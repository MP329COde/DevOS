import { readFile } from 'node:fs/promises';

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '');
}

interface VaultAuthResponse {
  auth?: {
    client_token?: string;
  };
}

export interface VaultClientOptions {
  address: string;
  kubernetesAuthPath: string;
  kubernetesRole: string;
  kubernetesJwtFile: string;
  fetchImpl?: typeof fetch;
}

export class VaultClient {
  private readonly fetchImpl: typeof fetch;
  private token: string | undefined;

  public constructor(private readonly options: VaultClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async authenticateKubernetes(jwt?: string): Promise<void> {
    const serviceAccountJwt = jwt ?? (await readFile(this.options.kubernetesJwtFile, 'utf8'));
    const response = await this.fetchImpl(this.url(`/v1/auth/${this.options.kubernetesAuthPath}/login`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: this.options.kubernetesRole, jwt: serviceAccountJwt }),
    });
    const payload = (await response.json()) as VaultAuthResponse;

    if (!response.ok || !payload.auth?.client_token) {
      throw new Error(`Vault Kubernetes authentication failed (${response.status})`);
    }

    this.token = payload.auth.client_token;
  }

  public async readKv2<T extends Record<string, unknown>>(path: string): Promise<T> {
    const response = await this.fetchImpl(this.url(`/v1/secret/data/${normalizePath(path)}`), {
      headers: { 'x-vault-token': this.requireToken() },
    });
    const payload = (await response.json()) as { data?: { data?: T } };

    if (!response.ok || !payload.data?.data) {
      throw new Error(`Vault secret read failed (${response.status})`);
    }

    return payload.data.data;
  }

  public async writeKv2(path: string, data: Record<string, unknown>): Promise<void> {
    const response = await this.fetchImpl(this.url(`/v1/secret/data/${normalizePath(path)}`), {
      method: 'POST',
      headers: { 'x-vault-token': this.requireToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!response.ok) throw new Error(`Vault secret write failed (${response.status})`);
  }

  public async deleteKv2(path: string): Promise<void> {
    const response = await this.fetchImpl(this.url(`/v1/secret/metadata/${normalizePath(path)}`), {
      method: 'DELETE',
      headers: { 'x-vault-token': this.requireToken() },
    });
    if (!response.ok && response.status !== 404) throw new Error(`Vault secret delete failed (${response.status})`);
  }

  /** Lists the secret names under a KV v2 path — used to expose which keys exist without ever reading their values. */
  public async listKv2(path: string): Promise<string[]> {
    const response = await this.fetchImpl(this.url(`/v1/secret/metadata/${normalizePath(path)}?list=true`), {
      method: 'LIST',
      headers: { 'x-vault-token': this.requireToken() },
    });
    if (response.status === 404) return [];
    const payload = (await response.json()) as { data?: { keys?: string[] } };
    if (!response.ok) throw new Error(`Vault secret list failed (${response.status})`);
    return payload.data?.keys ?? [];
  }

  private requireToken(): string {
    if (!this.token) throw new Error('Vault client is not authenticated');
    return this.token;
  }

  private url(path: string): string {
    return `${this.options.address.replace(/\/$/, '')}${path}`;
  }
}