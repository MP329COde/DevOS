export interface HAProxyCredentials {
  username: string;
  password: string;
}

export interface HAProxyClientOptions {
  baseUrl: string;
  credentials: HAProxyCredentials;
  fetchImpl?: typeof fetch;
}

export interface HAProxyBackend {
  name: string;
  mode?: string;
  balance?: { algorithm: string };
}

export interface HAProxyFrontend {
  name: string;
  mode?: string;
  bind?: string;
}

export interface HAProxyServer {
  name: string;
  address: string;
  port: number;
  check?: 'enabled' | 'disabled';
}

/**
 * Client for the HAProxy Data Plane API (structured config changes require the
 * current configuration version on every write, per the API's optimistic-locking model).
 */
export class HAProxyClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: HAProxyClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async getVersion(): Promise<number> {
    const response = await this.request('/v3/services/haproxy/configuration/version');
    const text = await response.text();
    const version = Number(text.trim());
    if (Number.isNaN(version)) throw new Error('HAProxy Data Plane API returned an invalid configuration version');
    return version;
  }

  public async listBackends(): Promise<HAProxyBackend[]> {
    const response = await this.request('/v3/services/haproxy/configuration/backends');
    return (await response.json()) as HAProxyBackend[];
  }

  public async listFrontends(): Promise<HAProxyFrontend[]> {
    const response = await this.request('/v3/services/haproxy/configuration/frontends');
    return (await response.json()) as HAProxyFrontend[];
  }

  public async listServers(backend: string): Promise<HAProxyServer[]> {
    const response = await this.request(`/v3/services/haproxy/configuration/servers?backend=${encodeURIComponent(backend)}`);
    return (await response.json()) as HAProxyServer[];
  }

  public async addServer(backend: string, server: HAProxyServer): Promise<void> {
    const version = await this.getVersion();
    await this.request(`/v3/services/haproxy/configuration/servers?backend=${encodeURIComponent(backend)}&version=${version}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(server),
    });
  }

  public async deleteServer(backend: string, name: string): Promise<void> {
    const version = await this.getVersion();
    await this.request(`/v3/services/haproxy/configuration/servers/${encodeURIComponent(name)}?backend=${encodeURIComponent(backend)}&version=${version}`, { method: 'DELETE' });
  }

  public async reload(): Promise<void> {
    await this.request('/v3/services/haproxy/reloads', { method: 'POST' });
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const auth = Buffer.from(`${this.options.credentials.username}:${this.options.credentials.password}`).toString('base64');
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { ...init, headers: { ...init?.headers, authorization: `Basic ${auth}` } });
    if (!response.ok) throw new Error(`HAProxy Data Plane API request failed (${response.status})`);
    return response;
  }
}
