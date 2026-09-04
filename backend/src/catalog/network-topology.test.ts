import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNetworkTopology } from './network-topology.js';

test('builds host -> VM edges and matches VMs to DNS A records by name', () => {
  const graph = buildNetworkTopology({
    proxmoxNodes: [{ id: 'pve1', status: 'online' }],
    proxmoxVMsByNode: {
      pve1: [{ vmid: 100, name: 'gitlab', status: 'running' }],
    },
    dnsRecords: [
      { name: 'gitlab.home.arpa.', type: 'A', records: ['10.0.0.10'] },
      { name: 'mail.home.arpa.', type: 'A', records: ['10.0.0.20'] },
    ],
  });

  const ids = graph.nodes.map((n) => n.id).sort();
  assert.deepEqual(ids, ['dns-record:gitlab.home.arpa.', 'proxmox-host:pve1', 'proxmox-vm:pve1/100']);

  assert.deepEqual(
    graph.edges,
    [
      { from: 'proxmox-host:pve1', to: 'proxmox-vm:pve1/100' },
      { from: 'proxmox-vm:pve1/100', to: 'dns-record:gitlab.home.arpa.' },
    ],
  );
});

test('groups VMs under their host via the cluster field', () => {
  const graph = buildNetworkTopology({
    proxmoxNodes: [{ id: 'pve1', status: 'online' }],
    proxmoxVMsByNode: { pve1: [{ vmid: 100, name: 'app', status: 'running' }] },
    dnsRecords: [],
  });

  const vm = graph.nodes.find((n) => n.kind === 'proxmox-vm');
  assert.equal(vm?.cluster, 'proxmox-host:pve1');
});

test('leaves a VM without a matching DNS record as a standalone node', () => {
  const graph = buildNetworkTopology({
    proxmoxNodes: [{ id: 'pve1', status: 'online' }],
    proxmoxVMsByNode: { pve1: [{ vmid: 100, name: 'unmatched', status: 'running' }] },
    dnsRecords: [{ name: 'other.home.arpa.', type: 'A', records: ['10.0.0.1'] }],
  });

  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
});

test('ignores non-address DNS record types (CNAME, MX, ...)', () => {
  const graph = buildNetworkTopology({
    proxmoxNodes: [{ id: 'pve1', status: 'online' }],
    proxmoxVMsByNode: { pve1: [{ vmid: 100, name: 'gitlab', status: 'running' }] },
    dnsRecords: [{ name: 'gitlab.home.arpa.', type: 'CNAME', records: ['alias.home.arpa.'] }],
  });

  assert.equal(graph.nodes.some((n) => n.kind === 'dns-record'), false);
});
