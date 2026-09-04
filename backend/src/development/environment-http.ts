import type { Environment } from '@prisma/client';

import { assertCan, type Role } from '../auth/permissions.js';
import type { DeployInput, EnvironmentInput, EnvironmentUpdateInput } from './environment-service.js';

export interface EnvironmentHttpService {
  list(devProjectId?: string): Promise<Environment[]>;
  get(id: string): Promise<Environment | null>;
  create(input: EnvironmentInput): Promise<Environment>;
  update(id: string, input: EnvironmentUpdateInput): Promise<Environment>;
  delete(id: string): Promise<void>;
  deploy(id: string, input: DeployInput): Promise<Environment>;
}

export interface EnvironmentHttpResponse {
  status: number;
  body: unknown;
}

/**
 * Routes REST des environnements de déploiement (section AM.6). Préfixe `/api/environments`.
 * `POST /:id/deploy` sur un environnement `prod` (ou marqué `requiresApproval`) exige un rôle
 * habilité (`execute_infrastructure`) et un `confirm: true` explicite dans le corps — même
 * garde-fou que les actions Proxmox (section Q) pour toute action sensible en prod.
 */
export async function handleEnvironmentRequest(
  method: string,
  url: string,
  body: unknown,
  role: Role | undefined,
  service: EnvironmentHttpService,
): Promise<EnvironmentHttpResponse> {
  try {
    const [path, query] = url.split('?');

    if (method === 'GET' && path === '/api/environments') {
      const devProjectId = new URLSearchParams(query ?? '').get('devProjectId') ?? undefined;
      return { status: 200, body: await service.list(devProjectId) };
    }
    if (method === 'POST' && path === '/api/environments') return { status: 201, body: await service.create(parseCreate(body)) };

    const deploy = path.match(/^\/api\/environments\/([^/]+)\/deploy$/);
    if (method === 'POST' && deploy) {
      const id = decodeURIComponent(deploy[1]);
      const current = await service.get(id);
      if (!current) return { status: 404, body: { error: 'Not found' } };
      if (isSensitive(current)) {
        if (!role) return { status: 401, body: { error: 'Authentification requise pour déployer sur cet environnement' } };
        assertCan(role, 'execute_infrastructure');
        if (!isConfirmed(body)) {
          return { status: 409, body: { error: 'Confirmation explicite requise (confirm: true) avant de déployer sur cet environnement' } };
        }
      }
      return { status: 200, body: await service.deploy(id, parseDeploy(body)) };
    }

    const one = path.match(/^\/api\/environments\/([^/]+)$/);
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
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid environment request' } };
  }
}

function isSensitive(environment: Environment): boolean {
  return environment.kind === 'prod' || environment.requiresApproval;
}

function isConfirmed(body: unknown): boolean {
  return !!body && typeof body === 'object' && (body as Record<string, unknown>).confirm === true;
}

function parseDeploy(body: unknown): DeployInput {
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).version !== 'string') {
    throw new Error('"version" is required to deploy');
  }
  return { version: (body as Record<string, unknown>).version as string };
}

function parseCreate(body: unknown): EnvironmentInput {
  if (!body || typeof body !== 'object') throw new Error('Missing environment payload');
  const b = body as Record<string, unknown>;
  if (typeof b.devProjectId !== 'string' || !b.devProjectId) throw new Error('"devProjectId" is required');
  if (typeof b.name !== 'string' || !b.name.trim()) throw new Error('"name" is required');
  return {
    devProjectId: b.devProjectId,
    name: b.name,
    ...(typeof b.kind === 'string' ? { kind: b.kind as EnvironmentInput['kind'] } : {}),
    ...(typeof b.url === 'string' ? { url: b.url } : {}),
    ...(typeof b.expectedVersion === 'string' ? { expectedVersion: b.expectedVersion } : {}),
    ...(typeof b.requiresApproval === 'boolean' ? { requiresApproval: b.requiresApproval } : {}),
  };
}

function parseUpdate(body: unknown): EnvironmentUpdateInput {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  const input: EnvironmentUpdateInput = {};
  if (typeof b.name === 'string') input.name = b.name;
  if (typeof b.kind === 'string') input.kind = b.kind as EnvironmentUpdateInput['kind'];
  if ('url' in b) input.url = (b.url as string | null) ?? null;
  if (typeof b.status === 'string') input.status = b.status as EnvironmentUpdateInput['status'];
  if ('currentVersion' in b) input.currentVersion = (b.currentVersion as string | null) ?? null;
  if ('expectedVersion' in b) input.expectedVersion = (b.expectedVersion as string | null) ?? null;
  if ('pipelineStatus' in b) input.pipelineStatus = (b.pipelineStatus as string | null) ?? null;
  if ('lastError' in b) input.lastError = (b.lastError as string | null) ?? null;
  if (typeof b.requiresApproval === 'boolean') input.requiresApproval = b.requiresApproval;
  return input;
}
