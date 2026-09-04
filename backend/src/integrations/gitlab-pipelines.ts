export interface GitLabPipelineTokenProvider {
  getToken(): Promise<string>;
}

export interface GitLabPipelinesClientOptions {
  baseUrl: string;
  tokenProvider: GitLabPipelineTokenProvider;
  fetchImpl?: typeof fetch;
}

export interface GitLabPipelineSummary {
  id: number;
  status: string;
  ref: string;
  web_url: string;
}

/**
 * Lists currently running pipelines for a GitLab project. Implemented as a standalone function
 * (rather than a `GitLabClient` method) to avoid touching the shared `gitlab.ts` client file.
 */
export async function listRunningPipelines(
  gitlab: GitLabPipelinesClientOptions,
  projectId: string,
): Promise<GitLabPipelineSummary[]> {
  const fetchImpl = gitlab.fetchImpl ?? fetch;
  const token = await gitlab.tokenProvider.getToken();
  const url = `${gitlab.baseUrl}/projects/${encodeURIComponent(projectId)}/pipelines?status=running`;
  const response = await fetchImpl(url, { headers: { 'private-token': token } });
  if (!response.ok) throw new Error(`GitLab API request failed (${response.status})`);
  const body = (await response.json()) as GitLabPipelineSummary[];
  return body.map((pipeline) => ({
    id: pipeline.id,
    status: pipeline.status,
    ref: pipeline.ref,
    web_url: pipeline.web_url,
  }));
}
