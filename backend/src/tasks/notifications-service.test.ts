import assert from 'node:assert/strict';
import test from 'node:test';

import { NotificationsService, type NotificationsServiceDeps } from './notifications-service.js';

function deps(overrides: Partial<NotificationsServiceDeps> = {}): NotificationsServiceDeps {
  return {
    sendEmail: overrides.sendEmail ?? (async () => undefined),
    sendWebhook: overrides.sendWebhook ?? (async () => undefined),
  };
}

test('dispatches to no channel when neither email nor webhook is configured', async () => {
  const service = new NotificationsService(undefined, undefined, deps());
  assert.deepEqual(await service.trigger({ title: 't', message: 'm' }), []);
});

test('dispatches to email only when only email is configured', async () => {
  let called = false;
  const service = new NotificationsService(
    { host: 'smtp.test', port: 587, from: 'a@test', to: 'b@test' },
    undefined,
    deps({ sendEmail: async () => { called = true; } }),
  );
  const results = await service.trigger({ title: 't', message: 'm' });
  assert.equal(called, true);
  assert.deepEqual(results, [{ channel: 'email', ok: true }]);
});

test('dispatches to both channels when both are configured', async () => {
  const service = new NotificationsService(
    { host: 'smtp.test', port: 587, from: 'a@test', to: 'b@test' },
    { url: 'https://hooks.test' },
    deps(),
  );
  const results = await service.trigger({ title: 't', message: 'm' });
  assert.deepEqual(results, [{ channel: 'email', ok: true }, { channel: 'webhook', ok: true }]);
});

test('reports a failed channel without throwing, and still attempts the other channel', async () => {
  const service = new NotificationsService(
    { host: 'smtp.test', port: 587, from: 'a@test', to: 'b@test' },
    { url: 'https://hooks.test' },
    deps({
      sendEmail: async () => { throw new Error('SMTP timeout'); },
    }),
  );
  const results = await service.trigger({ title: 't', message: 'm' });
  assert.deepEqual(results, [
    { channel: 'email', ok: false, error: 'SMTP timeout' },
    { channel: 'webhook', ok: true },
  ]);
});
