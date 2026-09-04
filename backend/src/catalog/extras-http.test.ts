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

test('rejects unknown extras routes', async () => {
  const result = await handleExtrasRequest('GET', '/api/extras/unknown', {});
  assert.equal(result.status, 404);
});

test('rejects non-GET methods', async () => {
  const result = await handleExtrasRequest('POST', '/api/extras/grafana/dashboards', {});
  assert.equal(result.status, 404);
});
