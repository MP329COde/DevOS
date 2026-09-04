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
import { handleHAProxyRequest, type HAProxyHttpService } from './tasks/haproxy-http.js';
import { HAProxyClient } from './integrations/haproxy.js';
import { addServerWithHistory, deleteServerWithHistory, rollbackChange } from './integrations/haproxy-history.js';
import { PrismaHAProxyHistoryRepository } from './integrations/haproxy-history-repository.js';
import { roles, type Role } from './auth/permissions.js';
import { handleCatalogRequest, type CatalogHttpService } from './catalog/catalog-http.js';
import { CatalogService } from './catalog/catalog-service.js';
import { scanCatalogFromGitLab } from './catalog/catalog-scan.js';
import { GitLabClient } from './integrations/gitlab.js';
import { handleInfraRequest, type InfraHttpService } from './catalog/infra-http.js';
import { KubernetesClient } from './catalog/kubernetes.js';
import { ArgoCDClient } from './catalog/argocd.js';
import { HarborTrivyClient } from './catalog/harbor-trivy.js';
import { handleDocsRequest, type DocsHttpService } from './docs/docs-http.js';
import { DocsService } from './docs/docs-service.js';
import { scanDocsFromGitLab } from './docs/docs-scan.js';

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
  haproxy?: HAProxyHttpService,
  catalog?: CatalogHttpService,
  infra?: InfraHttpService,
  docs?: DocsHttpService,
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

    if (request.url?.startsWith('/api/haproxy')) {
      if (!haproxy) { writeJson(response, 503, { error: 'HAProxy management is not configured' }); return; }
      // TODO: derive the role from the authenticated session once Keycloak sessions carry a
      // resolved DevOS role; until then this header is a development-only placeholder.
      const role = parseRole(headerValue(request.headers['x-devos-role']));
      const result = await handleHAProxyRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), role, haproxy);
      if (result.status === 204) {
        response.writeHead(204);
        response.end();
        return;
      }
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/catalog/kubernetes') || request.url?.startsWith('/api/catalog/argocd') || request.url?.startsWith('/api/catalog/trivy')) {
      if (!infra) { writeJson(response, 503, { error: 'Infrastructure integrations are not configured' }); return; }
      const result = await handleInfraRequest(request.method ?? 'GET', request.url, infra);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/catalog')) {
      if (!catalog) { writeJson(response, 503, { error: 'Catalog is not configured' }); return; }
      const result = await handleCatalogRequest(request.method ?? 'GET', request.url, catalog);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/docs')) {
      if (!docs) { writeJson(response, 503, { error: 'Docs are not configured' }); return; }
      const result = await handleDocsRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), docs);
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
  }
}

if (require.main === module) {
  const database = new PrismaClient();
  const items = new ItemService(database);
  const cycles = new PrismaCycleService(database);
  const triage = new PrismaTriageService(database);
  const time = new PrismaTimeService(database);
  const dashboard = new DashboardService(database);
  const haproxy = buildHAProxyServiceFromEnv(database);
  const catalog = buildCatalogServiceFromEnv(database);
  const infra = buildInfraServiceFromEnv();
  const docs = buildDocsServiceFromEnv(database);
  createServer(undefined, items, cycles, triage, time, undefined, undefined, undefined, dashboard, haproxy, catalog, infra, docs).listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

function buildDocsServiceFromEnv(database: PrismaClient): DocsHttpService {
  const service = new DocsService(database);
  return {
    list: () => service.list(),
    get: (id) => service.get(id),
    link: (docPageId, itemId) => service.link(docPageId, itemId),
    unlink: (docPageId, itemId) => service.unlink(docPageId, itemId),
    async scan() {
      const baseUrl = process.env.GITLAB_BASE_URL;
      const token = process.env.GITLAB_TOKEN;
      if (!baseUrl || !token) throw new Error('GITLAB_BASE_URL and GITLAB_TOKEN must be set to scan docs');
      const gitlab = new GitLabClient({ baseUrl, tokenProvider: { async getToken() { return token; } } });
      const result = await scanDocsFromGitLab(gitlab, process.env.DOCS_PATH);
      await service.sync(result.pages);
      return { scanned: result.pages.length, errors: result.errors };
    },
  };
}

function buildInfraServiceFromEnv(): InfraHttpService | undefined {
  const k8sApiServer = process.env.K8S_API_SERVER;
  const k8sToken = process.env.K8S_TOKEN;
  const argoBaseUrl = process.env.ARGOCD_BASE_URL;
  const argoToken = process.env.ARGOCD_TOKEN;
  const harborBaseUrl = process.env.HARBOR_BASE_URL;
  const harborUsername = process.env.HARBOR_USERNAME;
  const harborPassword = process.env.HARBOR_PASSWORD;
  if (!k8sApiServer && !k8sToken && !argoBaseUrl && !argoToken && !harborBaseUrl) return undefined;

  const kubernetes = k8sApiServer && k8sToken ? new KubernetesClient({ apiServer: k8sApiServer, token: k8sToken }) : undefined;
  const argocd = argoBaseUrl && argoToken ? new ArgoCDClient({ baseUrl: argoBaseUrl, token: argoToken }) : undefined;
  const harbor = harborBaseUrl && harborUsername && harborPassword ? new HarborTrivyClient({ baseUrl: harborBaseUrl, username: harborUsername, password: harborPassword }) : undefined;

  const requireClient = <T>(client: T | undefined, name: string): T => {
    if (!client) throw new Error(`${name} is not configured`);
    return client;
  };

  return {
    listPods: (namespace) => requireClient(kubernetes, 'Kubernetes').listPods(namespace),
    listDeployments: (namespace) => requireClient(kubernetes, 'Kubernetes').listDeployments(namespace),
    listNodes: () => requireClient(kubernetes, 'Kubernetes').listNodes(),
    listArgoApplications: () => requireClient(argocd, 'ArgoCD').listApplications(),
    getArgoSyncHistory: (name) => requireClient(argocd, 'ArgoCD').getSyncHistory(name),
    getTrivySummary: (project, repository, tag) => requireClient(harbor, 'Harbor').getVulnerabilitySummary(project, repository, tag),
  };
}

function buildCatalogServiceFromEnv(database: PrismaClient): CatalogHttpService {
  const service = new CatalogService(database);
  return {
    list: () => service.list(),
    graph: () => service.graph(),
    async scan() {
      const baseUrl = process.env.GITLAB_BASE_URL;
      const token = process.env.GITLAB_TOKEN;
      if (!baseUrl || !token) throw new Error('GITLAB_BASE_URL and GITLAB_TOKEN must be set to scan the catalog');
      const gitlab = new GitLabClient({ baseUrl, tokenProvider: { async getToken() { return token; } } });
      const result = await scanCatalogFromGitLab(gitlab);
      await service.sync(result.entities);
      return { scanned: result.entities.length, errors: result.errors };
    },
  };
}

function buildHAProxyServiceFromEnv(database: PrismaClient): HAProxyHttpService | undefined {
  const baseUrl = process.env.HAPROXY_DATA_PLANE_URL;
  const username = process.env.HAPROXY_USERNAME;
  const password = process.env.HAPROXY_PASSWORD;
  if (!baseUrl || !username || !password) return undefined;
  const client = new HAProxyClient({ baseUrl, credentials: { username, password } });
  const history = new PrismaHAProxyHistoryRepository(database);
  return {
    listBackends: () => client.listBackends(),
    listFrontends: () => client.listFrontends(),
    listServers: (backend) => client.listServers(backend),
    addServer: (backend, server) => addServerWithHistory(client, history, backend, server),
    deleteServer: (backend, name) => deleteServerWithHistory(client, history, backend, name),
    reload: () => client.reload(),
    listHistory: () => history.list(),
    rollback: (id) => rollbackChange(id, history, client),
  };
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

function parseRole(value: string | undefined): Role | undefined {
  return roles.find((role) => role === value);
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