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

test('rejects empty or oversized titles', async () => {
  const service = new ItemService({} as never);
  await assert.rejects(() => service.create({ type: ItemType.task, title: ' ' }), /between 1 and 300/);
  await assert.rejects(() => service.create({ type: ItemType.task, title: 'x'.repeat(301) }), /between 1 and 300/);
});