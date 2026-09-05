import { useState, type FormEvent } from 'react';
import { useStrings } from '../i18n/LanguageContext.js';

const strings = {
  fr: {
    appNameImagePortRequired: 'Le nom de l’application, l’image et le port sont requis.',
    selectAtLeastOneEnv: 'Sélectionnez au moins un environnement.',
    generationFailed: 'La génération des manifests a échoué.',
    generateTitle: 'Générer des manifests de déploiement',
    intro: (
      <>
        Assistant V1 volontairement simple : le type de projet est détecté à partir des fichiers présents dans le dépôt source (ex. <code>package.json</code>, <code>go.mod</code>),
        sans exécuter ni analyser le code. Les manifests Kubernetes et l'ApplicationSet ArgoCD générés restent à copier manuellement — rien n'est poussé automatiquement.
      </>
    ),
    sourceProjectLabel: 'Projet source (GitLab/GitHub, optionnel)',
    sourceProjectPlaceholder: 'Projet source (ex. groupe/projet, optionnel)',
    appNameLabel: "Nom de l'application",
    appNamePlaceholder: 'Nom de l’application (ex. mon-app)',
    imageLabel: 'Image de conteneur',
    imagePlaceholder: 'Image (ex. registry.example.com/team/mon-app:latest)',
    portLabel: 'Port',
    portPlaceholder: 'Port',
    replicasLabel: 'Réplicas par défaut',
    replicasPlaceholder: 'Réplicas par défaut',
    environmentsLegend: 'Environnements',
    domainAria: (env: string) => `Domaine pour ${env} (optionnel)`,
    domainPlaceholder: 'Domaine (optionnel, active un Ingress)',
    generateButton: 'Générer les manifests',
    generatedTitle: (appName: string, projectType: string) => `Manifests générés — ${appName} (${projectType})`,
    nothingPushed: "Rien n'a été poussé vers un dépôt : copiez le contenu ci-dessous vers le dépôt central configuré dans Paramètres.",
    envHeading: (environment: string, namespace: string) => `${environment} (namespace ${namespace})`,
    deploymentLabel: (environment: string) => `Deployment — ${environment}`,
    serviceLabel: (environment: string) => `Service — ${environment}`,
    ingressLabel: (environment: string) => `Ingress — ${environment}`,
    applicationSetLabel: 'ApplicationSet ArgoCD',
    copied: 'Copié !',
    copy: 'Copier',
  },
  en: {
    appNameImagePortRequired: 'The application name, image, and port are required.',
    selectAtLeastOneEnv: 'Select at least one environment.',
    generationFailed: 'Manifest generation failed.',
    generateTitle: 'Generate deployment manifests',
    intro: (
      <>
        Deliberately simple V1 assistant: the project type is detected from files present in the source repository (e.g. <code>package.json</code>, <code>go.mod</code>),
        without executing or analyzing the code. The generated Kubernetes manifests and ArgoCD ApplicationSet must still be copied manually — nothing is pushed automatically.
      </>
    ),
    sourceProjectLabel: 'Source project (GitLab/GitHub, optional)',
    sourceProjectPlaceholder: 'Source project (e.g. group/project, optional)',
    appNameLabel: 'Application name',
    appNamePlaceholder: 'Application name (e.g. my-app)',
    imageLabel: 'Container image',
    imagePlaceholder: 'Image (e.g. registry.example.com/team/my-app:latest)',
    portLabel: 'Port',
    portPlaceholder: 'Port',
    replicasLabel: 'Default replicas',
    replicasPlaceholder: 'Default replicas',
    environmentsLegend: 'Environments',
    domainAria: (env: string) => `Domain for ${env} (optional)`,
    domainPlaceholder: 'Domain (optional, enables an Ingress)',
    generateButton: 'Generate manifests',
    generatedTitle: (appName: string, projectType: string) => `Generated manifests — ${appName} (${projectType})`,
    nothingPushed: 'Nothing was pushed to a repository: copy the content below to the central repository configured in Settings.',
    envHeading: (environment: string, namespace: string) => `${environment} (namespace ${namespace})`,
    deploymentLabel: (environment: string) => `Deployment — ${environment}`,
    serviceLabel: (environment: string) => `Service — ${environment}`,
    ingressLabel: (environment: string) => `Ingress — ${environment}`,
    applicationSetLabel: 'ArgoCD ApplicationSet',
    copied: 'Copied!',
    copy: 'Copy',
  },
} as const;

interface EnvironmentDraft {
  name: string;
  host: string;
}

interface GeneratedEnvironment {
  environment: string;
  namespace: string;
  deploymentYaml: string;
  serviceYaml: string;
  ingressYaml?: string;
}

interface GenerateResult {
  appName: string;
  projectType: string;
  environments: GeneratedEnvironment[];
  applicationSetYaml: string;
}

const DEFAULT_ENVIRONMENTS: EnvironmentDraft[] = [
  { name: 'dev', host: '' },
  { name: 'staging', host: '' },
  { name: 'prod', host: '' },
];

/**
 * Panel "Déploiement" (section AL) : assistant V1 volontairement simple — détection du type de
 * projet via la liste de fichiers du dépôt source (jamais d'exécution ni d'analyse réelle du
 * code), génération de manifests Kubernetes/ArgoCD à partir de gabarits. Rien n'est poussé
 * automatiquement : les manifests générés restent à copier manuellement, éventuellement vers le
 * dépôt central configuré dans Paramètres.
 */
export function DeploymentPanel({ apiBase }: { apiBase: string }) {
  const s = useStrings(strings);
  const [sourceProject, setSourceProject] = useState('');
  const [appName, setAppName] = useState('');
  const [image, setImage] = useState('');
  const [port, setPort] = useState('8080');
  const [replicas, setReplicas] = useState('1');
  const [environments, setEnvironments] = useState<EnvironmentDraft[]>(DEFAULT_ENVIRONMENTS);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  function toggleEnvironment(name: string) {
    setEnvironments((current) => (current.some((env) => env.name === name) ? current.filter((env) => env.name !== name) : [...current, { name, host: '' }]));
  }

  function setEnvironmentHost(name: string, host: string) {
    setEnvironments((current) => current.map((env) => (env.name === name ? { ...env, host } : env)));
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    setError('');
    setResult(null);

    const portNumber = Number(port);
    const replicasNumber = Number(replicas);
    if (!appName.trim() || !image.trim() || !Number.isFinite(portNumber)) {
      setError(s.appNameImagePortRequired);
      return;
    }
    if (environments.length === 0) {
      setError(s.selectAtLeastOneEnv);
      return;
    }

    const response = await fetch(`${apiBase}/api/deployment/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceProject: sourceProject.trim() || undefined,
        appName: appName.trim(),
        image: image.trim(),
        port: portNumber,
        replicas: Number.isFinite(replicasNumber) && replicasNumber > 0 ? replicasNumber : undefined,
        environments: environments.map((env) => ({ name: env.name, host: env.host.trim() || undefined })),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? s.generationFailed);
      return;
    }
    setResult(await response.json());
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((current) => (current === key ? '' : current)), 1500);
    } catch {
      // Presse-papiers indisponible (ex. contexte non sécurisé) : l'utilisateur peut toujours sélectionner le texte manuellement.
    }
  }

  return (
    <div className="items deployment-panel">
      <section className="view-group deployment-form">
        <h3>{s.generateTitle}</h3>
        <p className="empty">
          {s.intro}
        </p>
        <form className="new-item" onSubmit={(event) => void generate(event)}>
          <input aria-label={s.sourceProjectLabel} placeholder={s.sourceProjectPlaceholder} value={sourceProject} onChange={(event) => setSourceProject(event.target.value)} />
          <input aria-label={s.appNameLabel} placeholder={s.appNamePlaceholder} value={appName} onChange={(event) => setAppName(event.target.value)} required />
          <input aria-label={s.imageLabel} placeholder={s.imagePlaceholder} value={image} onChange={(event) => setImage(event.target.value)} required />
          <input aria-label={s.portLabel} type="number" placeholder={s.portPlaceholder} value={port} onChange={(event) => setPort(event.target.value)} required />
          <input aria-label={s.replicasLabel} type="number" placeholder={s.replicasPlaceholder} value={replicas} onChange={(event) => setReplicas(event.target.value)} />
          <fieldset className="deployment-environments">
            <legend>{s.environmentsLegend}</legend>
            {DEFAULT_ENVIRONMENTS.map((def) => {
              const active = environments.find((env) => env.name === def.name);
              return (
                <label key={def.name} className="deployment-env-toggle">
                  <input type="checkbox" checked={Boolean(active)} onChange={() => toggleEnvironment(def.name)} />
                  <span>{def.name}</span>
                  {active && (
                    <input
                      aria-label={s.domainAria(def.name)}
                      placeholder={s.domainPlaceholder}
                      value={active.host}
                      onChange={(event) => setEnvironmentHost(def.name, event.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </fieldset>
          <button type="submit">{s.generateButton}</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {result && (
        <section className="view-group deployment-result">
          <h3>{s.generatedTitle(result.appName, result.projectType)}</h3>
          <p className="empty">{s.nothingPushed}</p>

          {result.environments.map((env) => (
            <div key={env.environment} className="deployment-manifest-group">
              <h4>{s.envHeading(env.environment, env.namespace)}</h4>
              <ManifestBlock label={s.deploymentLabel(env.environment)} yaml={env.deploymentYaml} copyKey={`deploy-${env.environment}`} copiedKey={copiedKey} onCopy={copy} copiedLabel={s.copied} copyLabel={s.copy} />
              <ManifestBlock label={s.serviceLabel(env.environment)} yaml={env.serviceYaml} copyKey={`svc-${env.environment}`} copiedKey={copiedKey} onCopy={copy} copiedLabel={s.copied} copyLabel={s.copy} />
              {env.ingressYaml && <ManifestBlock label={s.ingressLabel(env.environment)} yaml={env.ingressYaml} copyKey={`ingress-${env.environment}`} copiedKey={copiedKey} onCopy={copy} copiedLabel={s.copied} copyLabel={s.copy} />}
            </div>
          ))}

          <ManifestBlock label={s.applicationSetLabel} yaml={result.applicationSetYaml} copyKey="applicationset" copiedKey={copiedKey} onCopy={copy} copiedLabel={s.copied} copyLabel={s.copy} />
        </section>
      )}
    </div>
  );
}

function ManifestBlock({ label, yaml, copyKey, copiedKey, onCopy, copiedLabel, copyLabel }: { label: string; yaml: string; copyKey: string; copiedKey: string; onCopy: (key: string, text: string) => void; copiedLabel: string; copyLabel: string }) {
  return (
    <div className="deployment-manifest-block">
      <div className="deployment-manifest-header">
        <strong>{label}</strong>
        <button type="button" onClick={() => onCopy(copyKey, yaml)}>{copiedKey === copyKey ? copiedLabel : copyLabel}</button>
      </div>
      <pre>{yaml}</pre>
    </div>
  );
}
