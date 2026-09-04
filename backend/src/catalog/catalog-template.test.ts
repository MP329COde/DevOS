import assert from 'node:assert/strict';
import test from 'node:test';

import { createProjectFromTemplate } from './catalog-template.js';
import type { CatalogEntity } from './catalog-parser.js';

const template: CatalogEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'template-service', description: 'Template de base', annotations: { 'devos.io/source': 'gitlab' }, links: [] },
  spec: { type: 'service', lifecycle: 'experimental', owner: 'user:default/matthew', system: 'homelab', dependsOn: ['resource:default/devos-postgres'], providesApis: [] },
};

test('generates a new entity and YAML document from a template, without mutating it', () => {
  const result = createProjectFromTemplate(template, { name: 'nouveau-service', owner: 'user:default/alt' });

  assert.equal(result.entity.metadata.name, 'nouveau-service');
  assert.equal(result.entity.spec.owner, 'user:default/alt');
  assert.equal(result.entity.spec.type, 'service');
  assert.deepEqual(result.entity.spec.dependsOn, ['resource:default/devos-postgres']);
  assert.equal(template.metadata.name, 'template-service');
  assert.match(result.yaml, /name: nouveau-service/);
  assert.match(result.yaml, /owner: user:default\/alt/);
});

test('falls back to the template owner/description when not overridden', () => {
  const result = createProjectFromTemplate(template, { name: 'autre-service' });
  assert.equal(result.entity.spec.owner, 'user:default/matthew');
  assert.equal(result.entity.metadata.description, 'Template de base');
});

test('rejects an empty project name', () => {
  assert.throws(() => createProjectFromTemplate(template, { name: '   ' }));
});
