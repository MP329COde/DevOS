import assert from 'node:assert/strict';
import test from 'node:test';

import { ProxmoxClient } from './proxmox.js';

function client(fetchImpl: typeof fetch) {
  return new ProxmoxClient({ baseUrl: 'https://pve.test:8006', apiToken: 'root@pam!devos=secret-uuid', fetchImpl });
}

test('sends the PVEAPIToken authorization header on every request', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response(JSON.stringify({ data: [] }), { status: 200 }); }).listNodes();
  assert.equal(receivedAuth, 'PVEAPIToken=root@pam!devos=secret-uuid');
});

test('lists nodes with status, cpu and mem', async () => {
  let requestedUrl = '';
  const nodes = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [{ node: 'pve1', status: 'online', cpu: 0.12, mem: 4096 }] }), { status: 200 });
  }).listNodes();
  assert.equal(requestedUrl, 'https://pve.test:8006/api2/json/nodes');
  assert.deepEqual(nodes, [{ id: 'pve1', status: 'online', cpu: 0.12, mem: 4096 }]);
});

test('lists virtual machines for a node', async () => {
  let requestedUrl = '';
  const vms = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [{ vmid: 100, name: 'devos-vm', status: 'running' }] }), { status: 200 });
  }).listVirtualMachines('pve1');
  assert.equal(requestedUrl, 'https://pve.test:8006/api2/json/nodes/pve1/qemu');
  assert.deepEqual(vms, [{ vmid: 100, name: 'devos-vm', status: 'running' }]);
});

test('lists containers for a node', async () => {
  let requestedUrl = '';
  const containers = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [{ vmid: 200, name: 'devos-lxc', status: 'stopped' }] }), { status: 200 });
  }).listContainers('pve1');
  assert.equal(requestedUrl, 'https://pve.test:8006/api2/json/nodes/pve1/lxc');
  assert.deepEqual(containers, [{ vmid: 200, name: 'devos-lxc', status: 'stopped' }]);
});

test('rejects failed Proxmox API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 401 })).listNodes(), /failed \(401\)/);
});

