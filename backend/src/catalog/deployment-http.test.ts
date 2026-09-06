import assert from 'node:assert/strict';
import test from 'node:test';

import { handleDeploymentRequest, type DeploymentHttpService } from './deployment-http.js';
import type { GenerateDeploymentManifestsResult } from './k8s-manifest-generator.js';

const fakeResult: GenerateDeploymentManifestsResult = {
  appName: 'my-app',
  projectType: 'node',
  environments: [],
  applicationSetYaml: 'kind: ApplicationSet\n',
};

test('POST /api/deployment/generate returns generated manifests', async () => {
  const service: DeploymentHttpService = { generate: async () => fakeResult };
  const response = await handleDeploymentRequest('POST', '/api/deployment/generate', {
    appName: 'my-app',
    image: 'img:latest',
    port: 8080,
    environments: [{ name: 'dev' }],
  }, 'Admin', service);

  assert.equal(response.status, 201);
  assert.deepEqual(response.body, fakeResult);
});

test('rejects a request without a session', async () => {
  const service: DeploymentHttpService = { generate: async () => fakeResult };
  const response = await handleDeploymentRequest('POST', '/api/deployment/generate', {
    appName: 'my-app', image: 'img:latest', port: 8080, environments: [{ name: 'dev' }],
  }, undefined, service);
  assert.equal(response.status, 400);
});

test('rejects a request missing required fields', async () => {
  const service: DeploymentHttpService = { generate: async () => fakeResult };
  const response = await handleDeploymentRequest('POST', '/api/deployment/generate', { appName: 'my-app' }, 'Admin', service);
  assert.equal(response.status, 400);
});

test('rejects a request with no environments', async () => {
  const service: DeploymentHttpService = { generate: async () => fakeResult };
  const response = await handleDeploymentRequest('POST', '/api/deployment/generate', {
    appName: 'my-app', image: 'img', port: 80, environments: [],
  }, 'Admin', service);
  assert.equal(response.status, 400);
});

test('returns 404 for unknown routes', async () => {
  const service: DeploymentHttpService = { generate: async () => fakeResult };
  const response = await handleDeploymentRequest('GET', '/api/deployment/unknown', null, 'Admin', service);
  assert.equal(response.status, 404);
});
