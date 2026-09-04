import assert from 'node:assert/strict';
import test from 'node:test';

import { SecretsService } from './secrets-service.js';

function fakeVault(overrides: Partial<{ listKv2: (path: string) => Promise<string[]>; readKv2: (path: string) => Promise<{ value: string }>; writeKv2: (path: string, data: Record<string, unknown>) => Promise<void>; deleteKv2: (path: string) => Promise<void> }> = {}) {
  return {
    listKv2: overrides.listKv2 ?? (async () => []),
    readKv2: overrides.readKv2 ?? (async () => ({ value: '' })),
    writeKv2: overrides.writeKv2 ?? (async () => undefined),
    deleteKv2: overrides.deleteKv2 ?? (async () => undefined),
  } as unknown as import('../infrastructure/vault.js').VaultClient;
}

test('lists secret names under the devos-secrets KV mount', async () => {
  let requestedPath = '';
  const service = new SecretsService(fakeVault({ listKv2: async (path) => { requestedPath = path; return ['pve1-root', 'gitlab-runner']; } }));
  const names = await service.list();
  assert.equal(requestedPath, 'devos-secrets');
  assert.deepEqual(names, ['pve1-root', 'gitlab-runner']);
});

test('reveals a secret value only when explicitly asked', async () => {
  let requestedPath = '';
  const service = new SecretsService(fakeVault({ readKv2: async (path) => { requestedPath = path; return { value: 'hunter2' }; } }));
  const value = await service.reveal('pve1-root');
  assert.equal(requestedPath, 'devos-secrets/pve1-root');
  assert.equal(value, 'hunter2');
});

test('writes a secret value under the named path', async () => {
  let receivedPath = '';
  let receivedData: Record<string, unknown> = {};
  const service = new SecretsService(fakeVault({ writeKv2: async (path, data) => { receivedPath = path; receivedData = data; } }));
  await service.set('pve1-root', 'hunter2');
  assert.equal(receivedPath, 'devos-secrets/pve1-root');
  assert.deepEqual(receivedData, { value: 'hunter2' });
});

test('deletes a secret by name', async () => {
  let receivedPath = '';
  const service = new SecretsService(fakeVault({ deleteKv2: async (path) => { receivedPath = path; } }));
  await service.delete('pve1-root');
  assert.equal(receivedPath, 'devos-secrets/pve1-root');
});
