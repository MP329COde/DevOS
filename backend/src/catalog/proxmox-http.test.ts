import assert from 'node:assert/strict';
import test from 'node:test';

import { handleProxmoxRequest } from './proxmox-http.js';

test('rejects a VM action without a role', async () => {
  const result = await handleProxmoxRequest('POST', '/api/proxmox/nodes/pve1/vms/100/start', { confirm: true }, undefined, { async controlVirtualMachine() {} });
  assert.equal(result.status, 400);
});

test('rejects a VM action for a non-admin role', async () => {
  const result = await handleProxmoxRequest('POST', '/api/proxmox/nodes/pve1/vms/100/start', { confirm: true }, 'Contributeur', { async controlVirtualMachine() {} });
  assert.equal(result.status, 400);
});

test('rejects a VM action missing explicit confirmation', async () => {
  const result = await handleProxmoxRequest('POST', '/api/proxmox/nodes/pve1/vms/100/shutdown', {}, 'Admin', { async controlVirtualMachine() {} });
  assert.equal(result.status, 409);
});

test('rejects a VM action with confirm set to a truthy non-boolean', async () => {
  const result = await handleProxmoxRequest('POST', '/api/proxmox/nodes/pve1/vms/100/shutdown', { confirm: 'yes' }, 'Admin', { async controlVirtualMachine() {} });
  assert.equal(result.status, 409);
});

test('allows an admin to start a VM once confirmed', async () => {
  let received: unknown;
  const service = { async controlVirtualMachine(node: string, vmid: number, action: string) { received = { node, vmid, action }; } };
  const result = await handleProxmoxRequest('POST', '/api/proxmox/nodes/pve1/vms/100/start', { confirm: true }, 'Admin', service);
  assert.equal(result.status, 202);
  assert.deepEqual(received, { node: 'pve1', vmid: 100, action: 'start' });
});

test('allows an admin to reboot a VM once confirmed', async () => {
  let received: unknown;
  const service = { async controlVirtualMachine(node: string, vmid: number, action: string) { received = { node, vmid, action }; } };
  const result = await handleProxmoxRequest('POST', '/api/proxmox/nodes/pve1/vms/100/reboot', { confirm: true }, 'Admin', service);
  assert.equal(result.status, 202);
  assert.deepEqual(received, { node: 'pve1', vmid: 100, action: 'reboot' });
});

test('rejects an unknown route', async () => {
  const result = await handleProxmoxRequest('GET', '/api/proxmox/nodes/pve1/vms', null, 'Admin', { async controlVirtualMachine() {} });
  assert.equal(result.status, 404);
});
