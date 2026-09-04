export interface VerdaccioClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface VerdaccioPackage {
  name: string;
  'dist-tags': { latest: string };
  versions: Record<string, unknown>;
  latestVersion: string;
}

/** Read-only client for a Verdaccio registry's npm-compatible HTTP API. */
export class VerdaccioClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: VerdaccioClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async getPackage(packageName: string): Promise<VerdaccioPackage> {
    const headers: Record<string, string> = {};
    if (this.options.token) headers.authorization = `Bearer ${this.options.token}`;
    const response = await this.fetchImpl(`${this.options.baseUrl}/${encodeURIComponent(packageName)}`, { headers });
    if (!response.ok) throw new Error(`Verdaccio API request failed (${response.status})`);
    const body = (await response.json()) as { name: string; 'dist-tags': { latest: string }; versions: Record<string, unknown> };
    return {
      name: body.name,
      'dist-tags': body['dist-tags'],
      versions: body.versions,
      latestVersion: body['dist-tags'].latest,
    };
  }
}

export interface NexusClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  fetchImpl?: typeof fetch;
}

export interface NexusRepository {
  name: string;
  format: string;
  type: string;
  url: string;
}

/** Read-only client for the Nexus Repository REST API, authenticated via HTTP Basic. */
export class NexusClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: NexusClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listRepositories(): Promise<NexusRepository[]> {
    const repositories = await this.request<Array<{ name: string; format: string; type: string; url: string }>>(
      '/service/rest/v1/repositories',
    );
    return repositories.map((repository) => ({
      name: repository.name,
      format: repository.format,
      type: repository.type,
      url: repository.url,
    }));
  }

  private async request<T>(path: string): Promise<T> {
    const credentials = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      headers: { authorization: `Basic ${credentials}` },
    });
    if (!response.ok) throw new Error(`Nexus API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
