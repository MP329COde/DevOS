import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaCycleService } from './cycle-service.js';

test('closes a cycle and carries incomplete items in one transaction', async () => {
  let carried = false;
  let closed = false;
  const transaction = {
    cycle: {
      async findUnique() { return { id: 'current', startsAt: new Date('2026-09-01'), closedAt: null }; },
      async findFirst() { return { id: 'next' }; },
      async update() { closed = true; return { id: 'current' }; },
    },
    item: { async updateMany(input: { where: { status: { not: string } } }) { carried = input.where.status.not === 'done'; return { count: 1 }; } },
  };
  const service = new PrismaCycleService({ $transaction: async (callback: (tx: typeof transaction) => unknown) => callback(transaction) } as never);
  await service.close('current');
  assert.equal(carried, true);
  assert.equal(closed, true);
});

test('rejects creating a cycle with an invalid date range', async () => {
  const service = new PrismaCycleService({} as never);
  assert.throws(() => service.create({ name: 'Invalid', startsAt: '2026-09-14', endsAt: '2026-09-01' }), /increasing date range/);
});