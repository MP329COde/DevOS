import assert from 'node:assert/strict';
import test from 'node:test';

import { buildVSCodeDesktopUri, CoderClient } from './coder.js';

function client(fetchImpl: typeof fetch) {
  return new CoderClient({ baseUrl: 'https://coder.test', token: 'session-token', organizationId: 'org-1', fetchImpl });
}

test('sends the Coder session token header', async () => {
  let receivedToken: string | null = null;
  await client(async (_input, init) => { receivedToken = new Headers(init?.headers).get('Coder-Session-Token'); return new Response('[]', { status: 200 }); }).listTemplates();
  assert.equal(receivedToken, 'session-token');
});

test('lists templates for the configured organization', async () => {
  let requestedUrl = '';
  const templates = await client(async (input) => { requestedUrl = String(input); return new Response(JSON.stringify([{ id: 't1', name: 'node' }]), { status: 200 }); }).listTemplates();
  assert.equal(requestedUrl, 'https://coder.test/api/v2/organizations/org-1/templates');
  assert.deepEqual(templates, [{ id: 't1', name: 'node' }]);
});

test('creates a workspace with the given template and name', async () => {
  let sentBody: unknown;
  let requestedUrl = '';
  const workspace = await client(async (input, init) => {
    requestedUrl = String(input);
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 'ws-1', name: 'task-42', latest_build: { status: 'starting' } }), { status: 200 });
  }).createWorkspace('t1', 'task-42');
  assert.equal(requestedUrl, 'https://coder.test/api/v2/organizations/org-1/members/me/workspaces');
  assert.deepEqual(sentBody, { template_id: 't1', name: 'task-42' });
  assert.deepEqual(workspace, { id: 'ws-1', name: 'task-42', latest_build: { status: 'starting' } });
});

test('reads workspace status', async () => {
  const workspace = await client(async () => new Response(JSON.stringify({ id: 'ws-1', name: 'task-42', latest_build: { status: 'running' } }), { status: 200 })).getWorkspace('task-42');
  assert.equal(workspace.latest_build.status, 'running');
});

test('stops a workspace with a stop transition', async () => {
  let sentBody: unknown;
  await client(async (_input, init) => { sentBody = JSON.parse(String(init?.body)); return new Response('{}', { status: 200 }); }).stopWorkspace('ws-1');
  assert.deepEqual(sentBody, { transition: 'stop' });
});

test('starts a workspace with a start transition', async () => {
  let sentBody: unknown;
  await client(async (_input, init) => { sentBody = JSON.parse(String(init?.body)); return new Response('{}', { status: 200 }); }).startWorkspace('ws-1');
  assert.deepEqual(sentBody, { transition: 'start' });
});

test('rejects failed Coder API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 401 })).listTemplates(), /failed \(401\)/);
});

test('builds a VS Code Desktop deep link with the workspace owner and name', () => {
  const uri = buildVSCodeDesktopUri('https://coder.test', 'matthew', 'task-42');
  assert.equal(uri, 'vscode://coder.coder-remote/open?url=https%3A%2F%2Fcoder.test&owner=matthew&workspace=task-42');
});
