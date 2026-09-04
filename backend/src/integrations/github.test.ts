import assert from 'node:assert/strict';
import test from 'node:test';

import { GitHubClient } from './github.js';

function client(fetchImpl: typeof fetch) {
  return new GitHubClient({ baseUrl: 'https://api.github.test', token: 'gh-token', fetchImpl });
}

test('sends bearer auth and the GitHub Accept header when listing issues', async () => {
  let receivedAuth: string | null = null;
  let receivedAccept: string | null = null;
  const issues = [];
  for await (const issue of client(async (_input, init) => {
    const headers = new Headers(init?.headers);
    receivedAuth = headers.get('authorization');
    receivedAccept = headers.get('accept');
    return new Response(JSON.stringify([{ id: 1, number: 1, title: 'Bug', body: null, state: 'open', labels: [], html_url: 'https://github.test/1' }]), { status: 200 });
  }).listIssues('acme', 'widgets')) {
    issues.push(issue);
  }
  assert.equal(receivedAuth, 'Bearer gh-token');
  assert.equal(receivedAccept, 'application/vnd.github+json');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].title, 'Bug');
});

test('paginates issues using the Link header', async () => {
  let call = 0;
  const requestedUrls: string[] = [];
  const issues = [];
  for await (const issue of client(async (input) => {
    requestedUrls.push(String(input));
    call += 1;
    if (call === 1) {
      return new Response(JSON.stringify([{ id: 1, number: 1, title: 'First', body: null, state: 'open', labels: [], html_url: 'x' }]), {
        status: 200,
        headers: { link: '<https://api.github.test/repos/acme/widgets/issues?page=2>; rel="next"' },
      });
    }
    return new Response(JSON.stringify([{ id: 2, number: 2, title: 'Second', body: null, state: 'open', labels: [], html_url: 'y' }]), { status: 200 });
  }).listIssues('acme', 'widgets')) {
    issues.push(issue);
  }
  assert.deepEqual(requestedUrls, ['https://api.github.test/repos/acme/widgets/issues', 'https://api.github.test/repos/acme/widgets/issues?page=2']);
  assert.deepEqual(issues.map((i) => i.title), ['First', 'Second']);
});

test('rejects a failed listIssues response', async () => {
  await assert.rejects(async () => {
    for await (const _ of client(async () => new Response('{}', { status: 401 })).listIssues('acme', 'widgets')) {
      // no-op
    }
  }, /failed \(401\)/);
});

test('posts a comment body to the issue comments endpoint', async () => {
  let requestedUrl = '';
  let sentBody: unknown;
  let method = '';
  await client(async (input, init) => {
    requestedUrl = String(input);
    method = String(init?.method);
    sentBody = JSON.parse(String(init?.body));
    return new Response('{}', { status: 201 });
  }).addComment('acme', 'widgets', 42, 'hello world');
  assert.equal(requestedUrl, 'https://api.github.test/repos/acme/widgets/issues/42/comments');
  assert.equal(method, 'POST');
  assert.deepEqual(sentBody, { body: 'hello world' });
});

test('rejects a failed addComment response', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 404 })).addComment('acme', 'widgets', 42, 'hi'), /failed \(404\)/);
});

test('updates an issue with the given fields including state', async () => {
  let requestedUrl = '';
  let sentBody: unknown;
  let method = '';
  const updated = await client(async (input, init) => {
    requestedUrl = String(input);
    method = String(init?.method);
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 1, number: 42, title: 'Fixed', body: null, state: 'closed', labels: [], html_url: 'z' }), { status: 200 });
  }).updateIssue('acme', 'widgets', 42, { state: 'closed', title: 'Fixed' });
  assert.equal(requestedUrl, 'https://api.github.test/repos/acme/widgets/issues/42');
  assert.equal(method, 'PATCH');
  assert.deepEqual(sentBody, { state: 'closed', title: 'Fixed' });
  assert.equal(updated.state, 'closed');
});

test('rejects a failed updateIssue response', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 422 })).updateIssue('acme', 'widgets', 42, { state: 'closed' }), /failed \(422\)/);
});
