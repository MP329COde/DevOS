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