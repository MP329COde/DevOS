import { readFile } from 'node:fs/promises';

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
    if (!this.token) {
      throw new Error('Vault client is not authenticated');
    }

    const response = await this.fetchImpl(this.url(`/v1/secret/data/${path.replace(/^\/+/, '')}`), {
      headers: { 'x-vault-token': this.token },
    });
    const payload = (await response.json()) as { data?: { data?: T } };

    if (!response.ok || !payload.data?.data) {
      throw new Error(`Vault secret read failed (${response.status})`);
    }

    return payload.data.data;
  }

  private url(path: string): string {
    return `${this.options.address.replace(/\/$/, '')}${path}`;
  }
}