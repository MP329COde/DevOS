import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { handleAuthCallback } from './infrastructure/keycloak-http.js';
import type { KeycloakAuthService } from './infrastructure/keycloak-auth.js';
import { handleItemRequest, type ItemHttpService } from './tasks/item-http.js';

export function createServer(
  auth?: Pick<KeycloakAuthService, 'completeLogin'>,
  items?: ItemHttpService,
) {
  return createHttpServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      writeJson(response, 200, { status: 'ok' });
      return;
    }

    if (request.url?.startsWith('/api/items')) {
      if (!items) {
        writeJson(response, 503, { error: 'Items are not configured' });
        return;
      }
      const result = await handleItemRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), items);
      if (result.status === 204) {
        response.writeHead(204);
        response.end();
        return;
      }
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.method === 'POST' && request.url === '/auth/callback') {
      if (!auth) {
        writeJson(response, 503, { error: 'Authentication is not configured' });
        return;
      }
      const result = await handleAuthCallback(await readJson(request), auth);
      response.writeHead(result.status, result.headers);
      response.end(result.status === 204 ? undefined : JSON.stringify(result.body));
      return;
    }

    writeJson(response, 404, { error: 'Not found' });
  });
}

if (process.env.NODE_ENV !== 'test') {
  createServer().listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readJsonIfNeeded(request: IncomingMessage): Promise<unknown> {
  return request.method === 'GET' || request.method === 'DELETE' ? null : readJson(request);
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}