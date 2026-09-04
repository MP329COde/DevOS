import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCatalogRequest } from './catalog-http.js';

const baseService = { async list() { return [{ name: 'devos' }]; }, async graph() { return {}; }, async scan() { return {}; } };

test('lists catalog entities', async () => {
  const result = await handleCatalogRequest('GET', '/api/catalog/entities', undefined, baseService);
  assert.deepEqual(result, { status: 200, body: [{ name: 'devos' }] });
});

test('returns the dependency graph', async () => {
  const result = await handleCatalogRequest('GET', '/api/catalog/graph', undefined, { ...baseService, async graph() { return { nodes: [], edges: [] }; } });
  assert.deepEqual(result, { status: 200, body: { nodes: [], edges: [] } });
});

test('triggers a scan', async () => {
  let scanned = false;
  const result = await handleCatalogRequest('POST', '/api/catalog/scan', undefined, { ...baseService, async scan() { scanned = true; return { entities: 2, errors: 0 }; } });
  assert.equal(scanned, true);
  assert.deepEqual(result, { status: 202, body: { entities: 2, errors: 0 } });
});

test('rejects an unknown route', async () => {
  const result = await handleCatalogRequest('GET', '/api/catalog/unknown', undefined, baseService);
  assert.equal(result.status, 404);
});

test('returns 503 for template creation when not configured', async () => {
  const result = await handleCatalogRequest('POST', '/api/catalog/template', { templateKind: 'Component', templateName: 'devos', name: 'x' }, baseService);
  assert.equal(result.status, 503);
});

test('creates a project from a template', async () => {
  let received: unknown;
  const service = {
    ...baseService,
    async createFromTemplate(templateKind: string, templateName: string, input: { name: string }) {
      received = { templateKind, templateName, input };
      return { entity: { metadata: { name: input.name } }, yaml: 'yaml' };
    },
  };
  const result = await handleCatalogRequest('POST', '/api/catalog/template', { templateKind: 'Component', templateName: 'devos', name: 'nouveau' }, service);
  assert.equal(result.status, 201);
  assert.deepEqual(received, { templateKind: 'Component', templateName: 'devos', input: { templateKind: 'Component', templateName: 'devos', name: 'nouveau', owner: undefined, description: undefined } });
});

test('rejects a template creation request missing required fields', async () => {
  const result = await handleCatalogRequest('POST', '/api/catalog/template', { name: 'x' }, { ...baseService, async createFromTemplate() { return {}; } });
  assert.equal(result.status, 400);
});
