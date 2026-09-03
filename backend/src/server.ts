import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { handleAuthCallback } from './infrastructure/keycloak-http.js';
import type { KeycloakAuthService } from './infrastructure/keycloak-auth.js';
import { handleItemRequest, type ItemHttpService } from './tasks/item-http.js';
import { handleCycleRequest, type CycleService } from './tasks/cycle-http.js';
import { handleTriageRequest, type TriageService } from './tasks/triage-http.js';
import { handleTimeRequest, type TimeService } from './tasks/time-http.js';
import { verifyAndParseWebhook, type WebhookSecretProvider } from './integrations/gitlab-webhook.js';

export function createServer(
  auth?: Pick<KeycloakAuthService, 'completeLogin'>,
  items?: ItemHttpService,
  cycles?: CycleService,
  triage?: TriageService,
  time?: TimeService,
  webhookSecret?: WebhookSecretProvider,
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

    if (request.url?.startsWith('/api/cycles')) {
      if (!cycles) { writeJson(response, 503, { error: 'Cycles are not configured' }); return; }
      const result = await handleCycleRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), cycles);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/triage')) {
      if (!triage) { writeJson(response, 503, { error: 'Triage is not configured' }); return; }
      const result = await handleTriageRequest(request.method ?? 'GET', request.url, triage);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/webhooks/gitlab') {
      if (!webhookSecret) { writeJson(response, 503, { error: 'GitLab webhook is not configured' }); return; }
      const rawBody = await readRaw(request);
      try {
        await verifyAndParseWebhook(headerValue(request.headers['x-gitlab-token']), headerValue(request.headers['x-gitlab-event']), rawBody, webhookSecret);
        writeJson(response, 202, { accepted: true });
      } catch (error) {
        writeJson(response, 401, { error: error instanceof Error ? error.message : 'Invalid webhook' });
      }
      return;
    }

    if (request.url?.startsWith('/api/items/') && request.url.endsWith('/time') || request.url?.startsWith('/api/time/')) {
      if (!time) { writeJson(response, 503, { error: 'Time tracking is not configured' }); return; }
      const result = await handleTimeRequest(request.method ?? 'GET', request.url, time);
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
  return JSON.parse(await readRaw(request));
}

async function readRaw(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonIfNeeded(request: IncomingMessage): Promise<unknown> {
  return request.method === 'GET' || request.method === 'DELETE' ? null : readJson(request);
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}