import assert from 'node:assert/strict';
import test from 'node:test';

import { projectGitLabStatus } from './gitlab-status.js';

test('maps merged MR to done and exposes pipeline status', () => {
  assert.deepEqual(projectGitLabStatus('merged', 'success'), { itemStatus: 'done', mergeRequestState: 'merged', pipelineStatus: 'success' });
});

test('maps closed or failed work to blocked', () => {
  assert.equal(projectGitLabStatus('closed').itemStatus, 'blocked');
  assert.equal(projectGitLabStatus('opened', 'failed').itemStatus, 'blocked');
});