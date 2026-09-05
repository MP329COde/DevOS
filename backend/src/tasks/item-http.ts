import type { CreateItemInput, ListItemsFilter, UpdateItemInput } from './item-service.js';

export interface ItemHttpService {
  list(filter?: ListItemsFilter): Promise<unknown>;
  create(input: CreateItemInput): Promise<unknown>;
  update(id: string, input: UpdateItemInput): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

const ITEM_TYPES = ['task', 'doc', 'goal', 'note', 'bug'] as const;

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
    if (method === 'GET' && path.startsWith('/api/items') && !path.match(/^\/api\/items\/[^/]+$/)) {
      const url = new URL(path, 'http://localhost');
      const type = url.searchParams.get('type') ?? undefined;
      const devProjectId = url.searchParams.get('devProjectId') ?? undefined;
      return { status: 200, body: await service.list({ type, devProjectId }) };
    }
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
  if (!ITEM_TYPES.includes(String(input.type) as typeof ITEM_TYPES[number]) || typeof input.title !== 'string') {
    throw new Error('Item type and title are required');
  }
  return {
    type: input.type as typeof ITEM_TYPES[number],
    title: input.title,
    ...(Array.isArray(input.labels) ? { labels: input.labels.filter((label): label is string => typeof label === 'string') } : {}),
    ...(typeof input.dueAt === 'string' ? { dueAt: input.dueAt } : {}),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(typeof input.content === 'string' ? { content: input.content } : {}),
    ...(typeof input.devProjectId === 'string' ? { devProjectId: input.devProjectId } : {}),
    ...(typeof input.severity === 'string' ? { severity: input.severity as CreateItemInput['severity'] } : {}),
    ...(typeof input.environment === 'string' ? { environment: input.environment } : {}),
    ...(typeof input.versionAffected === 'string' ? { versionAffected: input.versionAffected } : {}),
    ...(typeof input.expectedBehavior === 'string' ? { expectedBehavior: input.expectedBehavior } : {}),
    ...(typeof input.observedBehavior === 'string' ? { observedBehavior: input.observedBehavior } : {}),
    ...(typeof input.reproSteps === 'string' ? { reproSteps: input.reproSteps } : {}),
    ...(typeof input.logs === 'string' ? { logs: input.logs } : {}),
    ...(Array.isArray(input.screenshots) ? { screenshots: input.screenshots.filter((s): s is string => typeof s === 'string') } : {}),
    ...(typeof input.releaseRef === 'string' ? { releaseRef: input.releaseRef } : {}),
    ...(typeof input.commitRef === 'string' ? { commitRef: input.commitRef } : {}),
  };
}

function parseUpdate(body: unknown) {
  if (!body || typeof body !== 'object') throw new Error('Invalid item payload');
  const input = body as Record<string, unknown>;
  return {
    ...(typeof input.title === 'string' ? { title: input.title } : {}),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(typeof input.content === 'string' ? { content: input.content } : {}),
    ...(typeof input.status === 'string' ? { status: input.status } : {}),
    ...(typeof input.required === 'boolean' ? { required: input.required } : {}),
    ...('releaseId' in input ? { releaseId: (input.releaseId as string | null) ?? null } : {}),
    ...(typeof input.severity === 'string' ? { severity: input.severity as UpdateItemInput['severity'] } : {}),
    ...(typeof input.environment === 'string' ? { environment: input.environment } : {}),
    ...(typeof input.versionAffected === 'string' ? { versionAffected: input.versionAffected } : {}),
    ...(typeof input.expectedBehavior === 'string' ? { expectedBehavior: input.expectedBehavior } : {}),
    ...(typeof input.observedBehavior === 'string' ? { observedBehavior: input.observedBehavior } : {}),
    ...(typeof input.reproSteps === 'string' ? { reproSteps: input.reproSteps } : {}),
    ...(typeof input.logs === 'string' ? { logs: input.logs } : {}),
    ...(Array.isArray(input.screenshots) ? { screenshots: input.screenshots.filter((s): s is string => typeof s === 'string') } : {}),
    ...(typeof input.releaseRef === 'string' ? { releaseRef: input.releaseRef } : {}),
    ...(typeof input.commitRef === 'string' ? { commitRef: input.commitRef } : {}),
  };
}