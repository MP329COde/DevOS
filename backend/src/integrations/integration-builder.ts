export type IntegrationAuthType = 'none' | 'basic' | 'bearer' | 'apiKey';

export interface IntegrationCredentials {
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
}

export interface IntegrationConfig {
  baseUrl: string;
  authType: IntegrationAuthType;
  credentials?: IntegrationCredentials;
  /** Path probed to validate connectivity; defaults to "/". */
  healthPath?: string;
}

export type DetectedApiType = 'openapi' | 'rest-generic' | 'unknown';

export interface IntegrationTestResult {
  reachable: boolean;
  status?: number;
  detectedApiType: DetectedApiType;
  error?: string;
}

/**
 * Best-effort connectivity test + API type detection for a user-supplied integration config.
 * There is no universal API discovery here: we probe the configured health path, then look
 * for a standard OpenAPI/Swagger document at well-known paths. Anything else is reported as
 * "rest-generic" — the caller should not expect richer auto-discovery than that.
 */
export async function testIntegration(config: IntegrationConfig, fetchImpl: typeof fetch = fetch): Promise<IntegrationTestResult> {
  const headers = buildAuthHeaders(config);
  const healthPath = config.healthPath ?? '/';

  let response: Response;
  try {
    response = await fetchImpl(`${config.baseUrl}${healthPath}`, { headers });
  } catch (error) {
    return { reachable: false, detectedApiType: 'unknown', error: error instanceof Error ? error.message : 'Connexion impossible' };
  }
  if (!response.ok) {
    return { reachable: false, status: response.status, detectedApiType: 'unknown', error: `HTTP ${response.status}` };
  }

  const detectedApiType = await detectApiType(config.baseUrl, headers, fetchImpl);
  return { reachable: true, status: response.status, detectedApiType };
}

async function detectApiType(baseUrl: string, headers: Record<string, string>, fetchImpl: typeof fetch): Promise<DetectedApiType> {
  for (const candidate of ['/openapi.json', '/swagger.json']) {
    try {
      const response = await fetchImpl(`${baseUrl}${candidate}`, { headers });
      if (response.ok) return 'openapi';
    } catch {
      // Best-effort probe only — a network error here just means "not this path".
    }
  }
  return 'rest-generic';
}

function buildAuthHeaders(config: IntegrationConfig): Record<string, string> {
  switch (config.authType) {
    case 'none':
      return {};
    case 'basic': {
      const token = Buffer.from(`${config.credentials?.username ?? ''}:${config.credentials?.password ?? ''}`).toString('base64');
      return { authorization: `Basic ${token}` };
    }
    case 'bearer':
      return { authorization: `Bearer ${config.credentials?.token ?? ''}` };
    case 'apiKey':
      return { [config.credentials?.apiKeyHeader ?? 'X-API-Key']: config.credentials?.apiKey ?? '' };
    default:
      return {};
  }
}
