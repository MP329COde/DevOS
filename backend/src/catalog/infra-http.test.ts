import assert from 'node:assert/strict';
import test from 'node:test';

import { handleInfraRequest } from './infra-http.js';

const service = {
  async listPods(namespace?: string) { return [{ name: 'pod', namespace: namespace ?? 'all', phase: 'Running' }]; },
  async listDeployments(namespace?: string) { return [{ name: 'dep', namespace: namespace ?? 'all', replicas: 1, readyReplicas: 1 }]; },
  async listNodes() { return [{ name: 'node-1', ready: true }]; },
  async listArgoApplications() { return [{ name: 'devos', syncStatus: 'Synced', healthStatus: 'Healthy' }]; },
  async getArgoSyncHistory(name: string) { return [{ id: 1, revision: name, deployedAt: '2026-09-01T00:00:00Z' }]; },
  async getTrivySummary(project: string) { return project === 'missing' ? null : { scanStatus: 'Success', critical: 0, high: 0, medium: 0, low: 0 }; },
};

test('lists pods scoped to a namespace query param', async () => {
  const result = await handleInfraRequest('GET', '/api/catalog/kubernetes/pods?namespace=devos', service);
  assert.deepEqual(result, { status: 200, body: [{ name: 'pod', namespace: 'devos', phase: 'Running' }] });
});

test('lists deployments across all namespaces without a query param', async () => {
  const result = await handleInfraRequest('GET', '/api/catalog/kubernetes/deployments', service);
  assert.deepEqual(result, { status: 200, body: [{ name: 'dep', namespace: 'all', replicas: 1, readyReplicas: 1 }] });
});

test('lists nodes', async () => {
  const result = await handleInfraRequest('GET', '/api/catalog/kubernetes/nodes', service);
  assert.deepEqual(result, { status: 200, body: [{ name: 'node-1', ready: true }] });
});

test('lists ArgoCD applications', async () => {
  const result = await handleInfraRequest('GET', '/api/catalog/argocd/applications', service);
  assert.deepEqual(result, { status: 200, body: [{ name: 'devos', syncStatus: 'Synced', healthStatus: 'Healthy' }] });
});

test('reads ArgoCD sync history for a named application', async () => {
  const result = await handleInfraRequest('GET', '/api/catalog/argocd/applications/devos/history', service);
  assert.deepEqual(result, { status: 200, body: [{ id: 1, revision: 'devos', deployedAt: '2026-09-01T00:00:00Z' }] });
});

test('returns a Trivy vulnerability summary', async () => {
  const result = await handleInfraRequest('GET', '/api/catalog/trivy/devos/backend/latest', service);
  assert.deepEqual(result, { status: 200, body: { scanStatus: 'Success', critical: 0, high: 0, medium: 0, low: 0 } });
});

test('returns 404 when no Trivy scan exists yet (stub case)', async () => {
  const result = await handleInfraRequest('GET', '/api/catalog/trivy/missing/backend/latest', service);
  assert.equal(result.status, 404);
});

test('rejects unknown routes', async () => {
  const result = await handleInfraRequest('GET', '/api/catalog/unknown', service);
  assert.equal(result.status, 404);
});

test('rejects non-GET methods', async () => {
  const result = await handleInfraRequest('POST', '/api/catalog/kubernetes/pods', service);
  assert.equal(result.status, 404);
});
