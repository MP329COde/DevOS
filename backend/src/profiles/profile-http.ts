import type { ProjectPermissionInput, RoleInput, UserProfileInput } from './profile-service.js';

export interface ProfileHttpService {
  listRoles(): Promise<unknown>;
  createRole(input: RoleInput): Promise<unknown>;
  updateRole(id: string, input: Partial<RoleInput>): Promise<unknown>;
  deleteRole(id: string): Promise<void>;
  listProfiles(): Promise<unknown>;
  getProfile(id: string): Promise<unknown>;
  getProfileByEmail(email: string): Promise<unknown>;
  createProfile(input: UserProfileInput): Promise<unknown>;
  updateProfile(id: string, input: Partial<UserProfileInput>): Promise<unknown>;
  deleteProfile(id: string): Promise<void>;
  listProjectPermissions(devProjectId: string): Promise<unknown>;
  setProjectPermission(input: ProjectPermissionInput): Promise<unknown>;
  removeProjectPermission(devProjectId: string, userProfileId: string): Promise<void>;
}

export interface ProfileHttpResponse {
  status: number;
  body: unknown;
}

/** Routes REST de la section AC : profils utilisateur (`/api/profiles`), rôles configurables
 * (`/api/roles`) et permissions par projet (`/api/dev-projects/:id/permissions`). */
export async function handleProfileRequest(method: string, url: string, body: unknown, service: ProfileHttpService): Promise<ProfileHttpResponse> {
  try {
    const [path, query] = url.split('?');
    const params = new URLSearchParams(query ?? '');

    // Rôles
    if (method === 'GET' && path === '/api/roles') return { status: 200, body: await service.listRoles() };
    if (method === 'POST' && path === '/api/roles') return { status: 201, body: await service.createRole(parseRoleInput(body)) };
    const roleOne = path.match(/^\/api\/roles\/([^/]+)$/);
    if (method === 'PATCH' && roleOne) return { status: 200, body: await service.updateRole(decodeURIComponent(roleOne[1]), parseRoleInput(body, true)) };
    if (method === 'DELETE' && roleOne) {
      await service.deleteRole(decodeURIComponent(roleOne[1]));
      return { status: 204, body: null };
    }

    // Profils
    if (method === 'GET' && path === '/api/profiles') {
      const email = params.get('email');
      if (email) {
        const found = await service.getProfileByEmail(email);
        return found ? { status: 200, body: found } : { status: 404, body: { error: 'Not found' } };
      }
      return { status: 200, body: await service.listProfiles() };
    }
    if (method === 'POST' && path === '/api/profiles') return { status: 201, body: await service.createProfile(parseProfileInput(body)) };
    const profileOne = path.match(/^\/api\/profiles\/([^/]+)$/);
    if (method === 'GET' && profileOne) {
      const found = await service.getProfile(decodeURIComponent(profileOne[1]));
      return found ? { status: 200, body: found } : { status: 404, body: { error: 'Not found' } };
    }
    if (method === 'PATCH' && profileOne) return { status: 200, body: await service.updateProfile(decodeURIComponent(profileOne[1]), parseProfileInput(body, true)) };
    if (method === 'DELETE' && profileOne) {
      await service.deleteProfile(decodeURIComponent(profileOne[1]));
      return { status: 204, body: null };
    }

    // Permissions par projet
    const projectPerms = path.match(/^\/api\/dev-projects\/([^/]+)\/permissions$/);
    if (method === 'GET' && projectPerms) return { status: 200, body: await service.listProjectPermissions(decodeURIComponent(projectPerms[1])) };
    if (method === 'PUT' && projectPerms) {
      const devProjectId = decodeURIComponent(projectPerms[1]);
      const b = (body ?? {}) as Record<string, unknown>;
      if (typeof b.userProfileId !== 'string' || !b.userProfileId) throw new Error('"userProfileId" is required');
      if (typeof b.roleId !== 'string' || !b.roleId) throw new Error('"roleId" is required');
      return { status: 200, body: await service.setProjectPermission({ devProjectId, userProfileId: b.userProfileId, roleId: b.roleId }) };
    }
    const projectPermOne = path.match(/^\/api\/dev-projects\/([^/]+)\/permissions\/([^/]+)$/);
    if (method === 'DELETE' && projectPermOne) {
      await service.removeProjectPermission(decodeURIComponent(projectPermOne[1]), decodeURIComponent(projectPermOne[2]));
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid profile request' } };
  }
}

function parseRoleInput(body: unknown, partial = false): RoleInput {
  if (!body || typeof body !== 'object') {
    if (partial) return {} as RoleInput;
    throw new Error('Missing role payload');
  }
  const b = body as Record<string, unknown>;
  if (!partial && (typeof b.name !== 'string' || !b.name.trim())) throw new Error('"name" is required');
  const input: RoleInput = {} as RoleInput;
  if (typeof b.name === 'string') input.name = b.name;
  if ('description' in b) input.description = (b.description as string | null) ?? null;
  if ('color' in b) input.color = (b.color as string | null) ?? null;
  if ('icon' in b) input.icon = (b.icon as string | null) ?? null;
  if (Array.isArray(b.permissions)) input.permissions = b.permissions.filter((p): p is string => typeof p === 'string');
  return input;
}

function parseProfileInput(body: unknown, partial = false): UserProfileInput {
  if (!body || typeof body !== 'object') {
    if (partial) return {} as UserProfileInput;
    throw new Error('Missing profile payload');
  }
  const b = body as Record<string, unknown>;
  if (!partial) {
    if (typeof b.email !== 'string' || !b.email.trim()) throw new Error('"email" is required');
    if (typeof b.displayName !== 'string' || !b.displayName.trim()) throw new Error('"displayName" is required');
  }
  const input: UserProfileInput = {} as UserProfileInput;
  if (typeof b.email === 'string') input.email = b.email;
  if (typeof b.displayName === 'string') input.displayName = b.displayName;
  if ('avatarEmoji' in b) input.avatarEmoji = (b.avatarEmoji as string | null) ?? null;
  if ('avatarColor' in b) input.avatarColor = (b.avatarColor as string | null) ?? null;
  if ('statusEmoji' in b) input.statusEmoji = (b.statusEmoji as string | null) ?? null;
  if ('statusMessage' in b) input.statusMessage = (b.statusMessage as string | null) ?? null;
  if (typeof b.availability === 'string') input.availability = b.availability as UserProfileInput['availability'];
  if ('availabilityUntil' in b) input.availabilityUntil = (b.availabilityUntil as string | null) ?? null;
  if ('themeMode' in b) input.themeMode = (b.themeMode as string | null) ?? null;
  if ('themeColors' in b) input.themeColors = (b.themeColors as Record<string, string> | null) ?? null;
  if ('profileBackground' in b) input.profileBackground = (b.profileBackground as string | null) ?? null;
  if ('roleId' in b) input.roleId = (b.roleId as string | null) ?? null;
  return input;
}
