import type { CreateWorkflowStatusInput, UpdateWorkflowStatusInput } from './workflow-service.js';

export interface WorkflowHttpService {
  list(scope?: string | null): Promise<unknown>;
  resolve(scope?: string | null): Promise<unknown>;
  create(input: CreateWorkflowStatusInput): Promise<unknown>;
  update(id: string, input: UpdateWorkflowStatusInput): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

export interface WorkflowHttpResponse {
  status: number;
  body: unknown;
}

/** Routage HTTP du workflow de statuts configurable (AM.5). `?scope=` filtre par projet. */
export async function handleWorkflowRequest(
  method: string,
  url: string,
  body: unknown,
  service: WorkflowHttpService,
): Promise<WorkflowHttpResponse> {
  try {
    const [path, query] = url.split('?');
    const params = new URLSearchParams(query ?? '');
    const scope = params.get('scope');

    if (method === 'GET' && path === '/api/workflow-statuses') return { status: 200, body: await service.list(scope) };
    if (method === 'GET' && path === '/api/workflow-statuses/resolve') return { status: 200, body: await service.resolve(scope) };
    if (method === 'POST' && path === '/api/workflow-statuses') return { status: 201, body: await service.create(parseCreate(body)) };

    const match = path.match(/^\/api\/workflow-statuses\/([^/]+)$/);
    if (!match) return { status: 404, body: { error: 'Not found' } };
    if (method === 'PATCH') return { status: 200, body: await service.update(match[1], parseUpdate(body)) };
    if (method === 'DELETE') {
      await service.delete(match[1]);
      return { status: 204, body: null };
    }
    return { status: 405, body: { error: 'Method not allowed' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return { status: 400, body: { error: message } };
  }
}

function parseCreate(body: unknown): CreateWorkflowStatusInput {
  if (!body || typeof body !== 'object') throw new Error('Invalid workflow status payload');
  const input = body as Record<string, unknown>;
  if (typeof input.key !== 'string' || typeof input.label !== 'string') {
    throw new Error('Workflow status key and label are required');
  }
  return {
    key: input.key,
    label: input.label,
    ...(typeof input.scope === 'string' ? { scope: input.scope } : {}),
    ...(typeof input.color === 'string' ? { color: input.color } : {}),
    ...(typeof input.order === 'number' ? { order: input.order } : {}),
    ...(typeof input.isDefault === 'boolean' ? { isDefault: input.isDefault } : {}),
    ...(typeof input.isFinal === 'boolean' ? { isFinal: input.isFinal } : {}),
  };
}

function parseUpdate(body: unknown): UpdateWorkflowStatusInput {
  if (!body || typeof body !== 'object') throw new Error('Invalid workflow status payload');
  const input = body as Record<string, unknown>;
  return {
    ...(typeof input.label === 'string' ? { label: input.label } : {}),
    ...(typeof input.color === 'string' ? { color: input.color } : {}),
    ...(typeof input.order === 'number' ? { order: input.order } : {}),
    ...(typeof input.isDefault === 'boolean' ? { isDefault: input.isDefault } : {}),
    ...(typeof input.isFinal === 'boolean' ? { isFinal: input.isFinal } : {}),
  };
}
