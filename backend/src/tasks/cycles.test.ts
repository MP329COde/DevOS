import assert from 'node:assert/strict';
import test from 'node:test';

import { carryIncompleteItems, closeCycle } from './cycles.js';

test('carries only incomplete items to the next cycle', () => {
  assert.deepEqual(carryIncompleteItems([
    { id: 'a', status: 'in_progress', cycleId: 'current' },
    { id: 'b', status: 'done', cycleId: 'current' },
    { id: 'c', status: 'backlog', cycleId: null },
  ], 'current', 'next'), [
    { id: 'a', status: 'in_progress', cycleId: 'next' },
    { id: 'b', status: 'done', cycleId: 'current' },
    { id: 'c', status: 'backlog', cycleId: null },
  ]);
});

test('closes a cycle at the supplied time', () => {
  const now = new Date('2026-09-03T12:00:00Z');
  assert.equal(closeCycle({ closedAt: null }, now).closedAt, now);
});