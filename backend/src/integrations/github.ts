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

export interface GitHubWorkflowRunDetail {
  id: number;
  status: string;
  conclusion: string | null;
  headBranch: string;
  headSha: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
  runNumber: number;
  displayTitle: string;
}

export interface GitHubWorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  webUrl: string;
  steps: Array<{ name: string; status: string; conclusion: string | null; number: number }>;
}

export interface GitHubArtifact {
  id: number;
  name: string;
  sizeBytes: number;
  expired: boolean;
  archiveDownloadUrl: string;
}

export interface GitHubCheckRun {
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string;
  completedAt: string | null;
  detailsUrl: string | null;
}

export interface GitHubCodeScanningAlert {
  number: number;
  rule: { id: string; severity: string; description: string };
  state: string;
  htmlUrl: string;
}

export interface GitHubDependabotAlert {
  number: number;
  severity: string;
  package: { name: string; ecosystem: string };
  summary: string;
  htmlUrl: string;
}

export interface GitHubPackage {
  name: string;
  packageType: string;
  htmlUrl: string;
  latestVersion: string | null;
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

  /** Runs de workflow détaillés (AM.7, CI/CD par projet) — symétrique à listProjectPipelines côté GitLab. */
  public async listWorkflowRunsDetailed(owner: string, repo: string, limit = 20): Promise<GitHubWorkflowRunDetail[]> {
    const payload = await this.request<{ workflow_runs: RawWorkflowRun[] }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=${limit}`,
    );
    return (payload.workflow_runs ?? []).map(mapWorkflowRun);
  }

  public async getWorkflowRun(owner: string, repo: string, runId: number): Promise<GitHubWorkflowRunDetail> {
    const run = await this.request<RawWorkflowRun>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}`);
    return mapWorkflowRun(run);
  }

  public async listWorkflowJobs(owner: string, repo: string, runId: number): Promise<GitHubWorkflowJob[]> {
    const payload = await this.request<{ jobs: RawWorkflowJob[] }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}/jobs`,
    );
    return (payload.jobs ?? []).map(mapWorkflowJob);
  }

  public async getJobLog(owner: string, repo: string, jobId: number): Promise<string> {
    const response = await this.fetchImpl(
      `${this.options.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/jobs/${jobId}/logs`,
      { headers: this.headers() },
    );
    if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
    return response.text();
  }

  public async rerunWorkflow(owner: string, repo: string, runId: number): Promise<void> {
    const response = await this.fetchImpl(
      `${this.options.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}/rerun`,
      { method: 'POST', headers: this.headers() },
    );
    if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
  }

  public async listRunArtifacts(owner: string, repo: string, runId: number): Promise<GitHubArtifact[]> {
    const payload = await this.request<{ artifacts: RawArtifact[] }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}/artifacts`,
    );
    return (payload.artifacts ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      sizeBytes: a.size_in_bytes,
      expired: a.expired,
      archiveDownloadUrl: a.archive_download_url,
    }));
  }

  public async downloadArtifact(owner: string, repo: string, artifactId: number): Promise<{ contentType: string; body: Buffer }> {
    const response = await this.fetchImpl(
      `${this.options.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/artifacts/${artifactId}/zip`,
      { headers: this.headers() },
    );
    if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    return { contentType: response.headers.get('content-type') ?? 'application/zip', body: buffer };
  }

  /** Checks sur une ref (branche/sha) — source native pour la section Tests. */
  public async listChecksForRef(owner: string, repo: string, ref: string): Promise<GitHubCheckRun[]> {
    const payload = await this.request<{ check_runs: RawCheckRun[] }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}/check-runs`,
    );
    return (payload.check_runs ?? []).map((c) => ({
      name: c.name,
      status: c.status,
      conclusion: c.conclusion,
      startedAt: c.started_at,
      completedAt: c.completed_at,
      detailsUrl: c.details_url,
    }));
  }

  /** Alertes CodeQL ouvertes — source native pour la section Qualité/Sécurité. */
  public async listCodeScanningAlerts(owner: string, repo: string): Promise<GitHubCodeScanningAlert[]> {
    const alerts = await this.request<RawCodeScanningAlert[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/code-scanning/alerts?state=open`,
    );
    return alerts.map((a) => ({
      number: a.number,
      rule: { id: a.rule.id, severity: a.rule.severity, description: a.rule.description },
      state: a.state,
      htmlUrl: a.html_url,
    }));
  }

  /** Alertes Dependabot ouvertes — source native pour la section Dépendances. */
  public async listDependabotAlerts(owner: string, repo: string): Promise<GitHubDependabotAlert[]> {
    const alerts = await this.request<RawDependabotAlert[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/dependabot/alerts?state=open`,
    );
    return alerts.map((a) => ({
      number: a.number,
      severity: a.security_advisory.severity,
      package: { name: a.dependency.package.name, ecosystem: a.dependency.package.ecosystem },
      summary: a.security_advisory.summary,
      htmlUrl: a.html_url,
    }));
  }

  /** Packages publiés au niveau organisation — [] si le owner n'est pas une org (403/404). */
  public async listPackages(owner: string, repo: string): Promise<GitHubPackage[]> {
    const response = await this.fetchImpl(
      `${this.options.baseUrl}/orgs/${encodeURIComponent(owner)}/packages?package_type=container`,
      { headers: this.headers() },
    );
    if (response.status === 403 || response.status === 404) return [];
    if (!response.ok) throw new Error(`GitHub API request failed (${response.status})`);
    const packages = (await response.json()) as RawPackage[];
    return packages
      .filter((p) => p.repository?.full_name === `${owner}/${repo}` || !p.repository)
      .map((p) => ({
        name: p.name,
        packageType: p.package_type,
        htmlUrl: p.html_url,
        latestVersion: p.latest_version?.name ?? null,
      }));
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

interface RawWorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  head_branch: string;
  head_sha: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_number: number;
  display_title: string;
}

function mapWorkflowRun(r: RawWorkflowRun): GitHubWorkflowRunDetail {
  return {
    id: r.id,
    status: r.status,
    conclusion: r.conclusion,
    headBranch: r.head_branch,
    headSha: r.head_sha,
    webUrl: r.html_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    runNumber: r.run_number,
    displayTitle: r.display_title,
  };
}

interface RawWorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  steps: Array<{ name: string; status: string; conclusion: string | null; number: number }>;
}

function mapWorkflowJob(j: RawWorkflowJob): GitHubWorkflowJob {
  return {
    id: j.id,
    name: j.name,
    status: j.status,
    conclusion: j.conclusion,
    startedAt: j.started_at,
    completedAt: j.completed_at,
    webUrl: j.html_url,
    steps: j.steps ?? [],
  };
}

interface RawArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  expired: boolean;
  archive_download_url: string;
}

interface RawCheckRun {
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  details_url: string | null;
}

interface RawCodeScanningAlert {
  number: number;
  rule: { id: string; severity: string; description: string };
  state: string;
  html_url: string;
}

interface RawDependabotAlert {
  number: number;
  security_advisory: { severity: string; summary: string };
  dependency: { package: { name: string; ecosystem: string } };
  html_url: string;
}

interface RawPackage {
  name: string;
  package_type: string;
  html_url: string;
  repository?: { full_name: string } | null;
  latest_version?: { name: string } | null;
}
