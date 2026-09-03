export interface CycleService {
  list(): Promise<unknown>;
  create(input: { name: string; startsAt: string; endsAt: string }): Promise<unknown>;
  close(id: string): Promise<unknown>;
}

export async function handleCycleRequest(method: string, path: string, body: unknown, service: CycleService) {
  try {
    if (method === 'GET' && path === '/api/cycles') return { status: 200, body: await service.list() };
    if (method === 'POST' && path === '/api/cycles') return { status: 201, body: await service.create(parseCycle(body)) };
    const match = path.match(/^\/api\/cycles\/([^/]+)\/close$/);
    if (method === 'POST' && match) return { status: 200, body: await service.close(match[1]) };
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid cycle' } };
  }
}

function parseCycle(body: unknown) {
  if (!body || typeof body !== 'object') throw new Error('Invalid cycle payload');
  const input = body as Record<string, unknown>;
  if (typeof input.name !== 'string' || typeof input.startsAt !== 'string' || typeof input.endsAt !== 'string') {
    throw new Error('Cycle name and dates are required');
  }
  return { name: input.name, startsAt: input.startsAt, endsAt: input.endsAt };
}