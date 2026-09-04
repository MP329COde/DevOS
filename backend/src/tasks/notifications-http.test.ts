import assert from 'node:assert/strict';
import test from 'node:test';

import { handleNotificationsRequest, type NotificationsHttpService } from './notifications-http.js';

function service(overrides: Partial<NotificationsHttpService> = {}): NotificationsHttpService {
  return { trigger: overrides.trigger ?? (async () => []) };
}

test('triggers a notification and returns per-channel results', async () => {
  const result = await handleNotificationsRequest(
    'POST',
    '/api/notifications/trigger',
    { title: 'Échéance dépassée', message: 'Item X en retard' },
    service({ trigger: async () => [{ channel: 'email', ok: true }] }),
  );
  assert.deepEqual(result, { status: 200, body: { results: [{ channel: 'email', ok: true }] } });
});

test('returns 200 with empty results when no server-side channel is configured', async () => {
  const result = await handleNotificationsRequest('POST', '/api/notifications/trigger', { title: 't', message: 'm' }, service());
  assert.deepEqual(result, { status: 200, body: { results: [] } });
});

test('rejects a payload missing title or message', async () => {
  const result = await handleNotificationsRequest('POST', '/api/notifications/trigger', { title: 't' }, service());
  assert.equal(result.status, 400);
});

test('rejects unknown routes', async () => {
  const result = await handleNotificationsRequest('GET', '/api/notifications/unknown', undefined, service());
  assert.equal(result.status, 404);
});
