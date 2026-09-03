import assert from 'node:assert/strict';
import test from 'node:test';

import { handleDashboardRequest } from './dashboard-http.js';

test('routes GET /api/dashboard/today to the service', async () => {
  const result = await handleDashboardRequest('GET', '/api/dashboard/today', { async today() { return [{ id: 'item-1' }]; }, async tomorrow() { return []; } });
  assert.deepEqual(result, { status: 200, body: [{ id: 'item-1' }] });
});

test('routes GET /api/dashboard/tomorrow to the service', async () => {
  const result = await handleDashboardRequest('GET', '/api/dashboard/tomorrow', { async today() { return []; }, async tomorrow() { return [{ id: 'item-2' }]; } });
  assert.deepEqual(result, { status: 200, body: [{ id: 'item-2' }] });
});

test('rejects unknown dashboard routes', async () => {
  const result = await handleDashboardRequest('GET', '/api/dashboard/unknown', { async today() { return []; }, async tomorrow() { return []; } });
  assert.equal(result.status, 404);
});
