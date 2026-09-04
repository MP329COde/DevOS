import type { GitHubIssue } from '../integrations/github.js';
import type { McpToolDefinition } from '../integrations/mcp-server.js';
import type { OllamaModel } from '../integrations/ollama.js';
import type { WoodpeckerBuild, WoodpeckerRepo } from '../integrations/woodpecker.js';
import type { UpdateCheckResult } from '../integrations/update-checker.js';
import type { GrafanaDashboard } from './grafana.js';
import type { HarborProject, HarborRepository } from './harbor.js';
import type { ProxmoxContainer, ProxmoxNode, ProxmoxVM } from './proxmox.js';
import type { WazuhAlert } from './wazuh.js';
import type { MinioBucket } from './minio.js';
import type { RabbitMQNode, RabbitMQQueue } from './rabbitmq.js';
import type { PowerDNSZone } from './dns-server.js';
import type { TerraformResourceSummary } from './terraform-state.js';

/**
 * Every method is optional: only the services configured via environment variables are
 * present, and handleExtrasRequest returns 503 for a route whose backing method is absent —
 * same graceful-degradation pattern as the rest of the app.
 */
export interface ExtrasHttpService {
  listGitHubIssues?(owner: string, repo: string): Promise<GitHubIssue[]>;
  listMcpTools?(): Promise<Array<Pick<McpToolDefinition, 'name' | 'description' | 'inputSchema'>>>;
  listGrafanaDashboards?(): Promise<GrafanaDashboard[]>;
  listHarborProjects?(): Promise<HarborProject[]>;
  listHarborRepositories?(project: string): Promise<HarborRepository[]>;
  listProxmoxNodes?(): Promise<ProxmoxNode[]>;
  listProxmoxVMs?(node: string): Promise<ProxmoxVM[]>;
  listProxmoxContainers?(node: string): Promise<ProxmoxContainer[]>;
  listWazuhAlerts?(limit?: number): Promise<WazuhAlert[]>;
  getMetrics?(exporter: string): Promise<Record<string, number>>;
  listMinioBuckets?(): Promise<MinioBucket[]>;
  listRabbitMQQueues?(): Promise<RabbitMQQueue[]>;
  listRabbitMQNodes?(): Promise<RabbitMQNode[]>;
  listDnsZones?(): Promise<PowerDNSZone[]>;
  listWoodpeckerRepos?(): Promise<WoodpeckerRepo[]>;
  listWoodpeckerBuilds?(repoId: number): Promise<WoodpeckerBuild[]>;
  listOllamaModels?(): Promise<OllamaModel[]>;
  readTerraformState?(): Promise<TerraformResourceSummary[]>;
  checkForUpdate?(): Promise<UpdateCheckResult>;
}

export interface ExtrasHttpResponse {
  status: number;
  body: unknown;
}

export async function handleExtrasRequest(method: string, url: string, service: ExtrasHttpService): Promise<ExtrasHttpResponse> {
  const [path, query] = url.split('?');
  const params = new URLSearchParams(query ?? '');

  try {
    if (method !== 'GET') return { status: 404, body: { error: 'Not found' } };

    const githubIssues = path.match(/^\/api\/extras\/github\/([^/]+)\/([^/]+)\/issues$/);
    if (githubIssues) return call(service.listGitHubIssues, 'GitHub', () => collect(service.listGitHubIssues!(decodeURIComponent(githubIssues[1]), decodeURIComponent(githubIssues[2]))));

    if (path === '/api/extras/mcp/tools') return call(service.listMcpTools, 'MCP', () => service.listMcpTools!());

    if (path === '/api/extras/grafana/dashboards') return call(service.listGrafanaDashboards, 'Grafana', () => service.listGrafanaDashboards!());

    if (path === '/api/extras/harbor/projects') return call(service.listHarborProjects, 'Harbor', () => service.listHarborProjects!());
    const harborRepos = path.match(/^\/api\/extras\/harbor\/([^/]+)\/repositories$/);
    if (harborRepos) return call(service.listHarborRepositories, 'Harbor', () => service.listHarborRepositories!(decodeURIComponent(harborRepos[1])));

    if (path === '/api/extras/proxmox/nodes') return call(service.listProxmoxNodes, 'Proxmox', () => service.listProxmoxNodes!());
    const proxmoxVMs = path.match(/^\/api\/extras\/proxmox\/([^/]+)\/vms$/);
    if (proxmoxVMs) return call(service.listProxmoxVMs, 'Proxmox', () => service.listProxmoxVMs!(decodeURIComponent(proxmoxVMs[1])));
    const proxmoxContainers = path.match(/^\/api\/extras\/proxmox\/([^/]+)\/containers$/);
    if (proxmoxContainers) return call(service.listProxmoxContainers, 'Proxmox', () => service.listProxmoxContainers!(decodeURIComponent(proxmoxContainers[1])));

    if (path === '/api/extras/wazuh/alerts') {
      const limit = params.get('limit');
      return call(service.listWazuhAlerts, 'Wazuh', () => service.listWazuhAlerts!(limit ? Number(limit) : undefined));
    }

    const metrics = path.match(/^\/api\/extras\/metrics\/([^/]+)$/);
    if (metrics) return call(service.getMetrics, 'Prometheus exporter', () => service.getMetrics!(decodeURIComponent(metrics[1])));

    if (path === '/api/extras/minio/buckets') return call(service.listMinioBuckets, 'MinIO', () => service.listMinioBuckets!());

    if (path === '/api/extras/rabbitmq/queues') return call(service.listRabbitMQQueues, 'RabbitMQ', () => service.listRabbitMQQueues!());
    if (path === '/api/extras/rabbitmq/nodes') return call(service.listRabbitMQNodes, 'RabbitMQ', () => service.listRabbitMQNodes!());

    if (path === '/api/extras/dns/zones') return call(service.listDnsZones, 'DNS', () => service.listDnsZones!());

    if (path === '/api/extras/woodpecker/repos') return call(service.listWoodpeckerRepos, 'Woodpecker', () => service.listWoodpeckerRepos!());
    const woodpeckerBuilds = path.match(/^\/api\/extras\/woodpecker\/([^/]+)\/builds$/);
    if (woodpeckerBuilds) return call(service.listWoodpeckerBuilds, 'Woodpecker', () => service.listWoodpeckerBuilds!(Number(decodeURIComponent(woodpeckerBuilds[1]))));

    if (path === '/api/extras/ollama/models') return call(service.listOllamaModels, 'Ollama', () => service.listOllamaModels!());

    if (path === '/api/extras/terraform/state') return call(service.readTerraformState, 'Terraform', () => service.readTerraformState!());

    if (path === '/api/extras/update-check') return call(service.checkForUpdate, 'Update checker', () => service.checkForUpdate!());

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid request' } };
  }
}

async function collect<T>(generator: AsyncGenerator<T> | Promise<T[]>): Promise<T[]> {
  const resolved = await generator;
  if (Array.isArray(resolved)) return resolved;
  const items: T[] = [];
  for await (const item of resolved as AsyncGenerator<T>) items.push(item);
  return items;
}

async function call<T>(guard: unknown, name: string, run: () => Promise<T>): Promise<ExtrasHttpResponse> {
  if (!guard) return { status: 503, body: { error: `${name} is not configured` } };
  return { status: 200, body: await run() };
}
