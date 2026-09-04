import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCiCdRequest, type CiCdHttpService } from './cicd-http.js';

test('returns 503 when the pipelines integration is not configured', async () => {
  const response = await handleCiCdRequest('GET', '/api/dev-cicd/group%2Fproject/pipelines', {});
  assert.equal(response.status, 503);
});

test('lists pipelines for a project', async () => {
  const service: CiCdHttpService = {
    listPipelines: async (projectId) => {
      assert.equal(projectId, 'group/project');
      return [{ id: 1, status: 'success', ref: 'main', sha: 's', webUrl: 'u', createdAt: 'c', updatedAt: 'u2', durationSeconds: 10, authorName: 'A', commitTitle: 'msg' }];
    },
  };
  const response = await handleCiCdRequest('GET', '/api/dev-cicd/group%2Fproject/pipelines', service);
  assert.equal(response.status, 200);
  assert.equal((response.body as unknown[]).length, 1);
});

test('gets pipeline jobs', async () => {
  const service: CiCdHttpService = {
    listPipelineJobs: async (projectId, pipelineId) => {
      assert.equal(projectId, 'group/project');
      assert.equal(pipelineId, 42);
      return [{ id: 1, name: 'build', stage: 'build', status: 'success', durationSeconds: 5, webUrl: 'u', hasArtifacts: false }];
    },
  };
  const response = await handleCiCdRequest('GET', '/api/dev-cicd/group%2Fproject/pipelines/42/jobs', service);
  assert.equal(response.status, 200);
});

test('gets a job log', async () => {
  const service: CiCdHttpService = { getJobLog: async () => 'log content' };
  const response = await handleCiCdRequest('GET', '/api/dev-cicd/group%2Fproject/jobs/5/log', service);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { log: 'log content' });
});

test('retries a pipeline via POST', async () => {
  let called = false;
  const service: CiCdHttpService = {
    retryPipeline: async (projectId, pipelineId) => {
      called = true;
      assert.equal(projectId, 'group/project');
      assert.equal(pipelineId, 42);
      return { id: 42, status: 'running', ref: 'main', sha: 's', webUrl: 'u', createdAt: 'c', updatedAt: 'u2', durationSeconds: null, authorName: null, commitTitle: null };
    },
  };
  const response = await handleCiCdRequest('POST', '/api/dev-cicd/group%2Fproject/pipelines/42/retry', service);
  assert.equal(response.status, 200);
  assert.ok(called);
});

test('rejects GET on the retry route', async () => {
  const response = await handleCiCdRequest('GET', '/api/dev-cicd/group%2Fproject/pipelines/42/retry', {});
  assert.equal(response.status, 404);
});

test('gets deployment history', async () => {
  const service: CiCdHttpService = { getDeploymentHistory: async (appName) => { assert.equal(appName, 'devos'); return [{ id: 1, revision: 'abc', deployedAt: 'c' }]; } };
  const response = await handleCiCdRequest('GET', '/api/dev-cicd/deployments/devos', service);
  assert.equal(response.status, 200);
});

test('returns 404 for the security scan when nothing found', async () => {
  const service: CiCdHttpService = { getSecuritySummary: async () => null };
  const response = await handleCiCdRequest('GET', '/api/dev-cicd/security/proj/repo/tag', service);
  assert.equal(response.status, 404);
});

test('returns 503 for the security scan when not configured', async () => {
  const response = await handleCiCdRequest('GET', '/api/dev-cicd/security/proj/repo/tag', {});
  assert.equal(response.status, 503);
});

test('returns 404 for unknown routes', async () => {
  const response = await handleCiCdRequest('GET', '/api/dev-cicd/unknown', {});
  assert.equal(response.status, 404);
});
