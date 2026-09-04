import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEmbedUrl, GrafanaClient } from './grafana.js';

function client(fetchImpl: typeof fetch) {
  return new GrafanaClient({ baseUrl: 'https://grafana.test', apiKey: 'api-key-1', fetchImpl });
}

test('sends the Grafana API key as a bearer token', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response('[]', { status: 200 }); }).listDashboards();
  assert.equal(receivedAuth, 'Bearer api-key-1');
});

test('lists dashboards from the search endpoint', async () => {
  let requestedUrl = '';
  const dashboards = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([{ uid: 'd1', title: 'Homelab overview', url: '/d/d1/homelab-overview' }]), { status: 200 });
  }).listDashboards();
  assert.equal(requestedUrl, 'https://grafana.test/api/search?type=dash-db');
  assert.deepEqual(dashboards, [{ uid: 'd1', title: 'Homelab overview', url: '/d/d1/homelab-overview' }]);
});

test('reads a dashboard by uid with its panels', async () => {
  let requestedUrl = '';
  const dashboard = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({ dashboard: { uid: 'd1', title: 'Homelab overview', panels: [{ id: 2, title: 'CPU', type: 'timeseries' }] } }),
      { status: 200 },
    );
  }).getDashboard('d1');
  assert.equal(requestedUrl, 'https://grafana.test/api/dashboards/uid/d1');
  assert.deepEqual(dashboard, { uid: 'd1', title: 'Homelab overview', panels: [{ id: 2, title: 'CPU', type: 'timeseries' }] });
});

test('defaults panels to an empty array when the dashboard has none', async () => {
  const dashboard = await client(async () => new Response(JSON.stringify({ dashboard: { uid: 'd2', title: 'Empty' } }), { status: 200 })).getDashboard('d2');
  assert.deepEqual(dashboard.panels, []);
});

test('rejects failed Grafana API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 401 })).listDashboards(), /failed \(401\)/);
});

test('builds a d-solo embed URL with panel id and default light theme', () => {
  const url = buildEmbedUrl('https://grafana.test', 'd1', 2);
  assert.equal(url, 'https://grafana.test/d-solo/d1?panelId=2&theme=light');
});

test('builds a d-solo embed URL honoring an explicit dark theme', () => {
  const url = buildEmbedUrl('https://grafana.test', 'd1', 2, { theme: 'dark' });
  assert.equal(url, 'https://grafana.test/d-solo/d1?panelId=2&theme=dark');
});
