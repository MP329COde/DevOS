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