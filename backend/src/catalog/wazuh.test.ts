import assert from 'node:assert/strict';
import test from 'node:test';

import { WazuhClient } from './wazuh.js';

function client(fetchImpl: typeof fetch) {
  return new WazuhClient({ baseUrl: 'https://wazuh.test:55000', token: 'jwt-token', fetchImpl });
}

test('sends the bearer token on every request', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response(JSON.stringify({ data: { affected_items: [] } }), { status: 200 }); }).listAlerts();
  assert.equal(receivedAuth, 'Bearer jwt-token');
});

test('lists alerts and maps rule fields', async () => {
  let requestedUrl = '';
  const alerts = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      data: { affected_items: [{ id: 'a1', rule: { description: 'SSH brute force', level: 10 }, timestamp: '2026-09-03T12:00:00Z' }] },
    }), { status: 200 });
  }).listAlerts();
  assert.equal(requestedUrl, 'https://wazuh.test:55000/security/alerts');
  assert.deepEqual(alerts, [{ id: 'a1', ruleDescription: 'SSH brute force', level: 10, timestamp: '2026-09-03T12:00:00Z' }]);
});

test('applies the limit query parameter when provided', async () => {
  let requestedUrl = '';
  await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: { affected_items: [] } }), { status: 200 });
  }).listAlerts(50);
  assert.equal(requestedUrl, 'https://wazuh.test:55000/security/alerts?limit=50');
});

test('rejects failed Wazuh API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 403 })).listAlerts(), /failed \(403\)/);
});
