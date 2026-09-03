import assert from 'node:assert/strict';
import test from 'node:test';

import { GitLabClient, type GitLabIssue } from './gitlab.js';
import { processGitLabIssueWebhook, processGitLabMergeRequestWebhook, pushItemToGitLab, resolveConflict, type SyncItem } from './gitlab-sync.js';

/**
 * Tests d'intégration bout-en-bout contre une vraie instance GitLab.
 * N'exécute rien par défaut: nécessite GITLAB_INTEGRATION_BASE_URL,
 * GITLAB_INTEGRATION_TOKEN et GITLAB_INTEGRATION_PROJECT_ID (voir README d'intégration).
 * Crée et supprime sa propre issue de test; ne touche à aucune autre donnée du projet.
 */
const baseUrl = process.env.GITLAB_INTEGRATION_BASE_URL;
const token = process.env.GITLAB_INTEGRATION_TOKEN;
const projectId = process.env.GITLAB_INTEGRATION_PROJECT_ID;
const runIntegration = Boolean(baseUrl && token && projectId);
const skip = runIntegration ? false : 'set GITLAB_INTEGRATION_BASE_URL/GITLAB_INTEGRATION_TOKEN/GITLAB_INTEGRATION_PROJECT_ID to run against a real GitLab instance';

async function createIssue(title: string, description: string): Promise<GitLabIssue> {
  const response = await fetch(`${baseUrl}/projects/${encodeURIComponent(projectId!)}/issues`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'private-token': token! },
    body: JSON.stringify({ title, description }),
  });
  if (!response.ok) throw new Error(`failed to create test issue (${response.status})`);
  return (await response.json()) as GitLabIssue;
}

async function deleteIssue(issueIid: number): Promise<void> {
  await fetch(`${baseUrl}/projects/${encodeURIComponent(projectId!)}/issues/${issueIid}`, {
    method: 'DELETE',
    headers: { 'private-token': token! },
  });
}

async function fetchNumericProjectId(): Promise<number> {
  const response = await fetch(`${baseUrl}/projects/${encodeURIComponent(projectId!)}`, { headers: { 'private-token': token! } });
  if (!response.ok) throw new Error(`failed to resolve the numeric project id (${response.status})`);
  const project = (await response.json()) as { id: number };
  return project.id;
}

test('imports a real GitLab issue into pending triage, then propagates a completed item back as closed', { skip }, async () => {
  const client = new GitLabClient({ baseUrl: baseUrl!, tokenProvider: { async getToken() { return token!; } } });
  const created = await createIssue('DevOS integration test issue', 'Created by the Phase 2 GitLab integration test suite.');
  try {
    const found: GitLabIssue[] = [];
    for await (const issue of client.listIssues(projectId!)) found.push(issue);
    const remote = found.find((issue) => issue.iid === created.iid);
    assert.ok(remote, 'the created issue must be visible through GitLabClient.listIssues');
    assert.equal(remote?.state, 'opened');

    let stored: SyncItem | undefined;
    const imported = await processGitLabIssueWebhook(
      { object_attributes: { iid: created.iid, title: remote!.title, description: remote!.description, state: remote!.state } },
      {
        async importIssue(issue) {
          stored = { id: `local-${issue.iid}`, title: issue.title, description: issue.description, status: 'backlog', triage: 'pending' };
          return stored;
        },
      },
    );
    assert.equal(imported?.triage, 'pending');

    const localItem: SyncItem & { updatedAt: Date } = { ...stored!, status: 'done', updatedAt: new Date() };
    const remoteState = { updatedAt: new Date(remote!.updated_at ?? created.updated_at ?? Date.now()) };
    await pushItemToGitLab(localItem, remoteState, projectId!, created.iid, client);

    const refreshed: GitLabIssue[] = [];
    for await (const issue of client.listIssues(projectId!)) refreshed.push(issue);
    const closed = refreshed.find((issue) => issue.iid === created.iid);
    assert.equal(closed?.state, 'closed', 'the real GitLab issue must be closed after pushing a done item');
  } finally {
    await deleteIssue(created.iid);
  }
});

test('resolves a real conflicting write in favor of whichever side is more recent', { skip }, async () => {
  const client = new GitLabClient({ baseUrl: baseUrl!, tokenProvider: { async getToken() { return token!; } } });
  const created = await createIssue('DevOS integration test conflict issue', 'Used to verify last-write-wins against real GitLab timestamps.');
  try {
    const staleLocal: SyncItem & { updatedAt: Date } = { id: 'local-conflict', title: 'Stale local title', description: null, status: 'done', triage: 'accepted', updatedAt: new Date(Date.now() - 60_000) };
    const freshRemote = { updatedAt: new Date() };
    assert.equal(resolveConflict(staleLocal, freshRemote), 'remote');

    let pushed = false;
    await pushItemToGitLab(staleLocal, freshRemote, projectId!, created.iid, { async updateIssue() { pushed = true; } });
    assert.equal(pushed, false, 'a stale local write must not overwrite a more recent remote issue');
  } finally {
    await deleteIssue(created.iid);
  }
});

test('propagates a real merge request state onto a linked item via the referenced issue', { skip }, async () => {
  const numericProjectId = runIntegration ? await fetchNumericProjectId() : 0;
  const created = await createIssue('DevOS integration test MR link', 'Referenced from a simulated merge request payload.');
  try {
    let applied: unknown;
    await processGitLabMergeRequestWebhook(
      { object_attributes: { state: 'merged', title: `Fixes #${created.iid}` }, project: { id: numericProjectId } },
      {
        async findItemIdByGitLabIssue(gitlabProjectId, issueIid) {
          assert.equal(issueIid, created.iid);
          return gitlabProjectId === String(numericProjectId) ? 'item-linked-to-real-issue' : null;
        },
        async applyStatus(itemId, status) { applied = { itemId, status }; },
      },
    );
    assert.deepEqual(applied, { itemId: 'item-linked-to-real-issue', status: { itemStatus: 'done', mergeRequestState: 'merged', pipelineStatus: undefined } });
  } finally {
    await deleteIssue(created.iid);
  }
});
