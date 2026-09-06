import { assertCan, type Role } from '../auth/permissions.js';
import type { RepoRef } from './cicd-http.js';
import type { CreateRepoInput, LinkRepoInput } from './repository-service.js';

export interface RepositoryHttpService {
  listRepositories(devProjectId: string): Promise<RepoRef[]>;
  linkExistingRepo(devProjectId: string, input: LinkRepoInput, actorEmail?: string): Promise<unknown>;
  createRepoAndLink(devProjectId: string, input: CreateRepoInput, actorEmail?: string): Promise<unknown>;
  unlinkRepo(devProjectId: string, cicdConfigId: string): Promise<void>;
}

export interface RepositoryHttpResponse {
  status: number;
  body: unknown;
}

/**
 * Routes REST de gestion des dépôts liés à un projet (AM.7+). Préfixe
 * `/api/dev-projects/:id/repositories`, à monter dans server.ts AVANT le bloc générique
 * `/api/dev-projects` (même contrainte que `/permissions`, voir le commentaire dans server.ts).
 */
export async function handleRepositoryRequest(
  method: string,
  url: string,
  body: unknown,
  role: Role | undefined,
  actorEmail: string | undefined,
  service: RepositoryHttpService,
): Promise<RepositoryHttpResponse> {
  try {
    const [path] = url.split('?');

    const list = path.match(/^\/api\/dev-projects\/([^/]+)\/repositories$/);
    if (list && method === 'GET') {
      return { status: 200, body: await service.listRepositories(decodeURIComponent(list[1])) };
    }
    if (list && method === 'POST') {
      requireRole(role, 'update');
      const devProjectId = decodeURIComponent(list[1]);
      const created = await service.linkExistingRepo(devProjectId, parseLinkInput(body), actorEmail);
      return { status: 201, body: created };
    }

    const create = path.match(/^\/api\/dev-projects\/([^/]+)\/repositories\/create$/);
    if (create && method === 'POST') {
      requireRole(role, 'update');
      const devProjectId = decodeURIComponent(create[1]);
      const created = await service.createRepoAndLink(devProjectId, parseCreateInput(body), actorEmail);
      return { status: 201, body: created };
    }

    const one = path.match(/^\/api\/dev-projects\/([^/]+)\/repositories\/([^/]+)$/);
    if (one && method === 'DELETE') {
      requireRole(role, 'update');
      await service.unlinkRepo(decodeURIComponent(one[1]), decodeURIComponent(one[2]));
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid repository request' } };
  }
}

function requireRole(role: Role | undefined, action: Parameters<typeof assertCan>[1]): void {
  if (!role) throw new Error('Authentication is required to manage repositories');
  assertCan(role, action);
}

function parseLinkInput(body: unknown): LinkRepoInput {
  if (!body || typeof body !== 'object') throw new Error('Missing repository payload');
  const b = body as Record<string, unknown>;
  if (b.provider !== 'gitlab' && b.provider !== 'github') throw new Error('"provider" must be "gitlab" or "github"');
  if (typeof b.repoIdentifier !== 'string' || !b.repoIdentifier.trim()) throw new Error('"repoIdentifier" is required');
  if (typeof b.role !== 'string' || !b.role.trim()) throw new Error('"role" is required');
  if (typeof b.vaultSecretName !== 'string' || !b.vaultSecretName.trim()) throw new Error('"vaultSecretName" is required');
  return {
    provider: b.provider,
    repoIdentifier: b.repoIdentifier,
    role: b.role,
    vaultSecretName: b.vaultSecretName,
    name: typeof b.name === 'string' ? b.name : null,
    webUrl: typeof b.webUrl === 'string' ? b.webUrl : null,
    defaultBranch: typeof b.defaultBranch === 'string' ? b.defaultBranch : null,
    argoAppName: typeof b.argoAppName === 'string' ? b.argoAppName : null,
    harborProject: typeof b.harborProject === 'string' ? b.harborProject : null,
    harborRepo: typeof b.harborRepo === 'string' ? b.harborRepo : null,
  };
}

function parseCreateInput(body: unknown): CreateRepoInput {
  if (!body || typeof body !== 'object') throw new Error('Missing repository payload');
  const b = body as Record<string, unknown>;
  if (b.provider !== 'gitlab' && b.provider !== 'github') throw new Error('"provider" must be "gitlab" or "github"');
  if (typeof b.name !== 'string' || !b.name.trim()) throw new Error('"name" is required');
  if (typeof b.role !== 'string' || !b.role.trim()) throw new Error('"role" is required');
  if (typeof b.vaultSecretName !== 'string' || !b.vaultSecretName.trim()) throw new Error('"vaultSecretName" is required');
  return { provider: b.provider, name: b.name, role: b.role, vaultSecretName: b.vaultSecretName };
}
