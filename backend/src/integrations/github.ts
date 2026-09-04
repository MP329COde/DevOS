export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: (string | { name: string })[];
  html_url: string;
  updated_at?: string;
}

export interface GitHubClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface GitHubUpdateIssueInput {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
}

export interface GitHubRepo {
  full_name: string;
  html_url: string;
  default_branch: string;
  pushed_at: string;
  open_issues_count?: number;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
  commit: { sha: string };
}

export interface GitHubPull {
  id: number;
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  html_url: string;
  user: { login: string } | null;
  updated_at: string;
  head: { ref: string };
  base: { ref: string };
}

export interface GitHubWorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  updated_at: string;
  head_branch: string;
}

export interface GitHubCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } | null };
  html_url?: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  published_at: string;
  html_url: string;
}

export interface GitHubCompare {
  ahead_by: number;
  behind_by: number;
  commits: GitHubCommit[];
}

/** Thin client for the GitHub REST API (issues), authenticated via a bearer token (personal access token or GitHub App installation token). */
export class GitHubClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: GitHubClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async *listIssues(owner: string, repo: string): AsyncGenerator<GitHubIssue> {
    let url: string | undefined = `${this.options.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`;
    while (url) {
      const response = await this.fetchImpl(url, { headers: this.headers() });
      if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
      const issues = (await response.json()) as GitHubIssue[];
      for (const issue of issues) yield issue;
      url = parseNext(response.headers.get('link'));
    }
  }

  public async addComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
    await this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  }

  public async updateIssue(owner: string, repo: string, issueNumber: number, update: GitHubUpdateIssueInput): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(update),
    });
  }

  /** Vue dépôt unifiée (AM.4) : détails du dépôt (URL, branche par défaut, dernière activité). */
  public async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  public async *listBranches(owner: string, repo: string): AsyncGenerator<GitHubBranch> {
    let url: string | undefined = `${this.options.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`;
    while (url) {
      const response = await this.fetchImpl(url, { headers: this.headers() });
      if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
      const branches = (await response.json()) as GitHubBranch[];
      for (const branch of branches) yield branch;
      url = parseNext(response.headers.get('link'));
    }
  }

  public async *listPulls(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'all'): AsyncGenerator<GitHubPull> {
    let url: string | undefined = `${this.options.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${state}&per_page=100`;
    while (url) {
      const response = await this.fetchImpl(url, { headers: this.headers() });
      if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
      const pulls = (await response.json()) as GitHubPull[];
      for (const pull of pulls) yield pull;
      url = parseNext(response.headers.get('link'));
    }
  }

  public async *listWorkflowRuns(owner: string, repo: string): AsyncGenerator<GitHubWorkflowRun> {
    let url: string | undefined = `${this.options.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=20`;
    while (url) {
      const response = await this.fetchImpl(url, { headers: this.headers() });
      if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
      const payload = (await response.json()) as { workflow_runs: GitHubWorkflowRun[] };
      for (const run of payload.workflow_runs ?? []) yield run;
      url = parseNext(response.headers.get('link'));
    }
  }

  public async *listCommits(owner: string, repo: string, sha?: string, perPage = 20): AsyncGenerator<GitHubCommit> {
    const shaParam = sha ? `&sha=${encodeURIComponent(sha)}` : '';
    let url: string | undefined = `${this.options.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${perPage}${shaParam}`;
    while (url) {
      const response = await this.fetchImpl(url, { headers: this.headers() });
      if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
      const commits = (await response.json()) as GitHubCommit[];
      for (const commit of commits) yield commit;
      url = parseNext(response.headers.get('link'));
    }
  }

  public async *listReleases(owner: string, repo: string): AsyncGenerator<GitHubRelease> {
    let url: string | undefined = `${this.options.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=20`;
    while (url) {
      const response = await this.fetchImpl(url, { headers: this.headers() });
      if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
      const releases = (await response.json()) as GitHubRelease[];
      for (const release of releases) yield release;
      url = parseNext(response.headers.get('link'));
    }
  }

  /** Compare deux refs (ahead/behind) — utilisé pour le diff branche/branche par défaut. */
  public async compareCommits(owner: string, repo: string, base: string, head: string): Promise<GitHubCompare> {
    return this.request<GitHubCompare>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);
  }

  private headers(extra?: HeadersInit): HeadersInit {
    return {
      ...extra,
      authorization: `Bearer ${this.options.token}`,
      accept: 'application/vnd.github+json',
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { ...init, headers: this.headers(init?.headers) });
    if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}

function parseNext(link: string | null): string | undefined {
  const match = link?.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1];
}
