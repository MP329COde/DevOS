import assert from 'node:assert/strict';
import test from 'node:test';

import { KubernetesClient } from './kubernetes.js';

function client(fetchImpl: typeof fetch) {
  return new KubernetesClient({ apiServer: 'https://k8s.test:6443', token: 'sa-token', fetchImpl });
}

test('sends the bearer token on every request', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response(JSON.stringify({ items: [] }), { status: 200 }); }).listNodes();
  assert.equal(receivedAuth, 'Bearer sa-token');
});

test('lists pods scoped to a namespace', async () => {
  let requestedUrl = '';
  const pods = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ items: [{ metadata: { name: 'devos-1', namespace: 'devos' }, spec: { nodeName: 'node-1' }, status: { phase: 'Running' } }] }), { status: 200 });
  }).listPods('devos');
  assert.equal(requestedUrl, 'https://k8s.test:6443/api/v1/namespaces/devos/pods');
  assert.deepEqual(pods, [{ name: 'devos-1', namespace: 'devos', phase: 'Running', node: 'node-1' }]);
});

test('lists all pods when no namespace is given', async () => {
  let requestedUrl = '';
  await client(async (input) => { requestedUrl = String(input); return new Response(JSON.stringify({ items: [] }), { status: 200 }); }).listPods();
  assert.equal(requestedUrl, 'https://k8s.test:6443/api/v1/pods');
});

test('lists deployments with readiness counts', async () => {
  const deployments = await client(async () => new Response(JSON.stringify({ items: [{ metadata: { name: 'devos', namespace: 'devos' }, spec: { replicas: 2 }, status: { readyReplicas: 1 } }] }), { status: 200 })).listDeployments('devos');
  assert.deepEqual(deployments, [{ name: 'devos', namespace: 'devos', replicas: 2, readyReplicas: 1 }]);
});

test('lists nodes and derives readiness from the Ready condition', async () => {
  const nodes = await client(async () => new Response(JSON.stringify({
    items: [
      { metadata: { name: 'node-1' }, status: { conditions: [{ type: 'Ready', status: 'True' }] } },
      { metadata: { name: 'node-2' }, status: { conditions: [{ type: 'Ready', status: 'False' }] } },
    ],
  }), { status: 200 })).listNodes();
  assert.deepEqual(nodes, [{ name: 'node-1', ready: true }, { name: 'node-2', ready: false }]);
});

test('rejects failed Kubernetes API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 403 })).listNodes(), /failed \(403\)/);
});
