import assert from 'node:assert/strict';
import test from 'node:test';

import { listRunningPipelines } from './gitlab-pipelines.js';

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
