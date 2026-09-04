import assert from 'node:assert/strict';
import test from 'node:test';

import { VaultClient } from './vault.js';

test('authenticates through Kubernetes Auth Method and reads KV v2 on demand', async () => {
  const requests: Request[] = [];
  const client = new VaultClient({
    address: 'http://vault.local/',
    kubernetesAuthPath: 'kubernetes',
    kubernetesRole: 'devos-backend',
    kubernetesJwtFile: '/unused',
    fetchImpl: async (input, init) => {
      requests.push(new Request(input, init));
      if (requests.length === 1) {
        return new Response(JSON.stringify({ auth: { client_token: 'short-lived-token' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { data: { token: 'gitlab-token' } } }), { status: 200 });
    },
  });

  await client.authenticateKubernetes('service-account-jwt');
  const secret = await client.readKv2<{ token: string }>('/gitlab/token');

  assert.deepEqual(secret, { token: 'gitlab-token' });
  assert.equal(requests[0].url, 'http://vault.local/v1/auth/kubernetes/login');
  assert.equal(requests[1].headers.get('x-vault-token'), 'short-lived-token');
  assert.match(await requests[0].text(), /service-account-jwt/);
});

test('rejects secret reads before authentication', async () => {
  const client = new VaultClient({
    address: 'http://vault.local',
    kubernetesAuthPath: 'kubernetes',
    kubernetesRole: 'devos-backend',
    kubernetesJwtFile: '/unused',
  });

  await assert.rejects(() => client.readKv2('gitlab/token'), /not authenticated/);
});

function authenticatedClient(fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const client = new VaultClient({
    address: 'http://vault.local',
    kubernetesAuthPath: 'kubernetes',
    kubernetesRole: 'devos-backend',
    kubernetesJwtFile: '/unused',
    fetchImpl,
  });
  (client as unknown as { token: string }).token = 'short-lived-token';
  return client;
}

test('writes a KV v2 secret with the token header and wrapped data payload', async () => {
  const requests: Request[] = [];
  const client = authenticatedClient(async (input, init) => {
    requests.push(new Request(input, init));
    return new Response(null, { status: 200 });
  });

  await client.writeKv2('vm-credentials/pve1', { username: 'root', password: 'hunter2' });

  assert.equal(requests[0].url, 'http://vault.local/v1/secret/data/vm-credentials/pve1');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].headers.get('x-vault-token'), 'short-lived-token');
  assert.deepEqual(JSON.parse(await requests[0].text()), { data: { username: 'root', password: 'hunter2' } });
});

test('deletes a KV v2 secret via its metadata path', async () => {
  const requests: Request[] = [];
  const client = authenticatedClient(async (input, init) => {
    requests.push(new Request(input, init));
    return new Response(null, { status: 204 });
  });

  await client.deleteKv2('vm-credentials/pve1');

  assert.equal(requests[0].url, 'http://vault.local/v1/secret/metadata/vm-credentials/pve1');
  assert.equal(requests[0].method, 'DELETE');
});

test('lists secret names without ever fetching their values', async () => {
  const client = authenticatedClient(async () => new Response(JSON.stringify({ data: { keys: ['pve1', 'pve2'] } }), { status: 200 }));
  const keys = await client.listKv2('vm-credentials');
  assert.deepEqual(keys, ['pve1', 'pve2']);
});

test('returns an empty list when the KV v2 path does not exist yet', async () => {
  const client = authenticatedClient(async () => new Response(null, { status: 404 }));
  const keys = await client.listKv2('vm-credentials');
  assert.deepEqual(keys, []);
});