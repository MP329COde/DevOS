import assert from 'node:assert/strict';
import test from 'node:test';

import { N8nClient, NatsMonitorClient } from './nats-n8n.js';

function natsClient(fetchImpl: typeof fetch) {
  return new NatsMonitorClient({ baseUrl: 'https://nats.test:8222', fetchImpl });
}

function n8nClient(fetchImpl: typeof fetch) {
  return new N8nClient({ baseUrl: 'https://n8n.test', apiKey: 'n8n-key', fetchImpl });
}

test('NatsMonitorClient sends no auth header on requests', async () => {
  let receivedAuth: string | null | undefined;
  await natsClient(async (_input, init) => {
    receivedAuth = new Headers(init?.headers).get('authorization');
    return new Response(JSON.stringify({ server_id: 's1', connections: 0, in_msgs: 0, out_msgs: 0 }), { status: 200 });
  }).getVarz();
  assert.equal(receivedAuth, null);
});

test('NatsMonitorClient fetches varz', async () => {
  let requestedUrl = '';
  const varz = await natsClient(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ server_id: 'NATS-1', connections: 5, in_msgs: 100, out_msgs: 200 }), { status: 200 });
  }).getVarz();
  assert.equal(requestedUrl, 'https://nats.test:8222/varz');
  assert.deepEqual(varz, { server_id: 'NATS-1', connections: 5, in_msgs: 100, out_msgs: 200 });
});

test('NatsMonitorClient lists connections from the connz envelope', async () => {
  let requestedUrl = '';
  const connections = await natsClient(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({ connections: [{ cid: 1, ip: '10.0.0.1', subscriptions: 3 }] }),
      { status: 200 },
    );
  }).listConnections();
  assert.equal(requestedUrl, 'https://nats.test:8222/connz');
  assert.deepEqual(connections, [{ cid: 1, ip: '10.0.0.1', subscriptions: 3 }]);
});

test('NatsMonitorClient rejects failed responses', async () => {
  await assert.rejects(() => natsClient(async () => new Response('{}', { status: 500 })).getVarz(), /failed \(500\)/);
});

test('N8nClient sends the API key header on every request', async () => {
  let receivedKey: string | null = null;
  await n8nClient(async (_input, init) => {
    receivedKey = new Headers(init?.headers).get('x-n8n-api-key');
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }).listWorkflows();
  assert.equal(receivedKey, 'n8n-key');
});

test('N8nClient lists workflows from the data envelope', async () => {
  let requestedUrl = '';
  const workflows = await n8nClient(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({ data: [{ id: 'wf1', name: 'Sync issues', active: true }] }),
      { status: 200 },
    );
  }).listWorkflows();
  assert.equal(requestedUrl, 'https://n8n.test/api/v1/workflows');
  assert.deepEqual(workflows, [{ id: 'wf1', name: 'Sync issues', active: true }]);
});

test('N8nClient lists executions for a workflow', async () => {
  let requestedUrl = '';
  const executions = await n8nClient(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({ data: [{ id: 'ex1', status: 'success', startedAt: '2026-09-01T00:00:00Z' }] }),
      { status: 200 },
    );
  }).listExecutions('wf1');
  assert.equal(requestedUrl, 'https://n8n.test/api/v1/executions?workflowId=wf1');
  assert.deepEqual(executions, [{ id: 'ex1', status: 'success', startedAt: '2026-09-01T00:00:00Z' }]);
});

test('N8nClient rejects failed API responses', async () => {
  await assert.rejects(() => n8nClient(async () => new Response('{}', { status: 401 })).listWorkflows(), /failed \(401\)/);
});
