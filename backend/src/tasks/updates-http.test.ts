import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleUpdatesRequest, type UpdatesHttpService } from './updates-http.js';

function service(overrides: Partial<UpdatesHttpService> = {}): UpdatesHttpService {
  return {
    getStatus: async () => ({ current: '1.0.0', latest: '1.0.0', status: 'up-to-date', mechanism: 'none' }),
    applyUpdate: async () => ({ mechanism: 'argocd', triggered: true }),
    rollback: async () => ({ mechanism: 'argocd', triggered: true }),
    ...overrides,
  };
}

test('GET /api/updates/status does not require a role', async () => {
  const response = await handleUpdatesRequest('GET', '/api/updates/status', undefined, service());
  assert.equal(response.status, 200);
});

test('POST /api/updates/apply without a role is rejected', async () => {
  const response = await handleUpdatesRequest('POST', '/api/updates/apply', undefined, service());
  assert.equal(response.status, 400);
});

test('POST /api/updates/apply as Lecteur is rejected (Admin-only action)', async () => {
  const response = await handleUpdatesRequest('POST', '/api/updates/apply', 'Lecteur', service());
  assert.equal(response.status, 400);
});

test('POST /api/updates/apply as Admin succeeds and reports 202 when triggered', async () => {
  const response = await handleUpdatesRequest('POST', '/api/updates/apply', 'Admin', service());
  assert.equal(response.status, 202);
  assert.deepEqual(response.body, { mechanism: 'argocd', triggered: true });
});

test('POST /api/updates/apply as Admin reports 200 when no mechanism is configured', async () => {
  const response = await handleUpdatesRequest('POST', '/api/updates/apply', 'Admin', service({
    applyUpdate: async () => ({ mechanism: 'none', triggered: false }),
  }));
  assert.equal(response.status, 200);
});

test('POST /api/updates/rollback as Admin succeeds', async () => {
  const response = await handleUpdatesRequest('POST', '/api/updates/rollback', 'Admin', service());
  assert.equal(response.status, 202);
});

test('unknown route returns 404', async () => {
  const response = await handleUpdatesRequest('GET', '/api/updates/nope', 'Admin', service());
  assert.equal(response.status, 404);
});
