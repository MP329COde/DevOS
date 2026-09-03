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

test('rejects failed GitLab responses', async () => {
  const client = new GitLabClient({ baseUrl: 'https://gitlab.test/api/v4', tokenProvider: { async getToken() { return 'token'; } }, fetchImpl: async () => new Response('{}', { status: 401 }) });
  await assert.rejects(async () => { for await (const _issue of client.listIssues('1')) { /* consume */ } }, /failed \(401\)/);
});