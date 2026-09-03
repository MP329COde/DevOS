import assert from 'node:assert/strict';
import test from 'node:test';

import { DashboardService, endOfDay, startOfDay } from './dashboard-service.js';

test('startOfDay resets the time to midnight', () => {
  const start = startOfDay(new Date('2026-09-03T18:45:12.000Z'));
  assert.deepEqual([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()], [0, 0, 0, 0]);
});

test('endOfDay resets the time to the last millisecond of the day', () => {
  const end = endOfDay(new Date('2026-09-03T18:45:12.000Z'));
  assert.deepEqual([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()], [23, 59, 59, 999]);
});

test('today() queries items due within the reference day, ordered by due date', async () => {
  let receivedWhere: unknown;
  let receivedOrderBy: unknown;
  const database = {
    item: {
      findMany: async ({ where, orderBy }: { where: unknown; orderBy: unknown }) => { receivedWhere = where; receivedOrderBy = orderBy; return []; },
    },
  } as never;

  await new DashboardService(database).today(new Date('2026-09-03T18:45:12.000Z'));
  assert.deepEqual(receivedWhere, { dueAt: { gte: startOfDay(new Date('2026-09-03T18:45:12.000Z')), lte: endOfDay(new Date('2026-09-03T18:45:12.000Z')) } });
  assert.deepEqual(receivedOrderBy, { dueAt: 'asc' });
});

test('tomorrow() shifts the reference day forward by one day', async () => {
  let receivedWhere: unknown;
  const database = {
    item: {
      findMany: async ({ where }: { where: unknown }) => { receivedWhere = where; return []; },
    },
  } as never;

  await new DashboardService(database).tomorrow(new Date('2026-09-03T18:45:12.000Z'));
  assert.deepEqual(receivedWhere, { dueAt: { gte: startOfDay(new Date('2026-09-04T18:45:12.000Z')), lte: endOfDay(new Date('2026-09-04T18:45:12.000Z')) } });
});
