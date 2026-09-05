import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';

import { NotificationsService, type NotificationsServiceDeps } from './notifications-service.js';

function deps(overrides: Partial<NotificationsServiceDeps> = {}): NotificationsServiceDeps {
  return {
    sendEmail: overrides.sendEmail ?? (async () => undefined),
    sendWebhook: overrides.sendWebhook ?? (async () => undefined),
  };
}

function fakeDatabase(): PrismaClient {
  return {
    notification: {
      create: async () => undefined,
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
  } as unknown as PrismaClient;
}

test('dispatches to no channel when neither email nor webhook is configured', async () => {
  const service = new NotificationsService(fakeDatabase(), undefined, undefined, deps());
  assert.deepEqual(await service.trigger({ title: 't', message: 'm' }), []);
});

test('dispatches to email only when only email is configured', async () => {
  let called = false;
  const service = new NotificationsService(
    fakeDatabase(),
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
    fakeDatabase(),
    { host: 'smtp.test', port: 587, from: 'a@test', to: 'b@test' },
    { url: 'https://hooks.test' },
    deps(),
  );
  const results = await service.trigger({ title: 't', message: 'm' });
  assert.deepEqual(results, [{ channel: 'email', ok: true }, { channel: 'webhook', ok: true }]);
});

test('reports a failed channel without throwing, and still attempts the other channel', async () => {
  const service = new NotificationsService(
    fakeDatabase(),
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

test('list only returns non-deleted notifications, ordered by most recent', async () => {
  const stored = [{ id: '1', title: 't', message: 'm', category: null, readAt: null, createdAt: new Date() }];
  let queriedWhere: unknown;
  const database = {
    notification: {
      findMany: async (args: { where: unknown }) => { queriedWhere = args.where; return stored; },
    },
  } as unknown as PrismaClient;
  const service = new NotificationsService(database, undefined, undefined, deps());
  assert.deepEqual(await service.list(), stored);
  assert.deepEqual(queriedWhere, { deletedAt: null });
});

test('markAsRead only touches unread notifications', async () => {
  let args: unknown;
  const database = {
    notification: { updateMany: async (a: unknown) => { args = a; return { count: 1 }; } },
  } as unknown as PrismaClient;
  const service = new NotificationsService(database, undefined, undefined, deps());
  await service.markAsRead('abc');
  assert.deepEqual(args, { where: { id: 'abc', readAt: null }, data: { readAt: (args as { data: { readAt: Date } }).data.readAt } });
});

test('delete soft-deletes rather than hard-deleting', async () => {
  let args: unknown;
  const database = {
    notification: { updateMany: async (a: unknown) => { args = a; return { count: 1 }; } },
  } as unknown as PrismaClient;
  const service = new NotificationsService(database, undefined, undefined, deps());
  await service.delete('abc');
  assert.equal((args as { where: { id: string; deletedAt: null } }).where.id, 'abc');
  assert.equal((args as { where: { id: string; deletedAt: null } }).where.deletedAt, null);
});

test('purgeExpired hard-deletes notifications older than 60 days', async () => {
  let args: unknown;
  const database = {
    notification: { deleteMany: async (a: unknown) => { args = a; return { count: 3 }; } },
  } as unknown as PrismaClient;
  const service = new NotificationsService(database, undefined, undefined, deps());
  const count = await service.purgeExpired();
  assert.equal(count, 3);
  const cutoff = (args as { where: { createdAt: { lt: Date } } }).where.createdAt.lt;
  const daysAgo = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
  assert.ok(Math.abs(daysAgo - 60) < 1);
});
