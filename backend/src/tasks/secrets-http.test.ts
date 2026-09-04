import assert from 'node:assert/strict';
import test from 'node:test';

import { handleSecretsRequest, type SecretsHttpService } from './secrets-http.js';

function service(overrides: Partial<SecretsHttpService> = {}): SecretsHttpService {
  return {
    list: overrides.list ?? (async () => ['pve1-root']),
    reveal: overrides.reveal ?? (async () => 'hunter2'),
    set: overrides.set ?? (async () => undefined),
    delete: overrides.delete ?? (async () => undefined),
  };
}

test('lists secret names without values', async () => {
  const result = await handleSecretsRequest('GET', '/api/secrets', undefined, service());
  assert.deepEqual(result, { status: 200, body: { names: ['pve1-root'] } });
});

test('reveals a secret value only on the dedicated reveal route', async () => {
  const result = await handleSecretsRequest('GET', '/api/secrets/pve1-root/reveal', undefined, service());
  assert.deepEqual(result, { status: 200, body: { name: 'pve1-root', value: 'hunter2' } });
});

test('writes a secret and echoes only its name back, never the value', async () => {
  let received: { name: string; value: string } | null = null;
  const result = await handleSecretsRequest('PUT', '/api/secrets/pve1-root', { value: 'hunter2' }, service({ set: async (name, value) => { received = { name, value }; } }));
  assert.deepEqual(result, { status: 200, body: { name: 'pve1-root' } });
  assert.deepEqual(received, { name: 'pve1-root', value: 'hunter2' });
});

test('rejects a write payload without a string value', async () => {
  const result = await handleSecretsRequest('PUT', '/api/secrets/pve1-root', {}, service());
  assert.equal(result.status, 400);
});

test('deletes a secret', async () => {
  const result = await handleSecretsRequest('DELETE', '/api/secrets/pve1-root', undefined, service());
  assert.deepEqual(result, { status: 204, body: null });
});

test('rejects a secret name containing path traversal characters', async () => {
  const result = await handleSecretsRequest('GET', '/api/secrets/..%2f..%2fetc-passwd/reveal', undefined, service());
  assert.equal(result.status, 400);
});
