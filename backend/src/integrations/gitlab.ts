export interface GitLabTokenProvider {
  getToken(): Promise<string>;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  labels: string[];
  web_url: string;
  updated_at?: string;
}

export interface GitLabProject {
  id: number;
  path_with_namespace: string;
  default_branch: string | null;
  web_url?: string;
  last_activity_at?: string;
}

export interface GitLabBranchCommit {
  id: string;
  short_id?: string;
  title?: string;
  message?: string;
  author_name?: string;
  committed_date?: string;
}

export interface GitLabBranch {
  name: string;
  protected: boolean;
  default: boolean;
  merged: boolean;
  developers_can_push?: boolean;
  developers_can_merge?: boolean;
  commit: GitLabBranchCommit;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  state: string;
  source_branch: string;
  target_branch: string;
  web_url: string;
  author: { name?: string; username?: string } | null;
  updated_at: string;
}

export interface GitLabPipeline {
  id: number;
  status: string;
  ref: string;
  web_url: string;
  updated_at: string;
  created_at?: string;
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message?: string;
  author_name: string;
  committed_date: string;
}

export interface GitLabRelease {
  tag_name: string;
  name: string | null;
  released_at: string;
}

export interface GitLabCompareResult {
  commits: GitLabCommit[];
}

export interface GitLabTreeEntry {
  path: string;
  type: 'blob' | 'tree';
}

export interface GitLabClientOptions {
  baseUrl: string;
  tokenProvider: GitLabTokenProvider;
  fetchImpl?: typeof fetch;
}

export class GitLabClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: GitLabClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async *listIssues(projectId: string): AsyncGenerator<GitLabIssue> {
    let url: string | undefined = `${this.options.baseUrl}/projects/${encodeURIComponent(projectId)}/issues`;
    while (url) {
      const page: { body: GitLabIssue[]; next?: string } = await this.request<GitLabIssue[]>(url);
      for (const issue of page.body) yield issue;
      url = page.next;
    }
  }

  public async *listProjects(): AsyncGenerator<GitLabProject> {
    let url: string | undefined = `${this.options.baseUrl}/projects?membership=true&simple=true`;
    while (url) {
      const page: { body: GitLabProject[]; next?: string } = await this.request<GitLabProject[]>(url);
      for (const project of page.body) yield project;
      url = page.next;
    }
  }

  /** Returns the raw file content at `path` on `ref`, or `null` if the file does not exist in the repository. */
  public async getRawFile(projectId: string, path: string, ref: string): Promise<string | null> {
    const token = await this.options.tokenProvider.getToken();
    const url = `${this.options.baseUrl}/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ref)}`;
    const response = await this.fetchImpl(url, { headers: { 'private-token': token } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitLab API request failed (${response.status})`);
    return response.text();
  }

  /** Lists blob/tree entries recursively under `path` (empty for the repository root) on `ref`. Returns an empty array if the path does not exist. */
  public async *listRepositoryTree(projectId: string, path: string, ref: string): AsyncGenerator<GitLabTreeEntry> {
    let url: string | undefined = `${this.options.baseUrl}/projects/${encodeURIComponent(projectId)}/repository/tree?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(ref)}&recursive=true&per_page=100`;
    while (url) {
      const token = await this.options.tokenProvider.getToken();
      const response: Response = await this.fetchImpl(url, { headers: { 'private-token': token } });
      if (response.status === 404) return;
      if (!response.ok) throw new Error(`GitLab API request failed (${response.status})`);
      const entries = (await response.json()) as GitLabTreeEntry[];
      for (const entry of entries) yield entry;
      url = parseNext(response.headers.get('link'));
    }
  }

  public async addNote(projectId: string, issueIid: number, body: string): Promise<void> {
    await this.request(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}/notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  }

  public async updateIssue(projectId: string, issueIid: number, update: { title?: string; description?: string; labels?: string[]; stateEvent?: 'close' | 'reopen' }): Promise<void> {
    const { stateEvent, ...rest } = update;
    await this.request(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...rest, labels: update.labels?.join(','), state_event: stateEvent }),
    });
  }

  /** Vue dépôt unifiée (AM.4) : détails du projet (URL, branche par défaut, dernière activité). */
  public async getProject(projectId: string): Promise<GitLabProject> {
    const { body } = await this.request<GitLabProject>(`/projects/${encodeURIComponent(projectId)}`);
    return body;
  }

  public async *listBranches(projectId: string): AsyncGenerator<GitLabBranch> {
    let url: string | undefined = `${this.options.baseUrl}/projects/${encodeURIComponent(projectId)}/repository/branches?per_page=100`;
    while (url) {
      const page: { body: GitLabBranch[]; next?: string } = await this.request<GitLabBranch[]>(url);
      for (const branch of page.body) yield branch;
      url = page.next;
    }
  }

  public async *listMergeRequests(projectId: string, state: 'opened' | 'closed' | 'merged' | 'all' = 'all'): AsyncGenerator<GitLabMergeRequest> {
    let url: string | undefined = `${this.options.baseUrl}/projects/${encodeURIComponent(projectId)}/merge_requests?state=${state}&per_page=100`;
    while (url) {
      const page: { body: GitLabMergeRequest[]; next?: string } = await this.request<GitLabMergeRequest[]>(url);
      for (const mr of page.body) yield mr;
      url = page.next;
    }
  }

  public async *listPipelines(projectId: string): AsyncGenerator<GitLabPipeline> {
    let url: string | undefined = `${this.options.baseUrl}/projects/${encodeURIComponent(projectId)}/pipelines?per_page=20&order_by=updated_at`;
    while (url) {
      const page: { body: GitLabPipeline[]; next?: string } = await this.request<GitLabPipeline[]>(url);
      for (const pipeline of page.body) yield pipeline;
      url = page.next;
    }
  }

  /** Retourne le pipeline le plus récent, ou `null` si le projet n'a aucun pipeline. */
  public async getLatestPipeline(projectId: string): Promise<GitLabPipeline | null> {
    const { body } = await this.request<GitLabPipeline[]>(`/projects/${encodeURIComponent(projectId)}/pipelines?per_page=1&order_by=updated_at`);
    return body[0] ?? null;
  }

  public async *listCommits(projectId: string, ref?: string, perPage = 20): AsyncGenerator<GitLabCommit> {
    const refParam = ref ? `&ref_name=${encodeURIComponent(ref)}` : '';
    let url: string | undefined = `${this.options.baseUrl}/projects/${encodeURIComponent(projectId)}/repository/commits?per_page=${perPage}${refParam}`;
    while (url) {
      const page: { body: GitLabCommit[]; next?: string } = await this.request<GitLabCommit[]>(url);
      for (const commit of page.body) yield commit;
      url = page.next;
    }
  }

  public async *listReleases(projectId: string): AsyncGenerator<GitLabRelease> {
    let url: string | undefined = `${this.options.baseUrl}/projects/${encodeURIComponent(projectId)}/releases?per_page=20`;
    while (url) {
      const page: { body: GitLabRelease[]; next?: string } = await this.request<GitLabRelease[]>(url);
      for (const release of page.body) yield release;
      url = page.next;
    }
  }

  /** Compare deux refs (commits présents dans `to` mais pas dans `from`) — utilisé pour le diff branche/main. */
  public async compare(projectId: string, from: string, to: string): Promise<GitLabCompareResult> {
    const { body } = await this.request<GitLabCompareResult>(`/projects/${encodeURIComponent(projectId)}/repository/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    return body;
  }

  private async request<T>(pathOrUrl: string, init?: RequestInit): Promise<{ body: T; next?: string }> {
    const token = await this.options.tokenProvider.getToken();
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${this.options.baseUrl}${pathOrUrl}`;
    const response = await this.fetchImpl(url, { ...init, headers: { ...init?.headers, 'private-token': token } });
    if (!response.ok) throw new Error(`GitLab API request failed (${response.status})`);
    return { body: (await response.json()) as T, next: parseNext(response.headers.get('link')) };
  }
}

function parseNext(link: string | null): string | undefined {
  const match = link?.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1];
}