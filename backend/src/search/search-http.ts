import type { SearchResultItem } from './search-service.js';

export interface SearchHttpService {
  search(query: string, limit?: number): Promise<SearchResultItem[]>;
}

export interface SearchHttpResponse {
  status: number;
  body: unknown;
}

/** Route unique `GET /api/search?q=...` (barre de recherche du header). */
export async function handleSearchRequest(method: string, url: string, service: SearchHttpService): Promise<SearchHttpResponse> {
  try {
    if (method !== 'GET') return { status: 405, body: { error: 'Method not allowed' } };
    const [, query] = url.split('?');
    const params = new URLSearchParams(query ?? '');
    const q = params.get('q') ?? '';
    const results = await service.search(q);
    return { status: 200, body: { results } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid search request' } };
  }
}
