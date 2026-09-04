export interface MeilisearchClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface MeilisearchIndex {
  uid: string;
  primaryKey: string | null;
}

export interface MeilisearchSearchResult {
  hits: unknown[];
  estimatedTotalHits: number;
  processingTimeMs: number;
}

/** Thin client for a local Meilisearch HTTP API (Bearer-key authentication, homelab-local usage). */
export class MeilisearchClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: MeilisearchClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listIndexes(): Promise<MeilisearchIndex[]> {
    const response = await this.request<{ results: Array<{ uid: string; primaryKey: string | null }> }>('/indexes');
    return response.results.map((index) => ({ uid: index.uid, primaryKey: index.primaryKey }));
  }

  public async search(indexUid: string, query: string): Promise<MeilisearchSearchResult> {
    return this.request<MeilisearchSearchResult>(`/indexes/${indexUid}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: query }),
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${this.options.apiKey}`);
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) throw new Error(`Meilisearch API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
