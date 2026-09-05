import assert from 'node:assert/strict';
import test from 'node:test';

import { ArgoCDClient } from './argocd.js';

function client(fetchImpl: typeof fetch) {
  return new ArgoCDClient({ baseUrl: 'https://argocd.test', token: 'argocd-token', fetchImpl });
}

test('sends the bearer token on every request', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response(JSON.stringify({ items: [] }), { status: 200 }); }).listApplications();
  assert.equal(receivedAuth, 'Bearer argocd-token');
});

test('lists applications with sync and health status', async () => {
  const apps = await client(async () => new Response(JSON.stringify({
    items: [{ metadata: { name: 'devos' }, status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } } }],
  }), { status: 200 })).listApplications();
  assert.deepEqual(apps, [{ name: 'devos', syncStatus: 'Synced', healthStatus: 'Healthy' }]);
});

test('defaults sync and health status to Unknown when absent', async () => {
  const apps = await client(async () => new Response(JSON.stringify({ items: [{ metadata: { name: 'devos' } }] }), { status: 200 })).listApplications();
  assert.deepEqual(apps, [{ name: 'devos', syncStatus: 'Unknown', healthStatus: 'Unknown' }]);
});

test('reads the sync history for a named application', async () => {
  let requestedUrl = '';
  const history = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ status: { history: [{ id: 1, revision: 'abc123', deployedAt: '2026-09-01T00:00:00Z' }] } }), { status: 200 });
  }).getSyncHistory('devos');
  assert.equal(requestedUrl, 'https://argocd.test/api/v1/applications/devos');
  assert.deepEqual(history, [{ id: 1, revision: 'abc123', deployedAt: '2026-09-01T00:00:00Z' }]);
});

test('returns an empty history when none is present', async () => {
  const history = await client(async () => new Response(JSON.stringify({}), { status: 200 })).getSyncHistory('devos');
  assert.deepEqual(history, []);
});

test('rejects failed ArgoCD API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 401 })).listApplications(), /failed \(401\)/);
});

test('getCurrentRevision reads the synced revision from status.sync', async () => {
  const revision = await client(async () => new Response(JSON.stringify({ status: { sync: { revision: 'abc123' } } }), { status: 200 })).getCurrentRevision('devos');
  assert.equal(revision, 'abc123');
});

test('getCurrentRevision returns null when no revision is reported', async () => {
  const revision = await client(async () => new Response(JSON.stringify({}), { status: 200 })).getCurrentRevision('devos');
  assert.equal(revision, null);
});

test('syncApplication POSTs to the sync endpoint with no body when no revision is given', async () => {
  let requestedUrl = '';
  let requestedMethod = '';
  let requestedBody = '';
  await client(async (input, init) => {
    requestedUrl = String(input);
    requestedMethod = init?.method ?? '';
    requestedBody = String(init?.body ?? '');
    return new Response('', { status: 200 });
  }).syncApplication('devos');
  assert.equal(requestedUrl, 'https://argocd.test/api/v1/applications/devos/sync');
  assert.equal(requestedMethod, 'POST');
  assert.equal(requestedBody, '{}');
});

test('syncApplication includes the target revision when rolling back', async () => {
  let requestedBody = '';
  await client(async (_input, init) => { requestedBody = String(init?.body ?? ''); return new Response('', { status: 200 }); }).syncApplication('devos', 'abc123');
  assert.deepEqual(JSON.parse(requestedBody), { revision: 'abc123' });
});
