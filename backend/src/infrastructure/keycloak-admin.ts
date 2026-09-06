/**
 * Client Keycloak Admin REST API, utilisé uniquement par l'onboarding serveur pour provisionner
 * le tout premier administrateur DevOS. Authentification via un compte de service Keycloak
 * (`client_credentials`), dont le secret est lu dans Vault — même pattern que
 * `KeycloakAuthService` pour le secret du client OIDC applicatif (voir `keycloak-auth.ts`). Ce
 * compte de service doit porter les rôles realm-management `manage-users` (création d'utilisateur,
 * attribution de rôle) et, si le rôle realm `devos-admin` n'existe pas encore, `manage-realm`.
 */

export interface KeycloakAdminConfig {
  /** Origine Keycloak, ex. "https://kc.example.com" (sans le segment /realms/...). */
  baseUrl: string;
  realm: string;
  /** Client confidentiel avec "Service accounts enabled" utilisé pour l'authentification admin. */
  clientId: string;
  clientSecretVaultPath: string;
}

export interface KeycloakAdminSecretReader {
  readKv2(path: string): Promise<{ client_secret: string }>;
}

export interface CreateAdminUserInput {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
}

export interface KeycloakAdminConnectionResult {
  connected: boolean;
  version?: string;
  endpoint: string;
  error?: string;
}

interface KeycloakRoleRepresentation {
  id: string;
  name: string;
}

export class KeycloakAdminClient {
  public constructor(
    private readonly config: KeycloakAdminConfig,
    private readonly vault: KeycloakAdminSecretReader,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private get realmAdminUrl(): string {
    return `${this.config.baseUrl.replace(/\/$/, '')}/admin/realms/${this.config.realm}`;
  }

  private async getToken(): Promise<string> {
    const { client_secret } = await this.vault.readKv2(this.config.clientSecretVaultPath);
    const response = await this.fetchImpl(
      `${this.config.baseUrl.replace(/\/$/, '')}/realms/${this.config.realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret,
        }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as { access_token?: string };
    if (!response.ok || !payload.access_token) {
      throw new Error(`Authentification admin Keycloak échouée (${response.status})`);
    }
    return payload.access_token;
  }

  /** Vérifie que le compte de service peut s'authentifier et lire le realm cible. */
  public async checkConnection(): Promise<KeycloakAdminConnectionResult> {
    const endpoint = this.realmAdminUrl;
    try {
      const token = await this.getToken();
      const response = await this.fetchImpl(endpoint, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) {
        return { connected: false, endpoint, error: `HTTP ${response.status}` };
      }
      const realmInfo = (await response.json().catch(() => ({}))) as { id?: string };
      return { connected: Boolean(realmInfo.id), endpoint };
    } catch (error) {
      return { connected: false, endpoint, error: error instanceof Error ? error.message : 'Connexion impossible' };
    }
  }

  /** Crée l'utilisateur, avec un mot de passe temporaire à changer à la première connexion. */
  public async createUser(input: CreateAdminUserInput): Promise<string> {
    const token = await this.getToken();
    const response = await this.fetchImpl(`${this.realmAdminUrl}/users`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        username: input.username,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        emailVerified: true,
        credentials: [{ type: 'password', value: input.temporaryPassword, temporary: true }],
      }),
    });

    if (response.status === 409) {
      throw new Error(`Un utilisateur Keycloak "${input.username}" existe déjà`);
    }
    if (!response.ok) {
      throw new Error(`Création de l'utilisateur Keycloak échouée (${response.status})`);
    }

    const location = response.headers.get('location');
    const userId = location?.split('/').pop();
    if (!userId) throw new Error('Keycloak n\'a pas renvoyé l\'identifiant du nouvel utilisateur');
    return userId;
  }

  private async findRealmRole(token: string, roleName: string): Promise<KeycloakRoleRepresentation | undefined> {
    const response = await this.fetchImpl(`${this.realmAdminUrl}/roles/${encodeURIComponent(roleName)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Lecture du rôle realm "${roleName}" échouée (${response.status})`);
    return (await response.json()) as KeycloakRoleRepresentation;
  }

  private async ensureRealmRole(token: string, roleName: string): Promise<KeycloakRoleRepresentation> {
    const existing = await this.findRealmRole(token, roleName);
    if (existing) return existing;

    const createResponse = await this.fetchImpl(`${this.realmAdminUrl}/roles`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: roleName, description: 'Rôle DevOS provisionné par l\'onboarding' }),
    });
    if (!createResponse.ok && createResponse.status !== 409) {
      throw new Error(`Création du rôle realm "${roleName}" échouée (${createResponse.status})`);
    }

    const created = await this.findRealmRole(token, roleName);
    if (!created) throw new Error(`Le rôle realm "${roleName}" est introuvable après création`);
    return created;
  }

  /** Assigne un rôle realm (ex. "devos-admin") à l'utilisateur, en le créant si besoin. */
  public async assignRealmRole(userId: string, roleName: string): Promise<void> {
    const token = await this.getToken();
    const role = await this.ensureRealmRole(token, roleName);
    const response = await this.fetchImpl(`${this.realmAdminUrl}/users/${userId}/role-mappings/realm`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    });
    if (!response.ok) {
      throw new Error(`Attribution du rôle realm "${roleName}" échouée (${response.status})`);
    }
  }
}

export function createKeycloakAdminConfig(
  environment: Record<string, string | undefined> = process.env,
): KeycloakAdminConfig | undefined {
  const baseUrl = environment.KEYCLOAK_ADMIN_BASE_URL ?? environment.KEYCLOAK_BASE_URL;
  const realm = environment.KEYCLOAK_REALM;
  const clientId = environment.KEYCLOAK_ADMIN_CLIENT_ID;
  const clientSecretVaultPath = environment.KEYCLOAK_ADMIN_SECRET_VAULT_PATH;
  if (!baseUrl || !realm || !clientId || !clientSecretVaultPath) return undefined;
  if (!clientSecretVaultPath.startsWith('secret/')) return undefined;
  return { baseUrl: baseUrl.replace(/\/$/, ''), realm, clientId, clientSecretVaultPath };
}
