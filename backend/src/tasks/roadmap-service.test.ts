import assert from 'node:assert/strict';
import test from 'node:test';

import { RoadmapService } from './roadmap-service.js';

function fakeDatabase(items: unknown[], cycles: unknown[]) {
  return {
    item: { findMany: async () => items },
    cycle: { findMany: async () => cycles },
  } as unknown as import('@prisma/client').PrismaClient;
}

test('computes milestone progress and lateness from linked items', async () => {
  const now = new Date('2026-09-04T00:00:00Z');
  const cycleId = 'cycle-1';
  const items = [
    { id: 'i1', title: 'A', status: 'done', taskLevel: 'epic', parentId: null, dueAt: null, createdAt: new Date('2026-01-01'), cycleId },
    { id: 'i2', title: 'B', status: 'in_progress', taskLevel: 'task', parentId: 'i1', dueAt: null, createdAt: new Date('2026-01-02'), cycleId },
  ];
  const cycles = [
    { id: cycleId, name: 'Jalon 1', startsAt: new Date('2026-01-01'), endsAt: new Date('2026-08-01'), closedAt: null },
  ];
  const service = new RoadmapService(fakeDatabase(items, cycles));
  const result = await service.get(now);

  assert.equal(result.items.length, 2);
  assert.equal(result.milestones.length, 1);
  assert.equal(result.milestones[0].itemCount, 2);
  assert.equal(result.milestones[0].doneCount, 1);
  assert.equal(result.milestones[0].progress, 50);
  assert.equal(result.milestones[0].isLate, true);
  assert.equal(result.milestones[0].isBlocked, false);
});

test('flags a milestone as blocked when any linked item is blocked', async () => {
  const cycleId = 'cycle-2';
  const items = [
    { id: 'i1', title: 'A', status: 'blocked', taskLevel: 'task', parentId: null, dueAt: null, createdAt: new Date('2026-01-01'), cycleId },
  ];
  const cycles = [
    { id: cycleId, name: 'Jalon 2', startsAt: new Date('2026-01-01'), endsAt: new Date('2027-01-01'), closedAt: null },
  ];
  const service = new RoadmapService(fakeDatabase(items, cycles));
  const result = await service.get(new Date('2026-09-04'));

  assert.equal(result.milestones[0].isBlocked, true);
  assert.equal(result.milestones[0].isLate, false);
});
