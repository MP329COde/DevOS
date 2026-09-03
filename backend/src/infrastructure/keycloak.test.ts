import assert from 'node:assert/strict';
import test from 'node:test';

import { createKeycloakOidcConfig } from './keycloak.js';

const environment = {
  KEYCLOAK_ISSUER_URL: 'https://sso.example.test/realms/devos/',
  KEYCLOAK_CLIENT_ID: 'devos-web',
  KEYCLOAK_CLIENT_SECRET_VAULT_PATH: 'secret/keycloak/client',
  KEYCLOAK_REDIRECT_URI: 'http://localhost:3000/auth/callback',
};

test('normalizes generic Keycloak OIDC configuration', () => {
  const config = createKeycloakOidcConfig(environment);

  assert.equal(config.issuerUrl, 'https://sso.example.test/realms/devos');
  assert.equal(config.clientSecretVaultPath, 'secret/keycloak/client');
  assert.deepEqual(config.scopes, ['openid', 'profile', 'email']);
});

test('rejects a client secret stored outside Vault', () => {
  assert.throws(
    () => createKeycloakOidcConfig({ ...environment, KEYCLOAK_CLIENT_SECRET_VAULT_PATH: 'client-secret' }),
    /Vault secret path/,
  );
});