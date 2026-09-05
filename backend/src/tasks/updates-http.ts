import { assertCan, type Role } from '../auth/permissions.js';
import type { UpdateCheckResult } from '../integrations/update-checker.js';
import type { UpdateApplyResult, UpdateMechanism } from '../integrations/update-apply-service.js';

export interface UpdateStatusResponse extends UpdateCheckResult {
  /** Which mechanism `POST /api/updates/apply` would use — lets the UI disable the button when none is configured. */
  mechanism: UpdateMechanism;
}

export interface UpdatesHttpService {
  getStatus(): Promise<UpdateStatusResponse>;
  applyUpdate(role: Role): Promise<UpdateApplyResult>;
  rollback(role: Role): Promise<UpdateApplyResult>;
}

export interface UpdatesHttpResponse {
  status: number;
  body: unknown;
}

export async function handleUpdatesRequest(method: string, path: string, role: Role | undefined, service: UpdatesHttpService): Promise<UpdatesHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/updates/status') {
      return { status: 200, body: await service.getStatus() };
    }

    if (method === 'POST' && path === '/api/updates/apply') {
      const result = await service.applyUpdate(requireRole(role));
      return { status: result.triggered ? 202 : 200, body: result };
    }

    if (method === 'POST' && path === '/api/updates/rollback') {
      const result = await service.rollback(requireRole(role));
      return { status: result.triggered ? 202 : 200, body: result };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid update request' } };
  }
}

function requireRole(role: Role | undefined): Role {
  if (!role) throw new Error('Authentication is required to manage platform updates');
  assertCan(role, 'execute_infrastructure');
  return role;
}
