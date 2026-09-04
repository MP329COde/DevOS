import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCommentRequest } from './comment-http.js';

test('lists comments for an item', async () => {
  const service = {
    async list(itemId: string) { return [{ id: 'c1', itemId, body: 'Hello' }]; },
    async create() { return {}; },
  };
  const response = await handleCommentRequest('GET', '/api/items/item-1/comments', null, service);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, [{ id: 'c1', itemId: 'item-1', body: 'Hello' }]);
});

test('creates a comment with an optional author', async () => {
  let received: unknown;
  const service = {
    async list() { return []; },
    async create(itemId: string, body: string, author?: string) { received = { itemId, body, author }; return { id: 'c2' }; },
  };
  const response = await handleCommentRequest('POST', '/api/items/item-1/comments', { body: 'A note', author: 'Matthew' }, service);
  assert.equal(response.status, 201);
  assert.deepEqual(received, { itemId: 'item-1', body: 'A note', author: 'Matthew' });
});

test('rejects a comment without a body', async () => {
  const response = await handleCommentRequest('POST', '/api/items/item-1/comments', {}, {} as never);
  assert.equal(response.status, 400);
});

test('returns 404 for a path that does not match the comments contract', async () => {
  const response = await handleCommentRequest('GET', '/api/items/item-1', null, {} as never);
  assert.equal(response.status, 404);
});

test('returns 405 for an unsupported method', async () => {
  const service = { async list() { return []; }, async create() { return {}; } };
  const response = await handleCommentRequest('DELETE', '/api/items/item-1/comments', null, service);
  assert.equal(response.status, 405);
});
