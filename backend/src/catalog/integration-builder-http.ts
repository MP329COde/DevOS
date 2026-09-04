import type { IntegrationConfig, IntegrationTestResult } from '../integrations/integration-builder.js';

export interface SavedIntegration {
  name: string;
  config: IntegrationConfig;
}

export interface IntegrationBuilderHttpService {
  test(config: IntegrationConfig): Promise<IntegrationTestResult>;
  list(): Promise<SavedIntegration[]>;
  save(integration: SavedIntegration): Promise<void>;
}

export interface IntegrationBuilderHttpResponse {
  status: number;
  body: unknown;
}

export async function handleIntegrationBuilderRequest(
  method: string,
  path: string,
  body: unknown,
  service: IntegrationBuilderHttpService,
): Promise<IntegrationBuilderHttpResponse> {
  try {
    if (method === 'POST' && path === '/api/integrations/test') {
      return { status: 200, body: await service.test(parseConfig(body)) };
    }

    if (method === 'GET' && path === '/api/integrations') {
      return { status: 200, body: await service.list() };
    }

    if (method === 'POST' && path === '/api/integrations') {
      const integration = parseSavedIntegration(body);
      await service.save(integration);
      return { status: 201, body: integration };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid integration request' } };
  }
}

function parseConfig(body: unknown): IntegrationConfig {
  if (!body || typeof body !== 'object') throw new Error('Missing integration config');
  const b = body as Record<string, unknown>;
  if (typeof b.baseUrl !== 'string' || !b.baseUrl) throw new Error('"baseUrl" is required');
  if (b.authType !== 'none' && b.authType !== 'basic' && b.authType !== 'bearer' && b.authType !== 'apiKey') {
    throw new Error('"authType" must be one of none, basic, bearer, apiKey');
  }
  return {
    baseUrl: b.baseUrl,
    authType: b.authType,
    credentials: typeof b.credentials === 'object' && b.credentials !== null ? (b.credentials as IntegrationConfig['credentials']) : undefined,
    healthPath: typeof b.healthPath === 'string' ? b.healthPath : undefined,
  };
}

function parseSavedIntegration(body: unknown): SavedIntegration {
  if (!body || typeof body !== 'object') throw new Error('Missing integration payload');
  const b = body as Record<string, unknown>;
  if (typeof b.name !== 'string' || !b.name.trim()) throw new Error('"name" is required');
  return { name: b.name, config: parseConfig(b.config) };
}
