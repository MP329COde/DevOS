import assert from 'node:assert/strict';
import test from 'node:test';

import { GitLabClient } from './gitlab.js';

test('paginates issues using the Link next cursor and Vault-provided token', async () => {
  const urls: string[] = [];
  const client = new GitLabClient({
    baseUrl: 'https://gitlab.test/api/v4',
    tokenProvider: { async getToken() { return 'vault-token'; } },
    fetchImpl: async (input, init) => {
      urls.push(String(input));
      assert.equal(new Headers(init?.headers).get('private-token'), 'vault-token');
      return urls.length === 1
        ? new Response(JSON.stringify([{ iid: 1, title: 'One' }]), { status: 200, headers: { link: '<https://gitlab.test/api/v4/projects/1/issues?page=2>; rel="next"' } })
        : new Response(JSON.stringify([{ iid: 2, title: 'Two' }]), { status: 200 });
    },
  });
  const issues = [];
  for await (const issue of client.listIssues('1')) issues.push(issue.title);
  assert.deepEqual(issues, ['One', 'Two']);
  assert.equal(urls.length, 2);
});

test('sends the GitLab REST state_event field when updating an issue state', async () => {
  let sentBody: unknown;
  const client = new GitLabClient({
    baseUrl: 'https://gitlab.test/api/v4',
    tokenProvider: { async getToken() { return 'token'; } },
    fetchImpl: async (_input, init) => { sentBody = JSON.parse(String(init?.body)); return new Response('{}', { status: 200 }); },
  });
  await client.updateIssue('1', 4, { title: 'Done', stateEvent: 'close' });
  assert.deepEqual(sentBody, { title: 'Done', state_event: 'close' });
});

test('paginates the list of accessible projects', async () => {
  const urls: string[] = [];
  const client = new GitLabClient({
    baseUrl: 'https://gitlab.test/api/v4',
    tokenProvider: { async getToken() { return 'token'; } },
    fetchImpl: async (input) => {
      urls.push(String(input));
      return urls.length === 1
        ? new Response(JSON.stringify([{ id: 1, path_with_namespace: 'root/a', default_branch: 'main' }]), { status: 200, headers: { link: '<https://gitlab.test/api/v4/projects?membership=true&simple=true&page=2>; rel="next"' } })
        : new Response(JSON.stringify([{ id: 2, path_with_namespace: 'root/b', default_branch: 'main' }]), { status: 200 });
    },
  });
  const projects = [];
  for await (const project of client.listProjects()) projects.push(project.path_with_namespace);
  assert.deepEqual(projects, ['root/a', 'root/b']);
});

test('reads a raw repository file', async () => {
  let requestedUrl = '';
  const client = new GitLabClient({
    baseUrl: 'https://gitlab.test/api/v4',
    tokenProvider: { async getToken() { return 'token'; } },
    fetchImpl: async (input) => { requestedUrl = String(input); return new Response('apiVersion: v1', { status: 200 }); },
  });
  const content = await client.getRawFile('root/a', 'catalog-info.yaml', 'main');
  assert.equal(content, 'apiVersion: v1');
  assert.equal(requestedUrl, 'https://gitlab.test/api/v4/projects/root%2Fa/repository/files/catalog-info.yaml/raw?ref=main');
});

test('returns null when the raw file does not exist', async () => {
  const client = new GitLabClient({ baseUrl: 'https://gitlab.test/api/v4', tokenProvider: { async getToken() { return 'token'; } }, fetchImpl: async () => new Response('', { status: 404 }) });
  assert.equal(await client.getRawFile('root/a', 'catalog-info.yaml', 'main'), null);
});

test('rejects failed GitLab responses', async () => {
  const client = new GitLabClient({ baseUrl: 'https://gitlab.test/api/v4', tokenProvider: { async getToken() { return 'token'; } }, fetchImpl: async () => new Response('{}', { status: 401 }) });
  await assert.rejects(async () => { for await (const _issue of client.listIssues('1')) { /* consume */ } }, /failed \(401\)/);
});