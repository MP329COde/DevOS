export interface ArgoCDClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface ArgoCDApplication {
  name: string;
  syncStatus: string;
  healthStatus: string;
}

export interface ArgoCDSyncHistoryEntry {
  id: number;
  revision: string;
  deployedAt: string;
}

/** Thin read-only client for the ArgoCD API (Applications status and sync history). */
export class ArgoCDClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: ArgoCDClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listApplications(): Promise<ArgoCDApplication[]> {
    const response = await this.request<{ items: Array<{ metadata: { name: string }; status?: { sync?: { status?: string }; health?: { status?: string } } }> }>('/api/v1/applications');
    return response.items.map((app) => ({ name: app.metadata.name, syncStatus: app.status?.sync?.status ?? 'Unknown', healthStatus: app.status?.health?.status ?? 'Unknown' }));
  }

  public async getSyncHistory(name: string): Promise<ArgoCDSyncHistoryEntry[]> {
    const response = await this.request<{ status?: { history?: Array<{ id: number; revision: string; deployedAt: string }> } }>(`/api/v1/applications/${encodeURIComponent(name)}`);
    return response.status?.history ?? [];
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { headers: { authorization: `Bearer ${this.options.token}` } });
    if (!response.ok) throw new Error(`ArgoCD API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
