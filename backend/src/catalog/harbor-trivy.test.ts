import assert from 'node:assert/strict';
import test from 'node:test';

import { HarborTrivyClient } from './harbor-trivy.js';

function client(fetchImpl: typeof fetch) {
  return new HarborTrivyClient({ baseUrl: 'https://harbor.test', username: 'robot', password: 'secret', fetchImpl });
}

test('sends basic auth and requests the scan overview', async () => {
  let receivedAuth: string | null = null;
  let requestedUrl = '';
  await client(async (input, init) => {
    requestedUrl = String(input);
    receivedAuth = new Headers(init?.headers).get('authorization');
    return new Response(JSON.stringify({}), { status: 200 });
  }).getVulnerabilitySummary('devos', 'backend', 'latest');
  assert.equal(receivedAuth, `Basic ${Buffer.from('robot:secret').toString('base64')}`);
  assert.equal(requestedUrl, 'https://harbor.test/api/v2.0/projects/devos/repositories/backend/artifacts/latest?with_scan_overview=true');
});

test('summarizes the first scan overview entry', async () => {
  const summary = await client(async () => new Response(JSON.stringify({
    scan_overview: { 'application/vnd.security.vulnerability.report; version=1.1': { scan_status: 'Success', summary: { critical: 1, high: 2, medium: 3, low: 4 } } },
  }), { status: 200 })).getVulnerabilitySummary('devos', 'backend', 'latest');
  assert.deepEqual(summary, { scanStatus: 'Success', critical: 1, high: 2, medium: 3, low: 4 });
});

test('returns null when no scan overview is present yet (stub case)', async () => {
  const summary = await client(async () => new Response(JSON.stringify({}), { status: 200 })).getVulnerabilitySummary('devos', 'backend', 'latest');
  assert.equal(summary, null);
});

test('rejects failed Harbor API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 404 })).getVulnerabilitySummary('devos', 'backend', 'latest'), /failed \(404\)/);
});
