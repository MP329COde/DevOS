import assert from 'node:assert/strict';
import test from 'node:test';

import { DocsService } from './docs-service.js';

test('sync upserts each page by sourceProject and path', async () => {
  const upserts: unknown[] = [];
  const database = { docPage: { upsert: async (args: unknown) => { upserts.push(args); return {}; } } } as never;

  await new DocsService(database).sync([{ sourceProject: 'root/devos', path: 'docs/intro.md', title: 'Introduction', content: '# Introduction' }]);

  assert.equal(upserts.length, 1);
  const call = upserts[0] as { where: unknown; create: { title: string } };
  assert.deepEqual(call.where, { sourceProject_path: { sourceProject: 'root/devos', path: 'docs/intro.md' } });
  assert.equal(call.create.title, 'Introduction');
});

test('link upserts a doc-item association idempotently', async () => {
  let upsertCall: unknown;
  const database = { docLink: { upsert: async (args: unknown) => { upsertCall = args; return {}; } } } as never;
  await new DocsService(database).link('doc-1', 'item-1');
  assert.deepEqual((upsertCall as { where: unknown }).where, { docPageId_itemId: { docPageId: 'doc-1', itemId: 'item-1' } });
});

test('unlink removes the doc-item association', async () => {
  let deleteWhere: unknown;
  const database = { docLink: { deleteMany: async (args: { where: unknown }) => { deleteWhere = args.where; return { count: 1 }; } } } as never;
  await new DocsService(database).unlink('doc-1', 'item-1');
  assert.deepEqual(deleteWhere, { docPageId: 'doc-1', itemId: 'item-1' });
});

test('linkedItemIds returns the item ids linked to a doc page', async () => {
  const database = { docLink: { findMany: async () => [{ itemId: 'item-1' }, { itemId: 'item-2' }] } } as never;
  assert.deepEqual(await new DocsService(database).linkedItemIds('doc-1'), ['item-1', 'item-2']);
});
