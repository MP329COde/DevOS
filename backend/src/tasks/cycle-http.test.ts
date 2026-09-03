import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCycleRequest } from './cycle-http.js';

test('exposes cycle list, create and explicit close routes', async () => {
  const service = {
    async list() { return []; },
    async create(input: { name: string }) { return input; },
    async close(id: string) { return { id, closed: true }; },
  };
  assert.equal((await handleCycleRequest('GET', '/api/cycles', null, service)).status, 200);
  assert.deepEqual((await handleCycleRequest('POST', '/api/cycles', { name: 'Sprint 1', startsAt: '2026-09-01', endsAt: '2026-09-14' }, service)).body, { name: 'Sprint 1', startsAt: '2026-09-01', endsAt: '2026-09-14' });
  assert.deepEqual((await handleCycleRequest('POST', '/api/cycles/a/close', null, service)).body, { id: 'a', closed: true });
});