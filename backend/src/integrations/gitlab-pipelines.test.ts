import assert from 'node:assert/strict';
import test from 'node:test';

import { getJobLog, getPipeline, listPipelineJobs, listProjectPipelines, listRunningPipelines, retryPipeline } from './gitlab-pipelines.js';

function tokenProvider(token = 'gitlab-token') {
  return { getToken: async () => token };
}

test('requests running pipelines for the given project', async () => {
  let requestedUrl = '';
  await listRunningPipelines(
    {
      baseUrl: 'https://gitlab.test/api/v4',
      tokenProvider: tokenProvider(),
      fetchImpl: async (input) => {
        requestedUrl = String(input);
        return new Response('[]', { status: 200 });
      },
    },
    'group/project',
  );
  assert.equal(requestedUrl, 'https://gitlab.test/api/v4/projects/group%2Fproject/pipelines?status=running');
});

test('sends the private-token header', async () => {
  let receivedToken: string | null = null;
  await listRunningPipelines(
    {
      baseUrl: 'https://gitlab.test/api/v4',
      tokenProvider: tokenProvider('secret-token'),
      fetchImpl: async (_input, init) => {
        receivedToken = new Headers(init?.headers).get('private-token');
        return new Response('[]', { status: 200 });
      },
    },
    'group/project',
  );
  assert.equal(receivedToken, 'secret-token');
});

test('maps pipeline fields from the GitLab response', async () => {
  const pipelines = await listRunningPipelines(
    {
      baseUrl: 'https://gitlab.test/api/v4',
      tokenProvider: tokenProvider(),
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            { id: 42, status: 'running', ref: 'main', web_url: 'https://gitlab.test/group/project/-/pipelines/42' },
          ]),
          { status: 200 },
        ),
    },
    'group/project',
  );
  assert.deepEqual(pipelines, [
    { id: 42, status: 'running', ref: 'main', web_url: 'https://gitlab.test/group/project/-/pipelines/42' },
  ]);
});

test('returns an empty array when there are no running pipelines', async () => {
  const pipelines = await listRunningPipelines(
    {
      baseUrl: 'https://gitlab.test/api/v4',
      tokenProvider: tokenProvider(),
      fetchImpl: async () => new Response('[]', { status: 200 }),
    },
    'group/project',
  );
  assert.deepEqual(pipelines, []);
});

test('rejects failed GitLab API responses', async () => {
  await assert.rejects(
    () =>
      listRunningPipelines(
        {
          baseUrl: 'https://gitlab.test/api/v4',
          tokenProvider: tokenProvider(),
          fetchImpl: async () => new Response('{}', { status: 500 }),
        },
        'group/project',
      ),
    /failed \(500\)/,
  );
});

test('listProjectPipelines maps pipeline detail fields and fetches commit titles', async () => {
  const calls: string[] = [];
  const pipelines = await listProjectPipelines(
    {
      baseUrl: 'https://gitlab.test/api/v4',
      tokenProvider: tokenProvider(),
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.includes('/pipelines?')) {
          return new Response(
            JSON.stringify([
              { id: 7, status: 'success', ref: 'main', sha: 'abc123', web_url: 'https://gitlab.test/p/-/pipelines/7', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:05:00Z', duration: 300, user: { name: 'Alice' } },
            ]),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ title: 'fix: bug' }), { status: 200 });
      },
    },
    'group/project',
  );
  assert.deepEqual(pipelines, [
    { id: 7, status: 'success', ref: 'main', sha: 'abc123', webUrl: 'https://gitlab.test/p/-/pipelines/7', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:05:00Z', durationSeconds: 300, authorName: 'Alice', commitTitle: 'fix: bug' },
  ]);
  assert.ok(calls.some((c) => c.includes('/pipelines?per_page=20')));
});

test('getPipeline maps a single pipeline', async () => {
  const pipeline = await getPipeline(
    {
      baseUrl: 'https://gitlab.test/api/v4',
      tokenProvider: tokenProvider(),
      fetchImpl: async () => new Response(JSON.stringify({ id: 9, status: 'failed', ref: 'dev', sha: 'zzz', web_url: 'u', created_at: 'c', updated_at: 'u2', duration: 12, user: { name: 'Bob' } }), { status: 200 }),
    },
    'group/project',
    9,
  );
  assert.equal(pipeline.id, 9);
  assert.equal(pipeline.authorName, 'Bob');
});

test('listPipelineJobs maps job fields', async () => {
  const jobs = await listPipelineJobs(
    {
      baseUrl: 'https://gitlab.test/api/v4',
      tokenProvider: tokenProvider(),
      fetchImpl: async () => new Response(JSON.stringify([{ id: 1, name: 'build', stage: 'build', status: 'success', duration: 30, web_url: 'u', artifacts: [{ file_type: 'archive' }] }]), { status: 200 }),
    },
    'group/project',
    9,
  );
  assert.deepEqual(jobs, [{ id: 1, name: 'build', stage: 'build', status: 'success', durationSeconds: 30, webUrl: 'u', hasArtifacts: true }]);
});

test('getJobLog returns raw text', async () => {
  const log = await getJobLog(
    {
      baseUrl: 'https://gitlab.test/api/v4',
      tokenProvider: tokenProvider(),
      fetchImpl: async () => new Response('line1\nline2', { status: 200 }),
    },
    'group/project',
    1,
  );
  assert.equal(log, 'line1\nline2');
});

test('retryPipeline posts to the retry endpoint then refetches the pipeline', async () => {
  const methods: string[] = [];
  const pipeline = await retryPipeline(
    {
      baseUrl: 'https://gitlab.test/api/v4',
      tokenProvider: tokenProvider(),
      fetchImpl: async (input, init) => {
        methods.push(`${init?.method ?? 'GET'} ${String(input)}`);
        if (String(input).includes('/retry')) return new Response('{}', { status: 201 });
        return new Response(JSON.stringify({ id: 9, status: 'running', ref: 'main', sha: 's', web_url: 'u', created_at: 'c', updated_at: 'u2', duration: null, user: null }), { status: 200 });
      },
    },
    'group/project',
    9,
  );
  assert.equal(pipeline.status, 'running');
  assert.ok(methods.some((m) => m.startsWith('POST') && m.includes('/retry')));
});
