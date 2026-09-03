export interface OidcAuthorizationConfig {
  issuerUrl: string;
  clientId: string;
  redirectUri: string;
  scopes?: readonly string[];
}

export interface OidcAuthorizationRequest {
  state: string;
  codeVerifier: string;
  url: string;
}

export async function createAuthorizationRequest(
  config: OidcAuthorizationConfig,
  randomBytes: (length: number) => Uint8Array = defaultRandomBytes,
): Promise<OidcAuthorizationRequest> {
  const state = encode(randomBytes(32));
  const codeVerifier = encode(randomBytes(32));
  const challengeBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const challenge = encode(new Uint8Array(challengeBuffer));
  const authorizationUrl = new URL(`${config.issuerUrl.replace(/\/$/, '')}/protocol/openid-connect/auth`);
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: (config.scopes ?? ['openid', 'profile', 'email']).join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  return { state, codeVerifier, url: authorizationUrl.toString() };
}

function defaultRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}