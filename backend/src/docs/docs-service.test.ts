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

test('ensureDefaultOnboardingPages upserts the operational guides idempotently', async () => {
  const upserts: Array<{ where: unknown; create: { title: string; pageType: string } }> = [];
  const database = { docPage: { upsert: async (args: unknown) => { upserts.push(args as typeof upserts[number]); return {}; } } } as never;

  const pages = await new DocsService(database).ensureDefaultOnboardingPages();

  assert.equal(pages.length, 5);
  assert.equal(upserts.length, 5);
  const titles = upserts.map((u) => u.create.title);
  assert.deepEqual(titles, [
    'Configurer un backend HAProxy pour un nouveau service',
    'Choisir un dépôt/version de logiciel',
    'Bonnes pratiques de sécurité',
    'Prendre en main le Dashboard DevOS',
    'Configurer les intégrations DevOS',
  ]);
  for (const upsert of upserts) {
    assert.equal(upsert.create.pageType, 'onboarding');
    assert.match((upsert.where as { sourceProject_path: { path: string } }).sourceProject_path.path, /^onboarding\//);
  }
});

test('ensureDefaultOnboardingPages uses a stable path (no timestamp) so re-running never duplicates', async () => {
  const wheres: unknown[] = [];
  const database = { docPage: { upsert: async (args: { where: unknown }) => { wheres.push(args.where); return {}; } } } as never;
  const service = new DocsService(database);

  await service.ensureDefaultOnboardingPages();
  await service.ensureDefaultOnboardingPages();

  assert.deepEqual(wheres.slice(0, 5), wheres.slice(5, 10));
});

test('createOnboardingPage persists a page with pageType "onboarding" and a slugified path', async () => {
  let createArgs: unknown;
  const database = { docPage: { create: async (args: unknown) => { createArgs = args; return {}; } } } as never;

  await new DocsService(database).createOnboardingPage('Arrivée sur le projet DevOS', '# Checklist\n- [ ] Lire INFO.md');

  const call = (createArgs as { data: { sourceProject: string; path: string; title: string; content: string; pageType: string } }).data;
  assert.equal(call.sourceProject, 'onboarding');
  assert.match(call.path, /^onboarding\/arrivee-sur-le-projet-devos-[a-z0-9]+$/);
  assert.equal(call.title, 'Arrivée sur le projet DevOS');
  assert.equal(call.pageType, 'onboarding');
});
