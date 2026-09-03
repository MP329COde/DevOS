import assert from 'node:assert/strict';
import test from 'node:test';

import { formatLabel, parseLabel } from './labels.js';

test('normalizes a GitLab-style label', () => {
  const label = parseLabel(' Priority::high ');
  assert.deepEqual(label, { prefix: 'priority', value: 'high' });
  assert.equal(formatLabel(label), 'priority::high');
});

test('rejects labels without a non-empty prefix and value', () => {
  assert.throws(() => parseLabel('bug'), /prefix::value/);
  assert.throws(() => parseLabel('type::'), /prefix::value/);
});