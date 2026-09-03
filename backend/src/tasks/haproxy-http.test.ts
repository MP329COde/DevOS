import assert from 'node:assert/strict';
import test from 'node:test';

import { handleHAProxyRequest } from './haproxy-http.js';

const readOnlyService = {
  async listBackends() { return [{ name: 'web-backend' }]; },
  async listFrontends() { return [{ name: 'web-frontend' }]; },
  async listServers() { return [{ name: 'srv1', address: '10.0.0.1', port: 8080 }]; },
  async addServer() {},
  async deleteServer() {},
  async reload() {},
  async listHistory() { return []; },
  async rollback() {},
};

test('lists backends without requiring a role', async () => {
  const result = await handleHAProxyRequest('GET', '/api/haproxy/backends', null, undefined, readOnlyService);
  assert.deepEqual(result, { status: 200, body: [{ name: 'web-backend' }] });
});

test('lists servers for a given backend', async () => {
  const result = await handleHAProxyRequest('GET', '/api/haproxy/backends/web-backend/servers', null, undefined, readOnlyService);
  assert.deepEqual(result, { status: 200, body: [{ name: 'srv1', address: '10.0.0.1', port: 8080 }] });
});

test('rejects adding a server without a role', async () => {
  const result = await handleHAProxyRequest('POST', '/api/haproxy/backends/web-backend/servers', { name: 'srv2', address: '10.0.0.2', port: 8081 }, undefined, readOnlyService);
  assert.equal(result.status, 400);
});

test('rejects adding a server for a non-admin role', async () => {
  const result = await handleHAProxyRequest('POST', '/api/haproxy/backends/web-backend/servers', { name: 'srv2', address: '10.0.0.2', port: 8081 }, 'Contributeur', readOnlyService);
  assert.equal(result.status, 400);
});

test('allows an admin to add a server', async () => {
  let added: unknown;
  const service = { ...readOnlyService, async addServer(backend: string, server: unknown) { added = { backend, server }; } };
  const result = await handleHAProxyRequest('POST', '/api/haproxy/backends/web-backend/servers', { name: 'srv2', address: '10.0.0.2', port: 8081 }, 'Admin', service);
  assert.equal(result.status, 201);
  assert.deepEqual(added, { backend: 'web-backend', server: { name: 'srv2', address: '10.0.0.2', port: 8081 } });
});

test('allows an admin to delete a server', async () => {
  let deleted: unknown;
  const service = { ...readOnlyService, async deleteServer(backend: string, name: string) { deleted = { backend, name }; } };
  const result = await handleHAProxyRequest('DELETE', '/api/haproxy/backends/web-backend/servers/srv2', null, 'Admin', service);
  assert.equal(result.status, 204);
  assert.deepEqual(deleted, { backend: 'web-backend', name: 'srv2' });
});

test('allows an admin to trigger a reload', async () => {
  let reloaded = false;
  const service = { ...readOnlyService, async reload() { reloaded = true; } };
  const result = await handleHAProxyRequest('POST', '/api/haproxy/reload', null, 'Admin', service);
  assert.equal(result.status, 202);
  assert.equal(reloaded, true);
});

test('rejects an invalid server payload', async () => {
  const result = await handleHAProxyRequest('POST', '/api/haproxy/backends/web-backend/servers', { name: 'srv2' }, 'Admin', readOnlyService);
  assert.equal(result.status, 400);
});

test('lists the change history without requiring a role', async () => {
  const record = { id: 'change-1', action: 'add_server' as const, backend: 'web-backend', server: { name: 'srv1', address: '10.0.0.1', port: 8080 }, createdAt: new Date(), revertedAt: null };
  const service = { ...readOnlyService, async listHistory() { return [record]; } };
  const result = await handleHAProxyRequest('GET', '/api/haproxy/history', null, undefined, service);
  assert.deepEqual(result, { status: 200, body: [record] });
});

test('rejects a rollback request for a non-admin role', async () => {
  const result = await handleHAProxyRequest('POST', '/api/haproxy/history/change-1/rollback', null, 'Contributeur', readOnlyService);
  assert.equal(result.status, 400);
});

test('allows an admin to roll back a change', async () => {
  let rolledBack: unknown;
  const service = { ...readOnlyService, async rollback(id: string) { rolledBack = id; } };
  const result = await handleHAProxyRequest('POST', '/api/haproxy/history/change-1/rollback', null, 'Admin', service);
  assert.equal(result.status, 200);
  assert.equal(rolledBack, 'change-1');
});
