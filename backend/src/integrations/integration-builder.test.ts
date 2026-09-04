import assert from 'node:assert/strict';
import test from 'node:test';

import { testIntegration } from './integration-builder.js';

test('reports unreachable when the fetch itself throws', async () => {
  const result = await testIntegration({ baseUrl: 'https://down.test', authType: 'none' }, async () => { throw new Error('ECONNREFUSED'); });
  assert.deepEqual(result, { reachable: false, detectedApiType: 'unknown', error: 'ECONNREFUSED' });
});

test('reports unreachable on a non-2xx health check', async () => {
  const result = await testIntegration({ baseUrl: 'https://api.test', authType: 'none' }, async () => new Response(null, { status: 401 }));
  assert.deepEqual(result, { reachable: false, status: 401, detectedApiType: 'unknown', error: 'HTTP 401' });
});

test('detects an OpenAPI document at /openapi.json', async () => {
  const result = await testIntegration({ baseUrl: 'https://api.test', authType: 'none' }, async (input) =>
    String(input).endsWith('/openapi.json') ? new Response('{}', { status: 200 }) : new Response(null, { status: 200 }));
  assert.deepEqual(result, { reachable: true, status: 200, detectedApiType: 'openapi' });
});

test('falls back to rest-generic when no OpenAPI/Swagger document is found', async () => {
  const result = await testIntegration({ baseUrl: 'https://api.test', authType: 'none' }, async (input) =>
    String(input).endsWith('/') || !String(input).includes('.json') ? new Response(null, { status: 200 }) : new Response(null, { status: 404 }));
  assert.deepEqual(result, { reachable: true, status: 200, detectedApiType: 'rest-generic' });
});

test('sends a Basic authorization header built from username/password credentials', async () => {
  let receivedAuth: string | null = null;
  await testIntegration(
    { baseUrl: 'https://api.test', authType: 'basic', credentials: { username: 'admin', password: 'secret' } },
    async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response(null, { status: 404 }); },
  );
  assert.equal(receivedAuth, `Basic ${Buffer.from('admin:secret').toString('base64')}`);
});

test('sends a Bearer authorization header built from a token credential', async () => {
  let receivedAuth: string | null = null;
  await testIntegration(
    { baseUrl: 'https://api.test', authType: 'bearer', credentials: { token: 'tok-123' } },
    async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response(null, { status: 404 }); },
  );
  assert.equal(receivedAuth, 'Bearer tok-123');
});

test('sends a custom API key header when configured', async () => {
  let receivedHeader: string | null = null;
  await testIntegration(
    { baseUrl: 'https://api.test', authType: 'apiKey', credentials: { apiKey: 'key-abc', apiKeyHeader: 'X-Custom-Key' } },
    async (_input, init) => { receivedHeader = new Headers(init?.headers).get('X-Custom-Key'); return new Response(null, { status: 404 }); },
  );
  assert.equal(receivedHeader, 'key-abc');
});
