import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMcpItemService } from './mcp-entrypoint.js';

test('buildMcpItemService returns an item service exposing list and create', () => {
  const database = {} as never;

  const service = buildMcpItemService(database);

  assert.equal(typeof service.list, 'function');
  assert.equal(typeof service.create, 'function');
});
