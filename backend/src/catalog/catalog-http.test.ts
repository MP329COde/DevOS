import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCatalogRequest } from './catalog-http.js';

test('lists catalog entities', async () => {
  const result = await handleCatalogRequest('GET', '/api/catalog/entities', { async list() { return [{ name: 'devos' }]; }, async graph() { return {}; }, async scan() { return {}; } });
  assert.deepEqual(result, { status: 200, body: [{ name: 'devos' }] });
});

test('returns the dependency graph', async () => {
  const result = await handleCatalogRequest('GET', '/api/catalog/graph', { async list() { return []; }, async graph() { return { nodes: [], edges: [] }; }, async scan() { return {}; } });
  assert.deepEqual(result, { status: 200, body: { nodes: [], edges: [] } });
});

test('triggers a scan', async () => {
  let scanned = false;
  const result = await handleCatalogRequest('POST', '/api/catalog/scan', { async list() { return []; }, async graph() { return {}; }, async scan() { scanned = true; return { entities: 2, errors: 0 }; } });
  assert.equal(scanned, true);
  assert.deepEqual(result, { status: 202, body: { entities: 2, errors: 0 } });
});

test('rejects an unknown route', async () => {
  const result = await handleCatalogRequest('GET', '/api/catalog/unknown', { async list() { return []; }, async graph() { return {}; }, async scan() { return {}; } });
  assert.equal(result.status, 404);
});
