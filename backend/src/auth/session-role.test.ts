import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';

import { KeycloakSessionRoleResolver } from './session-role.js';
import type { Session, SessionStore } from '../infrastructure/keycloak-auth.js';

function base64url(input: unknown): string {
  return Buffer.from(JSON.stringify(input)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeAccessToken(claims: Record<string, unknown>): string {
  return `${base64url({ alg: 'none' })}.${base64url(claims)}.signature`;
}

function requestWithCookie(cookie?: string): IncomingMessage {
  return { headers: cookie ? { cookie } : {} } as IncomingMessage;
}

function fakeSessions(session: Session | null): SessionStore {
  return {
    async create() { return 'unused'; },
    async get() { return session; },
  };
}

test('returns no role when the request carries no session cookie', async () => {
  const resolver = new KeycloakSessionRoleResolver(fakeSessions(null), { userProfile: { findUnique: async () => null } });
  const resolved = await resolver.resolve(requestWithCookie());
  assert.equal(resolved.role, undefined);
});

test('ignores a devos_session cookie that does not match a stored session (forged cookie)', async () => {
  const resolver = new KeycloakSessionRoleResolver(fakeSessions(null), { userProfile: { findUnique: async () => null } });
  const resolved = await resolver.resolve(requestWithCookie('devos_session=forged-id'));
  assert.equal(resolved.role, undefined);
});

test('ignores an expired session', async () => {
  const session: Session = {
    accessToken: fakeAccessToken({ email: 'a@example.com', realm_access: { roles: ['devos-admin'] } }),
    expiresAt: Date.now() - 1000,
  };
  const resolver = new KeycloakSessionRoleResolver(fakeSessions(session), { userProfile: { findUnique: async () => null } });
  const resolved = await resolver.resolve(requestWithCookie('devos_session=abc'));
  assert.equal(resolved.role, undefined);
});

test('derives Admin from the Keycloak realm role carried by the access token, not any header', async () => {
  const session: Session = {
    accessToken: fakeAccessToken({ email: 'admin@example.com', realm_access: { roles: ['devos-admin'] } }),
    expiresAt: Date.now() + 60_000,
  };
  const resolver = new KeycloakSessionRoleResolver(fakeSessions(session), {
    userProfile: {
      findUnique: async () => ({ id: 'user-1', role: null, projectPermissions: [] }),
    },
  });
  const resolved = await resolver.resolve(requestWithCookie('devos_session=abc'));
  assert.equal(resolved.role, 'Admin');
  assert.equal(resolved.email, 'admin@example.com');
});

test('falls back to the DevOS profile role when Keycloak carries no devos-* realm role', async () => {
  const session: Session = {
    accessToken: fakeAccessToken({ email: 'contrib@example.com', realm_access: { roles: ['offline_access'] } }),
    expiresAt: Date.now() + 60_000,
  };
  const resolver = new KeycloakSessionRoleResolver(fakeSessions(session), {
    userProfile: {
      findUnique: async () => ({ id: 'user-2', role: { name: 'Contributeur' }, projectPermissions: [] }),
    },
  });
  const resolved = await resolver.resolve(requestWithCookie('devos_session=abc'));
  assert.equal(resolved.role, 'Contributeur');
});

test('resolves per-project roles from ProjectPermission', async () => {
  const session: Session = {
    accessToken: fakeAccessToken({ email: 'u@example.com', realm_access: { roles: [] } }),
    expiresAt: Date.now() + 60_000,
  };
  const resolver = new KeycloakSessionRoleResolver(fakeSessions(session), {
    userProfile: {
      findUnique: async () => ({
        id: 'user-3',
        role: { name: 'Lecteur' },
        projectPermissions: [{ devProjectId: 'proj-1', role: { name: 'Admin' } }],
      }),
    },
  });
  const resolved = await resolver.resolve(requestWithCookie('devos_session=abc'));
  assert.equal(resolved.projectRoles.get('proj-1'), 'Admin');
});
