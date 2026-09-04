import assert from 'node:assert/strict';
import test from 'node:test';

import { handleSettingsRequest, type SettingsHttpService } from './settings-http.js';

function fakeService(overrides: Partial<SettingsHttpService> = {}): SettingsHttpService {
  return {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    list: async () => ({}),
    listKnownIntegrationKeys: () => [],
    ...overrides,
  };
}

test('GET /api/settings returns known keys and stored values', async () => {
  const service = fakeService({
    listKnownIntegrationKeys: () => ['GITHUB_TOKEN', 'GITLAB_BASE_URL'],
    list: async () => ({ GITHUB_TOKEN: 'abc' }),
  });

  const response = await handleSettingsRequest('GET', '/api/settings', undefined, service);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { known: ['GITHUB_TOKEN', 'GITLAB_BASE_URL'], values: { GITHUB_TOKEN: 'abc' } });
});

test('PUT /api/settings/:key stores the value and returns it', async () => {
  let received: { key: string; value: string } | undefined;
  const service = fakeService({
    set: async (key, value) => { received = { key, value }; },
  });

  const response = await handleSettingsRequest('PUT', '/api/settings/GITHUB_TOKEN', { value: 'newtoken' }, service);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { key: 'GITHUB_TOKEN', value: 'newtoken' });
  assert.deepEqual(received, { key: 'GITHUB_TOKEN', value: 'newtoken' });
});

test('PUT /api/settings/:key rejects a body without a string value', async () => {
  const response = await handleSettingsRequest('PUT', '/api/settings/GITHUB_TOKEN', { value: 123 }, fakeService());
  assert.equal(response.status, 400);
  assert.ok((response.body as { error: string }).error);
});

test('PUT /api/settings/:key rejects a missing body', async () => {
  const response = await handleSettingsRequest('PUT', '/api/settings/GITHUB_TOKEN', undefined, fakeService());
  assert.equal(response.status, 400);
});

test('PUT /api/settings/:key rejects a non-object body', async () => {
  const response = await handleSettingsRequest('PUT', '/api/settings/GITHUB_TOKEN', 'oops', fakeService());
  assert.equal(response.status, 400);
});

test('DELETE /api/settings/:key removes the key and returns 204', async () => {
  let deletedKey: string | undefined;
  const service = fakeService({
    delete: async (key) => { deletedKey = key; },
  });

  const response = await handleSettingsRequest('DELETE', '/api/settings/GRAFANA_API_KEY', undefined, service);
  assert.equal(response.status, 204);
  assert.equal(response.body, null);
  assert.equal(deletedKey, 'GRAFANA_API_KEY');
});

test('unknown route returns 404', async () => {
  const response = await handleSettingsRequest('GET', '/api/unknown', undefined, fakeService());
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'Not found' });
});

test('POST to /api/settings returns 404 since it is not a supported method', async () => {
  const response = await handleSettingsRequest('POST', '/api/settings', undefined, fakeService());
  assert.equal(response.status, 404);
});

test('PUT with an unsupported method on a keyed route returns 404', async () => {
  const response = await handleSettingsRequest('PATCH', '/api/settings/GITHUB_TOKEN', { value: 'x' }, fakeService());
  assert.equal(response.status, 404);
});

test('PUT /api/settings/:key url-decodes the key segment', async () => {
  let receivedKey: string | undefined;
  const service = fakeService({
    set: async (key) => { receivedKey = key; },
  });

  const response = await handleSettingsRequest('PUT', '/api/settings/SOME%2FKEY', { value: 'x' }, service);
  assert.equal(response.status, 200);
  assert.equal(receivedKey, 'SOME/KEY');
});
