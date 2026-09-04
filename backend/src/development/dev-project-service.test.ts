import assert from 'node:assert/strict';
import test from 'node:test';

import { DevProjectService } from './dev-project-service.js';

test('create requires a name and defaults status to planning', async () => {
  const created: unknown[] = [];
  const database = { devProject: { create: async (args: unknown) => { created.push(args); return { id: '1', ...(args as { data: object }).data }; } } } as never;
  const service = new DevProjectService(database);

  await assert.rejects(() => service.create({ name: '  ' }), /name/);

  await service.create({ name: 'Nexus Console' });
  const call = created[0] as { data: { name: string; status: string; members: string[] } };
  assert.equal(call.data.name, 'Nexus Console');
  assert.equal(call.data.status, 'planning');
  assert.deepEqual(call.data.members, []);
});

test('overview buckets projects by status', async () => {
  const rows = [
    { id: '1', status: 'development' },
    { id: '2', status: 'maintenance' },
    { id: '3', status: 'planning' },
    { id: '4', status: 'done' },
    { id: '5', status: 'archived' },
  ];
  const database = { devProject: { findMany: async () => rows } } as never;
  const overview = await new DevProjectService(database).overview();

  assert.deepEqual(overview.active.map((p) => p.id), ['1', '2']);
  assert.deepEqual(overview.waiting.map((p) => p.id), ['3']);
  assert.deepEqual(overview.done.map((p) => p.id), ['4']);
  assert.deepEqual(overview.archived.map((p) => p.id), ['5']);
});

test('dashboard returns placeholders for facets with no source yet, and null when the project is missing', async () => {
  const project = { id: 'p1', updatedAt: new Date('2026-01-01') };
  const database = {
    devProject: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'p1' ? project : null) },
    item: { findMany: async () => [{ status: 'in_progress', updatedAt: new Date('2026-02-01') }, { status: 'done', updatedAt: new Date('2026-01-15') }] },
  } as never;
  const service = new DevProjectService(database);

  const dashboard = await service.dashboard('p1');
  assert.ok(dashboard);
  assert.equal(dashboard?.progress.totalTasks, 2);
  assert.equal(dashboard?.progress.openTasks, 1);
  assert.equal(dashboard?.progress.percentDone, 50);
  assert.equal(dashboard?.lastRelease.available, false);
  assert.equal(dashboard?.lastRelease.summary, 'Non disponible');
  assert.equal(dashboard?.pipeline.summary, 'Non disponible');
  assert.equal(dashboard?.security.summary, 'Non disponible');

  assert.equal(await service.dashboard('missing'), null);
});
