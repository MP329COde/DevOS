export interface DocsHttpService {
  list(): Promise<unknown>;
  get(id: string): Promise<unknown>;
  scan(): Promise<unknown>;
  link(docPageId: string, itemId: string): Promise<unknown>;
  unlink(docPageId: string, itemId: string): Promise<unknown>;
}

export interface DocsHttpResponse {
  status: number;
  body: unknown;
}

export async function handleDocsRequest(method: string, path: string, body: unknown, service: DocsHttpService): Promise<DocsHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/docs') return { status: 200, body: await service.list() };
    if (method === 'POST' && path === '/api/docs/scan') return { status: 202, body: await service.scan() };

    const page = path.match(/^\/api\/docs\/([^/]+)$/);
    if (method === 'GET' && page) {
      const found = await service.get(decodeURIComponent(page[1]));
      return found ? { status: 200, body: found } : { status: 404, body: { error: 'Not found' } };
    }

    const link = path.match(/^\/api\/docs\/([^/]+)\/links$/);
    if (method === 'POST' && link) {
      await service.link(decodeURIComponent(link[1]), parseItemId(body));
      return { status: 201, body: { accepted: true } };
    }

    const unlink = path.match(/^\/api\/docs\/([^/]+)\/links\/([^/]+)$/);
    if (method === 'DELETE' && unlink) {
      await service.unlink(decodeURIComponent(unlink[1]), decodeURIComponent(unlink[2]));
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid docs request' } };
  }
}

function parseItemId(body: unknown): string {
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).itemId !== 'string') throw new Error('itemId is required');
  return (body as Record<string, string>).itemId;
}
