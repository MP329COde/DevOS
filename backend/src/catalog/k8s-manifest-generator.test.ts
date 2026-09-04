import assert from 'node:assert/strict';
import test from 'node:test';

import { detectProjectType, generateDeploymentManifests } from './k8s-manifest-generator.js';

test('detects Node projects from package.json', () => {
  assert.equal(detectProjectType(['package.json', 'src/index.ts']), 'node');
});

test('detects Go projects from go.mod', () => {
  assert.equal(detectProjectType(['go.mod', 'main.go']), 'go');
});

test('detects Java projects from pom.xml or Gradle files', () => {
  assert.equal(detectProjectType(['pom.xml']), 'java');
  assert.equal(detectProjectType(['build.gradle']), 'java');
});

test('detects Python projects from requirements.txt', () => {
  assert.equal(detectProjectType(['requirements.txt', 'app.py']), 'python');
});

test('falls back to unknown when nothing matches', () => {
  assert.equal(detectProjectType(['README.md']), 'unknown');
});

test('generates Deployment/Service manifests per environment and an ApplicationSet', () => {
  const result = generateDeploymentManifests({
    appName: 'my-app',
    image: 'registry.example.com/team/my-app:1.0.0',
    port: 8080,
    replicas: 2,
    projectType: 'node',
    sourceRepoUrl: 'https://gitlab.example.com/platform/gitops.git',
    environments: [
      { name: 'dev' },
      { name: 'prod', replicas: 3, host: 'my-app.example.com' },
    ],
  });

  assert.equal(result.appName, 'my-app');
  assert.equal(result.projectType, 'node');
  assert.equal(result.environments.length, 2);

  const dev = result.environments.find((env) => env.environment === 'dev');
  assert.ok(dev);
  assert.equal(dev?.namespace, 'my-app-dev');
  assert.match(dev!.deploymentYaml, /replicas: 2/);
  assert.match(dev!.deploymentYaml, /image: registry.example.com\/team\/my-app:1.0.0/);
  assert.match(dev!.serviceYaml, /port: 8080/);
  assert.equal(dev?.ingressYaml, undefined);

  const prod = result.environments.find((env) => env.environment === 'prod');
  assert.match(prod!.deploymentYaml, /replicas: 3/);
  assert.match(prod!.ingressYaml ?? '', /host: my-app.example.com/);

  assert.match(result.applicationSetYaml, /kind: ApplicationSet/);
  assert.match(result.applicationSetYaml, /repoURL: https:\/\/gitlab.example.com\/platform\/gitops.git/);
  assert.match(result.applicationSetYaml, /- env: dev/);
  assert.match(result.applicationSetYaml, /- env: prod/);
});

test('rejects invalid application names', () => {
  assert.throws(() => generateDeploymentManifests({ appName: 'My_App', image: 'img', port: 80, environments: [{ name: 'dev' }] }));
});

test('rejects invalid ports', () => {
  assert.throws(() => generateDeploymentManifests({ appName: 'app', image: 'img', port: 0, environments: [{ name: 'dev' }] }));
  assert.throws(() => generateDeploymentManifests({ appName: 'app', image: 'img', port: 70000, environments: [{ name: 'dev' }] }));
});

test('requires at least one environment', () => {
  assert.throws(() => generateDeploymentManifests({ appName: 'app', image: 'img', port: 80, environments: [] }));
});
