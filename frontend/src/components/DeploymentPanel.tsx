import { useState, type FormEvent } from 'react';

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
      setError('Le nom de l’application, l’image et le port sont requis.');
      return;
    }
    if (environments.length === 0) {
      setError('Sélectionnez au moins un environnement.');
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
      setError((body as { error?: string }).error ?? 'La génération des manifests a échoué.');
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
        <h3>Générer des manifests de déploiement</h3>
        <p className="empty">
          Assistant V1 volontairement simple : le type de projet est détecté à partir des fichiers présents dans le dépôt source (ex. <code>package.json</code>, <code>go.mod</code>),
          sans exécuter ni analyser le code. Les manifests Kubernetes et l'ApplicationSet ArgoCD générés restent à copier manuellement — rien n'est poussé automatiquement.
        </p>
        <form className="new-item" onSubmit={(event) => void generate(event)}>
          <input aria-label="Projet source (GitLab/GitHub, optionnel)" placeholder="Projet source (ex. groupe/projet, optionnel)" value={sourceProject} onChange={(event) => setSourceProject(event.target.value)} />
          <input aria-label="Nom de l'application" placeholder="Nom de l'application (ex. mon-app)" value={appName} onChange={(event) => setAppName(event.target.value)} required />
          <input aria-label="Image de conteneur" placeholder="Image (ex. registry.example.com/team/mon-app:latest)" value={image} onChange={(event) => setImage(event.target.value)} required />
          <input aria-label="Port" type="number" placeholder="Port" value={port} onChange={(event) => setPort(event.target.value)} required />
          <input aria-label="Réplicas par défaut" type="number" placeholder="Réplicas par défaut" value={replicas} onChange={(event) => setReplicas(event.target.value)} />
          <fieldset className="deployment-environments">
            <legend>Environnements</legend>
            {DEFAULT_ENVIRONMENTS.map((def) => {
              const active = environments.find((env) => env.name === def.name);
              return (
                <label key={def.name} className="deployment-env-toggle">
                  <input type="checkbox" checked={Boolean(active)} onChange={() => toggleEnvironment(def.name)} />
                  <span>{def.name}</span>
                  {active && (
                    <input
                      aria-label={`Domaine pour ${def.name} (optionnel)`}
                      placeholder="Domaine (optionnel, active un Ingress)"
                      value={active.host}
                      onChange={(event) => setEnvironmentHost(def.name, event.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </fieldset>
          <button type="submit">Générer les manifests</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {result && (
        <section className="view-group deployment-result">
          <h3>Manifests générés — {result.appName} ({result.projectType})</h3>
          <p className="empty">Rien n'a été poussé vers un dépôt : copiez le contenu ci-dessous vers le dépôt central configuré dans Paramètres.</p>

          {result.environments.map((env) => (
            <div key={env.environment} className="deployment-manifest-group">
              <h4>{env.environment} (namespace {env.namespace})</h4>
              <ManifestBlock label={`Deployment — ${env.environment}`} yaml={env.deploymentYaml} copyKey={`deploy-${env.environment}`} copiedKey={copiedKey} onCopy={copy} />
              <ManifestBlock label={`Service — ${env.environment}`} yaml={env.serviceYaml} copyKey={`svc-${env.environment}`} copiedKey={copiedKey} onCopy={copy} />
              {env.ingressYaml && <ManifestBlock label={`Ingress — ${env.environment}`} yaml={env.ingressYaml} copyKey={`ingress-${env.environment}`} copiedKey={copiedKey} onCopy={copy} />}
            </div>
          ))}

          <ManifestBlock label="ApplicationSet ArgoCD" yaml={result.applicationSetYaml} copyKey="applicationset" copiedKey={copiedKey} onCopy={copy} />
        </section>
      )}
    </div>
  );
}

function ManifestBlock({ label, yaml, copyKey, copiedKey, onCopy }: { label: string; yaml: string; copyKey: string; copiedKey: string; onCopy: (key: string, text: string) => void }) {
  return (
    <div className="deployment-manifest-block">
      <div className="deployment-manifest-header">
        <strong>{label}</strong>
        <button type="button" onClick={() => onCopy(copyKey, yaml)}>{copiedKey === copyKey ? 'Copié !' : 'Copier'}</button>
      </div>
      <pre>{yaml}</pre>
    </div>
  );
}
