import assert from 'node:assert/strict';
import test from 'node:test';

import { importIssueToTriage, processGitLabIssueWebhook, processGitLabMergeRequestWebhook, processGitLabPipelineWebhook, pushItemToGitLab } from './gitlab-sync.js';

test('imports GitLab issues into pending triage', async () => {
  let created: unknown;
  const item = await importIssueToTriage({ id: 1, iid: 4, title: 'Bug', description: 'Details', state: 'opened', labels: [], web_url: '' }, { async create(input) { created = input; return { id: 'item-1', ...input, description: input.description ?? null, title: input.title, status: 'backlog' }; }, async update() { throw new Error('unused'); } });
  assert.equal(item.triage, 'pending');
  assert.deepEqual(created, { title: 'Bug', description: 'Details', triage: 'pending' });
});

test('pushes a completed linked item as a closed GitLab issue', async () => {
  let update: unknown;
  await pushItemToGitLab({ id: 'item-1', title: 'Done', description: null, status: 'done', triage: 'accepted' }, '42', 4, { async updateIssue(project, iid, payload) { update = { project, iid, payload }; } });
  assert.deepEqual(update, { project: '42', iid: 4, payload: { title: 'Done', description: undefined, stateEvent: 'close' } });
});

test('processes an issue webhook through the pending triage importer', async () => {
  let imported = false;
  const result = await processGitLabIssueWebhook({ object_attributes: { iid: 9, title: 'Webhook issue', description: 'Body' } }, {
    async importIssue(issue) { imported = true; return { id: 'item-9', title: issue.title, description: issue.description, status: 'backlog', triage: 'pending' }; },
  });
  assert.equal(imported, true);
  assert.equal(result?.triage, 'pending');
});

test('applies a done status when a merge request referencing an item is merged', async () => {
  let applied: unknown;
  await processGitLabMergeRequestWebhook(
    { object_attributes: { state: 'merged', title: 'Fixes #4' }, project: { id: 42 } },
    {
      async findItemIdByGitLabIssue(gitlabProjectId, issueIid) { assert.equal(gitlabProjectId, '42'); assert.equal(issueIid, 4); return 'item-4'; },
      async applyStatus(itemId, status) { applied = { itemId, status }; },
    },
  );
  assert.deepEqual(applied, { itemId: 'item-4', status: { itemStatus: 'done', mergeRequestState: 'merged', pipelineStatus: undefined } });
});

test('does not apply a status when no item is linked to the referenced issue', async () => {
  let applied = false;
  await processGitLabMergeRequestWebhook(
    { object_attributes: { state: 'opened', title: 'Fixes #4' }, project: { id: 42 } },
    { async findItemIdByGitLabIssue() { return null; }, async applyStatus() { applied = true; } },
  );
  assert.equal(applied, false);
});

test('ignores merge request webhooks with an unrecognized state', async () => {
  let applied = false;
  await processGitLabMergeRequestWebhook(
    { object_attributes: { state: 'locked', title: 'Fixes #4' }, project: { id: 42 } },
    { async findItemIdByGitLabIssue() { return 'item-4'; }, async applyStatus() { applied = true; } },
  );
  assert.equal(applied, false);
});

test('applies a blocked status when a pipeline attached to a merge request fails', async () => {
  let applied: unknown;
  await processGitLabPipelineWebhook(
    { object_attributes: { status: 'failed' }, merge_request: { state: 'opened', title: 'Fixes #7' }, project: { id: 42 } },
    {
      async findItemIdByGitLabIssue(gitlabProjectId, issueIid) { assert.equal(gitlabProjectId, '42'); assert.equal(issueIid, 7); return 'item-7'; },
      async applyStatus(itemId, status) { applied = { itemId, status }; },
    },
  );
  assert.deepEqual(applied, { itemId: 'item-7', status: { itemStatus: 'blocked', mergeRequestState: 'opened', pipelineStatus: 'failed' } });
});

test('ignores pipeline webhooks that are not attached to a merge request', async () => {
  let applied = false;
  await processGitLabPipelineWebhook(
    { object_attributes: { status: 'failed' }, project: { id: 42 } },
    { async findItemIdByGitLabIssue() { return 'item-7'; }, async applyStatus() { applied = true; } },
  );
  assert.equal(applied, false);
});