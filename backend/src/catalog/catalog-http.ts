export interface CatalogHttpService {
  list(): Promise<unknown>;
  graph(): Promise<unknown>;
  scan(): Promise<unknown>;
  createFromTemplate?(templateKind: string, templateName: string, input: { name: string; owner?: string; description?: string }): Promise<unknown>;
}

export interface CatalogHttpResponse {
  status: number;
  body: unknown;
}

export async function handleCatalogRequest(method: string, path: string, body: unknown, service: CatalogHttpService): Promise<CatalogHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/catalog/entities') return { status: 200, body: await service.list() };
    if (method === 'GET' && path === '/api/catalog/graph') return { status: 200, body: await service.graph() };
    if (method === 'POST' && path === '/api/catalog/scan') return { status: 202, body: await service.scan() };
    if (method === 'POST' && path === '/api/catalog/template') {
      if (!service.createFromTemplate) return { status: 503, body: { error: 'Project creation from template is not configured' } };
      const input = parseTemplateInput(body);
      const result = await service.createFromTemplate(input.templateKind, input.templateName, input);
      return { status: 201, body: result };
    }
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid catalog request' } };
  }
}

function parseTemplateInput(body: unknown): { templateKind: string; templateName: string; name: string; owner?: string; description?: string } {
  if (!body || typeof body !== 'object') throw new Error('Invalid request body');
  const input = body as Record<string, unknown>;
  const templateKind = input.templateKind;
  const templateName = input.templateName;
  const name = input.name;
  if (typeof templateKind !== 'string' || typeof templateName !== 'string' || typeof name !== 'string') {
    throw new Error('templateKind, templateName and name are required');
  }
  return {
    templateKind,
    templateName,
    name,
    owner: typeof input.owner === 'string' ? input.owner : undefined,
    description: typeof input.description === 'string' ? input.description : undefined,
  };
}
