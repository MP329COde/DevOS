import assert from 'node:assert/strict';
import test from 'node:test';

import { startTracking, stopTracking, type TimeEntry } from './time-tracking.js';

test('starts one timer per item and stops it once', () => {
  const startedAt = new Date('2026-09-03T10:00:00Z');
  const entry = startTracking([], 'item-1', startedAt);
  const stopped = stopTracking([entry], entry.id, new Date('2026-09-03T11:00:00Z'))[0];
  assert.equal(stopped.endedAt?.toISOString(), '2026-09-03T11:00:00.000Z');
  assert.throws(() => startTracking([entry], 'item-1'), /active timer/);
});

test('rejects an unknown timer', () => {
  const entries: TimeEntry[] = [];
  assert.throws(() => stopTracking(entries, 'missing'), /not found/);
});