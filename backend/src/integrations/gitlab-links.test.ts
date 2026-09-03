import assert from 'node:assert/strict';
import test from 'node:test';

import { extractIssueIids } from './gitlab-links.js';

test('extracts unique positive issue IIDs from branches and commits', () => {
  assert.deepEqual(extractIssueIids('feature #42 improve api', 'fix #7 and #42'), [7, 42]);
});

test('ignores embedded hashtags and zero', () => {
  assert.deepEqual(extractIssueIids('topic#42 #0 #abc'), []);
});