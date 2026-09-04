import assert from 'node:assert/strict';
import test from 'node:test';

import { MeilisearchClient } from './meilisearch.js';

function client(fetchImpl: typeof fetch) {
  return new MeilisearchClient({ baseUrl: 'http://meili.test:7700', apiKey: 'secret-key', fetchImpl });
}

test('lists indexes extracted from the results array', async () => {
  let requestedUrl = '';
  const indexes = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ results: [{ uid: 'items', primaryKey: 'id' }, { uid: 'docs', primaryKey: null }] }), { status: 200 });
  }).listIndexes();
  assert.equal(requestedUrl, 'http://meili.test:7700/indexes');
  assert.deepEqual(indexes, [{ uid: 'items', primaryKey: 'id' }, { uid: 'docs', primaryKey: null }]);
});

test('search posts the query and returns the parsed response verbatim', async () => {
  let requestedUrl = '';
  let sentBody: unknown;
  const result = await client(async (input, init) => {
    requestedUrl = String(input);
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ hits: [{ id: '1' }], estimatedTotalHits: 1, processingTimeMs: 2 }), { status: 200 });
  }).search('items', 'foo');
  assert.equal(requestedUrl, 'http://meili.test:7700/indexes/items/search');
  assert.deepEqual(sentBody, { q: 'foo' });
  assert.deepEqual(result, { hits: [{ id: '1' }], estimatedTotalHits: 1, processingTimeMs: 2 });
});

test('sends the api key as a bearer token', async () => {
  let headers: Headers | undefined;
  await client(async (_input, init) => {
    headers = new Headers(init?.headers);
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  }).listIndexes();
  assert.equal(headers?.get('authorization'), 'Bearer secret-key');
});

test('rejects failed Meilisearch API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 500 })).listIndexes(), /failed \(500\)/);
});
