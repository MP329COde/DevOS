import type { Release } from '@prisma/client';

import type { ReleaseInput, ReleaseUpdateInput } from './release-service.js';

export interface ReleaseHttpService {
  list(devProjectId?: string): Promise<Release[]>;
  get(id: string): Promise<Release | null>;
  create(input: ReleaseInput): Promise<Release>;
  update(id: string, input: ReleaseUpdateInput): Promise<Release>;
  delete(id: string): Promise<void>;
  publish(id: string): Promise<Release>;
  associatedItems(id: string): Promise<unknown>;
}

export interface ReleaseHttpResponse {
  status: number;
  body: unknown;
}

/** Routes REST des versions/releases (section AM.6). Préfixe `/api/releases`. */
export async function handleReleaseRequest(method: string, url: string, body: unknown, service: ReleaseHttpService): Promise<ReleaseHttpResponse> {
  try {
    const [path, query] = url.split('?');

    if (method === 'GET' && path === '/api/releases') {
      const devProjectId = new URLSearchParams(query ?? '').get('devProjectId') ?? undefined;
      return { status: 200, body: await service.list(devProjectId) };
    }
    if (method === 'POST' && path === '/api/releases') return { status: 201, body: await service.create(parseCreate(body)) };

    const publish = path.match(/^\/api\/releases\/([^/]+)\/publish$/);
    if (method === 'POST' && publish) return { status: 200, body: await service.publish(decodeURIComponent(publish[1])) };

    const items = path.match(/^\/api\/releases\/([^/]+)\/items$/);
    if (method === 'GET' && items) return { status: 200, body: await service.associatedItems(decodeURIComponent(items[1])) };

    const one = path.match(/^\/api\/releases\/([^/]+)$/);
    if (method === 'GET' && one) {
      const found = await service.get(decodeURIComponent(one[1]));
      return found ? { status: 200, body: found } : { status: 404, body: { error: 'Not found' } };
    }
    if (method === 'PATCH' && one) return { status: 200, body: await service.update(decodeURIComponent(one[1]), parseUpdate(body)) };
    if (method === 'DELETE' && one) {
      await service.delete(decodeURIComponent(one[1]));
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid release request' } };
  }
}

function parseCreate(body: unknown): ReleaseInput {
  if (!body || typeof body !== 'object') throw new Error('Missing release payload');
  const b = body as Record<string, unknown>;
  if (typeof b.devProjectId !== 'string' || !b.devProjectId) throw new Error('"devProjectId" is required');
  if (typeof b.version !== 'string' || !b.version.trim()) throw new Error('"version" is required');
  return {
    devProjectId: b.devProjectId,
    version: b.version,
    ...(typeof b.name === 'string' ? { name: b.name } : {}),
    ...(typeof b.description === 'string' ? { description: b.description } : {}),
    ...(typeof b.state === 'string' ? { state: b.state as ReleaseInput['state'] } : {}),
    ...(typeof b.plannedAt === 'string' ? { plannedAt: b.plannedAt } : {}),
  };
}

function parseUpdate(body: unknown): ReleaseUpdateInput {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  const input: ReleaseUpdateInput = {};
  if (typeof b.version === 'string') input.version = b.version;
  if ('name' in b) input.name = (b.name as string | null) ?? null;
  if ('description' in b) input.description = (b.description as string | null) ?? null;
  if (typeof b.state === 'string') input.state = b.state as ReleaseInput['state'];
  if ('plannedAt' in b) input.plannedAt = (b.plannedAt as string | null) ?? null;
  return input;
}
