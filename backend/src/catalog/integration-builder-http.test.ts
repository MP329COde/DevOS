import assert from 'node:assert/strict';
import test from 'node:test';

import { handleIntegrationBuilderRequest, type SavedIntegration } from './integration-builder-http.js';

function service(overrides: Partial<{ saved: SavedIntegration[] }> = {}) {
  const saved = overrides.saved ?? [];
  return {
    async test(config: { baseUrl: string }) {
      return { reachable: true, status: 200, detectedApiType: 'rest-generic' as const, probedUrl: config.baseUrl };
    },
    async list() { return saved; },
    async save(integration: SavedIntegration) { saved.push(integration); },
  };
}

test('tests a config and returns the connectivity result', async () => {
  const result = await handleIntegrationBuilderRequest('POST', '/api/integrations/test', { baseUrl: 'https://api.test', authType: 'none' }, service());
  assert.equal(result.status, 200);
  assert.equal((result.body as { reachable: boolean }).reachable, true);
});

test('rejects a test payload missing baseUrl', async () => {
  const result = await handleIntegrationBuilderRequest('POST', '/api/integrations/test', { authType: 'none' }, service());
  assert.equal(result.status, 400);
});

test('rejects an unknown authType', async () => {
  const result = await handleIntegrationBuilderRequest('POST', '/api/integrations/test', { baseUrl: 'https://api.test', authType: 'oauth2' }, service());
  assert.equal(result.status, 400);
});

test('lists saved integrations', async () => {
  const saved: SavedIntegration[] = [{ name: 'grafana-custom', config: { baseUrl: 'https://g.test', authType: 'none' } }];
  const result = await handleIntegrationBuilderRequest('GET', '/api/integrations', undefined, service({ saved }));
  assert.deepEqual(result, { status: 200, body: saved });
});

test('saves a named integration', async () => {
  const svc = service();
  const result = await handleIntegrationBuilderRequest(
    'POST',
    '/api/integrations',
    { name: 'grafana-custom', config: { baseUrl: 'https://g.test', authType: 'bearer', credentials: { token: 'tok' } } },
    svc,
  );
  assert.equal(result.status, 201);
  assert.deepEqual(await svc.list(), [{ name: 'grafana-custom', config: { baseUrl: 'https://g.test', authType: 'bearer', credentials: { token: 'tok' }, healthPath: undefined } }]);
});

test('rejects a saved integration without a name', async () => {
  const result = await handleIntegrationBuilderRequest('POST', '/api/integrations', { config: { baseUrl: 'https://g.test', authType: 'none' } }, service());
  assert.equal(result.status, 400);
});

test('rejects unknown routes', async () => {
  const result = await handleIntegrationBuilderRequest('GET', '/api/integrations/unknown', undefined, service());
  assert.equal(result.status, 404);
});
