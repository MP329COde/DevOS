import type { Item, ItemType } from '@prisma/client';

import type { CreateItemInput, ItemService } from '../tasks/item-service.js';

/**
 * Subset of ItemService this module depends on. Kept narrow so tests can supply a
 * lightweight mock instead of a real Prisma-backed ItemService.
 */
export type McpItemService = Pick<ItemService, 'list' | 'create'>;

/** Minimal JSON-Schema-like description of a tool input, sufficient for MCP tool discovery. */
export interface McpJsonSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpJsonSchema;
  handler(input: Record<string, unknown>): Promise<unknown>;
}

const ITEM_TYPES: ItemType[] = ['task', 'doc', 'goal'] as ItemType[];

/**
 * Describes the MCP tools DevOS would expose to AI agents, without depending on any MCP SDK.
 * Once the SDK is added deliberately, these definitions can be registered with a real
 * stdio/HTTP MCP server. For now this provides testable structure: schemas, input
 * validation, and handlers that call through to the real ItemService.
 */
export function buildMcpToolDefinitions(itemsService: McpItemService): McpToolDefinition[] {
  return [
    {
      name: 'list_items',
      description: 'Lists DevOS items (tasks, docs, goals) that are not pending triage.',
      inputSchema: { type: 'object', properties: {} },
      async handler(): Promise<Item[]> {
        return itemsService.list();
      },
    },
    {
      name: 'create_item',
      description: 'Creates a new DevOS item.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'The kind of item to create.', enum: ITEM_TYPES },
          title: { type: 'string', description: 'The item title (1-300 characters).' },
          description: { type: 'string', description: 'Optional short description.' },
          content: { type: 'string', description: 'Optional long-form content.' },
          parentId: { type: 'string', description: 'Optional id of a parent item.' },
          labels: { type: 'array', description: 'Optional list of labels, e.g. "priority:high".' },
          dueAt: { type: 'string', description: 'Optional ISO 8601 due date.' },
        },
        required: ['type', 'title'],
      },
      async handler(input: Record<string, unknown>): Promise<Item> {
        return itemsService.create(parseCreateItemInput(input));
      },
    },
  ];
}

function parseCreateItemInput(input: Record<string, unknown>): CreateItemInput {
  const type = input.type;
  if (typeof type !== 'string' || !ITEM_TYPES.includes(type as ItemType)) {
    throw new Error(`create_item: "type" must be one of ${ITEM_TYPES.join(', ')}`);
  }
  const title = input.title;
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('create_item: "title" is required and must be a non-empty string');
  }
  const labels = input.labels;
  if (labels !== undefined && (!Array.isArray(labels) || !labels.every((label) => typeof label === 'string'))) {
    throw new Error('create_item: "labels" must be an array of strings');
  }
  for (const key of ['description', 'content', 'parentId', 'dueAt'] as const) {
    const value = input[key];
    if (value !== undefined && typeof value !== 'string') {
      throw new Error(`create_item: "${key}" must be a string`);
    }
  }
  return {
    type: type as ItemType,
    title,
    description: input.description as string | undefined,
    content: input.content as string | undefined,
    parentId: input.parentId as string | undefined,
    labels: labels as string[] | undefined,
    dueAt: input.dueAt as string | undefined,
  };
}
