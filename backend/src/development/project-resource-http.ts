import { assertCan, type Role } from '../auth/permissions.js';
import type { ProjectResourceInput } from './project-resource-service.js';

export interface ProjectResourceHttpService {
  listResources(devProjectId: string): Promise<unknown>;
  createResource(devProjectId: string, input: ProjectResourceInput): Promise<unknown>;
  deleteResource(devProjectId: string, resourceId: string): Promise<void>;
}

export interface ProjectResourceHttpResponse {
  status: number;
  body: unknown;
}

/**
 * Routes REST des ressources externes d'un projet (AM.7+). Préfixe
 * `/api/dev-projects/:id/resources`, à monter dans server.ts AVANT le bloc générique
 * `/api/dev-projects` (même contrainte que `/permissions` et `/repositories`).
 */
export async function handleProjectResourceRequest(
  method: string,
  url: string,
  body: unknown,
  role: Role | undefined,
  service: ProjectResourceHttpService,
): Promise<ProjectResourceHttpResponse> {
  try {
    const [path] = url.split('?');

    const list = path.match(/^\/api\/dev-projects\/([^/]+)\/resources$/);
    if (list && method === 'GET') {
      return { status: 200, body: await service.listResources(decodeURIComponent(list[1])) };
    }
    if (list && method === 'POST') {
      requireRole(role, 'update');
      const created = await service.createResource(decodeURIComponent(list[1]), parseInput(body));
      return { status: 201, body: created };
    }

    const one = path.match(/^\/api\/dev-projects\/([^/]+)\/resources\/([^/]+)$/);
    if (one && method === 'DELETE') {
      requireRole(role, 'update');
      await service.deleteResource(decodeURIComponent(one[1]), decodeURIComponent(one[2]));
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid project resource request' } };
  }
}

function requireRole(role: Role | undefined, action: Parameters<typeof assertCan>[1]): void {
  if (!role) throw new Error('Authentication is required to manage project resources');
  assertCan(role, action);
}

function parseInput(body: unknown): ProjectResourceInput {
  if (!body || typeof body !== 'object') throw new Error('Missing project resource payload');
  const b = body as Record<string, unknown>;
  if (typeof b.name !== 'string' || !b.name.trim()) throw new Error('"name" is required');
  if (typeof b.type !== 'string' || !b.type.trim()) throw new Error('"type" is required');
  return {
    name: b.name,
    type: b.type,
    host: typeof b.host === 'string' ? b.host : null,
    note: typeof b.note === 'string' ? b.note : null,
  };
}
