import type { GitLabClient, GitLabIssue } from './gitlab.js';

export interface SyncItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  triage: 'none' | 'pending' | 'accepted' | 'rejected';
}

export interface SyncItemRepository {
  create(input: { title: string; description?: string; triage: 'pending' }): Promise<SyncItem>;
  update(id: string, input: { title?: string; description?: string; status?: string }): Promise<SyncItem>;
}

export async function importIssueToTriage(issue: GitLabIssue, repository: SyncItemRepository): Promise<SyncItem> {
  return repository.create({ title: issue.title, description: issue.description ?? undefined, triage: 'pending' });
}

export async function pushItemToGitLab(item: SyncItem, projectId: string, issueIid: number, gitlab: Pick<GitLabClient, 'updateIssue'>): Promise<void> {
  await gitlab.updateIssue(projectId, issueIid, {
    title: item.title,
    description: item.description ?? undefined,
    stateEvent: item.status === 'done' ? 'close' : 'reopen',
  });
}

export interface GitLabWebhookSync {
  importIssue(issue: GitLabIssue): Promise<SyncItem>;
}

export async function processGitLabIssueWebhook(payload: unknown, sync: GitLabWebhookSync): Promise<SyncItem | null> {
  if (!payload || typeof payload !== 'object') return null;
  const attributes = (payload as { object_attributes?: Record<string, unknown> }).object_attributes;
  if (!attributes || typeof attributes.iid !== 'number' || typeof attributes.title !== 'string') return null;
  return sync.importIssue({
    id: typeof attributes.id === 'number' ? attributes.id : attributes.iid,
    iid: attributes.iid,
    title: attributes.title,
    description: typeof attributes.description === 'string' ? attributes.description : null,
    state: typeof attributes.state === 'string' ? attributes.state : 'opened',
    labels: [],
    web_url: typeof attributes.url === 'string' ? attributes.url : '',
  });
}