import type { KeycloakAuthService } from './keycloak-auth.js';

export interface AuthCallbackResponse {
  status: number;
  headers: Record<string, string>;
  body: { error?: string; ok?: boolean };
}

export async function handleAuthCallback(
  body: unknown,
  auth: Pick<KeycloakAuthService, 'completeLogin'>,
  secureCookie = true,
): Promise<AuthCallbackResponse> {
  if (!isCallbackBody(body)) {
    return { status: 400, headers: { 'content-type': 'application/json' }, body: { error: 'Invalid callback payload' } };
  }

  const sessionId = await auth.completeLogin(body.code, body.codeVerifier);
  const secure = secureCookie ? '; Secure' : '';
  return {
    status: 204,
    headers: { 'set-cookie': `devos_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax${secure}` },
    body: { ok: true },
  };
}

function isCallbackBody(body: unknown): body is { code: string; codeVerifier: string } {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.code === 'string' && candidate.code.length > 0
    && typeof candidate.codeVerifier === 'string' && candidate.codeVerifier.length > 0;
}