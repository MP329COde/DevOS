import type { IncomingMessage } from 'node:http';

import type { PrismaClient } from '@prisma/client';

import type { SessionStore } from '../infrastructure/keycloak-auth.js';
import { roles, type Role } from './permissions.js';

/**
 * Contexte d'autorisation résolu pour une requête : dérivé exclusivement de la session Keycloak
 * authentifiée (cookie `devos_session`), jamais d'un header client. `role` est `undefined` quand
 * la requête n'est pas authentifiée (ou que la session est expirée/inconnue) : les handlers
 * traitent déjà ce cas comme "authentification requise", exactement comme avec l'ancien header.
 */
export interface ResolvedSession {
  userId?: string;
  email?: string;
  role?: Role;
  /** Rôle par projet (DevProject.id -> Role), pour les vérifications d'appartenance à un projet. */
  projectRoles: Map<string, Role>;
}

export interface SessionRoleResolver {
  resolve(request: IncomingMessage): Promise<ResolvedSession>;
}

interface KeycloakAccessTokenClaims {
  sub?: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

const EMPTY_SESSION: ResolvedSession = { projectRoles: new Map() };

function readSessionId(request: IncomingMessage): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key === 'devos_session') return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

/**
 * Décode les claims du JWT d'accès sans vérifier la signature : ce token vient d'un échange
 * serveur-à-serveur avec Keycloak (voir `KeycloakAuthService.completeLogin`), jamais du client,
 * donc il est déjà de confiance au moment où il est stocké dans la session Redis.
 */
function decodeAccessToken(token: string): KeycloakAccessTokenClaims {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const payload = Buffer.from(normalized, 'base64').toString('utf8');
    return JSON.parse(payload) as KeycloakAccessTokenClaims;
  } catch {
    return {};
  }
}

const ROLE_NAMES = new Set<string>(roles);

function isKnownRole(name: string | undefined): name is Role {
  return !!name && ROLE_NAMES.has(name);
}

/** Mappe les rôles realm Keycloak (ex. `devos-admin`) sur les rôles DevOS historiques. */
function mapKeycloakRealmRoles(realmRoles: string[] | undefined): Role | undefined {
  if (!realmRoles) return undefined;
  const normalized = new Set(realmRoles.map((role) => role.toLowerCase()));
  if (normalized.has('devos-admin') || normalized.has('admin')) return 'Admin';
  if (normalized.has('devos-contributeur') || normalized.has('contributeur')) return 'Contributeur';
  if (normalized.has('devos-lecteur') || normalized.has('lecteur')) return 'Lecteur';
  return undefined;
}

type ProfileWithRoles = {
  id: string;
  role: { name: string } | null;
  projectPermissions: { devProjectId: string; role: { name: string } }[];
};

interface UserProfileReader {
  findUnique(args: {
    where: { email: string };
    include: { role: true; projectPermissions: { include: { role: true } } };
  }): Promise<ProfileWithRoles | null>;
}

/**
 * Résout un rôle DevOS réel à partir de la session Keycloak authentifiée : plus aucun header
 * client ne peut déclarer un rôle. La session (accessToken côté Redis) porte les rôles realm
 * Keycloak, qui priment ; le profil DevOS (email) complète l'appartenance aux projets et sert de
 * repli si Keycloak ne porte pas encore de rôle `devos-*` pour cet utilisateur.
 */
export class KeycloakSessionRoleResolver implements SessionRoleResolver {
  public constructor(
    private readonly sessions: SessionStore,
    private readonly prisma: { userProfile: UserProfileReader },
  ) {}

  public async resolve(request: IncomingMessage): Promise<ResolvedSession> {
    const sessionId = readSessionId(request);
    if (!sessionId) return EMPTY_SESSION;

    const session = await this.sessions.get(sessionId);
    if (!session || session.expiresAt <= Date.now()) return EMPTY_SESSION;

    const claims = decodeAccessToken(session.accessToken);
    const email = claims.email ?? claims.preferred_username;
    const keycloakRole = mapKeycloakRealmRoles(claims.realm_access?.roles);
    const projectRoles = new Map<string, Role>();

    if (!email) {
      return { userId: claims.sub, role: keycloakRole, projectRoles };
    }

    const profile = await this.prisma.userProfile.findUnique({
      where: { email },
      include: { role: true, projectPermissions: { include: { role: true } } },
    });

    for (const permission of profile?.projectPermissions ?? []) {
      if (isKnownRole(permission.role.name)) projectRoles.set(permission.devProjectId, permission.role.name);
    }

    const profileRole = profile?.role?.name;
    const role = keycloakRole ?? (isKnownRole(profileRole) ? profileRole : undefined);

    return { userId: profile?.id ?? claims.sub, email, role, projectRoles };
  }
}

export function buildKeycloakSessionRoleResolver(sessions: SessionStore, prisma: PrismaClient): SessionRoleResolver {
  return new KeycloakSessionRoleResolver(sessions, prisma);
}
