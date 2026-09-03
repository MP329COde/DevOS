import assert from 'node:assert/strict';
import test from 'node:test';

import { createItemLink, inverseLink } from './item-links.js';

test('creates typed links and inverts blocking direction', () => {
  const link = createItemLink('a', 'b', 'blocks');
  assert.deepEqual(inverseLink(link), { sourceId: 'b', targetId: 'a', type: 'is_blocked_by' });
});

test('rejects self-links', () => {
  assert.throws(() => createItemLink('a', 'a', 'relates_to'), /two different/);
});