import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { PrismaClient } from '@prisma/client';

import { handleAuthCallback } from './infrastructure/keycloak-http.js';
import { KeycloakAuthService, RedisSessionStore, type KeycloakSecretReader } from './infrastructure/keycloak-auth.js';
import { createKeycloakOidcConfig } from './infrastructure/keycloak.js';
import { createRedisClients } from './infrastructure/redis.js';
import { handleSettingsRequest, type SettingsHttpService } from './settings/settings-http.js';
import { SettingsService } from './settings/settings-service.js';
import { handleItemRequest, type ItemHttpService } from './tasks/item-http.js';
import { ItemService } from './tasks/item-service.js';
import { handleCommentRequest, type CommentHttpService } from './tasks/comment-http.js';
import { CommentService } from './tasks/comment-service.js';
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
import { handleProxmoxRequest, type ProxmoxHttpService } from './catalog/proxmox-http.js';
import { HAProxyClient } from './integrations/haproxy.js';
import { addServerWithHistory, deleteServerWithHistory, rollbackChange } from './integrations/haproxy-history.js';
import { PrismaHAProxyHistoryRepository } from './integrations/haproxy-history-repository.js';
import { roles, type Role } from './auth/permissions.js';
import { handleCatalogRequest, type CatalogHttpService } from './catalog/catalog-http.js';
import { CatalogService } from './catalog/catalog-service.js';
import { scanCatalogFromGitLab } from './catalog/catalog-scan.js';
import { GitLabClient } from './integrations/gitlab.js';
import { handleInfraRequest, type InfraHttpService } from './catalog/infra-http.js';
import { buildNetworkTopology } from './catalog/network-topology.js';
import { KubernetesClient } from './catalog/kubernetes.js';
import { ArgoCDClient } from './catalog/argocd.js';
import { HarborTrivyClient } from './catalog/harbor-trivy.js';
import { handleDocsRequest, type DocsHttpService } from './docs/docs-http.js';
import { DocsService } from './docs/docs-service.js';
import { scanDocsFromGitLab } from './docs/docs-scan.js';
import { handleWorkspaceRequest, type WorkspaceHttpService } from './tasks/workspace-http.js';
import { applyAutoStop, openEnvironment } from './tasks/workspace-service.js';
import { handleExtrasRequest, type ExtrasHttpService } from './catalog/extras-http.js';
import { GitHubClient } from './integrations/github.js';
import { buildMcpToolDefinitions } from './integrations/mcp-server.js';
import { OllamaClient } from './integrations/ollama.js';
import { WoodpeckerClient } from './integrations/woodpecker.js';
import { checkForUpdate, readCurrentVersion } from './integrations/update-checker.js';
import { GrafanaClient } from './catalog/grafana.js';
import { HarborClient } from './catalog/harbor.js';
import { ProxmoxClient } from './catalog/proxmox.js';
import { WazuhClient } from './catalog/wazuh.js';
import { PrometheusExporterClient } from './catalog/prometheus-metrics.js';
import { MinioClient } from './catalog/minio.js';
import { RabbitMQClient } from './catalog/rabbitmq.js';
import { PowerDNSClient } from './catalog/dns-server.js';
import { parseTerraformState } from './catalog/terraform-state.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CoderClient } from './integrations/coder.js';
import { summarizeFileShareMetrics } from './catalog/file-shares.js';
import { SuricataClient, summarizeWireGuardMetrics } from './catalog/network-security.js';
import { N8nClient, NatsMonitorClient } from './integrations/nats-n8n.js';
import { NexusClient, VerdaccioClient } from './integrations/artifact-registries.js';
import { MeilisearchClient } from './integrations/meilisearch.js';
import { RedpandaClient } from './integrations/redpanda.js';
import { listRunningPipelines } from './integrations/gitlab-pipelines.js';
import { AlertmanagerClient } from './integrations/alertmanager.js';
import { buildDashboardWidgets } from './tasks/dashboard-widgets.js';
import { handleIntegrationBuilderRequest, type IntegrationBuilderHttpService, type SavedIntegration } from './catalog/integration-builder-http.js';
import { handleCustomWidgetsRequest, type CustomWidgetsHttpService, type CustomWidget } from './catalog/custom-widgets-http.js';
import { testIntegration } from './integrations/integration-builder.js';
import { handleSecretsRequest, type SecretsHttpService } from './tasks/secrets-http.js';
import { SecretsService } from './tasks/secrets-service.js';
import { VaultClient } from './infrastructure/vault.js';
import { handleCalendarRequest, type CalendarHttpService, type CalendarSourceEvent } from './tasks/calendar-http.js';
import { fetchIcsEvents } from './integrations/ics-calendar.js';
import { handleNotificationsRequest, type NotificationsHttpService } from './tasks/notifications-http.js';
import { NotificationsService } from './tasks/notifications-service.js';

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
  workspace?: WorkspaceHttpService,
  extras?: ExtrasHttpService,
  settings?: SettingsHttpService,
  integrationBuilder?: IntegrationBuilderHttpService,
  secrets?: SecretsHttpService,
  calendar?: CalendarHttpService,
  notifications?: NotificationsHttpService,
  customWidgets?: CustomWidgetsHttpService,
  comments?: CommentHttpService,
  proxmox?: ProxmoxHttpService,
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

    if (request.url === '/api/coder/templates' || (request.url?.startsWith('/api/items/') && request.url.endsWith('/workspace'))) {
      if (!workspace) { writeJson(response, 503, { error: 'Coder integration is not configured' }); return; }
      const result = await handleWorkspaceRequest(request.method ?? 'GET', request.url, workspace);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/items/') && request.url.endsWith('/comments')) {
      if (!comments) { writeJson(response, 503, { error: 'Comments are not configured' }); return; }
      const result = await handleCommentRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), comments);
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

    if (request.url?.startsWith('/api/proxmox')) {
      if (!proxmox) { writeJson(response, 503, { error: 'Proxmox VM control is not configured' }); return; }
      const role = parseRole(headerValue(request.headers['x-devos-role']));
      const result = await handleProxmoxRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), role, proxmox);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/catalog/kubernetes') || request.url?.startsWith('/api/catalog/argocd') || request.url?.startsWith('/api/catalog/trivy') || request.url?.startsWith('/api/infra')) {
      if (!infra) { writeJson(response, 503, { error: 'Infrastructure integrations are not configured' }); return; }
      const result = await handleInfraRequest(request.method ?? 'GET', request.url, infra);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/catalog')) {
      if (!catalog) { writeJson(response, 503, { error: 'Catalog is not configured' }); return; }
      const result = await handleCatalogRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), catalog);
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

    if (request.url?.startsWith('/api/extras')) {
      if (!extras) { writeJson(response, 503, { error: 'Extras integrations are not configured' }); return; }
      const result = await handleExtrasRequest(request.method ?? 'GET', request.url, extras);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/settings')) {
      if (!settings) { writeJson(response, 503, { error: 'Settings are not configured' }); return; }
      const result = await handleSettingsRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), settings);
      if (result.status === 204) {
        response.writeHead(204);
        response.end();
        return;
      }
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url === '/api/integrations' || request.url === '/api/integrations/test') {
      if (!integrationBuilder) { writeJson(response, 503, { error: 'Integration builder is not configured' }); return; }
      const result = await handleIntegrationBuilderRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), integrationBuilder);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/custom-widgets')) {
      if (!customWidgets) { writeJson(response, 503, { error: 'Custom widgets are not configured' }); return; }
      const result = await handleCustomWidgetsRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), customWidgets);
      if (result.status === 204) { response.writeHead(204); response.end(); return; }
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/secrets')) {
      if (!secrets) { writeJson(response, 503, { error: 'Secrets management is not configured' }); return; }
      const result = await handleSecretsRequest(request.method ?? 'GET', request.url, await readJsonIfNeeded(request), secrets);
      if (result.status === 204) {
        response.writeHead(204);
        response.end();
        return;
      }
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url?.startsWith('/api/calendar')) {
      if (!calendar) { writeJson(response, 503, { error: 'Calendar integrations are not configured' }); return; }
      const result = await handleCalendarRequest(request.method ?? 'GET', request.url, calendar);
      writeJson(response, result.status, result.body);
      return;
    }

    if (request.url === '/api/notifications/trigger' && notifications) {
      const result = await handleNotificationsRequest(request.method ?? 'POST', request.url, await readJsonIfNeeded(request), notifications);
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
  void (async () => {
    const database = new PrismaClient();
    const settingsService = new SettingsService(database);
    await applyStoredSettingsToEnv(settingsService);
    const rawItems = new ItemService(database);
    const coder = buildCoderClientFromEnv();
    const items = coder ? wrapItemsWithAutoStop(rawItems, database, coder) : rawItems;
    const cycles = new PrismaCycleService(database);
    const triage = new PrismaTriageService(database);
    const time = new PrismaTimeService(database);
    const dashboard = new DashboardService(database);
    const haproxy = buildHAProxyServiceFromEnv(database);
    const catalog = buildCatalogServiceFromEnv(database);
    const infra = buildInfraServiceFromEnv(database);
    const docs = buildDocsServiceFromEnv(database);
    await new DocsService(database).ensureDefaultOnboardingPages();
    const workspace = coder ? buildWorkspaceServiceFromEnv(database, coder) : undefined;
    const extras = buildExtrasServiceFromEnv(rawItems);
    const auth = await buildAuthServiceFromEnv();
    const integrationBuilder = buildIntegrationBuilderServiceFromEnv(settingsService);
    const secrets = await buildSecretsServiceFromEnv();
    const calendar = buildCalendarServiceFromEnv();
    const notifications: NotificationsHttpService = buildNotificationsServiceFromEnv();
    const customWidgets = buildCustomWidgetsServiceFromEnv(settingsService);
    const comments = buildCommentsServiceFromEnv(database);
    const proxmoxHttp = buildProxmoxHttpServiceFromEnv();
    createServer(auth, items, cycles, triage, time, undefined, undefined, undefined, dashboard, haproxy, catalog, infra, docs, workspace, extras, settingsService, integrationBuilder, secrets, calendar, notifications, customWidgets, comments, proxmoxHttp).listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
  })();
}

const CUSTOM_INTEGRATIONS_SETTINGS_KEY = 'CUSTOM_INTEGRATIONS';

/** Generic integration builder: connectivity test is stateless, saved configs are persisted as a JSON array via SettingsService. */
function buildIntegrationBuilderServiceFromEnv(settings: SettingsService): IntegrationBuilderHttpService {
  return {
    test: (config) => testIntegration(config),
    async list() {
      const raw = await settings.get(CUSTOM_INTEGRATIONS_SETTINGS_KEY);
      return raw ? (JSON.parse(raw) as SavedIntegration[]) : [];
    },
    async save(integration) {
      const raw = await settings.get(CUSTOM_INTEGRATIONS_SETTINGS_KEY);
      const current: SavedIntegration[] = raw ? JSON.parse(raw) : [];
      const next = [...current.filter((existing) => existing.name !== integration.name), integration];
      await settings.set(CUSTOM_INTEGRATIONS_SETTINGS_KEY, JSON.stringify(next));
    },
  };
}

const CUSTOM_WIDGETS_SETTINGS_KEY = 'CUSTOM_WIDGETS';

/** Widgets custom du Dashboard (section R) : persistés comme un tableau JSON via SettingsService, jamais d'exécution de code côté serveur. */
function buildCustomWidgetsServiceFromEnv(settings: SettingsService): CustomWidgetsHttpService {
  return {
    async list() {
      const raw = await settings.get(CUSTOM_WIDGETS_SETTINGS_KEY);
      return raw ? (JSON.parse(raw) as CustomWidget[]) : [];
    },
    async save(widget) {
      const raw = await settings.get(CUSTOM_WIDGETS_SETTINGS_KEY);
      const current: CustomWidget[] = raw ? JSON.parse(raw) : [];
      const next = [...current.filter((existing) => existing.id !== widget.id), widget];
      await settings.set(CUSTOM_WIDGETS_SETTINGS_KEY, JSON.stringify(next));
    },
    async remove(id) {
      const raw = await settings.get(CUSTOM_WIDGETS_SETTINGS_KEY);
      const current: CustomWidget[] = raw ? JSON.parse(raw) : [];
      await settings.set(CUSTOM_WIDGETS_SETTINGS_KEY, JSON.stringify(current.filter((existing) => existing.id !== id)));
    },
  };
}

/**
 * Builds the generic secrets manager when a real Vault deployment is configured. Same
 * local/dev limitation as buildAuthServiceFromEnv above: this needs a real Vault + Kubernetes
 * ServiceAccount, so it stays undefined (503) without one — no Postgres fallback for secrets.
 */
async function buildSecretsServiceFromEnv(): Promise<SecretsHttpService | undefined> {
  const address = process.env.VAULT_ADDR;
  const kubernetesAuthPath = process.env.VAULT_KUBERNETES_AUTH_PATH;
  const kubernetesRole = process.env.VAULT_KUBERNETES_ROLE;
  const kubernetesJwtFile = process.env.VAULT_KUBERNETES_JWT_FILE;
  if (!address || !kubernetesAuthPath || !kubernetesRole || !kubernetesJwtFile) return undefined;

  const vault = new VaultClient({ address, kubernetesAuthPath, kubernetesRole, kubernetesJwtFile });
  try {
    await vault.authenticateKubernetes();
  } catch {
    return undefined;
  }
  return new SecretsService(vault);
}

/** Combines the personal + professional ICS calendars (read-only) when at least one URL is configured. */
function buildCalendarServiceFromEnv(): CalendarHttpService | undefined {
  const personalUrl = process.env.CALENDAR_PERSONAL_ICS_URL;
  const professionalUrl = process.env.CALENDAR_PROFESSIONAL_ICS_URL;
  if (!personalUrl && !professionalUrl) return undefined;

  return {
    async listEvents(): Promise<CalendarSourceEvent[]> {
      const sources: Array<{ url: string; source: 'personal' | 'professional' }> = [
        ...(personalUrl ? [{ url: personalUrl, source: 'personal' as const }] : []),
        ...(professionalUrl ? [{ url: professionalUrl, source: 'professional' as const }] : []),
      ];
      const results = await Promise.all(sources.map(async ({ url, source }) => {
        const events = await fetchIcsEvents(url);
        return events.map((event) => ({ ...event, source }));
      }));
      return results.flat();
    },
  };
}

/**
 * Server-side notification channels (email via SMTP, generic outbound webhook) — the browser
 * channel is handled entirely client-side and never touches this. Always returns a usable
 * service: with no channel configured, trigger() just dispatches to zero channels (200, empty
 * results), so the browser channel keeps working independently of server-side config.
 */
function buildNotificationsServiceFromEnv(): NotificationsHttpService {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const emailFrom = process.env.NOTIFICATIONS_EMAIL_FROM;
  const emailTo = process.env.NOTIFICATIONS_EMAIL_TO;
  const email = smtpHost && smtpPort && emailFrom && emailTo
    ? { host: smtpHost, port: Number(smtpPort), user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD, from: emailFrom, to: emailTo }
    : undefined;

  const webhookUrl = process.env.NOTIFICATIONS_WEBHOOK_URL;
  const webhook = webhookUrl ? { url: webhookUrl } : undefined;

  const service = new NotificationsService(email, webhook);
  return { trigger: (payload) => service.trigger(payload) };
}

/** Loads integration settings persisted via the Settings screen into process.env, without overriding variables already set (env vars always win). */
async function applyStoredSettingsToEnv(settings: SettingsService): Promise<void> {
  const stored = await settings.list();
  for (const [key, value] of Object.entries(stored)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Builds the Keycloak login flow when configured. `KEYCLOAK_CLIENT_SECRET` is a direct-value
 * fallback for local/dev setups without a real Vault deployment (e.g. docker-compose); the
 * production path (a Vault-backed KeycloakSecretReader) is intentionally not implemented here
 * since it needs a real Vault + Kubernetes ServiceAccount, out of scope for local dev.
 */
async function buildAuthServiceFromEnv(): Promise<Pick<KeycloakAuthService, 'completeLogin'> | undefined> {
  const directSecret = process.env.KEYCLOAK_CLIENT_SECRET;
  const redisUrl = process.env.REDIS_URL;
  if (!directSecret || !redisUrl) return undefined;
  let config;
  try {
    config = createKeycloakOidcConfig(process.env);
  } catch {
    return undefined;
  }
  const secretReader: KeycloakSecretReader = { async readKv2() { return { client_secret: directSecret }; } };
  const redis = createRedisClients(redisUrl).cache;
  await redis.connect();
  const sessions = new RedisSessionStore(redis);
  return new KeycloakAuthService(config, secretReader, sessions);
}

function buildExtrasServiceFromEnv(items: ItemService): ExtrasHttpService {
  const extras: ExtrasHttpService = {};

  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    const github = new GitHubClient({ baseUrl: process.env.GITHUB_BASE_URL ?? 'https://api.github.com', token: githubToken });
    extras.listGitHubIssues = async (owner, repo) => {
      const issues = [];
      for await (const issue of github.listIssues(owner, repo)) issues.push(issue);
      return issues;
    };
  }

  extras.listMcpTools = async () => buildMcpToolDefinitions(items).map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

  const grafanaBaseUrl = process.env.GRAFANA_BASE_URL;
  const grafanaApiKey = process.env.GRAFANA_API_KEY;
  if (grafanaBaseUrl && grafanaApiKey) {
    const grafana = new GrafanaClient({ baseUrl: grafanaBaseUrl, apiKey: grafanaApiKey });
    extras.listGrafanaDashboards = () => grafana.listDashboards();
  }

  const harborBaseUrl = process.env.HARBOR_BASE_URL;
  const harborUsername = process.env.HARBOR_USERNAME;
  const harborPassword = process.env.HARBOR_PASSWORD;
  if (harborBaseUrl && harborUsername && harborPassword) {
    const harbor = new HarborClient({ baseUrl: harborBaseUrl, username: harborUsername, password: harborPassword });
    extras.listHarborProjects = () => harbor.listProjects();
    extras.listHarborRepositories = (project) => harbor.listRepositories(project);
  }

  const proxmoxBaseUrl = process.env.PROXMOX_BASE_URL;
  const proxmoxApiToken = process.env.PROXMOX_API_TOKEN;
  if (proxmoxBaseUrl && proxmoxApiToken) {
    const proxmox = new ProxmoxClient({ baseUrl: proxmoxBaseUrl, apiToken: proxmoxApiToken });
    extras.listProxmoxNodes = () => proxmox.listNodes();
    extras.listProxmoxVMs = (node) => proxmox.listVirtualMachines(node);
    extras.listProxmoxContainers = (node) => proxmox.listContainers(node);
  }

  const wazuhBaseUrl = process.env.WAZUH_BASE_URL;
  const wazuhToken = process.env.WAZUH_TOKEN;
  if (wazuhBaseUrl && wazuhToken) {
    const wazuh = new WazuhClient({ baseUrl: wazuhBaseUrl, token: wazuhToken });
    extras.listWazuhAlerts = (limit) => wazuh.listAlerts(limit);
  }

  const exporterMap = parseExporterMap(process.env.PROMETHEUS_EXPORTERS);
  if (exporterMap) {
    extras.getMetrics = async (exporter) => {
      const baseUrl = exporterMap[exporter];
      if (!baseUrl) throw new Error(`Unknown Prometheus exporter: ${exporter}`);
      const metrics = await new PrometheusExporterClient({ baseUrl }).getMetrics();
      return Object.fromEntries(metrics);
    };
  }

  const minioBaseUrl = process.env.MINIO_BASE_URL;
  const minioAccessKey = process.env.MINIO_ACCESS_KEY;
  const minioSecretKey = process.env.MINIO_SECRET_KEY;
  if (minioBaseUrl && minioAccessKey && minioSecretKey) {
    const minio = new MinioClient({ baseUrl: minioBaseUrl, accessKey: minioAccessKey, secretKey: minioSecretKey });
    extras.listMinioBuckets = () => minio.listBuckets();
  }

  const rabbitmqBaseUrl = process.env.RABBITMQ_BASE_URL;
  const rabbitmqUsername = process.env.RABBITMQ_USERNAME;
  const rabbitmqPassword = process.env.RABBITMQ_PASSWORD;
  if (rabbitmqBaseUrl && rabbitmqUsername && rabbitmqPassword) {
    const rabbitmq = new RabbitMQClient({ baseUrl: rabbitmqBaseUrl, username: rabbitmqUsername, password: rabbitmqPassword });
    extras.listRabbitMQQueues = () => rabbitmq.listQueues();
    extras.listRabbitMQNodes = () => rabbitmq.listNodes();
  }

  const dnsBaseUrl = process.env.POWERDNS_BASE_URL;
  const dnsApiKey = process.env.POWERDNS_API_KEY;
  if (dnsBaseUrl && dnsApiKey) {
    const dns = new PowerDNSClient({ baseUrl: dnsBaseUrl, apiKey: dnsApiKey, serverId: process.env.POWERDNS_SERVER_ID });
    extras.listDnsZones = () => dns.listZones();
  }

  const woodpeckerBaseUrl = process.env.WOODPECKER_BASE_URL;
  const woodpeckerToken = process.env.WOODPECKER_TOKEN;
  if (woodpeckerBaseUrl && woodpeckerToken) {
    const woodpecker = new WoodpeckerClient({ baseUrl: woodpeckerBaseUrl, token: woodpeckerToken });
    extras.listWoodpeckerRepos = () => woodpecker.listRepos();
    extras.listWoodpeckerBuilds = (repoId) => woodpecker.listBuilds(repoId);
  }

  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
  if (ollamaBaseUrl) {
    const ollama = new OllamaClient({ baseUrl: ollamaBaseUrl });
    extras.listOllamaModels = () => ollama.listModels();
  }

  const terraformStatePath = process.env.TERRAFORM_STATE_PATH;
  if (terraformStatePath) {
    extras.readTerraformState = async () => parseTerraformState(readFileSync(terraformStatePath, 'utf8'));
  }

  const sambaExporterBaseUrl = process.env.SAMBA_EXPORTER_BASE_URL;
  if (sambaExporterBaseUrl) {
    const exporter = new PrometheusExporterClient({ baseUrl: sambaExporterBaseUrl });
    extras.getFileShareStatus = async () => summarizeFileShareMetrics(await exporter.getMetrics());
  }

  const wireguardExporterBaseUrl = process.env.WIREGUARD_EXPORTER_BASE_URL;
  if (wireguardExporterBaseUrl) {
    const exporter = new PrometheusExporterClient({ baseUrl: wireguardExporterBaseUrl });
    extras.getWireGuardStatus = async () => summarizeWireGuardMetrics(await exporter.getMetrics());
  }

  const suricataBaseUrl = process.env.SURICATA_BASE_URL;
  if (suricataBaseUrl) {
    const suricata = new SuricataClient({ baseUrl: suricataBaseUrl });
    extras.getSuricataAlertCount = () => suricata.getAlertCount();
  }

  const natsBaseUrl = process.env.NATS_MONITOR_BASE_URL;
  if (natsBaseUrl) {
    const nats = new NatsMonitorClient({ baseUrl: natsBaseUrl });
    extras.getNatsStatus = () => nats.getVarz();
    extras.listNatsConnections = () => nats.listConnections();
  }

  const n8nBaseUrl = process.env.N8N_BASE_URL;
  const n8nApiKey = process.env.N8N_API_KEY;
  if (n8nBaseUrl && n8nApiKey) {
    const n8n = new N8nClient({ baseUrl: n8nBaseUrl, apiKey: n8nApiKey });
    extras.listN8nWorkflows = () => n8n.listWorkflows();
    extras.listN8nExecutions = (workflowId) => n8n.listExecutions(workflowId);
  }

  const verdaccioBaseUrl = process.env.VERDACCIO_BASE_URL;
  if (verdaccioBaseUrl) {
    const verdaccio = new VerdaccioClient({ baseUrl: verdaccioBaseUrl, token: process.env.VERDACCIO_TOKEN });
    extras.getVerdaccioPackage = (packageName) => verdaccio.getPackage(packageName);
  }

  const nexusBaseUrl = process.env.NEXUS_BASE_URL;
  const nexusUsername = process.env.NEXUS_USERNAME;
  const nexusPassword = process.env.NEXUS_PASSWORD;
  if (nexusBaseUrl && nexusUsername && nexusPassword) {
    const nexus = new NexusClient({ baseUrl: nexusBaseUrl, username: nexusUsername, password: nexusPassword });
    extras.listNexusRepositories = () => nexus.listRepositories();
  }

  const meilisearchBaseUrl = process.env.MEILISEARCH_BASE_URL;
  const meilisearchApiKey = process.env.MEILISEARCH_API_KEY;
  if (meilisearchBaseUrl && meilisearchApiKey) {
    const meilisearch = new MeilisearchClient({ baseUrl: meilisearchBaseUrl, apiKey: meilisearchApiKey });
    extras.listMeilisearchIndexes = () => meilisearch.listIndexes();
    extras.searchMeilisearch = (indexUid, query) => meilisearch.search(indexUid, query);
  }

  const redpandaBaseUrl = process.env.REDPANDA_BASE_URL;
  if (redpandaBaseUrl) {
    const redpanda = new RedpandaClient({ baseUrl: redpandaBaseUrl, token: process.env.REDPANDA_TOKEN });
    extras.listRedpandaBrokers = () => redpanda.listBrokers();
    extras.listRedpandaTopics = () => redpanda.listTopics();
    extras.getRedpandaTopicPartitions = (topic) => redpanda.getTopicPartitions(topic);
  }

  const widgetsGitlabBaseUrl = process.env.GITLAB_BASE_URL;
  const widgetsGitlabToken = process.env.GITLAB_TOKEN;
  const widgetsGitlabProjectId = process.env.GITLAB_PROJECT_ID;
  const alertmanagerBaseUrl = process.env.ALERTMANAGER_BASE_URL;
  if ((widgetsGitlabBaseUrl && widgetsGitlabToken && widgetsGitlabProjectId) || alertmanagerBaseUrl) {
    const alertmanager = alertmanagerBaseUrl ? new AlertmanagerClient({ baseUrl: alertmanagerBaseUrl }) : undefined;
    extras.getDashboardWidgets = async () => {
      const pipelines = widgetsGitlabBaseUrl && widgetsGitlabToken && widgetsGitlabProjectId
        ? await listRunningPipelines({ baseUrl: widgetsGitlabBaseUrl, tokenProvider: { async getToken() { return widgetsGitlabToken; } } }, widgetsGitlabProjectId)
        : [];
      const alerts = alertmanager ? await alertmanager.listActiveAlerts() : [];
      return buildDashboardWidgets(pipelines, alerts);
    };
  }

  extras.checkForUpdate = async () => {
    const packageJsonPath = process.env.DEVOS_PACKAGE_JSON_PATH ?? join(__dirname, '../../../package.json');
    const gitlabBaseUrl = process.env.GITLAB_BASE_URL;
    const gitlabToken = process.env.GITLAB_TOKEN;
    const gitlabProjectId = process.env.GITLAB_PROJECT_ID;
    if (!gitlabBaseUrl || !gitlabToken || !gitlabProjectId) {
      const current = readCurrentVersion(packageJsonPath);
      return { current, latest: null, status: 'unknown' as const };
    }
    return checkForUpdate(packageJsonPath, {
      async getLatestReleaseTag() {
        const response = await fetch(`${gitlabBaseUrl}/projects/${encodeURIComponent(gitlabProjectId)}/releases`, { headers: { 'private-token': gitlabToken } });
        if (!response.ok) return null;
        const releases = (await response.json()) as Array<{ tag_name?: string }>;
        return releases[0]?.tag_name ?? null;
      },
    });
  };

  return extras;
}

function parseExporterMap(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
    return undefined;
  } catch {
    return undefined;
  }
}

function buildCoderClientFromEnv(): CoderClient | undefined {
  const baseUrl = process.env.CODER_BASE_URL;
  const token = process.env.CODER_TOKEN;
  const organizationId = process.env.CODER_ORGANIZATION_ID;
  if (!baseUrl || !token || !organizationId) return undefined;
  return new CoderClient({ baseUrl, token, organizationId });
}

/** Wraps ItemService so that a status transition into "done" auto-stops the item's linked Coder workspace. */
function wrapItemsWithAutoStop(inner: ItemService, database: PrismaClient, coder: CoderClient): ItemHttpService {
  return {
    list: () => inner.list(),
    create: (input) => inner.create(input),
    delete: (id) => inner.delete(id),
    async update(id, input) {
      const before = await database.item.findUnique({ where: { id }, select: { status: true } });
      const updated = await inner.update(id, input);
      if (before) await applyAutoStop(updated, before.status, coder);
      return updated;
    },
  };
}

function buildWorkspaceServiceFromEnv(database: PrismaClient, coder: CoderClient): WorkspaceHttpService | undefined {
  const baseUrl = process.env.CODER_BASE_URL;
  const owner = process.env.CODER_OWNER;
  if (!baseUrl || !owner) return undefined;
  return {
    listTemplates: () => coder.listTemplates(),
    async openEnvironment(itemId) {
      const item = await database.item.findUniqueOrThrow({ where: { id: itemId }, select: { id: true, coderTemplateId: true } });
      return openEnvironment(item, coder, {
        async saveWorkspace(id, fields) { await database.item.update({ where: { id }, data: fields }); },
      }, { defaultTemplateId: process.env.CODER_DEFAULT_TEMPLATE_ID, baseUrl, owner });
    },
  };
}

function buildDocsServiceFromEnv(database: PrismaClient): DocsHttpService {
  const service = new DocsService(database);
  return {
    list: () => service.list(),
    get: (id) => service.get(id),
    link: (docPageId, itemId) => service.link(docPageId, itemId),
    unlink: (docPageId, itemId) => service.unlink(docPageId, itemId),
    createOnboardingPage: (title, content) => service.createOnboardingPage(title, content),
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

function buildInfraServiceFromEnv(database: PrismaClient): InfraHttpService | undefined {
  const k8sApiServer = process.env.K8S_API_SERVER;
  const k8sToken = process.env.K8S_TOKEN;
  const argoBaseUrl = process.env.ARGOCD_BASE_URL;
  const argoToken = process.env.ARGOCD_TOKEN;
  const harborBaseUrl = process.env.HARBOR_BASE_URL;
  const harborUsername = process.env.HARBOR_USERNAME;
  const harborPassword = process.env.HARBOR_PASSWORD;
  const proxmoxBaseUrl = process.env.PROXMOX_BASE_URL;
  const proxmoxApiToken = process.env.PROXMOX_API_TOKEN;
  const dnsBaseUrl = process.env.POWERDNS_BASE_URL;
  const dnsApiKey = process.env.POWERDNS_API_KEY;
  const hasProxmoxAndDns = Boolean(proxmoxBaseUrl && proxmoxApiToken && dnsBaseUrl && dnsApiKey);
  if (!k8sApiServer && !k8sToken && !argoBaseUrl && !argoToken && !harborBaseUrl && !hasProxmoxAndDns) return undefined;

  const kubernetes = k8sApiServer && k8sToken ? new KubernetesClient({ apiServer: k8sApiServer, token: k8sToken }) : undefined;
  const argocd = argoBaseUrl && argoToken ? new ArgoCDClient({ baseUrl: argoBaseUrl, token: argoToken }) : undefined;
  const harbor = harborBaseUrl && harborUsername && harborPassword ? new HarborTrivyClient({ baseUrl: harborBaseUrl, username: harborUsername, password: harborPassword }) : undefined;
  const proxmox = proxmoxBaseUrl && proxmoxApiToken ? new ProxmoxClient({ baseUrl: proxmoxBaseUrl, apiToken: proxmoxApiToken }) : undefined;
  const dns = dnsBaseUrl && dnsApiKey ? new PowerDNSClient({ baseUrl: dnsBaseUrl, apiKey: dnsApiKey, serverId: process.env.POWERDNS_SERVER_ID }) : undefined;

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
    getNetworkTopology: hasProxmoxAndDns
      ? async () => {
          const proxmoxClient = requireClient(proxmox, 'Proxmox');
          const dnsClient = requireClient(dns, 'PowerDNS');
          const nodes = await proxmoxClient.listNodes();
          const vmsByNode = Object.fromEntries(
            await Promise.all(nodes.map(async (node) => [node.id, await proxmoxClient.listVirtualMachines(node.id)] as const)),
          );
          const zones = await dnsClient.listZones();
          const recordSets = (await Promise.all(zones.map((zone) => dnsClient.getZoneRecords(zone.id)))).flat();
          const catalogRows = await database.catalogEntity.findMany({ select: { name: true, annotations: true } });
          const catalogServices = catalogRows.map((row) => ({
            name: row.name,
            host: (row.annotations as Record<string, string> | null)?.['devos.io/host'],
          }));
          return buildNetworkTopology({ proxmoxNodes: nodes, proxmoxVMsByNode: vmsByNode, dnsRecords: recordSets, catalogServices });
        }
      : undefined,
  };
}

/**
 * Commentaires sur un item, propagés vers GitLab (note sur l'issue) quand l'item est lié
 * (`GitLabIssueLink`) et que GITLAB_BASE_URL/GITLAB_TOKEN sont configurés. Fonctionne aussi sans
 * GitLab configuré : les commentaires restent alors purement locaux (jamais propagés).
 */
function buildCommentsServiceFromEnv(database: PrismaClient): CommentHttpService {
  const baseUrl = process.env.GITLAB_BASE_URL;
  const token = process.env.GITLAB_TOKEN;
  const gitlab = baseUrl && token ? new GitLabClient({ baseUrl, tokenProvider: { async getToken() { return token; } } }) : undefined;
  const service = new CommentService(database, gitlab);
  return {
    list: (itemId) => service.list(itemId),
    create: (itemId, body, author) => service.create(itemId, body, author),
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
    createFromTemplate: (templateKind, templateName, input) => service.createFromTemplate(templateKind, templateName, input),
  };
}

function buildProxmoxHttpServiceFromEnv(): ProxmoxHttpService | undefined {
  const baseUrl = process.env.PROXMOX_BASE_URL;
  const apiToken = process.env.PROXMOX_API_TOKEN;
  if (!baseUrl || !apiToken) return undefined;
  const client = new ProxmoxClient({ baseUrl, apiToken });
  return {
    controlVirtualMachine: (node, vmid, action) => client.controlVirtualMachine(node, vmid, action),
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
    listAcls: (parentType, parentName) => client.listAcls(parentType, parentName),
    addAcl: (parentType, parentName, acl) => client.addAcl(parentType, parentName, acl),
    deleteAcl: (parentType, parentName, index) => client.deleteAcl(parentType, parentName, index),
    listCertificates: () => client.listCertificates(),
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
  response.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('vary', 'origin');
}