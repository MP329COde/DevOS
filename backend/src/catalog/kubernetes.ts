export interface KubernetesClientOptions {
  apiServer: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface KubernetesPod {
  name: string;
  namespace: string;
  phase: string;
  node?: string;
}

export interface KubernetesDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
}

export interface KubernetesNode {
  name: string;
  ready: boolean;
}

interface K8sList<T> {
  items: T[];
}

/** Thin read-only client for the Kubernetes API server, authenticated via a bearer token (typically the mounted ServiceAccount token in-cluster). */
export class KubernetesClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: KubernetesClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listPods(namespace?: string): Promise<KubernetesPod[]> {
    const path = namespace ? `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods` : '/api/v1/pods';
    const list = await this.request<K8sList<{ metadata: { name: string; namespace: string }; spec?: { nodeName?: string }; status?: { phase?: string } }>>(path);
    return list.items.map((pod) => ({ name: pod.metadata.name, namespace: pod.metadata.namespace, phase: pod.status?.phase ?? 'Unknown', node: pod.spec?.nodeName }));
  }

  public async listDeployments(namespace?: string): Promise<KubernetesDeployment[]> {
    const path = namespace ? `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments` : '/apis/apps/v1/deployments';
    const list = await this.request<K8sList<{ metadata: { name: string; namespace: string }; spec?: { replicas?: number }; status?: { readyReplicas?: number } }>>(path);
    return list.items.map((deployment) => ({ name: deployment.metadata.name, namespace: deployment.metadata.namespace, replicas: deployment.spec?.replicas ?? 0, readyReplicas: deployment.status?.readyReplicas ?? 0 }));
  }

  public async listNodes(): Promise<KubernetesNode[]> {
    const list = await this.request<K8sList<{ metadata: { name: string }; status?: { conditions?: Array<{ type: string; status: string }> } }>>('/api/v1/nodes');
    return list.items.map((node) => ({ name: node.metadata.name, ready: node.status?.conditions?.some((condition) => condition.type === 'Ready' && condition.status === 'True') ?? false }));
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.options.apiServer}${path}`, { headers: { authorization: `Bearer ${this.options.token}` } });
    if (!response.ok) throw new Error(`Kubernetes API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
