import assert from 'node:assert/strict';
import test from 'node:test';

import type { Item } from '@prisma/client';

import { handleMcpJsonRpcRequest } from './mcp-stdio-server.js';
import type { McpItemService } from './mcp-server.js';
import type { CreateItemInput } from '../tasks/item-service.js';

function fakeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    type: 'task',
    title: 'Sample',
    description: null,
    content: null,
    status: 'open',
    triage: 'none',
    taskLevel: 'task',
    parentId: null,
    mergeRequestState: null,
    pipelineStatus: null,
    dueAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Item;
}

function mockService(overrides: Partial<McpItemService> = {}): McpItemService {
  return {
    list: async () => [fakeItem()],
    create: async (input: CreateItemInput) => fakeItem({ title: input.title, type: input.type }),
    ...overrides,
  };
}

test('initialize returns protocol version, server info and capabilities', async () => {
  const response = await handleMcpJsonRpcRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' }, mockService());
  assert.deepEqual(response, {
    jsonrpc: '2.0',
    id: 1,
    result: {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'devos', version: '0.1.0' },
      capabilities: { tools: {} },
    },
  });
});

test('tools/list returns the tool definitions built via buildMcpToolDefinitions', async () => {
  const response = await handleMcpJsonRpcRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, mockService());
  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, 2);
  const result = (response as { result: { tools: Array<{ name: string }> } }).result;
  assert.deepEqual(result.tools.map((t) => t.name), ['list_items', 'create_item']);
});

test('tools/call succeeds for list_items and returns items as text content', async () => {
  const items = [fakeItem({ id: 'a' }), fakeItem({ id: 'b' })];
  const response = await handleMcpJsonRpcRequest(
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_items', arguments: {} } },
    mockService({ list: async () => items }),
  );
  const result = (response as { result: { content: Array<{ type: string; text: string }> } }).result;
  assert.equal(result.content[0].type, 'text');
  assert.deepEqual(JSON.parse(result.content[0].text), JSON.parse(JSON.stringify(items)));
});

test('tools/call succeeds for create_item and calls through to itemsService.create', async () => {
  let received: CreateItemInput | undefined;
  const response = await handleMcpJsonRpcRequest(
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'create_item', arguments: { type: 'task', title: 'Write docs' } },
    },
    mockService({
      create: async (input: CreateItemInput) => {
        received = input;
        return fakeItem({ title: input.title, type: input.type });
      },
    }),
  );
  assert.equal(received?.title, 'Write docs');
  const result = (response as { result: { content: Array<{ type: string; text: string }> } }).result;
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.title, 'Write docs');
});

test('tools/call with an unknown tool returns a JSON-RPC method-not-found error', async () => {
  const response = await handleMcpJsonRpcRequest(
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'does_not_exist', arguments: {} } },
    mockService(),
  );
  const error = (response as { error: { code: number; message: string } }).error;
  assert.equal(error.code, -32601);
  assert.match(error.message, /does_not_exist/);
});

test('tools/call whose handler throws returns a JSON-RPC internal error', async () => {
  const response = await handleMcpJsonRpcRequest(
    { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'create_item', arguments: { title: 'Missing type' } } },
    mockService(),
  );
  const error = (response as { error: { code: number; message: string } }).error;
  assert.equal(error.code, -32603);
  assert.match(error.message, /"type"/);
});

test('unknown JSON-RPC method returns a method-not-found error', async () => {
  const response = await handleMcpJsonRpcRequest({ jsonrpc: '2.0', id: 7, method: 'not/a/method' }, mockService());
  const error = (response as { error: { code: number; message: string } }).error;
  assert.equal(error.code, -32601);
  assert.match(error.message, /not\/a\/method/);
});

test('a malformed request (not a JSON-RPC object) returns an invalid-request error', async () => {
  const response = await handleMcpJsonRpcRequest({ foo: 'bar' }, mockService());
  const error = (response as { error: { code: number; message: string } }).error;
  assert.equal(error.code, -32600);
});

test('a malformed request that is not an object at all returns an invalid-request error', async () => {
  const response = await handleMcpJsonRpcRequest('not even an object', mockService());
  const error = (response as { error: { code: number; message: string } }).error;
  assert.equal(error.code, -32600);
});
