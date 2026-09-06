import assert from 'node:assert/strict';
import test from 'node:test';

import { handleNotificationsRequest, type NotificationsHttpService } from './notifications-http.js';

function service(overrides: Partial<NotificationsHttpService> = {}): NotificationsHttpService {
  return {
    trigger: overrides.trigger ?? (async () => []),
    list: overrides.list ?? (async () => []),
    markAsRead: overrides.markAsRead ?? (async () => {}),
    markAllAsRead: overrides.markAllAsRead ?? (async () => {}),
    delete: overrides.delete ?? (async () => {}),
  };
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

test('lists stored notifications', async () => {
  const stored = [{ id: '1', title: 't', message: 'm', category: null, resourceKind: null, resourceId: null, priority: 'normal', readAt: null, createdAt: new Date() }];
  const result = await handleNotificationsRequest('GET', '/api/notifications', undefined, service({ list: async () => stored }));
  assert.deepEqual(result, { status: 200, body: { notifications: stored } });
});

test('marks a notification as read', async () => {
  let markedId: string | undefined;
  const result = await handleNotificationsRequest(
    'PATCH',
    '/api/notifications/abc/read',
    undefined,
    service({ markAsRead: async (id) => { markedId = id; } }),
  );
  assert.equal(result.status, 204);
  assert.equal(markedId, 'abc');
});

test('marks all notifications as read', async () => {
  let called = false;
  const result = await handleNotificationsRequest(
    'PATCH',
    '/api/notifications/read-all',
    undefined,
    service({ markAllAsRead: async () => { called = true; } }),
  );
  assert.equal(result.status, 204);
  assert.equal(called, true);
});

test('deletes a notification from the center', async () => {
  let deletedId: string | undefined;
  const result = await handleNotificationsRequest(
    'DELETE',
    '/api/notifications/abc',
    undefined,
    service({ delete: async (id) => { deletedId = id; } }),
  );
  assert.equal(result.status, 204);
  assert.equal(deletedId, 'abc');
});
