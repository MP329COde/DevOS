import assert from 'node:assert/strict';
import test from 'node:test';

import { validateGitLabIssueLink } from './gitlab-mapping.js';

test('validates a GitLab issue mapping', () => {
  assert.deepEqual(validateGitLabIssueLink({ itemId: 'item-1', gitlabProjectId: '42', issueIid: 7 }), { itemId: 'item-1', gitlabProjectId: '42', issueIid: 7 });
});

test('rejects missing or invalid issue identifiers', () => {
  assert.throws(() => validateGitLabIssueLink({ itemId: '', gitlabProjectId: '42', issueIid: 0 }), /require/);
});