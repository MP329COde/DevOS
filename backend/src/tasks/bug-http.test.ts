import assert from 'node:assert/strict';
import test from 'node:test';

import { handleBugRequest, type BugHttpService } from './bug-http.js';
import type { CreateBugInput, UpdateBugInput } from './bug-service.js';

function buildService(): BugHttpService & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = { list: [], get: [], create: [], update: [], delete: [] };
  return {
    calls,
    async list(filter) { calls.list.push(filter); return [{ id: 'b1' }]; },
    async get(id) { calls.get.push(id); return id === 'missing' ? null : { id }; },
    async create(input: CreateBugInput) { calls.create.push(input); return { id: 'b2', ...input }; },
    async update(id, input: UpdateBugInput) { calls.update.push([id, input]); return { id, ...input }; },
    async delete(id) { calls.delete.push(id); },
  };
}

test('lists bugs with optional project/status filters', async () => {
  const service = buildService();
  const result = await handleBugRequest('GET', '/api/bugs?devProjectId=p1&status=open', null, service);
  assert.equal(result.status, 200);
  assert.deepEqual(service.calls.list[0], { devProjectId: 'p1', status: 'open' });
});

test('creates a bug with severity, repro info and optional links', async () => {
  const service = buildService();
  const result = await handleBugRequest('POST', '/api/bugs', {
    title: 'Crash au login',
    severity: 'critical',
    environment: 'staging',
    versionAffected: '1.4.0',
    expectedBehavior: 'Connexion réussie',
    observedBehavior: 'Erreur 500',
    reproSteps: '1. Ouvrir /login\n2. Soumettre',
    logs: 'TypeError: ...',
    screenshots: ['https://files/1.png'],
    releaseRef: 'v1.4.0',
    commitRef: 'abc123',
    devProjectId: 'p1',
  }, service);
  assert.equal(result.status, 201);
  assert.equal((service.calls.create[0] as CreateBugInput).severity, 'critical');
});

test('rejects a bug without a title and an invalid severity', async () => {
  const service = buildService();
  assert.equal((await handleBugRequest('POST', '/api/bugs', { title: '' }, service)).status, 400);
  assert.equal((await handleBugRequest('POST', '/api/bugs', { title: 'x', severity: 'invalid' }, service)).status, 400);
});

test('gets, updates and deletes a bug by id', async () => {
  const service = buildService();
  assert.equal((await handleBugRequest('GET', '/api/bugs/b1', null, service)).status, 200);
  assert.equal((await handleBugRequest('GET', '/api/bugs/missing', null, service)).status, 404);
  assert.equal((await handleBugRequest('PATCH', '/api/bugs/b1', { status: 'resolved' }, service)).status, 200);
  assert.equal((await handleBugRequest('DELETE', '/api/bugs/b1', null, service)).status, 204);
});
