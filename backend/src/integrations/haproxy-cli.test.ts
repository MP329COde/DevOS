import assert from 'node:assert/strict';
import test from 'node:test';

import { buildClientFromEnv, runHAProxyCli } from './haproxy-cli.js';
import { HAProxyClient } from './haproxy.js';

test('refuses to build a client without HAPROXY_DATA_PLANE_URL/USERNAME/PASSWORD set', () => {
  assert.throws(() => buildClientFromEnv({}), /must be set \(never hardcode them\)/);
});

test('builds a client from environment variables only, never a hardcoded URL', () => {
  const client = buildClientFromEnv({ HAPROXY_DATA_PLANE_URL: 'https://haproxy.internal:5555', HAPROXY_USERNAME: 'admin', HAPROXY_PASSWORD: 'secret' });
  assert.ok(client instanceof HAProxyClient);
});

test('list-backends prints the JSON result', async () => {
  const client = new HAProxyClient({ baseUrl: 'https://haproxy.test', credentials: { username: 'a', password: 'b' }, fetchImpl: async () => new Response(JSON.stringify([{ name: 'web-backend' }]), { status: 200 }) });
  const lines: string[] = [];
  await runHAProxyCli(['list-backends'], client, (message) => lines.push(message));
  assert.deepEqual(JSON.parse(lines[0]), [{ name: 'web-backend' }]);
});

test('add-server requires all four arguments', async () => {
  const client = new HAProxyClient({ baseUrl: 'https://haproxy.test', credentials: { username: 'a', password: 'b' } });
  await assert.rejects(() => runHAProxyCli(['add-server', 'web-backend'], client), /Usage: add-server/);
});

test('rejects an unknown command', async () => {
  const client = new HAProxyClient({ baseUrl: 'https://haproxy.test', credentials: { username: 'a', password: 'b' } });
  await assert.rejects(() => runHAProxyCli(['bogus'], client), /Unknown command: bogus/);
});
