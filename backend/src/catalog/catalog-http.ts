export interface CatalogHttpService {
  list(): Promise<unknown>;
  graph(): Promise<unknown>;
  scan(): Promise<unknown>;
}

export interface CatalogHttpResponse {
  status: number;
  body: unknown;
}

export async function handleCatalogRequest(method: string, path: string, service: CatalogHttpService): Promise<CatalogHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/catalog/entities') return { status: 200, body: await service.list() };
    if (method === 'GET' && path === '/api/catalog/graph') return { status: 200, body: await service.graph() };
    if (method === 'POST' && path === '/api/catalog/scan') return { status: 202, body: await service.scan() };
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid catalog request' } };
  }
}
