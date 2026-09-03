export interface KeycloakOidcConfig {
  issuerUrl: string;
  clientId: string;
  clientSecretVaultPath: string;
  redirectUri: string;
  scopes: readonly string[];
}

export function createKeycloakOidcConfig(
  environment: Record<string, string | undefined> = process.env,
): KeycloakOidcConfig {
  const issuerUrl = required(environment.KEYCLOAK_ISSUER_URL, 'KEYCLOAK_ISSUER_URL');
  const clientId = required(environment.KEYCLOAK_CLIENT_ID, 'KEYCLOAK_CLIENT_ID');
  const clientSecretVaultPath = required(
    environment.KEYCLOAK_CLIENT_SECRET_VAULT_PATH,
    'KEYCLOAK_CLIENT_SECRET_VAULT_PATH',
  );
  const redirectUri = required(environment.KEYCLOAK_REDIRECT_URI, 'KEYCLOAK_REDIRECT_URI');

  new URL(issuerUrl);
  new URL(redirectUri);

  if (!clientSecretVaultPath.startsWith('secret/')) {
    throw new Error('KEYCLOAK_CLIENT_SECRET_VAULT_PATH must be a Vault secret path');
  }

  return {
    issuerUrl: issuerUrl.replace(/\/$/, ''),
    clientId,
    clientSecretVaultPath,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
  };
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} must be configured`);
  }

  return value;
}