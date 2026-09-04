import readline from 'node:readline';

import { buildMcpToolDefinitions, type McpItemService, type McpToolDefinition } from './mcp-server.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
}

interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string };
}

const JSON_RPC_PARSE_ERROR = -32700;
const JSON_RPC_INVALID_REQUEST = -32600;
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_INVALID_PARAMS = -32602;
const JSON_RPC_INTERNAL_ERROR = -32603;

function errorResponse(id: string | number | null, code: number, message: string): JsonRpcErrorResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function successResponse(id: string | number | null, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: '2.0', id, result };
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.jsonrpc === '2.0' && typeof candidate.method === 'string';
}

/**
 * Handles a single MCP JSON-RPC 2.0 request over the base protocol methods
 * (initialize, tools/list, tools/call), without depending on any MCP SDK.
 */
export async function handleMcpJsonRpcRequest(request: unknown, itemsService: McpItemService): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
  if (!isJsonRpcRequest(request)) {
    const id = typeof request === 'object' && request !== null && 'id' in (request as Record<string, unknown>) ? ((request as Record<string, unknown>).id as string | number | null) : null;
    return errorResponse(id, JSON_RPC_INVALID_REQUEST, 'Invalid JSON-RPC request');
  }

  const { id, method, params } = request;

  if (method === 'initialize') {
    return successResponse(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'devos', version: '0.1.0' },
      capabilities: { tools: {} },
    });
  }

  if (method === 'tools/list') {
    const tools = buildMcpToolDefinitions(itemsService);
    return successResponse(id, {
      tools: tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })),
    });
  }

  if (method === 'tools/call') {
    const name = params?.name;
    if (typeof name !== 'string') {
      return errorResponse(id, JSON_RPC_INVALID_PARAMS, 'Missing "name" parameter for tools/call');
    }
    const tools = buildMcpToolDefinitions(itemsService);
    const tool: McpToolDefinition | undefined = tools.find((candidate) => candidate.name === name);
    if (!tool) {
      return errorResponse(id, JSON_RPC_METHOD_NOT_FOUND, `Unknown tool: ${name}`);
    }
    const toolArguments = (params?.arguments as Record<string, unknown> | undefined) ?? {};
    try {
      const result = await tool.handler(toolArguments);
      return successResponse(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(id, JSON_RPC_INTERNAL_ERROR, message);
    }
  }

  return errorResponse(id, JSON_RPC_METHOD_NOT_FOUND, `Unknown method: ${method}`);
}

/**
 * Runs a minimal JSON-RPC 2.0 server over stdio, line-delimited, following the base
 * MCP protocol methods. Not invoked automatically at module load time.
 */
export function runMcpStdioServer(itemsService: McpItemService): void {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  rl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    void (async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        process.stdout.write(`${JSON.stringify(errorResponse(null, JSON_RPC_PARSE_ERROR, 'Parse error'))}\n`);
        return;
      }
      const response = await handleMcpJsonRpcRequest(parsed, itemsService);
      process.stdout.write(`${JSON.stringify(response)}\n`);
    })();
  });
}
