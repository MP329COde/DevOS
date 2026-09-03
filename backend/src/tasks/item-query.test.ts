import assert from 'node:assert/strict';
import test from 'node:test';

import { queryItems, type QueryItem } from './item-query.js';

const items: QueryItem[] = [
  { id: '1', title: 'B task', type: 'task', status: 'done', createdAt: '2026-01-02' },
  { id: '2', title: 'A task', type: 'task', status: 'backlog', createdAt: '2026-01-01' },
  { id: '3', title: 'A doc', type: 'doc', status: 'backlog', createdAt: '2026-01-03' },
];

test('filters, sorts and groups through one query contract', () => {
  const result = queryItems(items, { type: 'task', groupBy: 'status', sort: 'title' });
  assert.deepEqual(result.items.map((item) => item.id), ['2', '1']);
  assert.deepEqual(Object.keys(result.groups), ['backlog', 'done']);
});

test('supports descending date ordering', () => {
  assert.deepEqual(queryItems(items, { sort: 'createdAt', direction: 'desc' }).items.map((item) => item.id), ['3', '1', '2']);
});