import { PrismaClient } from '@prisma/client';

import type { McpItemService } from './integrations/mcp-server.js';
import { runMcpStdioServer } from './integrations/mcp-stdio-server.js';
import { ItemService } from './tasks/item-service.js';

/**
 * Constructs the ItemService used by the MCP stdio server, isolated behind a small
 * factory so it can be built and tested without a real database connection.
 */
export function buildMcpItemService(database: PrismaClient): McpItemService {
  return new ItemService(database);
}

if (require.main === module) {
  const database = new PrismaClient();
  const items = buildMcpItemService(database);
  runMcpStdioServer(items);
}
