export interface HarborClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  fetchImpl?: typeof fetch;
}

export interface HarborProject {
  projectId: number;
  name: string;
  repoCount: number;
}

export interface HarborRepository {
  name: string;
  artifactCount: number;
}

/** Thin read-only client for the Harbor v2 API (projects, repositories, artifact tags), authenticated via HTTP Basic auth. */
export class HarborClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: HarborClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listProjects(): Promise<HarborProject[]> {
    const results = await this.request<Array<{ project_id: number; name: string; repo_count?: number }>>('/api/v2.0/projects');
    return results.map((result) => ({ projectId: result.project_id, name: result.name, repoCount: result.repo_count ?? 0 }));
  }

  public async listRepositories(project: string): Promise<HarborRepository[]> {
    const results = await this.request<Array<{ name: string; artifact_count?: number }>>(
      `/api/v2.0/projects/${encodeURIComponent(project)}/repositories`,
    );
    return results.map((result) => ({ name: result.name, artifactCount: result.artifact_count ?? 0 }));
  }

  public async listArtifactTags(project: string, repository: string): Promise<string[]> {
    const results = await this.request<Array<{ tags?: Array<{ name: string }> }>>(
      `/api/v2.0/projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts`,
    );
    return results.flatMap((artifact) => (artifact.tags ?? []).map((tag) => tag.name));
  }

  private async request<T>(path: string): Promise<T> {
    const auth = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { headers: { authorization: `Basic ${auth}` } });
    if (!response.ok) throw new Error(`Harbor API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
