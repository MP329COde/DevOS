import assert from 'node:assert/strict';
import test from 'node:test';

import { handleProfileRequest, type ProfileActor, type ProfileHttpService } from './profile-http.js';

const admin: ProfileActor = { role: 'Admin', userId: 'admin-1', email: 'admin@example.com' };

function service(overrides: Partial<ProfileHttpService> = {}): ProfileHttpService {
  return {
    listRoles: async () => [],
    createRole: async (input) => ({ id: 'r1', ...input }),
    updateRole: async (id, input) => ({ id, ...input }),
    deleteRole: async () => undefined,
    listProfiles: async () => [],
    getProfile: async () => null,
    getProfileByEmail: async () => null,
    createProfile: async (input) => ({ id: 'p1', ...input }),
    updateProfile: async (id, input) => ({ id, ...input }),
    deleteProfile: async () => undefined,
    listProjectPermissions: async () => [],
    setProjectPermission: async (input) => ({ id: 'pp1', ...input }),
    removeProjectPermission: async () => undefined,
    ...overrides,
  };
}

test('POST /api/roles requires a name', async () => {
  const result = await handleProfileRequest('POST', '/api/roles', {}, admin, service());
  assert.equal(result.status, 400);
});

test('POST /api/roles requires manage_users', async () => {
  const result = await handleProfileRequest('POST', '/api/roles', { name: 'Réseau' }, { role: 'Contributeur' }, service());
  assert.equal(result.status, 400);
});

test('POST /api/roles creates a role', async () => {
  const result = await handleProfileRequest('POST', '/api/roles', { name: 'Réseau', permissions: ['read'] }, admin, service());
  assert.equal(result.status, 201);
});

test('POST /api/profiles requires email and displayName', async () => {
  const result = await handleProfileRequest('POST', '/api/profiles', { displayName: 'Alice' }, admin, service());
  assert.equal(result.status, 400);
});

test('GET /api/profiles?email= routes to getProfileByEmail', async () => {
  const result = await handleProfileRequest('GET', '/api/profiles?email=a@b.c', undefined, undefined, service({
    getProfileByEmail: async (email) => (email === 'a@b.c' ? { id: 'p1' } : null),
  }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { id: 'p1' });
});

test('PATCH /api/profiles/:id changing roleId requires manage_users', async () => {
  const result = await handleProfileRequest('PATCH', '/api/profiles/u1', { roleId: 'admin-role' }, { role: 'Contributeur', userId: 'u1' }, service());
  assert.equal(result.status, 400);
});

test('PATCH /api/profiles/:id allows editing your own profile', async () => {
  const result = await handleProfileRequest('PATCH', '/api/profiles/u1', { displayName: 'Nouveau nom' }, { role: 'Contributeur', userId: 'u1' }, service());
  assert.equal(result.status, 200);
});

test('PATCH /api/profiles/:id rejects editing someone else\'s profile without manage_users', async () => {
  const result = await handleProfileRequest('PATCH', '/api/profiles/u2', { displayName: 'Nouveau nom' }, { role: 'Contributeur', userId: 'u1' }, service());
  assert.equal(result.status, 400);
});

test('PUT /api/dev-projects/:id/permissions sets a project permission', async () => {
  const result = await handleProfileRequest('PUT', '/api/dev-projects/proj1/permissions', { userProfileId: 'u1', roleId: 'r1' }, admin, service());
  assert.equal(result.status, 200);
});

test('PUT /api/dev-projects/:id/permissions rejects missing fields', async () => {
  const result = await handleProfileRequest('PUT', '/api/dev-projects/proj1/permissions', {}, admin, service());
  assert.equal(result.status, 400);
});

test('DELETE /api/dev-projects/:id/permissions/:userProfileId removes it', async () => {
  const result = await handleProfileRequest('DELETE', '/api/dev-projects/proj1/permissions/u1', undefined, admin, service());
  assert.equal(result.status, 204);
});

test('unknown route returns 404', async () => {
  const result = await handleProfileRequest('GET', '/api/unknown', undefined, undefined, service());
  assert.equal(result.status, 404);
});
