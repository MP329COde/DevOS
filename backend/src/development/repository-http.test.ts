import assert from 'node:assert/strict';
import test from 'node:test';

import { handleRepositoryRequest, type RepositoryHttpService } from './repository-http.js';

function fakeService(overrides: Partial<RepositoryHttpService> = {}): RepositoryHttpService {
  return {
    listRepositories: async () => [],
    linkExistingRepo: async (devProjectId, input) => ({ id: 'c1', devProjectId, ...input }) as never,
    createRepoAndLink: async (devProjectId, input) => ({ id: 'c1', devProjectId, ...input }) as never,
    unlinkRepo: async () => undefined,
    ...overrides,
  };
}

test('lists repositories for a project', async () => {
  let received: string | undefined;
  const service = fakeService({ listRepositories: async (id) => { received = id; return []; } });
  const result = await handleRepositoryRequest('GET', '/api/dev-projects/p1/repositories', null, 'Lecteur', undefined, service);
  assert.equal(result.status, 200);
  assert.equal(received, 'p1');
});

test('links an existing repository', async () => {
  const service = fakeService();
  const result = await handleRepositoryRequest(
    'POST',
    '/api/dev-projects/p1/repositories',
    { provider: 'gitlab', repoIdentifier: 'group/repo', role: 'backend', vaultSecretName: 'p1-backend' },
    'Contributeur',
    'me@example.com',
    service,
  );
  assert.equal(result.status, 201);
});

test('rejects linking without a session', async () => {
  const service = fakeService();
  const result = await handleRepositoryRequest(
    'POST',
    '/api/dev-projects/p1/repositories',
    { provider: 'gitlab', repoIdentifier: 'group/repo', role: 'backend', vaultSecretName: 'p1-backend' },
    undefined,
    undefined,
    service,
  );
  assert.equal(result.status, 400);
});

test('rejects linking without required fields', async () => {
  const service = fakeService();
  const result = await handleRepositoryRequest('POST', '/api/dev-projects/p1/repositories', { provider: 'gitlab' }, 'Contributeur', undefined, service);
  assert.equal(result.status, 400);
});

test('creates and links a repository', async () => {
  let receivedInput: unknown;
  const service = fakeService({ createRepoAndLink: async (id, input) => { receivedInput = input; return { id: 'c2' } as never; } });
  const result = await handleRepositoryRequest(
    'POST',
    '/api/dev-projects/p1/repositories/create',
    { provider: 'github', name: 'my-repo', role: 'frontend', vaultSecretName: 'p1-frontend' },
    'Admin',
    'me@example.com',
    service,
  );
  assert.equal(result.status, 201);
  assert.deepEqual(receivedInput, { provider: 'github', name: 'my-repo', role: 'frontend', vaultSecretName: 'p1-frontend' });
});

test('unlinks a repository', async () => {
  let unlinkedId: string | undefined;
  const service = fakeService({ unlinkRepo: async (_projectId, id) => { unlinkedId = id; } });
  const result = await handleRepositoryRequest('DELETE', '/api/dev-projects/p1/repositories/c1', null, 'Admin', undefined, service);
  assert.equal(result.status, 204);
  assert.equal(unlinkedId, 'c1');
});

test('rejects unknown routes', async () => {
  const service = fakeService();
  const result = await handleRepositoryRequest('GET', '/api/dev-projects/p1/unknown', null, 'Admin', undefined, service);
  assert.equal(result.status, 404);
});
