import assert from 'node:assert/strict';
import test from 'node:test';

import { scanCatalogFromGitLab } from './catalog-scan.js';

function gitlab(projects: Array<{ path_with_namespace: string; default_branch: string | null }>, files: Record<string, string | null>) {
  return {
    async *listProjects() { for (const project of projects) yield { id: 1, ...project }; },
    async getRawFile(projectId: string) {
      if (projectId in files) return files[projectId];
      throw new Error(`unexpected project ${projectId}`);
    },
  };
}

test('collects entities from every project that has a catalog-info.yaml', async () => {
  const result = await scanCatalogFromGitLab(gitlab(
    [{ path_with_namespace: 'root/a', default_branch: 'main' }, { path_with_namespace: 'root/b', default_branch: 'main' }],
    {
      'root/a': 'apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: a\nspec:\n  type: service\n  lifecycle: production\n  owner: user:default/x\n',
      'root/b': null,
    },
  ));
  assert.equal(result.entities.length, 1);
  assert.equal(result.entities[0].metadata.name, 'a');
  assert.equal(result.entities[0].sourceProject, 'root/a');
  assert.deepEqual(result.errors, []);
});

test('reports a parse failure without aborting the rest of the scan', async () => {
  const result = await scanCatalogFromGitLab(gitlab(
    [{ path_with_namespace: 'root/broken', default_branch: 'main' }, { path_with_namespace: 'root/ok', default_branch: 'main' }],
    {
      'root/broken': 'apiVersion: [unclosed',
      'root/ok': 'apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: ok\nspec:\n  type: service\n  lifecycle: production\n  owner: user:default/x\n',
    },
  ));
  assert.equal(result.entities.length, 1);
  assert.equal(result.entities[0].metadata.name, 'ok');
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].project, 'root/broken');
});

test('falls back to HEAD when a project has no default branch', async () => {
  let requestedRef: unknown;
  const result = await scanCatalogFromGitLab({
    async *listProjects() { yield { id: 1, path_with_namespace: 'root/a', default_branch: null }; },
    async getRawFile(_projectId: string, _path: string, ref: string) { requestedRef = ref; return null; },
  });
  assert.equal(requestedRef, 'HEAD');
  assert.deepEqual(result.entities, []);
});

test('records a read failure as an error rather than throwing', async () => {
  const result = await scanCatalogFromGitLab({
    async *listProjects() { yield { id: 1, path_with_namespace: 'root/a', default_branch: 'main' }; },
    async getRawFile() { throw new Error('GitLab API request failed (500)'); },
  });
  assert.deepEqual(result.entities, []);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /failed \(500\)/);
});
