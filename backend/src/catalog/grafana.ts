export interface GrafanaClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface GrafanaDashboard {
  uid: string;
  title: string;
  url?: string;
}

export interface GrafanaPanel {
  id: number;
  title?: string;
  type?: string;
}

export interface GrafanaDashboardDetail {
  uid: string;
  title: string;
  panels: GrafanaPanel[];
}

/** Thin read-only client for the Grafana HTTP API, authenticated via an API key (Authorization: Bearer). */
export class GrafanaClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: GrafanaClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listDashboards(): Promise<GrafanaDashboard[]> {
    const results = await this.request<Array<{ uid: string; title: string; url?: string }>>('/api/search?type=dash-db');
    return results.map((result) => ({ uid: result.uid, title: result.title, url: result.url }));
  }

  public async getDashboard(uid: string): Promise<GrafanaDashboardDetail> {
    const result = await this.request<{ dashboard: { uid: string; title: string; panels?: Array<{ id: number; title?: string; type?: string }> } }>(
      `/api/dashboards/uid/${encodeURIComponent(uid)}`,
    );
    return {
      uid: result.dashboard.uid,
      title: result.dashboard.title,
      panels: (result.dashboard.panels ?? []).map((panel) => ({ id: panel.id, title: panel.title, type: panel.type })),
    };
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { headers: { authorization: `Bearer ${this.options.apiKey}` } });
    if (!response.ok) throw new Error(`Grafana API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}

/** Builds the d-solo embed URL for a single Grafana panel, for embedding in an iframe. */
export function buildEmbedUrl(baseUrl: string, dashboardUid: string, panelId: number, options?: { theme?: 'light' | 'dark' }): string {
  const params = new URLSearchParams({ panelId: String(panelId), theme: options?.theme ?? 'light' });
  return `${baseUrl}/d-solo/${encodeURIComponent(dashboardUid)}?${params.toString()}`;
}
