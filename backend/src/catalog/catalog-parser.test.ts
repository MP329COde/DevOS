import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { parseCatalogInfo } from './catalog-parser.js';

test('parses the repository catalog-info.yaml into two entities', () => {
  const raw = readFileSync(join(__dirname, '../../../catalog-info.yaml'), 'utf8');
  const entities = parseCatalogInfo(raw);
  assert.equal(entities.length, 2);
  assert.equal(entities[0].kind, 'Component');
  assert.equal(entities[0].metadata.name, 'devos');
  assert.deepEqual(entities[0].metadata.annotations, { 'devos.io/source': 'gitlab', 'devos.io/health-endpoint': '/health' });
  assert.deepEqual(entities[0].spec.dependsOn, ['resource:default/devos-postgres', 'resource:default/devos-redis']);
  assert.deepEqual(entities[0].spec.providesApis, ['devos-api']);
  assert.equal(entities[1].kind, 'API');
  assert.equal(entities[1].metadata.name, 'devos-api');
});

test('preserves unknown annotations without dropping them', () => {
  const raw = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: svc
  annotations:
    devos.io/known: yes
    some-tool.io/unrelated: value
spec:
  type: service
  lifecycle: production
  owner: user:default/someone
`;
  const [entity] = parseCatalogInfo(raw);
  assert.deepEqual(entity.metadata.annotations, { 'devos.io/known': 'yes', 'some-tool.io/unrelated': 'value' });
});

test('rejects a document missing an identity', () => {
  assert.throws(() => parseCatalogInfo('apiVersion: backstage.io/v1alpha1\nkind: Component\nspec:\n  type: service\n  lifecycle: production\n  owner: user:default/x\n'), /metadata.name/);
});

test('rejects a document missing spec.type/lifecycle/owner', () => {
  assert.throws(() => parseCatalogInfo('apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: svc\nspec: {}\n'), /spec.type/);
});

test('accepts multiple documents in a single file', () => {
  const raw = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: a
spec:
  type: service
  lifecycle: production
  owner: user:default/x
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: b
spec:
  type: service
  lifecycle: production
  owner: user:default/x
`;
  const entities = parseCatalogInfo(raw);
  assert.deepEqual(entities.map((entity) => entity.metadata.name), ['a', 'b']);
});

test('rejects malformed YAML', () => {
  assert.throws(() => parseCatalogInfo('apiVersion: [unclosed'), /not valid YAML/);
});
