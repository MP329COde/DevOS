import type { CreateItemInput, UpdateItemInput } from './item-service.js';

export interface ItemHttpService {
  list(): Promise<unknown>;
  create(input: CreateItemInput): Promise<unknown>;
  update(id: string, input: UpdateItemInput): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

export interface ItemHttpResponse {
  status: number;
  body: unknown;
}

export async function handleItemRequest(
  method: string,
  path: string,
  body: unknown,
  service: ItemHttpService,
): Promise<ItemHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/items') return { status: 200, body: await service.list() };
    if (method === 'POST' && path === '/api/items') return { status: 201, body: await service.create(parseCreate(body)) };

    const match = path.match(/^\/api\/items\/([^/]+)$/);
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

function parseCreate(body: unknown) {
  if (!body || typeof body !== 'object') throw new Error('Invalid item payload');
  const input = body as Record<string, unknown>;
  if (!['task', 'doc', 'goal'].includes(String(input.type)) || typeof input.title !== 'string') {
    throw new Error('Item type and title are required');
  }
  return {
    type: input.type as 'task' | 'doc' | 'goal',
    title: input.title,
    ...(Array.isArray(input.labels) ? { labels: input.labels.filter((label): label is string => typeof label === 'string') } : {}),
    ...(typeof input.dueAt === 'string' ? { dueAt: input.dueAt } : {}),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
  };
}

function parseUpdate(body: unknown) {
  if (!body || typeof body !== 'object') throw new Error('Invalid item payload');
  const input = body as Record<string, unknown>;
  return {
    ...(typeof input.title === 'string' ? { title: input.title } : {}),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(typeof input.status === 'string' ? { status: input.status } : {}),
  };
}