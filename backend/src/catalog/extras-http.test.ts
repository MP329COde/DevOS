import assert from 'node:assert/strict';
import test from 'node:test';

import { handleExtrasRequest } from './extras-http.js';

test('returns 503 for a route whose backing service is not configured', async () => {
  const result = await handleExtrasRequest('GET', '/api/extras/grafana/dashboards', {});
  assert.equal(result.status, 503);
});

test('lists GitHub issues by draining the async generator', async () => {
  const service = {
    async *listGitHubIssues(owner: string, repo: string) {
      yield { id: 1, number: 1, title: `${owner}/${repo}`, body: null, state: 'open', labels: [], html_url: '' };
    },
  };
  const result = await handleExtrasRequest('GET', '/api/extras/github/root/devos/issues', service as never);
  assert.equal(result.status, 200);
  assert.equal((result.body as Array<{ title: string }>)[0].title, 'root/devos');
});

test('lists Proxmox VMs for a given node', async () => {
  let requestedNode = '';
  const service = { async listProxmoxVMs(node: string) { requestedNode = node; return [{ vmid: 100, name: 'vm1', status: 'running' }]; } };
  const result = await handleExtrasRequest('GET', '/api/extras/proxmox/pve1/vms', service as never);
  assert.equal(requestedNode, 'pve1');
  assert.equal(result.status, 200);
});

test('passes the limit query param to Wazuh alerts', async () => {
  let receivedLimit: number | undefined;
  const service = { async listWazuhAlerts(limit?: number) { receivedLimit = limit; return []; } };
  await handleExtrasRequest('GET', '/api/extras/wazuh/alerts?limit=5', service as never);
  assert.equal(receivedLimit, 5);
});

test('reads metrics for a named Prometheus exporter', async () => {
  let requestedExporter = '';
  const service = { async getMetrics(exporter: string) { requestedExporter = exporter; return { up: 1 }; } };
  const result = await handleExtrasRequest('GET', '/api/extras/metrics/postgres', service as never);
  assert.equal(requestedExporter, 'postgres');
  assert.deepEqual(result.body, { up: 1 });
});

test('runs the update checker', async () => {
  const service = { async checkForUpdate() { return { current: '1.0.0', latest: '1.1.0', status: 'update-available' as const }; } };
  const result = await handleExtrasRequest('GET', '/api/extras/update-check', service as never);
  assert.deepEqual(result.body, { current: '1.0.0', latest: '1.1.0', status: 'update-available' });
});

test('reads file share status', async () => {
  const service = { async getFileShareStatus() { return { activeConnections: 3, freeSpacePercent: 42 }; } };
  const result = await handleExtrasRequest('GET', '/api/extras/file-shares/status', service as never);
  assert.deepEqual(result.body, { activeConnections: 3, freeSpacePercent: 42 });
});

test('reads WireGuard and Suricata status', async () => {
  const service = { async getWireGuardStatus() { return { peerCount: 4 }; }, async getSuricataAlertCount() { return 7; } };
  assert.deepEqual((await handleExtrasRequest('GET', '/api/extras/wireguard/status', service as never)).body, { peerCount: 4 });
  assert.deepEqual((await handleExtrasRequest('GET', '/api/extras/suricata/alert-count', service as never)).body, 7);
});

test('lists n8n executions for a given workflow', async () => {
  let requestedId = '';
  const service = { async listN8nExecutions(workflowId: string) { requestedId = workflowId; return []; } };
  await handleExtrasRequest('GET', '/api/extras/n8n/workflows/wf-1/executions', service as never);
  assert.equal(requestedId, 'wf-1');
});

test('reads a Verdaccio package', async () => {
  let requestedName = '';
  const service = { async getVerdaccioPackage(name: string) { requestedName = name; return { name, 'dist-tags': { latest: '1.0.0' }, versions: {}, latestVersion: '1.0.0' }; } };
  const result = await handleExtrasRequest('GET', '/api/extras/verdaccio/devos-lib', service as never);
  assert.equal(requestedName, 'devos-lib');
  assert.equal(result.status, 200);
});

test('searches a Meilisearch index using the q query param', async () => {
  let receivedQuery = '';
  const service = { async searchMeilisearch(indexUid: string, query: string) { receivedQuery = query; return { hits: [], estimatedTotalHits: 0, processingTimeMs: 1 }; } };
  await handleExtrasRequest('GET', '/api/extras/meilisearch/docs/search?q=homelab', service as never);
  assert.equal(receivedQuery, 'homelab');
});

test('lists Redpanda topic partitions for a given topic', async () => {
  let requestedTopic = '';
  const service = { async getRedpandaTopicPartitions(topic: string) { requestedTopic = topic; return []; } };
  await handleExtrasRequest('GET', '/api/extras/redpanda/topics/orders/partitions', service as never);
  assert.equal(requestedTopic, 'orders');
});

test('reads aggregated dashboard widgets', async () => {
  const data = { pipelines: { running: 1, items: [] }, alerts: { active: 0, critical: 0, items: [] } };
  const service = { async getDashboardWidgets() { return data; } };
  const result = await handleExtrasRequest('GET', '/api/extras/dashboard/widgets', service as never);
  assert.deepEqual(result.body, data);
});

test('lists unified dev repos', async () => {
  const service = { async listDevRepos() { return [{ key: 'gitlab:1', provider: 'gitlab', id: '1', name: 'devos', webUrl: '', defaultBranch: 'main', lastActivityAt: null, lastCommit: null, latestRelease: null, pipeline: null, branchCount: 2, openChangeCount: 1 }]; } };
  const result = await handleExtrasRequest('GET', '/api/extras/dev/repos', service as never);
  assert.equal(result.status, 200);
  assert.equal((result.body as Array<{ key: string }>)[0].key, 'gitlab:1');
});

test('reads dev repo detail for a given provider/id', async () => {
  let requestedProvider = '';
  let requestedId = '';
  const service = {
    async getDevRepoDetail(provider: string, id: string) {
      requestedProvider = provider;
      requestedId = id;
      return { recentCommits: [], changes: [] };
    },
  };
  const result = await handleExtrasRequest('GET', '/api/extras/dev/repos/github/owner%2Frepo', service as never);
  assert.equal(requestedProvider, 'github');
  assert.equal(requestedId, 'owner/repo');
  assert.equal(result.status, 200);
});

test('lists dev repo branches for a given provider/id', async () => {
  let requestedId = '';
  const service = { async listDevRepoBranches(_provider: string, id: string) { requestedId = id; return []; } };
  const result = await handleExtrasRequest('GET', '/api/extras/dev/repos/gitlab/1/branches', service as never);
  assert.equal(requestedId, '1');
  assert.equal(result.status, 200);
});

test('rejects unknown extras routes', async () => {
  const result = await handleExtrasRequest('GET', '/api/extras/unknown', {});
  assert.equal(result.status, 404);
});

test('rejects non-GET methods', async () => {
  const result = await handleExtrasRequest('POST', '/api/extras/grafana/dashboards', {});
  assert.equal(result.status, 404);
});
