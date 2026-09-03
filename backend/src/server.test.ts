import assert from 'node:assert/strict';
import test from 'node:test';

import { createServer } from './server.js';

async function request(server: ReturnType<typeof createServer>, method: string, path: string, body?: string, headers?: Record<string, string>): Promise<{ status: number; body: unknown; headers: Headers }> {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not bind to a port');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method, ...(body !== undefined ? { body, headers: { 'content-type': 'application/json', ...headers } } : { headers }) });
  const text = await response.text();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}

test('routes a time-tracking start without crashing, even though it starts with /api/items', async () => {
  let started = false;
  const server = createServer(undefined, { async list() { return []; }, async create() { return {}; }, async update() { return {}; }, async delete() { return {}; } }, undefined, undefined, {
    async history() { return []; },
    async start() { started = true; return { id: 'timer-1' }; },
    async stop() { return {}; },
  });
  const result = await request(server, 'POST', '/api/items/item-1/time');
  assert.equal(started, true);
  assert.equal(result.status, 201);
  assert.deepEqual(result.body, { id: 'timer-1' });
});

test('never crashes the server process on a malformed JSON body', async () => {
  const server = createServer(undefined, { async list() { return []; }, async create() { return {}; }, async update() { return {}; }, async delete() { return {}; } });
  const result = await request(server, 'PATCH', '/api/items/item-1', 'not json');
  assert.equal(result.status, 500);
});

test('rejects an empty body on a PATCH with a 400 instead of crashing the server', async () => {
  const server = createServer(undefined, { async list() { return []; }, async create() { return {}; }, async update() { return {}; }, async delete() { return {}; } });
  const result = await request(server, 'PATCH', '/api/items/item-1', '');
  assert.equal(result.status, 400);
});

test('reflects the request origin in CORS headers so the frontend can call a cross-origin API', async () => {
  const server = createServer(undefined, { async list() { return []; }, async create() { return {}; }, async update() { return {}; }, async delete() { return {}; } });
  const result = await request(server, 'GET', '/api/items', undefined, { origin: 'http://localhost:5173' });
  assert.equal(result.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(result.headers.get('access-control-allow-credentials'), null);
});

test('answers an OPTIONS preflight without routing it to a handler', async () => {
  const server = createServer();
  const result = await request(server, 'OPTIONS', '/api/items', undefined, { origin: 'http://localhost:5173' });
  assert.equal(result.status, 204);
  assert.equal(result.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});
