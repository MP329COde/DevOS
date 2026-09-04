import assert from 'node:assert/strict';
import test from 'node:test';

import { handleDocsRequest } from './docs-http.js';

const service = {
  async list() { return [{ id: 'doc-1' }]; },
  async get(id: string) { return id === 'doc-1' ? { id: 'doc-1' } : null; },
  async link() {},
  async unlink() {},
  async createOnboardingPage(title: string, content: string) { return { id: 'doc-2', title, content, pageType: 'onboarding' }; },
};

test('lists doc pages', async () => {
  const result = await handleDocsRequest('GET', '/api/docs', null, service);
  assert.deepEqual(result, { status: 200, body: [{ id: 'doc-1' }] });
});

test('gets a single doc page', async () => {
  const result = await handleDocsRequest('GET', '/api/docs/doc-1', null, service);
  assert.deepEqual(result, { status: 200, body: { id: 'doc-1' } });
});

test('returns 404 for an unknown doc page', async () => {
  const result = await handleDocsRequest('GET', '/api/docs/missing', null, service);
  assert.equal(result.status, 404);
});

test('links a doc page to an item', async () => {
  let linked: unknown;
  const result = await handleDocsRequest('POST', '/api/docs/doc-1/links', { itemId: 'item-1' }, { ...service, async link(docPageId: string, itemId: string) { linked = { docPageId, itemId }; } });
  assert.equal(result.status, 201);
  assert.deepEqual(linked, { docPageId: 'doc-1', itemId: 'item-1' });
});

test('rejects a link request without an itemId', async () => {
  const result = await handleDocsRequest('POST', '/api/docs/doc-1/links', {}, service);
  assert.equal(result.status, 400);
});

test('unlinks a doc page from an item', async () => {
  let unlinked: unknown;
  const result = await handleDocsRequest('DELETE', '/api/docs/doc-1/links/item-1', null, { ...service, async unlink(docPageId: string, itemId: string) { unlinked = { docPageId, itemId }; } });
  assert.equal(result.status, 204);
  assert.deepEqual(unlinked, { docPageId: 'doc-1', itemId: 'item-1' });
});

test('creates an onboarding page', async () => {
  const result = await handleDocsRequest('POST', '/api/docs/onboarding', { title: 'Arrivée sur DevOS', content: '# Checklist' }, service);
  assert.deepEqual(result, { status: 201, body: { id: 'doc-2', title: 'Arrivée sur DevOS', content: '# Checklist', pageType: 'onboarding' } });
});

test('rejects an onboarding page without content', async () => {
  const result = await handleDocsRequest('POST', '/api/docs/onboarding', { title: 'Arrivée sur DevOS' }, service);
  assert.equal(result.status, 400);
});
