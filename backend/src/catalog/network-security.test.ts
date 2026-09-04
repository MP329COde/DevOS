import assert from 'node:assert/strict';
import test from 'node:test';

import { SuricataClient, summarizeWireGuardMetrics } from './network-security.js';

test('counts distinct WireGuard peer handshake series', () => {
  const metrics = new Map([
    ['wireguard_peer_last_handshake_seconds{public_key="a"}', 1710000000],
    ['wireguard_peer_last_handshake_seconds{public_key="b"}', 1710000100],
  ]);
  const summary = summarizeWireGuardMetrics(metrics);
  assert.equal(summary.peerCount, 2);
});

test('returns zero peer count when no metrics are present', () => {
  const summary = summarizeWireGuardMetrics(new Map());
  assert.equal(summary.peerCount, 0);
});

test('ignores unrelated metrics when counting WireGuard peers', () => {
  const metrics = new Map([
    ['wireguard_peer_last_handshake_seconds{public_key="a"}', 1710000000],
    ['node_filesystem_free_bytes{mountpoint="/"}', 500],
  ]);
  const summary = summarizeWireGuardMetrics(metrics);
  assert.equal(summary.peerCount, 1);
});

test('SuricataClient reads alert count from the stats endpoint', async () => {
  let requestedUrl = '';
  const client = new SuricataClient({
    baseUrl: 'https://suricata.test',
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ alert: { count: 7 } }), { status: 200 });
    },
  });
  const count = await client.getAlertCount();
  assert.equal(requestedUrl, 'https://suricata.test/stats');
  assert.equal(count, 7);
});

test('SuricataClient defaults alert count to 0 when field is absent', async () => {
  const client = new SuricataClient({
    baseUrl: 'https://suricata.test',
    fetchImpl: async () => new Response(JSON.stringify({}), { status: 200 }),
  });
  const count = await client.getAlertCount();
  assert.equal(count, 0);
});

test('SuricataClient rejects failed stats responses', async () => {
  const client = new SuricataClient({
    baseUrl: 'https://suricata.test',
    fetchImpl: async () => new Response('{}', { status: 500 }),
  });
  await assert.rejects(() => client.getAlertCount(), /failed \(500\)/);
});
