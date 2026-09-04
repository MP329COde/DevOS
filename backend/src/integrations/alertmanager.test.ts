import assert from 'node:assert/strict';
import test from 'node:test';

import { AlertmanagerClient } from './alertmanager.js';

function client(fetchImpl: typeof fetch) {
  return new AlertmanagerClient({ baseUrl: 'https://alertmanager.test', fetchImpl });
}

test('requests the active alerts endpoint', async () => {
  let requestedUrl = '';
  await client(async (input) => {
    requestedUrl = String(input);
    return new Response('[]', { status: 200 });
  }).listActiveAlerts();
  assert.equal(requestedUrl, 'https://alertmanager.test/api/v2/alerts?active=true');
});

test('maps alert fields from the Alertmanager v2 response', async () => {
  const alerts = await client(
    async () =>
      new Response(
        JSON.stringify([
          {
            fingerprint: 'abc123',
            labels: { alertname: 'HighCPU', severity: 'critical' },
            status: { state: 'active' },
            startsAt: '2026-09-03T10:00:00Z',
          },
        ]),
        { status: 200 },
      ),
  ).listActiveAlerts();
  assert.deepEqual(alerts, [
    {
      fingerprint: 'abc123',
      labels: { alertname: 'HighCPU', severity: 'critical' },
      status: { state: 'active' },
      startsAt: '2026-09-03T10:00:00Z',
    },
  ]);
});

test('returns an empty array when there are no active alerts', async () => {
  const alerts = await client(async () => new Response('[]', { status: 200 })).listActiveAlerts();
  assert.deepEqual(alerts, []);
});

test('defaults labels and state when missing from the response', async () => {
  const alerts = await client(
    async () =>
      new Response(JSON.stringify([{ fingerprint: 'xyz', startsAt: '2026-09-03T10:00:00Z' }]), { status: 200 }),
  ).listActiveAlerts();
  assert.deepEqual(alerts, [{ fingerprint: 'xyz', labels: {}, status: { state: 'active' }, startsAt: '2026-09-03T10:00:00Z' }]);
});

test('rejects failed Alertmanager API responses', async () => {
  await assert.rejects(
    () => client(async () => new Response('{}', { status: 503 })).listActiveAlerts(),
    /failed \(503\)/,
  );
});
