import assert from 'node:assert/strict';
import test from 'node:test';

import { KeycloakAuthService, type Session, type SessionStore } from './keycloak-auth.js';

const config = {
  issuerUrl: 'https://sso.example.test/realms/devos',
  clientId: 'devos-web',
  clientSecretVaultPath: 'secret/keycloak/client',
  redirectUri: 'http://localhost:3000/auth/callback',
  scopes: ['openid'],
} as const;

test('exchanges the PKCE code with a Vault secret and creates an opaque session', async () => {
  let created: Session | undefined;
  const sessions: SessionStore = {
    async create(session, ttlSeconds) {
      created = session;
      assert.equal(ttlSeconds, 300);
      return 'opaque-session-id';
    },
    async get() { return created ?? null; },
  };
  const service = new KeycloakAuthService(
    config,
    { async readKv2() { return { client_secret: 'vault-only-secret' }; } },
    sessions,
    async (_input, init) => {
      assert.equal(init?.method, 'POST');
      assert.match(String(init?.body), /client_secret=vault-only-secret/);
      assert.match(String(init?.body), /code_verifier=verifier/);
      return new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 300 }), { status: 200 });
    },
  );

  assert.equal(await service.completeLogin('authorization-code', 'verifier'), 'opaque-session-id');
  assert.deepEqual(created, { accessToken: 'access', refreshToken: 'refresh', expiresAt: created?.expiresAt });
  assert.ok(created?.expiresAt);
});

test('rejects a token response without an access token', async () => {
  const service = new KeycloakAuthService(
    config,
    { async readKv2() { return { client_secret: 'secret' }; } },
    { async create() { return 'session'; }, async get() { return null; } },
    async () => new Response('{}', { status: 200 }),
  );

  await assert.rejects(() => service.completeLogin('code', 'verifier'), /token exchange failed/);
});