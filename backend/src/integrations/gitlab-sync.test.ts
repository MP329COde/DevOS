import assert from 'node:assert/strict';
import test from 'node:test';

import { importIssueToTriage, processGitLabIssueWebhook, pushItemToGitLab } from './gitlab-sync.js';

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