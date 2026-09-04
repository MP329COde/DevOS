import type { VaultClient } from '../infrastructure/vault.js';

const SECRET_MOUNT_PATH = 'devos-secrets';

/**
 * Minimal CRUD over named secrets (e.g. VM/service credentials), backed entirely by Vault —
 * never by Postgres. `list` only returns names: a value is never sent to the client unless
 * explicitly requested via `reveal`.
 */
export class SecretsService {
  public constructor(private readonly vault: VaultClient) {}

  public async list(): Promise<string[]> {
    return this.vault.listKv2(SECRET_MOUNT_PATH);
  }

  public async reveal(name: string): Promise<string> {
    const secret = await this.vault.readKv2<{ value: string }>(`${SECRET_MOUNT_PATH}/${name}`);
    return secret.value;
  }

  public async set(name: string, value: string): Promise<void> {
    await this.vault.writeKv2(`${SECRET_MOUNT_PATH}/${name}`, { value });
  }

  public async delete(name: string): Promise<void> {
    await this.vault.deleteKv2(`${SECRET_MOUNT_PATH}/${name}`);
  }
}
