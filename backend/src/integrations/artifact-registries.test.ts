import assert from 'node:assert/strict';
import test from 'node:test';

import { NexusClient, VerdaccioClient } from './artifact-registries.js';

function verdaccioClient(fetchImpl: typeof fetch, token?: string) {
  return new VerdaccioClient({ baseUrl: 'https://verdaccio.test', token, fetchImpl });
}

function nexusClient(fetchImpl: typeof fetch) {
  return new NexusClient({ baseUrl: 'https://nexus.test', username: 'admin', password: 'secret', fetchImpl });
}

test('VerdaccioClient sends no auth header when token is omitted', async () => {
  let receivedAuth: string | null | undefined;
  await verdaccioClient(async (_input, init) => {
    receivedAuth = new Headers(init?.headers).get('authorization');
    return new Response(JSON.stringify({ name: 'pkg', 'dist-tags': { latest: '1.0.0' }, versions: {} }), { status: 200 });
  }).getPackage('pkg');
  assert.equal(receivedAuth, null);
});

test('VerdaccioClient sends the bearer token when provided', async () => {
  let receivedAuth: string | null = null;
  await verdaccioClient(async (_input, init) => {
    receivedAuth = new Headers(init?.headers).get('authorization');
    return new Response(JSON.stringify({ name: 'pkg', 'dist-tags': { latest: '1.0.0' }, versions: {} }), { status: 200 });
  }, 'verd-token').getPackage('pkg');
  assert.equal(receivedAuth, 'Bearer verd-token');
});

test('VerdaccioClient fetches a package and derives latestVersion', async () => {
  let requestedUrl = '';
  const pkg = await verdaccioClient(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({ name: '@devos/core', 'dist-tags': { latest: '2.3.4' }, versions: { '2.3.4': {} } }),
      { status: 200 },
    );
  }).getPackage('@devos/core');
  assert.equal(requestedUrl, 'https://verdaccio.test/%40devos%2Fcore');
  assert.deepEqual(pkg, {
    name: '@devos/core',
    'dist-tags': { latest: '2.3.4' },
    versions: { '2.3.4': {} },
    latestVersion: '2.3.4',
  });
});

test('VerdaccioClient rejects failed responses', async () => {
  await assert.rejects(() => verdaccioClient(async () => new Response('{}', { status: 404 })).getPackage('missing'), /failed \(404\)/);
});

test('NexusClient sends HTTP Basic credentials', async () => {
  let receivedAuth: string | null = null;
  await nexusClient(async (_input, init) => {
    receivedAuth = new Headers(init?.headers).get('authorization');
    return new Response('[]', { status: 200 });
  }).listRepositories();
  assert.equal(receivedAuth, `Basic ${Buffer.from('admin:secret').toString('base64')}`);
});

test('NexusClient lists repositories', async () => {
  let requestedUrl = '';
  const repositories = await nexusClient(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify([{ name: 'npm-hosted', format: 'npm', type: 'hosted', url: 'https://nexus.test/repository/npm-hosted' }]),
      { status: 200 },
    );
  }).listRepositories();
  assert.equal(requestedUrl, 'https://nexus.test/service/rest/v1/repositories');
  assert.deepEqual(repositories, [
    { name: 'npm-hosted', format: 'npm', type: 'hosted', url: 'https://nexus.test/repository/npm-hosted' },
  ]);
});

test('NexusClient rejects failed responses', async () => {
  await assert.rejects(() => nexusClient(async () => new Response('{}', { status: 403 })).listRepositories(), /failed \(403\)/);
});
