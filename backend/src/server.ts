import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { PrismaClient } from '@prisma/client';

import { handleAuthCallback } from './infrastructure/keycloak-http.js';
import type { KeycloakAuthService } from './infrastructure/keycloak-auth.js';
import { handleItemRequest, type ItemHttpService } from './tasks/item-http.js';
import { ItemService } from './tasks/item-service.js';
import { handleCycleRequest, type CycleService } from './tasks/cycle-http.js';
import { PrismaCycleService } from './tasks/cycle-service.js';
import { handleTriageRequest, type TriageService } from './tasks/triage-http.js';
import { PrismaTriageService } from './tasks/triage-service.js';
import { handleTimeRequest, type TimeService } from './tasks/time-http.js';
import { PrismaTimeService } from './tasks/time-service.js';
import { handleDashboardRequest, type DashboardHttpService } from './tasks/dashboard-http.js';
import { DashboardService } from './tasks/dashboard-service.js';
import { verifyAndParseWebhook, type WebhookSecretProvider } from './integrations/gitlab-webhook.js';
import { processGitLabIssueWebhook, processGitLabMergeRequestWebhook, processGitLabPipelineWebhook, type GitLabStatusSync, type GitLabWebhookSync } from './integrations/gitlab-sync.js';

export function createServer(
  auth?: Pick<KeycloakAuthService, 'completeLogin'>,
  items?: ItemHttpService,
  cycles?: CycleService,
  triage?: TriageService,
  time?: TimeService,
  webhookSecret?: WebhookSecretProvider,
  webhookSync?: GitLabWebhookSync,
  statusSync?: GitLabStatusSync,
  dashboard?: DashboardHttpService,
) {
  return createHttpServer(async (request, response) => {
    applyCors(request, response);
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    try {
      await handleRequest(request, response);
    } catch (error) {
      if (!response.headersSent) writeJson(response, 500, { error: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method === 'GET' && request.url === '/health') {
      writeJson(response, 200, { status: 'ok' });
      return;
    }

    if (request.url?.startsWith('/api/items/') && request.url.endsWith('/time') || request.url?.startsWith('/api/time/')) {
      if (!time) { writeJson(response, 503, { error: 'Time tracking is not configured' }); return; }
      const result = await handleTimeRequest(request.method ?? 'GET', request.url, time);
      writeJson(response, result.status, result.body);
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

    if (request.url?.startsWith('/api/dashboard')) {
      if (!dashboard) { writeJson(response, 503, { error: 'Dashboard is not configured' }); return; }
      const result = await handleDashboardRequest(request.method ?? 'GET', request.url, dashboard);
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
        const event = await verifyAndParseWebhook(headerValue(request.headers['x-gitlab-token']), headerValue(request.headers['x-gitlab-event']), rawBody, webhookSecret);
        if (webhookSync && event.type === 'Issue Hook') await processGitLabIssueWebhook(event.payload, webhookSync);
        if (statusSync && event.type === 'Merge Request Hook') await processGitLabMergeRequestWebhook(event.payload, statusSync);
        if (statusSync && event.type === 'Pipeline Hook') await processGitLabPipelineWebhook(event.payload, statusSync);
        writeJson(response, 202, { accepted: true });
      } catch (error) {
        writeJson(response, 401, { error: error instanceof Error ? error.message : 'Invalid webhook' });
      }
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
  }
}

if (require.main === module) {
  const database = new PrismaClient();
  const items = new ItemService(database);
  const cycles = new PrismaCycleService(database);
  const triage = new PrismaTriageService(database);
  const time = new PrismaTimeService(database);
  const dashboard = new DashboardService(database);
  createServer(undefined, items, cycles, triage, time, undefined, undefined, undefined, dashboard).listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
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
  if (request.method === 'GET' || request.method === 'DELETE') return null;
  const raw = await readRaw(request);
  return raw.trim() === '' ? null : (JSON.parse(raw) as unknown);
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function applyCors(request: IncomingMessage, response: ServerResponse): void {
  const configuredOrigin = process.env.FRONTEND_ORIGIN;
  const allowedOrigin = configuredOrigin ?? headerValue(request.headers.origin);
  if (!allowedOrigin) return;
  response.setHeader('access-control-allow-origin', allowedOrigin);
  // Credentials are only allowed once FRONTEND_ORIGIN is explicitly configured; reflecting an
  // arbitrary request origin with credentials enabled would let any site read a signed-in session.
  if (configuredOrigin) response.setHeader('access-control-allow-credentials', 'true');
  response.setHeader('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('vary', 'origin');
}