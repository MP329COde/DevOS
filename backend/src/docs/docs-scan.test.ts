import assert from 'node:assert/strict';
import test from 'node:test';

import { scanDocsFromGitLab } from './docs-scan.js';

function gitlab(projects: Array<{ path_with_namespace: string; default_branch: string | null }>, trees: Record<string, Array<{ path: string; type: 'blob' | 'tree' }>>, files: Record<string, string>) {
  return {
    async *listProjects() { for (const project of projects) yield { id: 1, ...project }; },
    async *listRepositoryTree(projectId: string) { for (const entry of trees[projectId] ?? []) yield entry; },
    async getRawFile(projectId: string, path: string) { return files[`${projectId}:${path}`] ?? null; },
  };
}

test('collects markdown pages and derives titles from the first heading', async () => {
  const result = await scanDocsFromGitLab(gitlab(
    [{ path_with_namespace: 'root/a', default_branch: 'main' }],
    { 'root/a': [{ path: 'docs/intro.md', type: 'blob' }, { path: 'docs/assets', type: 'tree' }, { path: 'docs/notes.txt', type: 'blob' }] },
    { 'root/a:docs/intro.md': '# Introduction\n\nBody text.' },
  ));
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].title, 'Introduction');
  assert.equal(result.pages[0].sourceProject, 'root/a');
  assert.deepEqual(result.errors, []);
});

test('falls back to the file name when there is no heading', async () => {
  const result = await scanDocsFromGitLab(gitlab(
    [{ path_with_namespace: 'root/a', default_branch: 'main' }],
    { 'root/a': [{ path: 'docs/no-heading.md', type: 'blob' }] },
    { 'root/a:docs/no-heading.md': 'Just body text.' },
  ));
  assert.equal(result.pages[0].title, 'no-heading');
});

test('skips a project with no docs folder', async () => {
  const result = await scanDocsFromGitLab(gitlab([{ path_with_namespace: 'root/empty', default_branch: 'main' }], {}, {}));
  assert.deepEqual(result.pages, []);
  assert.deepEqual(result.errors, []);
});

test('reports a scan failure without aborting the rest of the scan', async () => {
  const result = await scanDocsFromGitLab({
    async *listProjects() { yield { id: 1, path_with_namespace: 'root/broken', default_branch: 'main' }; yield { id: 2, path_with_namespace: 'root/ok', default_branch: 'main' }; },
    async *listRepositoryTree(projectId: string) {
      if (projectId === 'root/broken') throw new Error('GitLab API request failed (500)');
      yield { path: 'docs/a.md', type: 'blob' as const };
    },
    async getRawFile() { return '# A'; },
  });
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].sourceProject, 'root/ok');
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].project, 'root/broken');
});
