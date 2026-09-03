import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCatalogInfo } from './catalog-parser.js';
import { buildDependencyGraph } from './catalog-graph.js';

test('builds nodes and edges from dependsOn and providesApis of the repository catalog-info.yaml', () => {
  const raw = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: devos
spec:
  type: service
  lifecycle: experimental
  owner: user:default/matthew
  dependsOn:
    - resource:default/devos-postgres
    - resource:default/devos-redis
  providesApis:
    - devos-api
---
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: devos-api
spec:
  type: openapi
  lifecycle: experimental
  owner: user:default/matthew
`;
  const graph = buildDependencyGraph(parseCatalogInfo(raw));

  const ids = graph.nodes.map((node) => node.id).sort();
  assert.deepEqual(ids, ['api:default/devos-api', 'component:default/devos', 'resource:default/devos-postgres', 'resource:default/devos-redis']);

  const devosApi = graph.nodes.find((node) => node.id === 'api:default/devos-api');
  assert.equal(devosApi?.known, true, 'the API entity was scanned, so it must be marked known');

  const postgres = graph.nodes.find((node) => node.id === 'resource:default/devos-postgres');
  assert.equal(postgres?.known, false, 'the resource was only referenced, never scanned as its own entity');

  assert.deepEqual(
    graph.edges.sort((a, b) => a.to.localeCompare(b.to)),
    [
      { from: 'component:default/devos', to: 'api:default/devos-api' },
      { from: 'component:default/devos', to: 'resource:default/devos-postgres' },
      { from: 'component:default/devos', to: 'resource:default/devos-redis' },
    ],
  );
});

test('treats a bare dependency name as a component reference', () => {
  const raw = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: a
spec:
  type: service
  lifecycle: production
  owner: user:default/x
  dependsOn:
    - b
`;
  const graph = buildDependencyGraph(parseCatalogInfo(raw));
  assert.deepEqual(graph.edges, [{ from: 'component:default/a', to: 'component:default/b' }]);
});

test('returns an empty graph for an empty entity list', () => {
  assert.deepEqual(buildDependencyGraph([]), { nodes: [], edges: [] });
});
