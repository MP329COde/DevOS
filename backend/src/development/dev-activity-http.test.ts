import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleDevActivityRequest, type DevActivityHttpService } from './dev-activity-http.js';

function buildService(overrides: Partial<DevActivityHttpService> = {}): DevActivityHttpService {
  return {
    timeline: async () => [],
    projectDocs: async () => [],
    createProjectDoc: async (devProjectId, title, content) => ({ devProjectId, title, content }),
    architecture: async () => ({ nodes: [], edges: [] }),
    members: async () => [],
    integrationsStatus: () => [],
    search: async () => [],
    assistantQuery: (prompt) => ({ configured: false, message: `stub:${prompt}` }),
    agentAction: (action) => ({ configured: false, message: `stub:${action}` }),
    lifecycle: async () => null,
    personalDashboard: async (member) => ({ member, assignedOpenTasks: [], pipelinesFailing: [], mergeRequestsToReview: [] }),
    recordEvent: async (input) => input,
    ...overrides,
  };
}

test('GET /api/dev-activity/timeline forwards filters', async () => {
  let received: unknown;
  const service = buildService({ timeline: async (filter) => { received = filter; return []; } });
  const result = await handleDevActivityRequest('GET', '/api/dev-activity/timeline?devProjectId=p1&type=comment', undefined, service);
  assert.equal(result.status, 200);
  assert.deepEqual(received, {
    devProjectId: 'p1',
    itemId: undefined,
    releaseId: undefined,
    environmentId: undefined,
    type: 'comment',
    from: undefined,
    to: undefined,
  });
});

test('POST /api/dev-activity/events records a timeline event when authorized', async () => {
  let received: unknown;
  const service = buildService({ recordEvent: async (input) => { received = input; return input; } });
  const result = await handleDevActivityRequest(
    'POST',
    '/api/dev-activity/events',
    { type: 'commit', summary: 'Commit abc123' },
    service,
    'Contributeur',
  );
  assert.equal(result.status, 201);
  assert.equal((received as { type: string }).type, 'commit');
});

test('POST /api/dev-activity/events requires authentication', async () => {
  const service = buildService();
  const result = await handleDevActivityRequest('POST', '/api/dev-activity/events', { type: 'commit', summary: 'x' }, service);
  assert.equal(result.status, 400);
});

test('POST /api/dev-activity/projects/:id/docs creates a scoped doc', async () => {
  const service = buildService();
  const result = await handleDevActivityRequest('POST', '/api/dev-activity/projects/p1/docs', { title: 'T', content: 'C' }, service);
  assert.equal(result.status, 201);
  assert.deepEqual(result.body, { devProjectId: 'p1', title: 'T', content: 'C' });
});

test('POST /api/dev-activity/assistant returns an explicit stub, never a real answer', async () => {
  const service = buildService();
  const result = await handleDevActivityRequest('POST', '/api/dev-activity/assistant', { prompt: 'hello' }, service);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { configured: false, message: 'stub:hello' });
});

test('POST /api/dev-activity/agent returns an explicit stub', async () => {
  const service = buildService();
  const result = await handleDevActivityRequest('POST', '/api/dev-activity/agent', { action: 'open-pr' }, service);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { configured: false, message: 'stub:open-pr' });
});

test('GET /api/dev-activity/dashboard requires a member query param', async () => {
  const service = buildService();
  const result = await handleDevActivityRequest('GET', '/api/dev-activity/dashboard', undefined, service);
  assert.equal(result.status, 400);
});

test('GET /api/dev-activity/dashboard returns the personal dashboard', async () => {
  const service = buildService();
  const result = await handleDevActivityRequest('GET', '/api/dev-activity/dashboard?member=alice', undefined, service);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { member: 'alice', assignedOpenTasks: [], pipelinesFailing: [], mergeRequestsToReview: [] });
});

test('GET /api/dev-activity/items/:id/lifecycle 404s when the item is missing', async () => {
  const service = buildService();
  const result = await handleDevActivityRequest('GET', '/api/dev-activity/items/missing/lifecycle', undefined, service);
  assert.equal(result.status, 404);
});
