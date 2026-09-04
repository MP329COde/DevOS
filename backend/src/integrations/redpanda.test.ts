import assert from 'node:assert/strict';
import test from 'node:test';

import { RedpandaClient } from './redpanda.js';

function client(fetchImpl: typeof fetch, token?: string) {
  return new RedpandaClient({ baseUrl: 'https://redpanda.test', token, fetchImpl });
}

test('omits Authorization header when no token is provided', async () => {
  let receivedAuth: string | null | undefined;
  await client(async (_input, init) => {
    receivedAuth = new Headers(init?.headers).get('authorization');
    return new Response('[]', { status: 200 });
  }).listBrokers();
  assert.equal(receivedAuth, null);
});

test('sends Bearer token when provided', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => {
    receivedAuth = new Headers(init?.headers).get('authorization');
    return new Response('[]', { status: 200 });
  }, 'secret-token').listBrokers();
  assert.equal(receivedAuth, 'Bearer secret-token');
});

test('lists brokers', async () => {
  let requestedUrl = '';
  const brokers = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify([{ node_id: 1, num_cores: 4, membership_status: 'active' }]),
      { status: 200 },
    );
  }).listBrokers();
  assert.equal(requestedUrl, 'https://redpanda.test/v1/brokers');
  assert.deepEqual(brokers, [{ node_id: 1, num_cores: 4, membership_status: 'active' }]);
});

test('lists topics', async () => {
  let requestedUrl = '';
  const topics = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify([{ topic_name: 'events', partition_count: 3, replication_factor: 3 }]),
      { status: 200 },
    );
  }).listTopics();
  assert.equal(requestedUrl, 'https://redpanda.test/v1/topics');
  assert.deepEqual(topics, [{ topic_name: 'events', partition_count: 3, replication_factor: 3 }]);
});

test('gets topic partitions', async () => {
  let requestedUrl = '';
  const partitions = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify([{ partition_id: 0, leader_id: 1, replicas: [1, 2, 3] }]),
      { status: 200 },
    );
  }).getTopicPartitions('events');
  assert.equal(requestedUrl, 'https://redpanda.test/v1/topics/events/partitions');
  assert.deepEqual(partitions, [{ partition_id: 0, leader_id: 1, replicas: [1, 2, 3] }]);
});

test('encodes topic name in partitions URL', async () => {
  let requestedUrl = '';
  await client(async (input) => {
    requestedUrl = String(input);
    return new Response('[]', { status: 200 });
  }).getTopicPartitions('my topic/weird');
  assert.equal(requestedUrl, 'https://redpanda.test/v1/topics/my%20topic%2Fweird/partitions');
});

test('rejects failed Redpanda Admin API responses', async () => {
  await assert.rejects(
    () => client(async () => new Response('{}', { status: 503 })).listBrokers(),
    /failed \(503\)/,
  );
});
