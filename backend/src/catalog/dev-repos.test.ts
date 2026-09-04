import assert from 'node:assert/strict';
import test from 'node:test';

import { GitHubClient } from '../integrations/github.js';
import { GitLabClient } from '../integrations/gitlab.js';
import { getDevRepoDetail, listDevRepoBranches, listDevRepos, type DevReposConfig } from './dev-repos.js';

function fakeGitLabClient(): GitLabClient {
  return new GitLabClient({
    baseUrl: 'http://mock',
    tokenProvider: { async getToken() { return 'demo'; } },
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/projects/1')) return jsonResponse({ id: 1, path_with_namespace: 'grp/devos', default_branch: 'main', web_url: 'http://mock/grp/devos', last_activity_at: '2026-08-01T00:00:00Z' });
      if (url.includes('/repository/branches')) return jsonResponse([
        { name: 'main', protected: true, default: true, merged: false, commit: { id: 'a1', committed_date: '2026-08-01T00:00:00Z' } },
        { name: 'feature/x', protected: false, default: false, merged: false, commit: { id: 'b2', committed_date: '2025-01-01T00:00:00Z' } },
      ]);
      if (url.includes('/repository/commits')) return jsonResponse([{ id: 'a1', short_id: 'a1', title: 'Initial', author_name: 'Ada', committed_date: '2026-08-01T00:00:00Z' }]);
      if (url.includes('/releases')) return jsonResponse([{ tag_name: 'v1.0.0', name: 'v1.0.0', released_at: '2026-07-15T00:00:00Z' }]);
      if (url.includes('/pipelines')) return jsonResponse([{ id: 9, status: 'success', ref: 'main', web_url: 'http://mock/pipe/9', updated_at: '2026-08-01T01:00:00Z' }]);
      if (url.includes('/merge_requests')) return jsonResponse([]);
      if (url.includes('/repository/compare')) return jsonResponse({ commits: [] });
      throw new Error(`unmocked GitLab URL: ${url}`);
    }) as typeof fetch,
  });
}

function fakeGitHubClient(): GitHubClient {
  return new GitHubClient({
    baseUrl: 'http://mock',
    token: 'demo',
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/repos/acme/app')) return jsonResponse({ full_name: 'acme/app', html_url: 'http://mock/acme/app', default_branch: 'main', pushed_at: '2026-08-02T00:00:00Z' });
      if (url.includes('/branches')) return jsonResponse([{ name: 'main', protected: true, commit: { sha: 'aaa' } }]);
      if (url.includes('/commits')) return jsonResponse([{ sha: 'aaa', commit: { message: 'Init', author: { name: 'Bob', date: '2026-08-02T00:00:00Z' } } }]);
      if (url.includes('/releases')) return jsonResponse([]);
      if (url.includes('/actions/runs')) return jsonResponse({ workflow_runs: [] });
      if (url.includes('/pulls')) return jsonResponse([]);
      throw new Error(`unmocked GitHub URL: ${url}`);
    }) as typeof fetch,
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('listDevRepos merges GitLab and GitHub summaries into one unified shape', async () => {
  const config: DevReposConfig = {
    gitlab: { client: fakeGitLabClient(), projectId: '1' },
    github: { client: fakeGitHubClient(), repos: ['acme/app'] },
  };
  const repos = await listDevRepos(config);
  assert.equal(repos.length, 2);
  const gitlab = repos.find((r) => r.provider === 'gitlab')!;
  assert.equal(gitlab.name, 'grp/devos');
  assert.equal(gitlab.branchCount, 2);
  assert.equal(gitlab.pipeline?.status, 'success');
  assert.equal(gitlab.latestRelease?.tag, 'v1.0.0');
  const github = repos.find((r) => r.provider === 'github')!;
  assert.equal(github.name, 'acme/app');
  assert.equal(github.lastCommit?.author, 'Bob');
});

test('getDevRepoDetail rejects an unknown repo id', async () => {
  const config: DevReposConfig = { gitlab: { client: fakeGitLabClient(), projectId: '1' } };
  await assert.rejects(() => getDevRepoDetail(config, 'gitlab', '999'));
});

test('listDevRepoBranches marks the default branch and flags a stale non-default branch', async () => {
  const config: DevReposConfig = { gitlab: { client: fakeGitLabClient(), projectId: '1' } };
  const branches = await listDevRepoBranches(config, 'gitlab', '1');
  const main = branches.find((b) => b.name === 'main')!;
  const feature = branches.find((b) => b.name === 'feature/x')!;
  assert.equal(main.default, true);
  assert.equal(main.merged, null);
  assert.equal(feature.default, false);
  assert.equal(feature.stale, true);
});
