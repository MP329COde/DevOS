import assert from 'node:assert/strict';
import test from 'node:test';

import { WoodpeckerClient } from './woodpecker.js';

function client(fetchImpl: typeof fetch) {
  return new WoodpeckerClient({ baseUrl: 'https://woodpecker.test', token: 'wp-token', fetchImpl });
}

test('sends the bearer token on every request', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response('[]', { status: 200 }); }).listRepos();
  assert.equal(receivedAuth, 'Bearer wp-token');
});

test('lists repos', async () => {
  let requestedUrl = '';
  const repos = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([{ id: 1, full_name: 'devos/api', active: true }]), { status: 200 });
  }).listRepos();
  assert.equal(requestedUrl, 'https://woodpecker.test/api/user/repos');
  assert.deepEqual(repos, [{ id: 1, full_name: 'devos/api', active: true }]);
});

test('lists builds for a repo', async () => {
  let requestedUrl = '';
  const builds = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([{ number: 42, status: 'success', branch: 'main', created: 1700000000 }]), { status: 200 });
  }).listBuilds(1);
  assert.equal(requestedUrl, 'https://woodpecker.test/api/repos/1/pipelines');
  assert.deepEqual(builds, [{ number: 42, status: 'success', branch: 'main', created: 1700000000 }]);
});

test('rejects failed Woodpecker API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 403 })).listRepos(), /failed \(403\)/);
});
