import assert from 'node:assert/strict';
import test from 'node:test';

import { handleReleaseRequest, type ReleaseHttpService } from './release-http.js';

function fakeService(overrides: Partial<ReleaseHttpService> = {}): ReleaseHttpService {
  return {
    list: async () => [],
    get: async () => null,
    create: async (input) => ({ id: 'r1', ...input }) as never,
    update: async () => ({}) as never,
    delete: async () => undefined,
    publish: async () => ({}) as never,
    associatedItems: async () => [],
    ...overrides,
  };
}

test('lists releases, optionally filtered by devProjectId', async () => {
  let receivedFilter: string | undefined;
  const service = fakeService({ list: async (devProjectId) => { receivedFilter = devProjectId; return []; } });
  await handleReleaseRequest('GET', '/api/releases?devProjectId=p1', null, service);
  assert.equal(receivedFilter, 'p1');
});

test('creates a release with required fields', async () => {
  const service = fakeService();
  const result = await handleReleaseRequest('POST', '/api/releases', { devProjectId: 'p1', version: '1.0.0' }, service);
  assert.equal(result.status, 201);
});

test('rejects creation without version', async () => {
  const service = fakeService();
  const result = await handleReleaseRequest('POST', '/api/releases', { devProjectId: 'p1' }, service);
  assert.equal(result.status, 400);
});

test('publishes a release', async () => {
  let publishedId: string | undefined;
  const service = fakeService({ publish: async (id) => { publishedId = id; return {} as never; } });
  const result = await handleReleaseRequest('POST', '/api/releases/r1/publish', null, service);
  assert.equal(result.status, 200);
  assert.equal(publishedId, 'r1');
});

test('returns 404 for unknown release on GET', async () => {
  const service = fakeService({ get: async () => null });
  const result = await handleReleaseRequest('GET', '/api/releases/missing', null, service);
  assert.equal(result.status, 404);
});
