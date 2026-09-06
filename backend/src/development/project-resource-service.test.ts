import assert from 'node:assert/strict';
import test from 'node:test';

import { ProjectResourceService } from './project-resource-service.js';

function makeDatabase(overrides: { resource?: Record<string, unknown>; project?: Record<string, unknown> } = {}) {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, args: unknown) => { (calls[name] ??= []).push(args); };
  const database = {
    devProject: {
      findUnique: async () => ({ id: 'p1' }),
      ...overrides.project,
    },
    projectResource: {
      findMany: async (args: unknown) => { record('findMany', args); return []; },
      create: async (args: unknown) => { record('create', args); return { id: 'r1', ...((args as { data: object }).data) }; },
      findUnique: async (args: unknown) => { record('findUnique', args); return { id: 'r1', devProjectId: 'p1' }; },
      delete: async (args: unknown) => { record('delete', args); return {}; },
      ...overrides.resource,
    },
  };
  return { database: database as never, calls };
}

test('listResources lists resources for a project', async () => {
  const { database, calls } = makeDatabase();
  const service = new ProjectResourceService(database);
  await service.listResources('p1');
  assert.deepEqual(calls.findMany[0], { where: { devProjectId: 'p1' }, orderBy: { createdAt: 'asc' } });
});

test('createResource requires name and type', async () => {
  const { database } = makeDatabase();
  const service = new ProjectResourceService(database);
  await assert.rejects(() => service.createResource('p1', { name: '', type: 'postgres' }));
  await assert.rejects(() => service.createResource('p1', { name: 'db', type: '' }));
});

test('createResource fails when the project does not exist', async () => {
  const { database } = makeDatabase({ project: { findUnique: async () => null } });
  const service = new ProjectResourceService(database);
  await assert.rejects(() => service.createResource('missing', { name: 'db', type: 'postgres' }));
});

test('createResource creates the resource', async () => {
  const { database, calls } = makeDatabase();
  const service = new ProjectResourceService(database);
  await service.createResource('p1', { name: 'db-main', type: 'postgres', host: 'db.internal' });
  const created = calls.create[0] as { data: { devProjectId: string; name: string; type: string; host: string | null } };
  assert.equal(created.data.devProjectId, 'p1');
  assert.equal(created.data.name, 'db-main');
  assert.equal(created.data.host, 'db.internal');
});

test('deleteResource rejects a resource that belongs to another project', async () => {
  const { database } = makeDatabase({ resource: { findUnique: async () => ({ id: 'r1', devProjectId: 'other' }) } });
  const service = new ProjectResourceService(database);
  await assert.rejects(() => service.deleteResource('p1', 'r1'));
});

test('deleteResource deletes the resource', async () => {
  const { database, calls } = makeDatabase();
  const service = new ProjectResourceService(database);
  await service.deleteResource('p1', 'r1');
  assert.deepEqual(calls.delete[0], { where: { id: 'r1' } });
});
