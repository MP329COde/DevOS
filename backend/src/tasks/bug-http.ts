import type { CreateBugInput, UpdateBugInput } from './bug-service.js';

export interface BugHttpService {
  list(filter?: { devProjectId?: string; status?: string }): Promise<unknown>;
  get(id: string): Promise<unknown>;
  create(input: CreateBugInput): Promise<unknown>;
  update(id: string, input: UpdateBugInput): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

export interface BugHttpResponse {
  status: number;
  body: unknown;
}

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

/** Routage HTTP du modèle Bug (AM.5) : CRUD simple, cohérent avec `item-http.ts`. */
export async function handleBugRequest(
  method: string,
  url: string,
  body: unknown,
  service: BugHttpService,
): Promise<BugHttpResponse> {
  try {
    const [path, query] = url.split('?');
    if (method === 'GET' && path === '/api/bugs') {
      const params = new URLSearchParams(query ?? '');
      const devProjectId = params.get('devProjectId') ?? undefined;
      const status = params.get('status') ?? undefined;
      return { status: 200, body: await service.list({ devProjectId, status }) };
    }
    if (method === 'POST' && path === '/api/bugs') return { status: 201, body: await service.create(parseCreate(body)) };

    const match = path.match(/^\/api\/bugs\/([^/]+)$/);
    if (!match) return { status: 404, body: { error: 'Not found' } };
    if (method === 'GET') {
      const bug = await service.get(match[1]);
      return bug ? { status: 200, body: bug } : { status: 404, body: { error: 'Bug not found' } };
    }
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

function parseCreate(body: unknown): CreateBugInput {
  if (!body || typeof body !== 'object') throw new Error('Invalid bug payload');
  const input = body as Record<string, unknown>;
  if (typeof input.title !== 'string' || !input.title.trim()) throw new Error('Bug title is required');
  if (input.severity !== undefined && !SEVERITIES.includes(String(input.severity))) throw new Error('Invalid bug severity');
  return {
    title: input.title,
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(typeof input.severity === 'string' ? { severity: input.severity as CreateBugInput['severity'] } : {}),
    ...(typeof input.environment === 'string' ? { environment: input.environment } : {}),
    ...(typeof input.versionAffected === 'string' ? { versionAffected: input.versionAffected } : {}),
    ...(typeof input.expectedBehavior === 'string' ? { expectedBehavior: input.expectedBehavior } : {}),
    ...(typeof input.observedBehavior === 'string' ? { observedBehavior: input.observedBehavior } : {}),
    ...(typeof input.reproSteps === 'string' ? { reproSteps: input.reproSteps } : {}),
    ...(typeof input.logs === 'string' ? { logs: input.logs } : {}),
    ...(Array.isArray(input.screenshots) ? { screenshots: input.screenshots.filter((v): v is string => typeof v === 'string') } : {}),
    ...(typeof input.releaseRef === 'string' ? { releaseRef: input.releaseRef } : {}),
    ...(typeof input.commitRef === 'string' ? { commitRef: input.commitRef } : {}),
    ...(typeof input.itemId === 'string' ? { itemId: input.itemId } : {}),
    ...(typeof input.devProjectId === 'string' ? { devProjectId: input.devProjectId } : {}),
  };
}

function parseUpdate(body: unknown): UpdateBugInput {
  if (!body || typeof body !== 'object') throw new Error('Invalid bug payload');
  const input = body as Record<string, unknown>;
  if (input.severity !== undefined && !SEVERITIES.includes(String(input.severity))) throw new Error('Invalid bug severity');
  return {
    ...(typeof input.title === 'string' ? { title: input.title } : {}),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(typeof input.severity === 'string' ? { severity: input.severity as UpdateBugInput['severity'] } : {}),
    ...(typeof input.status === 'string' ? { status: input.status } : {}),
    ...(typeof input.environment === 'string' ? { environment: input.environment } : {}),
    ...(typeof input.versionAffected === 'string' ? { versionAffected: input.versionAffected } : {}),
    ...(typeof input.expectedBehavior === 'string' ? { expectedBehavior: input.expectedBehavior } : {}),
    ...(typeof input.observedBehavior === 'string' ? { observedBehavior: input.observedBehavior } : {}),
    ...(typeof input.reproSteps === 'string' ? { reproSteps: input.reproSteps } : {}),
    ...(typeof input.logs === 'string' ? { logs: input.logs } : {}),
    ...(Array.isArray(input.screenshots) ? { screenshots: input.screenshots.filter((v): v is string => typeof v === 'string') } : {}),
    ...(typeof input.releaseRef === 'string' ? { releaseRef: input.releaseRef } : {}),
    ...(typeof input.commitRef === 'string' ? { commitRef: input.commitRef } : {}),
    ...(input.itemId === null ? { itemId: null } : typeof input.itemId === 'string' ? { itemId: input.itemId } : {}),
    ...(input.devProjectId === null ? { devProjectId: null } : typeof input.devProjectId === 'string' ? { devProjectId: input.devProjectId } : {}),
  };
}
