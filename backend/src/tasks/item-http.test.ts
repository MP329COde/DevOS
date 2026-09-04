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

test('passes markdown content through on create and update for doc items', async () => {
  let receivedCreate: unknown;
  let receivedUpdate: unknown;
  const service = {
    async list() { return []; },
    async create(input: unknown) { receivedCreate = input; return {}; },
    async update(_id: string, input: unknown) { receivedUpdate = input; return {}; },
    async delete() { return {}; },
  };
  await handleItemRequest('POST', '/api/items', { type: 'doc', title: 'Guide', content: '# Guide' }, service);
  assert.deepEqual(receivedCreate, { type: 'doc', title: 'Guide', content: '# Guide' });
  await handleItemRequest('PATCH', '/api/items/doc-1', { content: '# Updated' }, service);
  assert.deepEqual(receivedUpdate, { content: '# Updated' });
});

test('passes the required flag through on update', async () => {
  let receivedUpdate: unknown;
  const service = {
    async list() { return []; },
    async create() { return {}; },
    async update(_id: string, input: unknown) { receivedUpdate = input; return {}; },
    async delete() { return {}; },
  };
  await handleItemRequest('PATCH', '/api/items/item-1', { required: true }, service);
  assert.deepEqual(receivedUpdate, { required: true });
});