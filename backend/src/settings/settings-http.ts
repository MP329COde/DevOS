export interface SettingsHttpService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<Record<string, string>>;
  listKnownIntegrationKeys(): string[];
}

export interface SettingsHttpResponse {
  status: number;
  body: unknown;
}

export async function handleSettingsRequest(
  method: string,
  path: string,
  body: unknown,
  service: SettingsHttpService,
): Promise<SettingsHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/settings') {
      return {
        status: 200,
        body: {
          known: service.listKnownIntegrationKeys(),
          values: await service.list(),
        },
      };
    }

    const match = path.match(/^\/api\/settings\/([^/]+)$/);
    if (!match) return { status: 404, body: { error: 'Not found' } };
    const key = decodeURIComponent(match[1]);

    if (method === 'PUT') {
      const value = parsePutValue(body);
      await service.set(key, value);
      return { status: 200, body: { key, value } };
    }

    if (method === 'DELETE') {
      await service.delete(key);
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return { status: 400, body: { error: message } };
  }
}

function parsePutValue(body: unknown): string {
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).value !== 'string') {
    throw new Error('Settings payload must contain a string "value"');
  }
  return (body as Record<string, unknown>).value as string;
}
