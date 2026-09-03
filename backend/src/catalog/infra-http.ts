import type { ArgoCDApplication, ArgoCDSyncHistoryEntry } from './argocd.js';
import type { KubernetesDeployment, KubernetesNode, KubernetesPod } from './kubernetes.js';
import type { TrivyVulnerabilitySummary } from './harbor-trivy.js';

export interface InfraHttpService {
  listPods(namespace?: string): Promise<KubernetesPod[]>;
  listDeployments(namespace?: string): Promise<KubernetesDeployment[]>;
  listNodes(): Promise<KubernetesNode[]>;
  listArgoApplications(): Promise<ArgoCDApplication[]>;
  getArgoSyncHistory(name: string): Promise<ArgoCDSyncHistoryEntry[]>;
  getTrivySummary(project: string, repository: string, tag: string): Promise<TrivyVulnerabilitySummary | null>;
}

export interface InfraHttpResponse {
  status: number;
  body: unknown;
}

export async function handleInfraRequest(method: string, url: string, service: InfraHttpService): Promise<InfraHttpResponse> {
  const [path, query] = url.split('?');
  const params = new URLSearchParams(query ?? '');

  try {
    if (method !== 'GET') return { status: 404, body: { error: 'Not found' } };

    if (path === '/api/catalog/kubernetes/pods') return { status: 200, body: await service.listPods(params.get('namespace') ?? undefined) };
    if (path === '/api/catalog/kubernetes/deployments') return { status: 200, body: await service.listDeployments(params.get('namespace') ?? undefined) };
    if (path === '/api/catalog/kubernetes/nodes') return { status: 200, body: await service.listNodes() };

    if (path === '/api/catalog/argocd/applications') return { status: 200, body: await service.listArgoApplications() };
    const history = path.match(/^\/api\/catalog\/argocd\/applications\/([^/]+)\/history$/);
    if (history) return { status: 200, body: await service.getArgoSyncHistory(decodeURIComponent(history[1])) };

    const trivy = path.match(/^\/api\/catalog\/trivy\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (trivy) {
      const summary = await service.getTrivySummary(decodeURIComponent(trivy[1]), decodeURIComponent(trivy[2]), decodeURIComponent(trivy[3]));
      return summary === null ? { status: 404, body: { error: 'No Trivy scan available for this artifact yet' } } : { status: 200, body: summary };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid infra request' } };
  }
}
