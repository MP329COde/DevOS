export interface TimeService {
  history(itemId: string): Promise<unknown>;
  start(itemId: string): Promise<unknown>;
  stop(id: string): Promise<unknown>;
}

export async function handleTimeRequest(method: string, path: string, service: TimeService) {
  try {
    const history = path.match(/^\/api\/items\/([^/]+)\/time$/);
    if (method === 'GET' && history) return { status: 200, body: await service.history(history[1]) };
    if (method === 'POST' && history) return { status: 201, body: await service.start(history[1]) };
    const stop = path.match(/^\/api\/time\/([^/]+)\/stop$/);
    if (method === 'POST' && stop) return { status: 200, body: await service.stop(stop[1]) };
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid time request' } };
  }
}