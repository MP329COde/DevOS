/**
 * Vérifications de connectivité "cœur" pour l'onboarding serveur : chaque fonction sonde une
 * intégration avec ses identifiants réels (pas de simple test de forme) et renvoie un résultat
 * normalisé — connecté/erreur/version/endpoint — affichable tel quel par le wizard.
 */

export interface IntegrationCheckResult {
  connected: boolean;
  endpoint?: string;
  version?: string;
  error?: string;
  testedAt: string;
}

function now(): string {
  return new Date().toISOString();
}

function ok(endpoint: string, version?: string): IntegrationCheckResult {
  return { connected: true, endpoint, version, testedAt: now() };
}

function fail(endpoint: string | undefined, error: unknown): IntegrationCheckResult {
  return { connected: false, endpoint, error: error instanceof Error ? error.message : 'Connexion impossible', testedAt: now() };
}

export interface GitLabCheckConfig {
  baseUrl: string;
  token: string;
}

export async function checkGitLab(config: GitLabCheckConfig, fetchImpl: typeof fetch = fetch): Promise<IntegrationCheckResult> {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/api/v4/version`;
  try {
    const response = await fetchImpl(endpoint, { headers: { 'PRIVATE-TOKEN': config.token } });
    if (!response.ok) return fail(endpoint, `HTTP ${response.status}`);
    const payload = (await response.json()) as { version?: string };
    return ok(endpoint, payload.version);
  } catch (error) {
    return fail(endpoint, error);
  }
}

export interface ArgoCDCheckConfig {
  baseUrl: string;
  token: string;
}

export async function checkArgoCD(config: ArgoCDCheckConfig, fetchImpl: typeof fetch = fetch): Promise<IntegrationCheckResult> {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/api/version`;
  try {
    const response = await fetchImpl(endpoint, { headers: { authorization: `Bearer ${config.token}` } });
    if (!response.ok) return fail(endpoint, `HTTP ${response.status}`);
    const payload = (await response.json()) as { Version?: string };
    return ok(endpoint, payload.Version);
  } catch (error) {
    return fail(endpoint, error);
  }
}

export interface HAProxyCheckConfig {
  dataPlaneUrl: string;
  username: string;
  password: string;
}

export async function checkHAProxy(config: HAProxyCheckConfig, fetchImpl: typeof fetch = fetch): Promise<IntegrationCheckResult> {
  const endpoint = `${config.dataPlaneUrl.replace(/\/$/, '')}/v2/info`;
  try {
    const token = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const response = await fetchImpl(endpoint, { headers: { authorization: `Basic ${token}` } });
    if (!response.ok) return fail(endpoint, `HTTP ${response.status}`);
    const payload = (await response.json()) as { api?: { version?: string } };
    return ok(endpoint, payload.api?.version);
  } catch (error) {
    return fail(endpoint, error);
  }
}

export interface PostgresProbe {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>;
}

export async function checkPostgres(database: PostgresProbe): Promise<IntegrationCheckResult> {
  try {
    const rows = await database.$queryRawUnsafe<{ version: string }[]>('SELECT version() as version');
    return ok('postgresql://<DATABASE_URL>', rows?.[0]?.version);
  } catch (error) {
    return fail('postgresql://<DATABASE_URL>', error);
  }
}

export interface RedisProbe {
  connect(): Promise<unknown>;
  ping(): Promise<string>;
  info?(section?: string): Promise<string>;
  quit(): Promise<unknown>;
  isOpen?: boolean;
}

export async function checkRedis(client: RedisProbe, endpoint: string): Promise<IntegrationCheckResult> {
  try {
    if (!client.isOpen) await client.connect();
    await client.ping();
    let version: string | undefined;
    if (client.info) {
      const info = await client.info('server');
      version = /redis_version:([^\r\n]+)/.exec(info)?.[1];
    }
    return ok(endpoint, version);
  } catch (error) {
    return fail(endpoint, error);
  } finally {
    try {
      await client.quit();
    } catch {
      // Best-effort cleanup only.
    }
  }
}

export interface VaultCheckConfig {
  address: string;
}

export async function checkVault(config: VaultCheckConfig, fetchImpl: typeof fetch = fetch): Promise<IntegrationCheckResult> {
  const endpoint = `${config.address.replace(/\/$/, '')}/v1/sys/health`;
  try {
    const response = await fetchImpl(endpoint);
    if (!response.ok && response.status !== 429 && response.status !== 472 && response.status !== 473) {
      return fail(endpoint, `HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { version?: string; sealed?: boolean };
    if (payload.sealed) return fail(endpoint, 'Vault est scellé (sealed)');
    return ok(endpoint, payload.version);
  } catch (error) {
    return fail(endpoint, error);
  }
}
