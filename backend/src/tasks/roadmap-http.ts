import type { RoadmapData } from './roadmap-service.js';

export interface RoadmapHttpService {
  get(): Promise<RoadmapData>;
}

export interface RoadmapHttpResponse {
  status: number;
  body: unknown;
}

export async function handleRoadmapRequest(method: string, path: string, service: RoadmapHttpService): Promise<RoadmapHttpResponse> {
  if (method === 'GET' && path === '/api/roadmap') return { status: 200, body: await service.get() };
  return { status: 404, body: { error: 'Not found' } };
}
