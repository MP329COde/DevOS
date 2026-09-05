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

  /** Reads the revision ArgoCD is currently synced to for the given Application. */
  public async getCurrentRevision(name: string): Promise<string | null> {
    const response = await this.request<{ status?: { sync?: { revision?: string } } }>(`/api/v1/applications/${encodeURIComponent(name)}`);
    return response.status?.sync?.revision ?? null;
  }

  /**
   * Triggers a sync of the given Application (ArgoCD API: POST /api/v1/applications/{name}/sync).
   * When `revision` is omitted, ArgoCD syncs to the target revision already configured on the
   * Application (typically the tracked branch/tag HEAD) — used both for "update to latest" and,
   * with an explicit prior revision, for rollback.
   */
  public async syncApplication(name: string, revision?: string): Promise<void> {
    await this.request(`/api/v1/applications/${encodeURIComponent(name)}/sync`, {
      method: 'POST',
      body: JSON.stringify(revision ? { revision } : {}),
    });
  }

  private async request<T>(path: string, init?: { method?: string; body?: string }): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: { authorization: `Bearer ${this.options.token}`, 'content-type': 'application/json' },
      body: init?.body,
    });
    if (!response.ok) throw new Error(`ArgoCD API request failed (${response.status})`);
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
