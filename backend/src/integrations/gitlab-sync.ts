import { extractIssueIids } from './gitlab-links.js';
import { projectGitLabStatus, type GitLabStatusProjection, type MergeRequestState, type PipelineStatus } from './gitlab-status.js';
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

/** Dernière écriture gagne, comparée par timestamp; une égalité conserve l'état local (aucune écriture inutile). */
export function resolveConflict(local: { updatedAt: Date }, remote: { updatedAt: Date }): 'local' | 'remote' {
  return remote.updatedAt.getTime() > local.updatedAt.getTime() ? 'remote' : 'local';
}

export interface AuditLogSync {
  record(entry: { entityId: string; action: string; decision: 'local' | 'remote'; localUpdatedAt: Date; remoteUpdatedAt: Date }): Promise<void>;
}

export async function pushItemToGitLab(
  item: SyncItem & { updatedAt: Date },
  remote: { updatedAt: Date },
  projectId: string,
  issueIid: number,
  gitlab: Pick<GitLabClient, 'updateIssue'>,
  audit?: AuditLogSync,
): Promise<void> {
  const decision = resolveConflict(item, remote);
  await audit?.record({ entityId: item.id, action: 'push_to_gitlab', decision, localUpdatedAt: item.updatedAt, remoteUpdatedAt: remote.updatedAt });
  if (decision !== 'local') return;
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

export interface GitLabStatusSync {
  findItemIdByGitLabIssue(gitlabProjectId: string, issueIid: number): Promise<string | null>;
  applyStatus(itemId: string, status: GitLabStatusProjection): Promise<void>;
}

function normalizeMergeRequestState(state: unknown): MergeRequestState | undefined {
  if (state === 'opened' || state === 'reopened') return 'opened';
  if (state === 'merged') return 'merged';
  if (state === 'closed') return 'closed';
  return undefined;
}

function normalizePipelineStatus(status: unknown): PipelineStatus | undefined {
  const known: readonly PipelineStatus[] = ['created', 'pending', 'running', 'success', 'failed', 'canceled', 'skipped'];
  return known.find((candidate) => candidate === status);
}

export async function processGitLabMergeRequestWebhook(payload: unknown, sync: GitLabStatusSync): Promise<void> {
  if (!payload || typeof payload !== 'object') return;
  const attributes = (payload as { object_attributes?: Record<string, unknown> }).object_attributes;
  const project = (payload as { project?: { id?: number } }).project;
  if (!attributes || !project?.id) return;
  const state = normalizeMergeRequestState(attributes.state);
  if (!state) return;
  const title = typeof attributes.title === 'string' ? attributes.title : '';
  const description = typeof attributes.description === 'string' ? attributes.description : '';
  const gitlabProjectId = String(project.id);
  const projection = projectGitLabStatus(state);
  for (const issueIid of extractIssueIids(title, description)) {
    const itemId = await sync.findItemIdByGitLabIssue(gitlabProjectId, issueIid);
    if (itemId) await sync.applyStatus(itemId, projection);
  }
}

// Un pipeline n'est propagé sur une carte que lorsqu'il est rattache a une merge request
// (payload.merge_request present) : un pipeline de branche seule n'a pas de cible fiable.
export async function processGitLabPipelineWebhook(payload: unknown, sync: GitLabStatusSync): Promise<void> {
  if (!payload || typeof payload !== 'object') return;
  const attributes = (payload as { object_attributes?: Record<string, unknown> }).object_attributes;
  const mergeRequest = (payload as { merge_request?: Record<string, unknown> }).merge_request;
  const project = (payload as { project?: { id?: number } }).project;
  if (!attributes || !project?.id || !mergeRequest) return;
  const pipelineStatus = normalizePipelineStatus(attributes.status);
  if (!pipelineStatus) return;
  const mergeRequestState = normalizeMergeRequestState(mergeRequest.state);
  if (!mergeRequestState) return;
  const title = typeof mergeRequest.title === 'string' ? mergeRequest.title : '';
  const gitlabProjectId = String(project.id);
  const projection = projectGitLabStatus(mergeRequestState, pipelineStatus);
  for (const issueIid of extractIssueIids(title)) {
    const itemId = await sync.findItemIdByGitLabIssue(gitlabProjectId, issueIid);
    if (itemId) await sync.applyStatus(itemId, projection);
  }
}