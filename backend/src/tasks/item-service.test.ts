import assert from 'node:assert/strict';
import test from 'node:test';

import { ItemType } from '@prisma/client';

import { ItemService } from './item-service.js';

test('normalizes a title before creating an item', async () => {
  let receivedTitle = '';
  const database = {
    item: {
      create: async ({ data }: { data: { title: string } }) => { receivedTitle = data.title; return { title: data.title }; },
    },
  } as never;

  await new ItemService(database).create({ type: ItemType.task, title: '  Fix uptime  ' });
  assert.equal(receivedTitle, 'Fix uptime');
});

test('stores labels as normalized relations when creating an item', async () => {
  let receivedLabels: unknown;
  const database = {
    item: {
      create: async ({ data }: { data: { labels: unknown } }) => { receivedLabels = data.labels; return {}; },
    },
  } as never;

  await new ItemService(database).create({ type: ItemType.task, title: 'Labelled', labels: [' Priority::high '] });
  assert.deepEqual(receivedLabels, {
    create: [{ label: { connectOrCreate: { where: { prefix_value: { prefix: 'priority', value: 'high' } }, create: { prefix: 'priority', value: 'high' } } } }],
  });
});

test('persists GitLab merge request and pipeline status when provided', async () => {
  let receivedData: unknown;
  const database = {
    item: {
      update: async ({ data }: { data: unknown }) => { receivedData = data; return {}; },
    },
  } as never;

  await new ItemService(database).update('item-1', { mergeRequestState: 'merged', pipelineStatus: 'success' });
  assert.deepEqual(receivedData, { mergeRequestState: 'merged', pipelineStatus: 'success' });
});

test('leaves GitLab merge request and pipeline status untouched when absent from the update', async () => {
  let receivedData: unknown;
  const database = {
    item: {
      update: async ({ data }: { data: unknown }) => { receivedData = data; return {}; },
    },
  } as never;

  await new ItemService(database).update('item-1', { status: 'in_progress' });
  assert.deepEqual(receivedData, { status: 'in_progress' });
});

test('rejects empty or oversized titles', async () => {
  const service = new ItemService({} as never);
  await assert.rejects(() => service.create({ type: ItemType.task, title: ' ' }), /between 1 and 300/);
  await assert.rejects(() => service.create({ type: ItemType.task, title: 'x'.repeat(301) }), /between 1 and 300/);
});