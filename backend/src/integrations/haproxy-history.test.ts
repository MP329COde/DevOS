import assert from 'node:assert/strict';
import test from 'node:test';

import { addServerWithHistory, deleteServerWithHistory, rollbackChange, type HAProxyChangeRecord, type HAProxyHistoryRepository } from './haproxy-history.js';

function repository(overrides: Partial<HAProxyHistoryRepository> = {}): HAProxyHistoryRepository {
  return {
    async record(entry) { return { id: 'change-1', createdAt: new Date(), revertedAt: null, ...entry }; },
    async list() { return []; },
    async get() { return null; },
    async markReverted() {},
    ...overrides,
  };
}

test('addServerWithHistory applies the change then records it', async () => {
  let added: unknown;
  let recorded: unknown;
  await addServerWithHistory(
    { async addServer(backend, server) { added = { backend, server }; } },
    repository({ async record(entry) { recorded = entry; return { id: 'change-1', createdAt: new Date(), revertedAt: null, ...entry }; } }),
    'web-backend',
    { name: 'srv1', address: '10.0.0.1', port: 8080 },
  );
  assert.deepEqual(added, { backend: 'web-backend', server: { name: 'srv1', address: '10.0.0.1', port: 8080 } });
  assert.deepEqual(recorded, { action: 'add_server', backend: 'web-backend', server: { name: 'srv1', address: '10.0.0.1', port: 8080 } });
});

test('deleteServerWithHistory records the removed server so it can be restored later', async () => {
  let recorded: unknown;
  await deleteServerWithHistory(
    { async listServers() { return [{ name: 'srv1', address: '10.0.0.1', port: 8080 }]; }, async deleteServer() {} },
    repository({ async record(entry) { recorded = entry; return { id: 'change-1', createdAt: new Date(), revertedAt: null, ...entry }; } }),
    'web-backend',
    'srv1',
  );
  assert.deepEqual(recorded, { action: 'delete_server', backend: 'web-backend', server: { name: 'srv1', address: '10.0.0.1', port: 8080 } });
});

test('deleteServerWithHistory rejects an unknown server without calling HAProxy', async () => {
  let deleted = false;
  await assert.rejects(
    () => deleteServerWithHistory(
      { async listServers() { return []; }, async deleteServer() { deleted = true; } },
      repository(),
      'web-backend',
      'ghost',
    ),
    /was not found/,
  );
  assert.equal(deleted, false);
});

test('rollbackChange reverses an add_server by deleting the server', async () => {
  const record: HAProxyChangeRecord = { id: 'change-1', action: 'add_server', backend: 'web-backend', server: { name: 'srv1', address: '10.0.0.1', port: 8080 }, createdAt: new Date(), revertedAt: null };
  let deleted: unknown;
  let reverted = false;
  await rollbackChange('change-1', repository({ async get() { return record; }, async markReverted() { reverted = true; } }), {
    async addServer() { throw new Error('should not be called'); },
    async deleteServer(backend, name) { deleted = { backend, name }; },
  });
  assert.deepEqual(deleted, { backend: 'web-backend', name: 'srv1' });
  assert.equal(reverted, true);
});

test('rollbackChange reverses a delete_server by re-adding the server', async () => {
  const record: HAProxyChangeRecord = { id: 'change-2', action: 'delete_server', backend: 'web-backend', server: { name: 'srv1', address: '10.0.0.1', port: 8080 }, createdAt: new Date(), revertedAt: null };
  let added: unknown;
  await rollbackChange('change-2', repository({ async get() { return record; } }), {
    async addServer(backend, server) { added = { backend, server }; },
    async deleteServer() { throw new Error('should not be called'); },
  });
  assert.deepEqual(added, { backend: 'web-backend', server: record.server });
});

test('rollbackChange rejects an unknown change id', async () => {
  await assert.rejects(() => rollbackChange('missing', repository(), { async addServer() {}, async deleteServer() {} }), /Unknown HAProxy change/);
});

test('rollbackChange rejects a change that was already reverted', async () => {
  const record: HAProxyChangeRecord = { id: 'change-1', action: 'add_server', backend: 'web-backend', server: { name: 'srv1', address: '10.0.0.1', port: 8080 }, createdAt: new Date(), revertedAt: new Date() };
  await assert.rejects(() => rollbackChange('change-1', repository({ async get() { return record; } }), { async addServer() {}, async deleteServer() {} }), /already reverted/);
});
