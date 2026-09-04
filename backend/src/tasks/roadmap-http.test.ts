import assert from 'node:assert/strict';
import test from 'node:test';

import { handleRoadmapRequest, type RoadmapHttpService } from './roadmap-http.js';

test('returns roadmap data on GET /api/roadmap', async () => {
  const service: RoadmapHttpService = { get: async () => ({ items: [], milestones: [] }) };
  const result = await handleRoadmapRequest('GET', '/api/roadmap', service);
  assert.deepEqual(result, { status: 200, body: { items: [], milestones: [] } });
});

test('returns 404 for unknown paths', async () => {
  const service: RoadmapHttpService = { get: async () => ({ items: [], milestones: [] }) };
  const result = await handleRoadmapRequest('GET', '/api/roadmap/foo', service);
  assert.equal(result.status, 404);
});
