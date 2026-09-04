import assert from 'node:assert/strict';
import test from 'node:test';

import { RabbitMQClient } from './rabbitmq.js';

function client(fetchImpl: typeof fetch) {
  return new RabbitMQClient({ baseUrl: 'https://rabbitmq.test', username: 'guest', password: 'guest', fetchImpl });
}

test('sends HTTP Basic auth credentials', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => {
    receivedAuth = new Headers(init?.headers).get('authorization');
    return new Response('[]', { status: 200 });
  }).listQueues();
  assert.equal(receivedAuth, `Basic ${Buffer.from('guest:guest').toString('base64')}`);
});

test('lists queues', async () => {
  let requestedUrl = '';
  const queues = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify([{ name: 'jobs', vhost: '/', messages: 5, consumers: 1, state: 'running' }]),
      { status: 200 },
    );
  }).listQueues();
  assert.equal(requestedUrl, 'https://rabbitmq.test/api/queues');
  assert.deepEqual(queues, [{ name: 'jobs', vhost: '/', messages: 5, consumers: 1, state: 'running' }]);
});

test('lists nodes', async () => {
  let requestedUrl = '';
  const nodes = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify([{ name: 'rabbit@node1', running: true, mem_used: 12345, disk_free: 987654 }]),
      { status: 200 },
    );
  }).listNodes();
  assert.equal(requestedUrl, 'https://rabbitmq.test/api/nodes');
  assert.deepEqual(nodes, [{ name: 'rabbit@node1', running: true, mem_used: 12345, disk_free: 987654 }]);
});

test('rejects failed RabbitMQ API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 401 })).listQueues(), /failed \(401\)/);
});
