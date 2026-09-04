export interface WoodpeckerClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface WoodpeckerRepo {
  id: number;
  full_name: string;
  active: boolean;
}

export interface WoodpeckerBuild {
  number: number;
  status: string;
  branch: string;
  created: number;
}

/** Thin read-only client for the Woodpecker CI REST API, authenticated via a bearer token. */
export class WoodpeckerClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: WoodpeckerClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listRepos(): Promise<WoodpeckerRepo[]> {
    const repos = await this.request<Array<{ id: number; full_name: string; active: boolean }>>('/api/user/repos');
    return repos.map((repo) => ({ id: repo.id, full_name: repo.full_name, active: repo.active }));
  }

  public async listBuilds(repoId: number): Promise<WoodpeckerBuild[]> {
    const pipelines = await this.request<Array<{ number: number; status: string; branch: string; created: number }>>(`/api/repos/${encodeURIComponent(String(repoId))}/pipelines`);
    return pipelines.map((pipeline) => ({ number: pipeline.number, status: pipeline.status, branch: pipeline.branch, created: pipeline.created }));
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { headers: { authorization: `Bearer ${this.options.token}` } });
    if (!response.ok) throw new Error(`Woodpecker API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
