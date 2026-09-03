export type MergeRequestState = 'opened' | 'merged' | 'closed';
export type PipelineStatus = 'created' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped';

export interface GitLabStatusProjection {
  itemStatus: 'in_progress' | 'done' | 'blocked';
  mergeRequestState: MergeRequestState;
  pipelineStatus?: PipelineStatus;
}

export function projectGitLabStatus(mergeRequestState: MergeRequestState, pipelineStatus?: PipelineStatus): GitLabStatusProjection {
  return {
    itemStatus: mergeRequestState === 'merged' ? 'done' : mergeRequestState === 'closed' || pipelineStatus === 'failed' ? 'blocked' : 'in_progress',
    mergeRequestState,
    pipelineStatus,
  };
}