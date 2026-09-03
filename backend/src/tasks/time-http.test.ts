import assert from 'node:assert/strict';
import test from 'node:test';

import { handleTimeRequest } from './time-http.js';

test('exposes time history, start and stop routes', async () => {
  const service = { async history() { return []; }, async start(itemId: string) { return { itemId }; }, async stop(id: string) { return { id, stopped: true }; } };
  assert.equal((await handleTimeRequest('GET', '/api/items/item-1/time', service)).status, 200);
  assert.deepEqual((await handleTimeRequest('POST', '/api/items/item-1/time', service)).body, { itemId: 'item-1' });
  assert.deepEqual((await handleTimeRequest('POST', '/api/time/entry-1/stop', service)).body, { id: 'entry-1', stopped: true });
});