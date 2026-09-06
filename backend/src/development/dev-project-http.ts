import { assertCan, type Role } from '../auth/permissions.js';
import type { DevProjectDashboard, DevProjectInput } from './dev-project-service.js';

export interface DevProjectHttpService {
  list(): Promise<unknown>;
  get(id: string): Promise<unknown>;
  create(input: DevProjectInput): Promise<unknown>;
  update(id: string, input: Partial<DevProjectInput>): Promise<unknown>;
  delete(id: string): Promise<void>;
  overview(search?: string): Promise<unknown>;
  dashboard(id: string): Promise<DevProjectDashboard | null>;
}

export interface DevProjectHttpResponse {
  status: number;
  body: unknown;
}

/** Routes REST du module Développement — fondation AM.1. Préfixe `/api/dev-projects`. */
export async function handleDevProjectRequest(method: string, url: string, body: unknown, role: Role | undefined, service: DevProjectHttpService): Promise<DevProjectHttpResponse> {
  try {
    const [path, query] = url.split('?');

    if (method === 'GET' && path === '/api/dev-projects') return { status: 200, body: await service.list() };
    if (method === 'POST' && path === '/api/dev-projects') {
      requireRole(role, 'create');
      return { status: 201, body: await service.create(parseInput(body)) };
    }

    if (method === 'GET' && path === '/api/dev-projects/overview') {
      const search = new URLSearchParams(query ?? '').get('search') ?? undefined;
      return { status: 200, body: await service.overview(search) };
    }

    const dashboard = path.match(/^\/api\/dev-projects\/([^/]+)\/dashboard$/);
    if (method === 'GET' && dashboard) {
      const found = await service.dashboard(decodeURIComponent(dashboard[1]));
      return found ? { status: 200, body: found } : { status: 404, body: { error: 'Not found' } };
    }

    const one = path.match(/^\/api\/dev-projects\/([^/]+)$/);
    if (method === 'GET' && one) {
      const found = await service.get(decodeURIComponent(one[1]));
      return found ? { status: 200, body: found } : { status: 404, body: { error: 'Not found' } };
    }
    if (method === 'PATCH' && one) {
      requireRole(role, 'update');
      return { status: 200, body: await service.update(decodeURIComponent(one[1]), parseInput(body, true)) };
    }
    if (method === 'DELETE' && one) {
      requireRole(role, 'delete');
      await service.delete(decodeURIComponent(one[1]));
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid dev project request' } };
  }
}

function requireRole(role: Role | undefined, action: Parameters<typeof assertCan>[1]): void {
  if (!role) throw new Error('Authentication is required to manage development projects');
  assertCan(role, action);
}

function parseInput(body: unknown, partial = false): DevProjectInput {
  if (!body || typeof body !== 'object') {
    if (partial) return {} as DevProjectInput;
    throw new Error('Missing dev project payload');
  }
  const b = body as Record<string, unknown>;
  if (!partial && (typeof b.name !== 'string' || !b.name.trim())) throw new Error('"name" is required');
  const input: DevProjectInput = {} as DevProjectInput;
  if (typeof b.name === 'string') input.name = b.name;
  if ('description' in b) input.description = (b.description as string | null) ?? null;
  if (typeof b.status === 'string') input.status = b.status as DevProjectInput['status'];
  if ('owner' in b) input.owner = (b.owner as string | null) ?? null;
  if (Array.isArray(b.members)) input.members = b.members.filter((m): m is string => typeof m === 'string');
  if ('plannedStartAt' in b) input.plannedStartAt = (b.plannedStartAt as string | null) ?? null;
  if ('plannedEndAt' in b) input.plannedEndAt = (b.plannedEndAt as string | null) ?? null;
  if ('deliveryGoal' in b) input.deliveryGoal = (b.deliveryGoal as string | null) ?? null;
  if ('templateId' in b) input.templateId = (b.templateId as string | null) ?? null;
  return input;
}
