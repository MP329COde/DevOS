import assert from 'node:assert/strict';
import test from 'node:test';

import { handleEnvironmentRequest, type EnvironmentHttpService } from './environment-http.js';

function fakeEnvironment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    devProjectId: 'p1',
    name: 'prod',
    kind: 'prod',
    url: null,
    status: 'unknown',
    currentVersion: null,
    expectedVersion: null,
    pipelineStatus: null,
    lastDeployedAt: null,
    lastError: null,
    requiresApproval: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeService(overrides: Partial<EnvironmentHttpService> = {}): EnvironmentHttpService {
  return {
    list: async () => [],
    get: async () => fakeEnvironment() as never,
    create: async (input) => ({ id: 'e1', ...input }) as never,
    update: async () => ({}) as never,
    delete: async () => undefined,
    deploy: async () => ({}) as never,
    ...overrides,
  };
}

test('creates an environment', async () => {
  const service = fakeService();
  const result = await handleEnvironmentRequest('POST', '/api/environments', { devProjectId: 'p1', name: 'staging' }, undefined, service);
  assert.equal(result.status, 201);
});

test('refuses to deploy on a prod environment without confirmation', async () => {
  let deployed = false;
  const service = fakeService({ deploy: async () => { deployed = true; return {} as never; } });
  const result = await handleEnvironmentRequest('POST', '/api/environments/e1/deploy', { version: '1.2.3' }, 'Admin', service);
  assert.equal(result.status, 409);
  assert.equal(deployed, false);
});

test('refuses to deploy on prod without an authorized role', async () => {
  let deployed = false;
  const service = fakeService({ deploy: async () => { deployed = true; return {} as never; } });
  const result = await handleEnvironmentRequest('POST', '/api/environments/e1/deploy', { version: '1.2.3', confirm: true }, 'Lecteur', service);
  assert.equal(result.status, 400);
  assert.equal(deployed, false);
});

test('allows deploy on prod with role + explicit confirmation', async () => {
  let deployedWith: unknown;
  const service = fakeService({ deploy: async (id, input) => { deployedWith = { id, input }; return {} as never; } });
  const result = await handleEnvironmentRequest('POST', '/api/environments/e1/deploy', { version: '1.2.3', confirm: true }, 'Admin', service);
  assert.equal(result.status, 200);
  assert.deepEqual(deployedWith, { id: 'e1', input: { version: '1.2.3' } });
});

test('allows deploy on a non-sensitive dev environment without confirmation', async () => {
  let deployed = false;
  const service = fakeService({
    get: async () => fakeEnvironment({ kind: 'dev', requiresApproval: false }) as never,
    deploy: async () => { deployed = true; return {} as never; },
  });
  const result = await handleEnvironmentRequest('POST', '/api/environments/e1/deploy', { version: '1.2.3' }, undefined, service);
  assert.equal(result.status, 200);
  assert.equal(deployed, true);
});
