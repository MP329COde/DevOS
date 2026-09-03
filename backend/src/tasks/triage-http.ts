import type { TriageStatus } from './triage.js';

export interface TriageService {
  listPending(): Promise<unknown>;
  transition(id: string, status: 'accepted' | 'rejected'): Promise<unknown>;
}

export async function handleTriageRequest(method: string, path: string, service: TriageService) {
  try {
    if (method === 'GET' && path === '/api/triage') return { status: 200, body: await service.listPending() };
    const match = path.match(/^\/api\/triage\/([^/]+)\/(accept|reject)$/);
    if (method === 'POST' && match) return { status: 200, body: await service.transition(match[1], match[2] === 'accept' ? 'accepted' : 'rejected') };
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid triage request' } };
  }
}