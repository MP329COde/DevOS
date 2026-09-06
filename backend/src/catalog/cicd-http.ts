import { assertCan, type Role } from '../auth/permissions.js';
import type { TimelineEventInput } from '../development/timeline-event-service.js';
import type { GitLabPipelineDetail, GitLabPipelineJob } from '../integrations/gitlab-pipelines.js';
import type { ArgoCDSyncHistoryEntry } from './argocd.js';
import type { TrivyVulnerabilitySummary } from './harbor-trivy.js';

/** Sous-ensemble minimal de `DevProjectCiCdConfig` nécessaire pour résoudre les pipelines d'un projet. */
export interface RepoRef {
  id: string;
  role: string;
  name: string | null;
  repoIdentifier: string;
}

export interface RepositoryResolverService {
  listRepositories(devProjectId: string): Promise<RepoRef[]>;
}

export interface PipelinesByRepo {
  cicdConfigId: string;
  role: string;
  name: string | null;
  repoIdentifier: string;
  pipelines?: GitLabPipelineDetail[];
  error?: string;
}

/**
 * Résout les dépôts liés d'un `DevProject` (AM.7+, plusieurs dépôts possibles) puis récupère les
 * pipelines de chacun. Tolérant aux erreurs par dépôt : un dépôt en échec (provider mal
 * configuré, dépôt renommé...) n'empêche pas les autres de répondre.
 */
export async function resolveReposForDevProject(
  devProjectId: string,
  repositoryService: RepositoryResolverService,
  service: Pick<CiCdHttpService, 'listPipelines'>,
): Promise<PipelinesByRepo[]> {
  const repos = await repositoryService.listRepositories(devProjectId);
  return Promise.all(
    repos.map(async (repo): Promise<PipelinesByRepo> => {
      const base = { cicdConfigId: repo.id, role: repo.role, name: repo.name, repoIdentifier: repo.repoIdentifier };
      if (!service.listPipelines) return { ...base, error: 'GitLab (pipelines) is not configured' };
      try {
        return { ...base, pipelines: await service.listPipelines(repo.repoIdentifier) };
      } catch (error) {
        return { ...base, error: error instanceof Error ? error.message : 'Failed to fetch pipelines' };
      }
    }),
  );
}

/**
 * Endpoints CI/CD par projet (AM.7) : pipelines/étapes/logs/relance (GitLab), historique de
 * déploiement (ArgoCD, réutilisé tel quel — pas de rollback réel disponible côté ArgoCD en
 * lecture seule ici, seul l'historique de sync est exposé), sécurité images (Harbor/Trivy,
 * réutilisé tel quel). Chaque méthode est optionnelle : si son intégration n'est pas configurée,
 * la route renvoie 503 pour que le frontend affiche un message clair plutôt qu'une donnée inventée.
 */
export interface CiCdHttpService {
  listPipelines?(projectId: string): Promise<GitLabPipelineDetail[]>;
  getPipeline?(projectId: string, pipelineId: number): Promise<GitLabPipelineDetail>;
  listPipelineJobs?(projectId: string, pipelineId: number): Promise<GitLabPipelineJob[]>;
  getJobLog?(projectId: string, jobId: number): Promise<string>;
  retryPipeline?(projectId: string, pipelineId: number): Promise<GitLabPipelineDetail>;
  getDeploymentHistory?(appName: string): Promise<ArgoCDSyncHistoryEntry[]>;
  getSecuritySummary?(harborProject: string, repository: string, tag: string): Promise<TrivyVulnerabilitySummary | null>;
}

export interface CiCdHttpResponse {
  status: number;
  body: unknown;
}

export async function handleCiCdRequest(
  method: string,
  url: string,
  role: Role | undefined,
  service: CiCdHttpService,
  recordEvent?: (input: TimelineEventInput) => Promise<unknown>,
  actorEmail?: string,
  repositoryService?: RepositoryResolverService,
): Promise<CiCdHttpResponse> {
  const [path] = url.split('?');

  try {
    const byProject = path.match(/^\/api\/dev-cicd\/by-project\/([^/]+)\/pipelines$/);
    if (byProject && method === 'GET') {
      if (!repositoryService) return { status: 503, body: { error: 'Repository resolution is not configured' } };
      const results = await resolveReposForDevProject(decodeURIComponent(byProject[1]), repositoryService, service);
      return { status: 200, body: results };
    }

    const pipelines = path.match(/^\/api\/dev-cicd\/([^/]+)\/pipelines$/);
    if (pipelines && method === 'GET') {
      return call(service.listPipelines, 'GitLab (pipelines)', () => service.listPipelines!(decodeURIComponent(pipelines[1])));
    }

    const pipelineDetail = path.match(/^\/api\/dev-cicd\/([^/]+)\/pipelines\/(\d+)$/);
    if (pipelineDetail && method === 'GET') {
      return call(service.getPipeline, 'GitLab (pipelines)', () => service.getPipeline!(decodeURIComponent(pipelineDetail[1]), Number(pipelineDetail[2])));
    }

    const pipelineJobs = path.match(/^\/api\/dev-cicd\/([^/]+)\/pipelines\/(\d+)\/jobs$/);
    if (pipelineJobs && method === 'GET') {
      return call(service.listPipelineJobs, 'GitLab (pipelines)', () => service.listPipelineJobs!(decodeURIComponent(pipelineJobs[1]), Number(pipelineJobs[2])));
    }

    const jobLog = path.match(/^\/api\/dev-cicd\/([^/]+)\/jobs\/(\d+)\/log$/);
    if (jobLog && method === 'GET') {
      if (!service.getJobLog) return { status: 503, body: { error: 'GitLab (pipelines) is not configured' } };
      const log = await service.getJobLog(decodeURIComponent(jobLog[1]), Number(jobLog[2]));
      return { status: 200, body: { log } };
    }

    const retry = path.match(/^\/api\/dev-cicd\/([^/]+)\/pipelines\/(\d+)\/retry$/);
    if (retry && method === 'POST') {
      if (!role) throw new Error('Authentication is required to retry a pipeline');
      assertCan(role, 'execute_infrastructure');
      const projectId = decodeURIComponent(retry[1]);
      const pipelineId = Number(retry[2]);
      const result = await call(service.retryPipeline, 'GitLab (pipelines)', () => service.retryPipeline!(projectId, pipelineId));
      if (result.status === 200) {
        await recordEvent?.({
          type: 'pipeline_started',
          status: 'pending',
          summary: `Pipeline #${pipelineId} relancé (${projectId})`,
          actorEmail,
          pipelineRef: `${projectId}#${pipelineId}`,
        });
      }
      return result;
    }

    const deployments = path.match(/^\/api\/dev-cicd\/deployments\/([^/]+)$/);
    if (deployments && method === 'GET') {
      return call(service.getDeploymentHistory, 'ArgoCD', () => service.getDeploymentHistory!(decodeURIComponent(deployments[1])));
    }

    const security = path.match(/^\/api\/dev-cicd\/security\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (security && method === 'GET') {
      if (!service.getSecuritySummary) return { status: 503, body: { error: 'Harbor/Trivy is not configured' } };
      const summary = await service.getSecuritySummary(decodeURIComponent(security[1]), decodeURIComponent(security[2]), decodeURIComponent(security[3]));
      return summary === null ? { status: 404, body: { error: 'No Trivy scan available for this artifact yet' } } : { status: 200, body: summary };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid CI/CD request' } };
  }
}

async function call<T>(guard: unknown, name: string, run: () => Promise<T>): Promise<CiCdHttpResponse> {
  if (!guard) return { status: 503, body: { error: `${name} is not configured` } };
  return { status: 200, body: await run() };
}
