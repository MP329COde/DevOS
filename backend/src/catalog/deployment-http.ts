import { assertCan, type Role } from '../auth/permissions.js';
import type { TimelineEventInput } from '../development/timeline-event-service.js';
import type { DeploymentEnvironmentConfig, GenerateDeploymentManifestsResult } from './k8s-manifest-generator.js';

export interface DeploymentHttpService {
  /**
   * Détecte le type de projet à partir du dépôt source (via la liste de fichiers de son
   * arborescence) puis génère les manifests Kubernetes/ArgoCD. Ne pousse rien nulle part : le
   * résultat reste à copier manuellement par l'utilisateur (comme le générateur catalogue).
   */
  generate(input: GenerateDeploymentRequest): Promise<GenerateDeploymentManifestsResult>;
}

export interface GenerateDeploymentRequest {
  /** Identifiant du projet source (ex. "group/project" GitLab), utilisé pour la détection de type. */
  sourceProject?: string;
  appName: string;
  image: string;
  port: number;
  replicas?: number;
  environments: DeploymentEnvironmentConfig[];
}

export interface DeploymentHttpResponse {
  status: number;
  body: unknown;
}

export async function handleDeploymentRequest(
  method: string,
  path: string,
  body: unknown,
  role: Role | undefined,
  service: DeploymentHttpService,
  recordEvent?: (input: TimelineEventInput) => Promise<unknown>,
  actorEmail?: string,
): Promise<DeploymentHttpResponse> {
  try {
    if (method === 'POST' && path === '/api/deployment/generate') {
      if (!role) throw new Error('Authentication is required to generate deployment manifests');
      assertCan(role, 'create');
      const input = parseGenerateInput(body);
      const result = await service.generate(input);
      await recordEvent?.({
        type: 'manifest_updated',
        status: 'success',
        summary: `Manifests générés pour ${input.appName}`,
        actorEmail,
        pipelineRef: input.appName,
        metadata: { image: input.image, environments: input.environments.map((env) => env.name) },
      });
      return { status: 201, body: result };
    }
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid deployment request' } };
  }
}

function parseGenerateInput(body: unknown): GenerateDeploymentRequest {
  if (!body || typeof body !== 'object') throw new Error('Invalid request body');
  const input = body as Record<string, unknown>;

  const appName = input.appName;
  const image = input.image;
  const port = input.port;
  const environments = input.environments;

  if (typeof appName !== 'string' || typeof image !== 'string' || typeof port !== 'number') {
    throw new Error('appName, image and port are required');
  }
  if (!Array.isArray(environments) || environments.length === 0) {
    throw new Error('At least one environment is required');
  }

  const parsedEnvironments: DeploymentEnvironmentConfig[] = environments.map((entry) => {
    if (!entry || typeof entry !== 'object' || typeof (entry as Record<string, unknown>).name !== 'string') {
      throw new Error('Each environment requires a name');
    }
    const env = entry as Record<string, unknown>;
    return {
      name: env.name as string,
      namespace: typeof env.namespace === 'string' ? env.namespace : undefined,
      replicas: typeof env.replicas === 'number' ? env.replicas : undefined,
      host: typeof env.host === 'string' ? env.host : undefined,
    };
  });

  return {
    sourceProject: typeof input.sourceProject === 'string' ? input.sourceProject : undefined,
    appName,
    image,
    port,
    replicas: typeof input.replicas === 'number' ? input.replicas : undefined,
    environments: parsedEnvironments,
  };
}
