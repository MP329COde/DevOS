import assert from 'node:assert/strict';
import test from 'node:test';

import { HarborClient } from './harbor.js';

function client(fetchImpl: typeof fetch) {
  return new HarborClient({ baseUrl: 'https://harbor.test', username: 'admin', password: 'secret', fetchImpl });
}

test('sends HTTP Basic auth credentials', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response('[]', { status: 200 }); }).listProjects();
  const expected = `Basic ${Buffer.from('admin:secret').toString('base64')}`;
  assert.equal(receivedAuth, expected);
});

test('lists projects', async () => {
  let requestedUrl = '';
  const projects = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([{ project_id: 1, name: 'library', repo_count: 3 }]), { status: 200 });
  }).listProjects();
  assert.equal(requestedUrl, 'https://harbor.test/api/v2.0/projects');
  assert.deepEqual(projects, [{ projectId: 1, name: 'library', repoCount: 3 }]);
});

test('defaults project repo count to zero when absent', async () => {
  const projects = await client(async () => new Response(JSON.stringify([{ project_id: 2, name: 'empty' }]), { status: 200 })).listProjects();
  assert.deepEqual(projects, [{ projectId: 2, name: 'empty', repoCount: 0 }]);
});

test('lists repositories for a project', async () => {
  let requestedUrl = '';
  const repositories = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([{ name: 'library/app', artifact_count: 5 }]), { status: 200 });
  }).listRepositories('library');
  assert.equal(requestedUrl, 'https://harbor.test/api/v2.0/projects/library/repositories');
  assert.deepEqual(repositories, [{ name: 'library/app', artifactCount: 5 }]);
});

test('lists artifact tags for a repository', async () => {
  let requestedUrl = '';
  const tags = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify([{ tags: [{ name: 'latest' }, { name: 'v1.0.0' }] }, { tags: [{ name: 'v0.9.0' }] }, {}]),
      { status: 200 },
    );
  }).listArtifactTags('library', 'app');
  assert.equal(requestedUrl, 'https://harbor.test/api/v2.0/projects/library/repositories/app/artifacts');
  assert.deepEqual(tags, ['latest', 'v1.0.0', 'v0.9.0']);
});

test('rejects failed Harbor API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 403 })).listProjects(), /failed \(403\)/);
});
