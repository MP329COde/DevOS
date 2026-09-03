import assert from 'node:assert/strict';
import test from 'node:test';

import { handleTriageRequest } from './triage-http.js';

test('lists pending triage and accepts an item explicitly', async () => {
  const calls: string[] = [];
  const service = { async listPending() { return [{ id: 'a', triage: 'pending' }]; }, async transition(id: string, status: string) { calls.push(`${id}:${status}`); return { id, triage: status }; } };
  assert.deepEqual((await handleTriageRequest('GET', '/api/triage', service)).body, [{ id: 'a', triage: 'pending' }]);
  assert.deepEqual((await handleTriageRequest('POST', '/api/triage/a/accept', service)).body, { id: 'a', triage: 'accepted' });
  assert.deepEqual(calls, ['a:accepted']);
});