import assert from 'node:assert/strict';
import test from 'node:test';

import { HAProxyClient } from './haproxy.js';

function client(fetchImpl: typeof fetch) {
  return new HAProxyClient({ baseUrl: 'https://haproxy.test:5555', credentials: { username: 'admin', password: 'secret' }, fetchImpl });
}

test('sends basic auth built from the configured credentials', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response('[]', { status: 200 }); }).listBackends();
  assert.equal(receivedAuth, `Basic ${Buffer.from('admin:secret').toString('base64')}`);
});

test('lists backends from the configuration endpoint', async () => {
  const backends = await client(async () => new Response(JSON.stringify([{ name: 'web-backend', mode: 'http' }]), { status: 200 })).listBackends();
  assert.deepEqual(backends, [{ name: 'web-backend', mode: 'http' }]);
});

test('lists servers scoped to a backend', async () => {
  let requestedUrl = '';
  const servers = await client(async (input) => { requestedUrl = String(input); return new Response(JSON.stringify([{ name: 'srv1', address: '10.0.0.1', port: 8080 }]), { status: 200 }); }).listServers('web-backend');
  assert.equal(requestedUrl, 'https://haproxy.test:5555/v3/services/haproxy/configuration/servers?backend=web-backend');
  assert.deepEqual(servers, [{ name: 'srv1', address: '10.0.0.1', port: 8080 }]);
});

test('reads the configuration version before adding a server, and includes it in the write', async () => {
  const calls: string[] = [];
  await client(async (input) => {
    calls.push(String(input));
    if (String(input).endsWith('/version')) return new Response('7', { status: 200 });
    return new Response('{}', { status: 200 });
  }).addServer('web-backend', { name: 'srv2', address: '10.0.0.2', port: 8081 });
  assert.equal(calls[0], 'https://haproxy.test:5555/v3/services/haproxy/configuration/version');
  assert.equal(calls[1], 'https://haproxy.test:5555/v3/services/haproxy/configuration/servers?backend=web-backend&version=7');
});

test('rejects a non-numeric configuration version', async () => {
  await assert.rejects(() => client(async () => new Response('not-a-number', { status: 200 })).getVersion(), /invalid configuration version/);
});

test('rejects failed Data Plane API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 401 })).listBackends(), /failed \(401\)/);
});

test('triggers a reload via the reloads endpoint', async () => {
  let calledUrl = '';
  let calledMethod = '';
  await client(async (input, init) => { calledUrl = String(input); calledMethod = init?.method ?? 'GET'; return new Response('{}', { status: 200 }); }).reload();
  assert.equal(calledUrl, 'https://haproxy.test:5555/v3/services/haproxy/reloads');
  assert.equal(calledMethod, 'POST');
});

test('lists ACL rules for a frontend', async () => {
  let requestedUrl = '';
  const acls = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([{ index: 0, acl_name: 'is_api', criterion: 'path_beg', value: '/api' }]), { status: 200 });
  }).listAcls('frontend', 'main-frontend');
  assert.equal(requestedUrl, 'https://haproxy.test:5555/v3/services/haproxy/configuration/acl?parent_type=frontend&parent_name=main-frontend');
  assert.deepEqual(acls, [{ index: 0, aclName: 'is_api', criterion: 'path_beg', value: '/api' }]);
});

test('reads the configuration version before adding an ACL, and includes it in the write', async () => {
  const calls: string[] = [];
  await client(async (input) => {
    calls.push(String(input));
    if (String(input).endsWith('/version')) return new Response('9', { status: 200 });
    return new Response('{}', { status: 200 });
  }).addAcl('frontend', 'main-frontend', { aclName: 'is_api', criterion: 'path_beg', value: '/api' });
  assert.equal(calls[0], 'https://haproxy.test:5555/v3/services/haproxy/configuration/version');
  assert.equal(calls[1], 'https://haproxy.test:5555/v3/services/haproxy/configuration/acl?parent_type=frontend&parent_name=main-frontend&version=9');
});

test('deletes an ACL rule by index, versioned', async () => {
  const calls: string[] = [];
  await client(async (input) => {
    calls.push(String(input));
    if (String(input).endsWith('/version')) return new Response('4', { status: 200 });
    return new Response('{}', { status: 200 });
  }).deleteAcl('frontend', 'main-frontend', 0);
  assert.equal(calls[1], 'https://haproxy.test:5555/v3/services/haproxy/configuration/acl/0?parent_type=frontend&parent_name=main-frontend&version=4');
});

test('lists stored TLS certificates', async () => {
  const certs = await client(async () => new Response(JSON.stringify([{ storage_name: 'coder-mpcode.duckdns.org.pem', description: 'Coder' }]), { status: 200 })).listCertificates();
  assert.deepEqual(certs, [{ storageName: 'coder-mpcode.duckdns.org.pem', description: 'Coder' }]);
});
