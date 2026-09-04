import assert from 'node:assert/strict';
import test from 'node:test';

import { handleWorkspaceRequest } from './workspace-http.js';

test('lists Coder templates', async () => {
  const result = await handleWorkspaceRequest('GET', '/api/coder/templates', { async listTemplates() { return [{ id: 't1', name: 'node' }]; }, async openEnvironment() { throw new Error('unused'); } });
  assert.deepEqual(result, { status: 200, body: [{ id: 't1', name: 'node' }] });
});

test('opens an environment for an item', async () => {
  let requestedItemId = '';
  const result = await handleWorkspaceRequest('POST', '/api/items/item-1/workspace', {
    async listTemplates() { return []; },
    async openEnvironment(itemId: string) { requestedItemId = itemId; return { workspaceId: 'ws-1', workspaceName: 'devos-item-1', status: 'starting', vscodeUri: 'vscode://...' }; },
  });
  assert.equal(requestedItemId, 'item-1');
  assert.deepEqual(result, { status: 201, body: { workspaceId: 'ws-1', workspaceName: 'devos-item-1', status: 'starting', vscodeUri: 'vscode://...' } });
});

test('surfaces an opening failure as a 400', async () => {
  const result = await handleWorkspaceRequest('POST', '/api/items/item-1/workspace', { async listTemplates() { return []; }, async openEnvironment() { throw new Error('No Coder template configured'); } });
  assert.equal(result.status, 400);
});

test('rejects unknown routes', async () => {
  const result = await handleWorkspaceRequest('GET', '/api/coder/unknown', { async listTemplates() { return []; }, async openEnvironment() { throw new Error('unused'); } });
  assert.equal(result.status, 404);
});
