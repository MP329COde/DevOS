import assert from 'node:assert/strict';
import test from 'node:test';

import { handleProjectResourceRequest, type ProjectResourceHttpService } from './project-resource-http.js';

function fakeService(overrides: Partial<ProjectResourceHttpService> = {}): ProjectResourceHttpService {
  return {
    listResources: async () => [],
    createResource: async (devProjectId, input) => ({ id: 'r1', devProjectId, ...input }) as never,
    deleteResource: async () => undefined,
    ...overrides,
  };
}

test('lists resources for a project', async () => {
  let received: string | undefined;
  const service = fakeService({ listResources: async (id) => { received = id; return []; } });
  const result = await handleProjectResourceRequest('GET', '/api/dev-projects/p1/resources', null, 'Lecteur', service);
  assert.equal(result.status, 200);
  assert.equal(received, 'p1');
});

test('creates a resource', async () => {
  const service = fakeService();
  const result = await handleProjectResourceRequest('POST', '/api/dev-projects/p1/resources', { name: 'db-main', type: 'postgres' }, 'Contributeur', service);
  assert.equal(result.status, 201);
});

test('rejects creating a resource without a session', async () => {
  const service = fakeService();
  const result = await handleProjectResourceRequest('POST', '/api/dev-projects/p1/resources', { name: 'db-main', type: 'postgres' }, undefined, service);
  assert.equal(result.status, 400);
});

test('rejects creating a resource without required fields', async () => {
  const service = fakeService();
  const result = await handleProjectResourceRequest('POST', '/api/dev-projects/p1/resources', { name: 'db-main' }, 'Contributeur', service);
  assert.equal(result.status, 400);
});

test('deletes a resource', async () => {
  let deletedId: string | undefined;
  const service = fakeService({ deleteResource: async (_projectId, id) => { deletedId = id; } });
  const result = await handleProjectResourceRequest('DELETE', '/api/dev-projects/p1/resources/r1', null, 'Admin', service);
  assert.equal(result.status, 204);
  assert.equal(deletedId, 'r1');
});

test('rejects unknown routes', async () => {
  const service = fakeService();
  const result = await handleProjectResourceRequest('GET', '/api/dev-projects/p1/unknown', null, 'Admin', service);
  assert.equal(result.status, 404);
});
