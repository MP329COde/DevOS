import { assertCan, type Role } from '../auth/permissions.js';

const NAME_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export interface SecretsHttpService {
  list(): Promise<string[]>;
  reveal(name: string): Promise<string>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}

export interface SecretsHttpResponse {
  status: number;
  body: unknown;
}

/**
 * Secret values only ever leave the server on an explicit GET .../reveal request — every other
 * response (list, write confirmation) carries names only, never the value itself.
 */
export async function handleSecretsRequest(method: string, path: string, body: unknown, role: Role | undefined, service: SecretsHttpService): Promise<SecretsHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/secrets') {
      if (!role) throw new Error('Authentication is required to list secrets');
      return { status: 200, body: { names: await service.list() } };
    }

    const revealMatch = path.match(/^\/api\/secrets\/([^/]+)\/reveal$/);
    if (method === 'GET' && revealMatch) {
      const name = requireValidName(revealMatch[1]);
      requireManageIntegrations(role);
      return { status: 200, body: { name, value: await service.reveal(name) } };
    }

    const nameMatch = path.match(/^\/api\/secrets\/([^/]+)$/);
    if (nameMatch) {
      const name = requireValidName(nameMatch[1]);
      if (method === 'PUT') {
        const value = parseValue(body);
        requireManageIntegrations(role);
        await service.set(name, value);
        return { status: 200, body: { name } };
      }
      if (method === 'DELETE') {
        requireManageIntegrations(role);
        await service.delete(name);
        return { status: 204, body: null };
      }
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid secrets request' } };
  }
}

function requireManageIntegrations(role: Role | undefined): void {
  if (!role) throw new Error('Authentication is required to manage secrets');
  assertCan(role, 'manage_integrations');
}

function requireValidName(rawName: string): string {
  const name = decodeURIComponent(rawName);
  if (!NAME_PATTERN.test(name)) throw new Error('Secret names must match [a-zA-Z0-9_-]{1,128}');
  return name;
}

function parseValue(body: unknown): string {
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).value !== 'string') {
    throw new Error('Secrets payload must contain a string "value"');
  }
  return (body as Record<string, unknown>).value as string;
}
