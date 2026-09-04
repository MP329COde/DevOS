/**
 * Générateur V1 (volontairement simple, cf. TODO-refonte-2.md section AL) : détecte le
 * langage/framework principal d'un dépôt à partir de la seule liste des noms de fichiers présents
 * (jamais d'exécution ni d'analyse réelle du code), puis génère des manifests Kubernetes
 * (Deployment/Service/Ingress) et un ApplicationSet ArgoCD à partir de gabarits prédéfinis
 * paramétrés. Rien n'est poussé automatiquement : l'appelant décide séparément quoi faire du
 * résultat (mêmes principes que `catalog-template.ts`).
 */

export type DetectedProjectType = 'node' | 'python' | 'go' | 'java' | 'unknown';

/**
 * Détecte le type de projet dominant à partir des noms de fichiers présents à la racine (ou dans
 * l'arborescence) d'un dépôt. Ordre de priorité fixe et explicite en cas de dépôt polyglotte.
 */
export function detectProjectType(fileNames: string[]): DetectedProjectType {
  const names = new Set(fileNames.map((name) => name.split('/').pop() ?? name));

  if (names.has('package.json')) return 'node';
  if (names.has('go.mod')) return 'go';
  if (names.has('pom.xml') || names.has('build.gradle') || names.has('build.gradle.kts')) return 'java';
  if (names.has('requirements.txt') || names.has('pyproject.toml') || names.has('Pipfile')) return 'python';
  return 'unknown';
}

export interface DeploymentEnvironmentConfig {
  /** Nom de l'environnement, ex. "dev", "staging", "prod". */
  name: string;
  /** Namespace Kubernetes cible ; par défaut `<appName>-<environnement>`. */
  namespace?: string;
  /** Nombre de réplicas pour cet environnement ; par défaut la valeur globale. */
  replicas?: number;
  /** Nom de domaine pour l'Ingress de cet environnement (optionnel). */
  host?: string;
}

export interface GenerateDeploymentManifestsInput {
  /** Nom de l'application (utilisé comme nom des ressources Kubernetes). */
  appName: string;
  /** Image de conteneur (ex. registry.example.com/team/app:latest). */
  image: string;
  /** Port exposé par le conteneur et le Service. */
  port: number;
  /** Nombre de réplicas par défaut (peut être surchargé par environnement). */
  replicas?: number;
  /** Environnements à générer (dev/staging/prod...). Au moins un requis. */
  environments: DeploymentEnvironmentConfig[];
  /** Type de projet détecté, uniquement utilisé pour annoter les manifests générés. */
  projectType?: DetectedProjectType;
  /** URL du dépôt Git source, référencée dans l'ApplicationSet (source des manifests). */
  sourceRepoUrl?: string;
  /** Chemin dans le dépôt central où les manifests par environnement seront rangés. */
  manifestsPath?: string;
}

export interface GeneratedEnvironmentManifests {
  environment: string;
  namespace: string;
  deploymentYaml: string;
  serviceYaml: string;
  ingressYaml?: string;
}

export interface GenerateDeploymentManifestsResult {
  appName: string;
  projectType: DetectedProjectType;
  environments: GeneratedEnvironmentManifests[];
  applicationSetYaml: string;
}

const DEFAULT_REPLICAS = 1;

/** Construit les manifests Deployment/Service/Ingress + ApplicationSet ArgoCD à partir de gabarits prédéfinis. Fonction pure, aucun appel réseau. */
export function generateDeploymentManifests(input: GenerateDeploymentManifestsInput): GenerateDeploymentManifestsResult {
  const appName = input.appName.trim();
  if (!appName) throw new Error("Le nom de l'application est requis");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(appName)) {
    throw new Error("Le nom de l'application doit être un nom DNS valide (minuscules, chiffres, tirets)");
  }

  const image = input.image.trim();
  if (!image) throw new Error("L'image de conteneur est requise");

  if (!Number.isInteger(input.port) || input.port <= 0 || input.port > 65535) {
    throw new Error('Le port doit être un entier valide entre 1 et 65535');
  }

  if (!input.environments || input.environments.length === 0) {
    throw new Error('Au moins un environnement est requis');
  }

  const defaultReplicas = input.replicas && input.replicas > 0 ? input.replicas : DEFAULT_REPLICAS;
  const projectType = input.projectType ?? 'unknown';

  const environments = input.environments.map((env) => buildEnvironmentManifests(appName, image, input.port, defaultReplicas, projectType, env));

  const applicationSetYaml = buildApplicationSet(appName, input.environments, input.sourceRepoUrl, input.manifestsPath);

  return { appName, projectType, environments, applicationSetYaml };
}

function buildEnvironmentManifests(
  appName: string,
  image: string,
  port: number,
  defaultReplicas: number,
  projectType: DetectedProjectType,
  env: DeploymentEnvironmentConfig,
): GeneratedEnvironmentManifests {
  const environment = env.name.trim();
  if (!environment) throw new Error("Le nom de l'environnement est requis");
  const namespace = env.namespace?.trim() || `${appName}-${environment}`;
  const replicas = env.replicas && env.replicas > 0 ? env.replicas : defaultReplicas;
  const resourceName = `${appName}-${environment}`;

  const deploymentYaml = [
    'apiVersion: apps/v1',
    'kind: Deployment',
    'metadata:',
    `  name: ${resourceName}`,
    `  namespace: ${namespace}`,
    '  labels:',
    `    app: ${appName}`,
    `    environment: ${environment}`,
    `    devos.io/project-type: ${projectType}`,
    'spec:',
    `  replicas: ${replicas}`,
    '  selector:',
    '    matchLabels:',
    `      app: ${appName}`,
    `      environment: ${environment}`,
    '  template:',
    '    metadata:',
    '      labels:',
    `        app: ${appName}`,
    `        environment: ${environment}`,
    '    spec:',
    '      containers:',
    `        - name: ${appName}`,
    `          image: ${image}`,
    '          ports:',
    `            - containerPort: ${port}`,
    '',
  ].join('\n');

  const serviceYaml = [
    'apiVersion: v1',
    'kind: Service',
    'metadata:',
    `  name: ${resourceName}`,
    `  namespace: ${namespace}`,
    '  labels:',
    `    app: ${appName}`,
    `    environment: ${environment}`,
    'spec:',
    '  selector:',
    `    app: ${appName}`,
    `    environment: ${environment}`,
    '  ports:',
    `    - port: ${port}`,
    `      targetPort: ${port}`,
    '',
  ].join('\n');

  let ingressYaml: string | undefined;
  if (env.host?.trim()) {
    const host = env.host.trim();
    ingressYaml = [
      'apiVersion: networking.k8s.io/v1',
      'kind: Ingress',
      'metadata:',
      `  name: ${resourceName}`,
      `  namespace: ${namespace}`,
      'spec:',
      '  rules:',
      `    - host: ${host}`,
      '      http:',
      '        paths:',
      '          - path: /',
      '            pathType: Prefix',
      '            backend:',
      '              service:',
      `                name: ${resourceName}`,
      '                port:',
      `                  number: ${port}`,
      '',
    ].join('\n');
  }

  return { environment, namespace, deploymentYaml, serviceYaml, ingressYaml };
}

function buildApplicationSet(appName: string, environments: DeploymentEnvironmentConfig[], sourceRepoUrl: string | undefined, manifestsPath: string | undefined): string {
  const repoUrl = sourceRepoUrl?.trim() || '<URL_DU_DEPOT_CENTRAL>';
  const basePath = manifestsPath?.trim() || `apps/${appName}`;

  const lines = [
    'apiVersion: argoproj.io/v1alpha1',
    'kind: ApplicationSet',
    'metadata:',
    `  name: ${appName}`,
    'spec:',
    '  generators:',
    '    - list:',
    '        elements:',
    ...environments.flatMap((env) => {
      const environment = env.name.trim();
      const namespace = env.namespace?.trim() || `${appName}-${environment}`;
      return [`          - env: ${environment}`, `            namespace: ${namespace}`];
    }),
    '  template:',
    '    metadata:',
    `      name: '${appName}-{{env}}'`,
    '    spec:',
    `      project: default`,
    '      source:',
    `        repoURL: ${repoUrl}`,
    '        targetRevision: HEAD',
    `        path: '${basePath}/{{env}}'`,
    '      destination:',
    '        server: https://kubernetes.default.svc',
    '        namespace: \'{{namespace}}\'',
    '      syncPolicy:',
    '        automated:',
    '          prune: true',
    '          selfHeal: true',
    '',
  ];

  return lines.join('\n');
}
