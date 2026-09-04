import assert from 'node:assert/strict';
import test from 'node:test';

import { ProfileService } from './profile-service.js';

test('ensureSystemRoles upserts the three historical roles marked isSystem', async () => {
  const upserts: unknown[] = [];
  const database = { role: { upsert: async (args: unknown) => { upserts.push(args); return args; } } } as never;
  await new ProfileService(database).ensureSystemRoles();
  const names = (upserts as Array<{ where: { name: string } }>).map((u) => u.where.name);
  assert.deepEqual(names.sort(), ['Admin', 'Contributeur', 'Lecteur']);
  for (const u of upserts as Array<{ create: { isSystem: boolean } }>) assert.equal(u.create.isSystem, true);
});

test('createRole requires a name', async () => {
  const database = { role: { create: async (args: unknown) => args } } as never;
  await assert.rejects(() => new ProfileService(database).createRole({ name: '  ' }), /name/);
});

test('updateRole refuses to rename a system role', async () => {
  const database = { role: { findUnique: async () => ({ id: 'r1', name: 'Admin', isSystem: true }) } } as never;
  await assert.rejects(() => new ProfileService(database).updateRole('r1', { name: 'SuperAdmin' }), /système/);
});

test('deleteRole refuses to delete a system role but allows a custom one', async () => {
  const deleted: string[] = [];
  const database = {
    role: {
      findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'r1' ? { id: 'r1', isSystem: true } : { id: 'r2', isSystem: false }),
      delete: async ({ where }: { where: { id: string } }) => { deleted.push(where.id); },
    },
  } as never;
  const service = new ProfileService(database);
  await assert.rejects(() => service.deleteRole('r1'), /système/);
  await service.deleteRole('r2');
  assert.deepEqual(deleted, ['r2']);
});

test('createProfile requires email and displayName', async () => {
  const database = { userProfile: { create: async (args: unknown) => args } } as never;
  const service = new ProfileService(database);
  await assert.rejects(() => service.createProfile({ email: '', displayName: 'A' }), /email/);
  await assert.rejects(() => service.createProfile({ email: 'a@b.c', displayName: '' }), /displayName/);
});

test('createProfile defaults availability to available', async () => {
  let captured: { data: { availability: string } } | undefined;
  const database = { userProfile: { create: async (args: unknown) => { captured = args as never; return args; } } } as never;
  await new ProfileService(database).createProfile({ email: 'a@b.c', displayName: 'Alice' });
  assert.equal(captured?.data.availability, 'available');
});

test('setProjectPermission upserts by devProjectId+userProfileId', async () => {
  let captured: unknown;
  const database = { projectPermission: { upsert: async (args: unknown) => { captured = args; return args; } } } as never;
  await new ProfileService(database).setProjectPermission({ devProjectId: 'p1', userProfileId: 'u1', roleId: 'r1' });
  const args = captured as { where: { devProjectId_userProfileId: { devProjectId: string; userProfileId: string } } };
  assert.deepEqual(args.where.devProjectId_userProfileId, { devProjectId: 'p1', userProfileId: 'u1' });
});
