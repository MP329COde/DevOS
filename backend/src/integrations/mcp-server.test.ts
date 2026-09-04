import assert from 'node:assert/strict';
import test from 'node:test';

import type { Item } from '@prisma/client';

import { buildMcpToolDefinitions, type McpItemService } from './mcp-server.js';
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

test('exposes list_items and create_item tool definitions', () => {
  const tools = buildMcpToolDefinitions(mockService());
  assert.deepEqual(tools.map((t) => t.name), ['list_items', 'create_item']);
  assert.equal(tools[0].inputSchema.type, 'object');
  assert.deepEqual(tools[1].inputSchema.required, ['type', 'title']);
});

test('list_items handler calls itemsService.list and returns items', async () => {
  const items = [fakeItem({ id: 'a' }), fakeItem({ id: 'b' })];
  const service = mockService({ list: async () => items });
  const tools = buildMcpToolDefinitions(service);
  const listItems = tools.find((t) => t.name === 'list_items')!;
  const result = await listItems.handler({});
  assert.deepEqual(result, items);
});

test('create_item handler validates input and calls itemsService.create', async () => {
  let receivedInput: CreateItemInput | undefined;
  const service = mockService({
    create: async (input: CreateItemInput) => {
      receivedInput = input;
      return fakeItem({ title: input.title, type: input.type });
    },
  });
  const tools = buildMcpToolDefinitions(service);
  const createItem = tools.find((t) => t.name === 'create_item')!;
  const result = (await createItem.handler({ type: 'task', title: 'Write docs', labels: ['priority:high'] })) as Item;
  assert.deepEqual(receivedInput, { type: 'task', title: 'Write docs', description: undefined, content: undefined, parentId: undefined, labels: ['priority:high'], dueAt: undefined });
  assert.equal(result.title, 'Write docs');
});

test('create_item handler rejects a missing title', async () => {
  const tools = buildMcpToolDefinitions(mockService());
  const createItem = tools.find((t) => t.name === 'create_item')!;
  await assert.rejects(() => createItem.handler({ type: 'task' }), /"title"/);
});

test('create_item handler rejects an invalid type', async () => {
  const tools = buildMcpToolDefinitions(mockService());
  const createItem = tools.find((t) => t.name === 'create_item')!;
  await assert.rejects(() => createItem.handler({ type: 'not-a-type', title: 'Foo' }), /"type"/);
});

test('create_item handler rejects labels that are not an array of strings', async () => {
  const tools = buildMcpToolDefinitions(mockService());
  const createItem = tools.find((t) => t.name === 'create_item')!;
  await assert.rejects(() => createItem.handler({ type: 'task', title: 'Foo', labels: [1, 2] }), /"labels"/);
});

test('create_item handler does not call itemsService.create when validation fails', async () => {
  let called = false;
  const service = mockService({ create: async (input: CreateItemInput) => { called = true; return fakeItem({ title: input.title, type: input.type }); } });
  const tools = buildMcpToolDefinitions(service);
  const createItem = tools.find((t) => t.name === 'create_item')!;
  await assert.rejects(() => createItem.handler({ title: 'Missing type' }));
  assert.equal(called, false);
});
