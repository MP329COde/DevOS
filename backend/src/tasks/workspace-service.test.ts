import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAutoStop, openEnvironment } from './workspace-service.js';

test('openEnvironment creates a workspace using the item template override', async () => {
  let createCall: unknown;
  let saved: unknown;
  const result = await openEnvironment(
    { id: 'item-12345678', coderTemplateId: 'custom-template' },
    { async createWorkspace(templateId, name) { createCall = { templateId, name }; return { id: 'ws-1', name, latest_build: { status: 'starting' } }; } },
    { async saveWorkspace(itemId, fields) { saved = { itemId, fields }; } },
    { defaultTemplateId: 'default-template', baseUrl: 'https://coder.test', owner: 'matthew' },
  );
  assert.deepEqual(createCall, { templateId: 'custom-template', name: 'devos-item-123' });
  assert.deepEqual(saved, { itemId: 'item-12345678', fields: { coderWorkspaceId: 'ws-1', coderWorkspaceName: 'devos-item-123', coderWorkspaceStatus: 'starting' } });
  assert.equal(result.vscodeUri, 'vscode://coder.coder-remote/open?url=https%3A%2F%2Fcoder.test&owner=matthew&workspace=devos-item-123');
});

test('openEnvironment falls back to the default template when the item has no override', async () => {
  let usedTemplate = '';
  await openEnvironment(
    { id: 'item-1', coderTemplateId: null },
    { async createWorkspace(templateId, name) { usedTemplate = templateId; return { id: 'ws-1', name, latest_build: { status: 'starting' } }; } },
    { async saveWorkspace() {} },
    { defaultTemplateId: 'default-template', baseUrl: 'https://coder.test', owner: 'matthew' },
  );
  assert.equal(usedTemplate, 'default-template');
});

test('openEnvironment rejects when neither the item nor a default template is configured', async () => {
  await assert.rejects(
    () => openEnvironment({ id: 'item-1', coderTemplateId: null }, { async createWorkspace() { throw new Error('should not be called'); } }, { async saveWorkspace() {} }, { baseUrl: 'https://coder.test', owner: 'matthew' }),
    /No Coder template configured/,
  );
});

test('applyAutoStop stops the workspace when the item transitions into done', async () => {
  let stoppedId = '';
  await applyAutoStop({ status: 'done', coderWorkspaceId: 'ws-1' }, 'in_progress', { async stopWorkspace(id) { stoppedId = id; } });
  assert.equal(stoppedId, 'ws-1');
});

test('applyAutoStop does nothing when the item was already done', async () => {
  let stopped = false;
  await applyAutoStop({ status: 'done', coderWorkspaceId: 'ws-1' }, 'done', { async stopWorkspace() { stopped = true; } });
  assert.equal(stopped, false);
});

test('applyAutoStop does nothing when the item did not transition to done', async () => {
  let stopped = false;
  await applyAutoStop({ status: 'in_progress', coderWorkspaceId: 'ws-1' }, 'backlog', { async stopWorkspace() { stopped = true; } });
  assert.equal(stopped, false);
});

test('applyAutoStop does nothing when the item has no linked workspace', async () => {
  let stopped = false;
  await applyAutoStop({ status: 'done', coderWorkspaceId: null }, 'in_progress', { async stopWorkspace() { stopped = true; } });
  assert.equal(stopped, false);
});
