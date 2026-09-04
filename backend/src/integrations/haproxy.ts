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

export interface HAProxyAcl {
  /** Position of this ACL rule within its parent frontend/backend (returned by the API, required to delete a rule). */
  index: number;
  aclName: string;
  criterion: string;
  value: string;
}

export interface HAProxyCertificate {
  storageName: string;
  description?: string;
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

  /** ACL rules attached to a frontend or backend (used for guided routing rule editing). */
  public async listAcls(parentType: 'frontend' | 'backend', parentName: string): Promise<HAProxyAcl[]> {
    const response = await this.request(`/v3/services/haproxy/configuration/acl?parent_type=${parentType}&parent_name=${encodeURIComponent(parentName)}`);
    const rows = (await response.json()) as Array<{ index: number; acl_name: string; criterion: string; value: string }>;
    return rows.map((row) => ({ index: row.index, aclName: row.acl_name, criterion: row.criterion, value: row.value }));
  }

  public async addAcl(parentType: 'frontend' | 'backend', parentName: string, acl: Omit<HAProxyAcl, 'index'>): Promise<void> {
    const version = await this.getVersion();
    await this.request(`/v3/services/haproxy/configuration/acl?parent_type=${parentType}&parent_name=${encodeURIComponent(parentName)}&version=${version}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acl_name: acl.aclName, criterion: acl.criterion, value: acl.value }),
    });
  }

  public async deleteAcl(parentType: 'frontend' | 'backend', parentName: string, index: number): Promise<void> {
    const version = await this.getVersion();
    await this.request(`/v3/services/haproxy/configuration/acl/${index}?parent_type=${parentType}&parent_name=${encodeURIComponent(parentName)}&version=${version}`, { method: 'DELETE' });
  }

  /** Read-only listing of TLS certificates stored for HAProxy (Data Plane API storage endpoint) — creating/renewing certificates stays a manual, out-of-band operation. */
  public async listCertificates(): Promise<HAProxyCertificate[]> {
    const response = await this.request('/v3/services/haproxy/storage/ssl_certificates');
    const rows = (await response.json()) as Array<{ storage_name: string; description?: string }>;
    return rows.map((row) => ({ storageName: row.storage_name, description: row.description }));
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const auth = Buffer.from(`${this.options.credentials.username}:${this.options.credentials.password}`).toString('base64');
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { ...init, headers: { ...init?.headers, authorization: `Basic ${auth}` } });
    if (!response.ok) throw new Error(`HAProxy Data Plane API request failed (${response.status})`);
    return response;
  }
}
