import assert from 'node:assert/strict';
import test from 'node:test';

import { createRedisClients } from './redis.js';

test('creates independent cache and pub/sub clients without connecting', () => {
  const clients = createRedisClients('redis://localhost:6379');

  assert.notEqual(clients.cache, clients.publisher);
  assert.notEqual(clients.publisher, clients.subscriber);
  assert.equal(clients.cache.isOpen, false);
  assert.equal(clients.publisher.isOpen, false);
  assert.equal(clients.subscriber.isOpen, false);
});

test('requires a Redis URL', () => {
  assert.throws(() => createRedisClients(''), /REDIS_URL must be configured/);
});
