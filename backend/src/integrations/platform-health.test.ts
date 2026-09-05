import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkPlatformHealth } from './platform-health.js';

test('checkPlatformHealth is healthy when the database (and no redis check) succeed', async () => {
  const result = await checkPlatformHealth({ pingDatabase: async () => {} });
  assert.deepEqual(result, { healthy: true, database: 'ok', redis: 'skipped' });
});

test('checkPlatformHealth reports the database error without pinging redis', async () => {
  let redisPinged = false;
  const result = await checkPlatformHealth({
    pingDatabase: async () => { throw new Error('connection refused'); },
    pingRedis: async () => { redisPinged = true; },
  });
  assert.equal(result.healthy, false);
  assert.equal(result.database, 'error');
  assert.equal(result.redis, 'skipped');
  assert.equal(redisPinged, false);
});

test('checkPlatformHealth reports a redis failure even when the database is fine', async () => {
  const result = await checkPlatformHealth({
    pingDatabase: async () => {},
    pingRedis: async () => { throw new Error('timeout'); },
  });
  assert.equal(result.healthy, false);
  assert.equal(result.database, 'ok');
  assert.equal(result.redis, 'error');
});

test('checkPlatformHealth is healthy when both database and redis succeed', async () => {
  const result = await checkPlatformHealth({ pingDatabase: async () => {}, pingRedis: async () => {} });
  assert.deepEqual(result, { healthy: true, database: 'ok', redis: 'ok' });
});
