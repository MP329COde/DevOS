import { randomUUID } from 'node:crypto';

import type { KeycloakOidcConfig } from './keycloak.js';
import type { RedisClient } from './redis.js';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface Session {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface SessionStore {
  create(session: Session, ttlSeconds: number): Promise<string>;
  get(id: string): Promise<Session | null>;
}

export interface KeycloakSecretReader {
  readKv2(path: string): Promise<{ client_secret: string }>;
}

export class RedisSessionStore implements SessionStore {
  public constructor(private readonly client: RedisClient, private readonly prefix = 'devos:session:') {}

  public async create(session: Session, ttlSeconds: number): Promise<string> {
    const id = randomUUID();
    await this.client.set(`${this.prefix}${id}`, JSON.stringify(session), { EX: ttlSeconds });
    return id;
  }

  public async get(id: string): Promise<Session | null> {
    const value = await this.client.get(`${this.prefix}${id}`);
    return value ? (JSON.parse(value) as Session) : null;
  }
}

export class KeycloakAuthService {
  public constructor(
    private readonly config: KeycloakOidcConfig,
    private readonly vault: KeycloakSecretReader,
    private readonly sessions: SessionStore,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  public get sessionStore(): SessionStore {
    return this.sessions;
  }

  public async completeLogin(code: string, codeVerifier: string): Promise<string> {
    const credentials = await this.vault.readKv2(this.config.clientSecretVaultPath);
    const response = await this.fetchImpl(`${this.config.issuerUrl}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: credentials.client_secret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: this.config.redirectUri,
      }),
    });
    const tokens = (await response.json()) as TokenResponse;

    if (!response.ok || !tokens.access_token || !tokens.expires_in) {
      throw new Error(`Keycloak token exchange failed (${response.status})`);
    }

    return this.sessions.create(
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      },
      tokens.expires_in,
    );
  }
}