import assert from 'node:assert/strict';
import test from 'node:test';

import { DevTemplateService } from './dev-template-service.js';

function makeDatabase(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, args: unknown) => { (calls[name] ??= []).push(args); };
  const database = {
    devTemplate: {
      findMany: async (args: unknown) => { record('findMany', args); return []; },
      findUnique: async (args: unknown) => { record('findUnique', args); return null; },
      create: async (args: unknown) => { record('create', args); return { id: 'new-id', ...((args as { data: object }).data) }; },
      update: async (args: unknown) => { record('update', args); return { id: (args as { where: { id: string } }).where.id, ...((args as { data: object }).data) }; },
      updateMany: async (args: unknown) => { record('updateMany', args); return { count: 0 }; },
      delete: async (args: unknown) => { record('delete', args); return { id: (args as { where: { id: string } }).where.id }; },
      ...overrides,
    },
  };
  return { database: database as never, calls };
}

test('create requires a non-empty name and type', async () => {
  const { database } = makeDatabase();
  const service = new DevTemplateService(database);
  await assert.rejects(() => service.create({ name: '  ', type: 'api' }));
  await assert.rejects(() => service.create({ name: 'API service', type: '' }));
});

test('create defaults version to 1.0.0 and stores dependencies/technologies/environments', async () => {
  const { database, calls } = makeDatabase();
  const service = new DevTemplateService(database);
  await service.create({
    name: 'API Node/Express',
    type: 'api',
    technologies: ['Node.js', 'Express'],
    dependencies: [{ name: 'express', version: '4.19.2' }],
    environments: ['dev', 'staging', 'prod'],
    integrableTools: ['gitlab-ci', 'sonarqube'],
    generatedItems: ['Dockerfile', '.gitlab-ci.yml'],
  });
  const created = calls.create[0] as { data: { version: string; dependencies: unknown } };
  assert.equal(created.data.version, '1.0.0');
  assert.deepEqual(created.data.dependencies, [{ name: 'express', version: '4.19.2' }]);
});

test('create clears the previous default when isDefault is set', async () => {
  const { database, calls } = makeDatabase();
  const service = new DevTemplateService(database);
  await service.create({ name: 'API', type: 'api', isDefault: true });
  assert.deepEqual(calls.updateMany[0], { where: { isDefault: true }, data: { isDefault: false } });
});

test('setActive toggles active without touching other fields', async () => {
  const { database, calls } = makeDatabase();
  const service = new DevTemplateService(database);
  await service.setActive('tpl-1', false);
  assert.deepEqual(calls.update[0], { where: { id: 'tpl-1' }, data: { active: false } });
});

test('setDefault clears previous default then sets the new one', async () => {
  const { database, calls } = makeDatabase();
  const service = new DevTemplateService(database);
  await service.setDefault('tpl-2');
  assert.deepEqual(calls.updateMany[0], { where: { isDefault: true }, data: { isDefault: false } });
  assert.deepEqual(calls.update[0], { where: { id: 'tpl-2' }, data: { isDefault: true } });
});

test('createNewVersion fails when the source template does not exist', async () => {
  const { database } = makeDatabase();
  const service = new DevTemplateService(database);
  await assert.rejects(() => service.createNewVersion('missing', '2.0.0'));
});

test('createNewVersion creates a new row carrying previousVersionId and inherited fields', async () => {
  const { database, calls } = makeDatabase({
    findUnique: async () => ({
      id: 'tpl-1', name: 'API', type: 'api', description: 'desc', technologies: ['Node.js'],
      dependencies: [{ name: 'express', version: '4.19.2' }], version: '1.0.0',
      environments: ['dev'], integrableTools: [], generatedItems: [], isDefault: false, active: true,
    }),
  });
  const service = new DevTemplateService(database);
  await service.createNewVersion('tpl-1', '2.0.0', { technologies: ['Node.js', 'TypeScript'] });
  const created = calls.create[0] as { data: { previousVersionId: string; version: string; technologies: string[] } };
  assert.equal(created.data.previousVersionId, 'tpl-1');
  assert.equal(created.data.version, '2.0.0');
  assert.deepEqual(created.data.technologies, ['Node.js', 'TypeScript']);
});

test('list orders default-first then by name', async () => {
  const { database, calls } = makeDatabase();
  const service = new DevTemplateService(database);
  await service.list(false);
  assert.deepEqual(calls.findMany[0], { where: { active: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
});
