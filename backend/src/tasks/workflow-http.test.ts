import assert from 'node:assert/strict';
import test from 'node:test';

import { handleWorkflowRequest, type WorkflowHttpService } from './workflow-http.js';

function buildService(): WorkflowHttpService & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = { list: [], resolve: [], create: [], update: [], delete: [] };
  return {
    calls,
    async list(scope) { calls.list.push(scope); return [{ key: 'backlog', label: 'Backlog' }]; },
    async resolve(scope) { calls.resolve.push(scope); return [{ key: 'backlog', label: 'Backlog' }]; },
    async create(input) { calls.create.push(input); return { id: 'w1', ...input }; },
    async update(id, input) { calls.update.push([id, input]); return { id, ...input }; },
    async delete(id) { calls.delete.push(id); },
  };
}

test('lists and resolves workflow statuses scoped to a project', async () => {
  const service = buildService();
  assert.equal((await handleWorkflowRequest('GET', '/api/workflow-statuses?scope=p1', null, service)).status, 200);
  assert.equal(service.calls.list[0], 'p1');
  assert.equal((await handleWorkflowRequest('GET', '/api/workflow-statuses/resolve?scope=p1', null, service)).status, 200);
  assert.equal(service.calls.resolve[0], 'p1');
});

test('creates a workflow status and rejects a payload missing key/label', async () => {
  const service = buildService();
  const created = await handleWorkflowRequest('POST', '/api/workflow-statuses', { key: 'in_review', label: 'En revue', scope: 'p1', order: 2 }, service);
  assert.equal(created.status, 201);
  const rejected = await handleWorkflowRequest('POST', '/api/workflow-statuses', { key: 'x' }, service);
  assert.equal(rejected.status, 400);
});

test('updates and deletes a workflow status by id', async () => {
  const service = buildService();
  assert.equal((await handleWorkflowRequest('PATCH', '/api/workflow-statuses/w1', { label: 'Terminé', isFinal: true }, service)).status, 200);
  assert.equal((await handleWorkflowRequest('DELETE', '/api/workflow-statuses/w1', null, service)).status, 204);
});
