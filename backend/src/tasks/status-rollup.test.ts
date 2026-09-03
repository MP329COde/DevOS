import assert from 'node:assert/strict';
import test from 'node:test';

import { rollupStatus } from './status-rollup.js';

test('keeps an empty parent in backlog', () => {
  assert.equal(rollupStatus([]), 'backlog');
});

test('marks a parent done only when every child is done', () => {
  assert.equal(rollupStatus(['done', 'done']), 'done');
  assert.equal(rollupStatus(['done', 'in_progress']), 'in_progress');
});

test('blocked children take priority over progress', () => {
  assert.equal(rollupStatus(['in_progress', 'blocked', 'done']), 'blocked');
});