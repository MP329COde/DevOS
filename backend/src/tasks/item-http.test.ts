import assert from 'node:assert/strict';
import test from 'node:test';

import { handleItemRequest } from './item-http.js';

test('lists and creates items through the HTTP contract', async () => {
  const service = {
    async list() { return [{ id: '1', title: 'Existing' }]; },
    async create(input: { title: string }) { return { id: '2', ...input }; },
    async update() { return {}; },
    async delete() { return {}; },
  };
  assert.deepEqual((await handleItemRequest('GET', '/api/items', null, service)).body, [{ id: '1', title: 'Existing' }]);
  assert.deepEqual((await handleItemRequest('POST', '/api/items', { type: 'task', title: 'New item' }, service)).body, { id: '2', type: 'task', title: 'New item' });
});

test('rejects invalid item payloads', async () => {
  const response = await handleItemRequest('POST', '/api/items', { title: '' }, {} as never);
  assert.equal(response.status, 400);
});