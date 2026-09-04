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
