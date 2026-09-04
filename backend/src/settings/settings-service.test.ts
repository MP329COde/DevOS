import assert from 'node:assert/strict';
import test from 'node:test';

import { SettingsService } from './settings-service.js';

test('get returns null when the key does not exist', async () => {
  const database = {
    systemSetting: {
      findUnique: async () => null,
    },
  } as never;

  const value = await new SettingsService(database).get('GITHUB_TOKEN');
  assert.equal(value, null);
});

test('get returns the stored value when the key exists', async () => {
  const database = {
    systemSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => ({ key: where.key, value: 'abc123' }),
    },
  } as never;

  const value = await new SettingsService(database).get('GITHUB_TOKEN');
  assert.equal(value, 'abc123');
});

test('set upserts the key and value', async () => {
  let received: unknown;
  const database = {
    systemSetting: {
      upsert: async (args: unknown) => { received = args; return {}; },
    },
  } as never;

  await new SettingsService(database).set('GRAFANA_API_KEY', 'secret');
  assert.deepEqual(received, {
    where: { key: 'GRAFANA_API_KEY' },
    create: { key: 'GRAFANA_API_KEY', value: 'secret' },
    update: { value: 'secret' },
  });
});

test('delete removes the key', async () => {
  let received: unknown;
  const database = {
    systemSetting: {
      deleteMany: async (args: unknown) => { received = args; return { count: 1 }; },
    },
  } as never;

  await new SettingsService(database).delete('GRAFANA_API_KEY');
  assert.deepEqual(received, { where: { key: 'GRAFANA_API_KEY' } });
});

test('delete does not throw when the key is absent', async () => {
  const database = {
    systemSetting: {
      deleteMany: async () => ({ count: 0 }),
    },
  } as never;

  await assert.doesNotReject(() => new SettingsService(database).delete('MISSING_KEY'));
});

test('list returns all stored key/value pairs as an object', async () => {
  const database = {
    systemSetting: {
      findMany: async () => [
        { key: 'GITHUB_TOKEN', value: 'a' },
        { key: 'GRAFANA_BASE_URL', value: 'http://grafana' },
      ],
    },
  } as never;

  const result = await new SettingsService(database).list();
  assert.deepEqual(result, { GITHUB_TOKEN: 'a', GRAFANA_BASE_URL: 'http://grafana' });
});

test('list returns an empty object when no settings are stored', async () => {
  const database = {
    systemSetting: {
      findMany: async () => [],
    },
  } as never;

  const result = await new SettingsService(database).list();
  assert.deepEqual(result, {});
});

test('listKnownIntegrationKeys returns a non-empty array of known env var names', () => {
  const keys = new SettingsService({} as never).listKnownIntegrationKeys();
  assert.ok(Array.isArray(keys));
  assert.ok(keys.length > 0);
  assert.ok(keys.includes('GITHUB_TOKEN'));
  assert.ok(keys.includes('GITLAB_BASE_URL'));
  assert.ok(keys.includes('HAPROXY_DATA_PLANE_URL'));
});

test('listKnownIntegrationKeys returns a fresh array each call', () => {
  const service = new SettingsService({} as never);
  const first = service.listKnownIntegrationKeys();
  first.push('MUTATED');
  const second = service.listKnownIntegrationKeys();
  assert.ok(!second.includes('MUTATED'));
});

test('listKnownIntegrationKeys does not include unrelated server env vars', () => {
  const keys = new SettingsService({} as never).listKnownIntegrationKeys();
  assert.ok(!keys.includes('PORT'));
  assert.ok(!keys.includes('FRONTEND_ORIGIN'));
});
