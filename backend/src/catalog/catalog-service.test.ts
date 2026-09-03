import assert from 'node:assert/strict';
import test from 'node:test';

import { CatalogService } from './catalog-service.js';

test('sync upserts each entity by kind and name', async () => {
  const upserts: unknown[] = [];
  const database = { catalogEntity: { upsert: async (args: unknown) => { upserts.push(args); return {}; } } } as never;

  await new CatalogService(database).sync([
    { apiVersion: 'v1', kind: 'Component', metadata: { name: 'devos', annotations: {}, links: [] }, spec: { type: 'service', lifecycle: 'experimental', owner: 'user:default/x', dependsOn: ['resource:default/pg'], providesApis: ['devos-api'] }, sourceProject: 'root/devos' },
  ]);

  assert.equal(upserts.length, 1);
  const call = upserts[0] as { where: unknown; create: { name: string; dependsOn: string[] } };
  assert.deepEqual(call.where, { kind_name: { kind: 'Component', name: 'devos' } });
  assert.equal(call.create.name, 'devos');
  assert.deepEqual(call.create.dependsOn, ['resource:default/pg']);
});

test('graph() builds a dependency graph from the persisted entities', async () => {
  const database = {
    catalogEntity: {
      findMany: async () => [{
        kind: 'Component', name: 'devos', description: null, type: 'service', lifecycle: 'experimental', owner: 'user:default/x', system: null,
        dependsOn: ['resource:default/pg'], providesApis: [], annotations: {}, links: [],
      }],
    },
  } as never;

  const graph = await new CatalogService(database).graph();
  assert.deepEqual(graph.edges, [{ from: 'component:default/devos', to: 'resource:default/pg' }]);
});
