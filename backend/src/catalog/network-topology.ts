export interface NetworkTopologyNode {
  id: string;
  kind: 'proxmox-host' | 'proxmox-vm' | 'dns-record';
  label: string;
  /** Cluster grouping key: the Proxmox host id for hosts and their VMs, absent for unmatched DNS records. */
  cluster?: string;
  meta?: Record<string, string>;
}

export interface NetworkTopologyEdge {
  from: string;
  to: string;
}

export interface NetworkTopologyGraph {
  nodes: NetworkTopologyNode[];
  edges: NetworkTopologyEdge[];
}

export interface TopologyProxmoxNode {
  id: string;
  status: string;
}

export interface TopologyProxmoxVM {
  vmid: number;
  name: string;
  status: string;
}

export interface TopologyDnsRecord {
  name: string;
  type: string;
  records: string[];
}

export interface NetworkTopologyInput {
  proxmoxNodes: readonly TopologyProxmoxNode[];
  proxmoxVMsByNode: Readonly<Record<string, readonly TopologyProxmoxVM[]>>;
  dnsRecords: readonly TopologyDnsRecord[];
}

/**
 * Combines Proxmox (host → VM) and DNS (A/AAAA record) data into a single graph, matching
 * VMs to DNS records by name (best-effort: the VM name must equal or prefix the first DNS
 * label, case-insensitive). Certificate data is intentionally omitted — no integration in
 * this codebase currently exposes certificate expiry/authority for these nodes.
 */
export function buildNetworkTopology(input: NetworkTopologyInput): NetworkTopologyGraph {
  const nodes: NetworkTopologyNode[] = [];
  const edges: NetworkTopologyEdge[] = [];

  const addressRecords = input.dnsRecords.filter((record) => record.type === 'A' || record.type === 'AAAA');

  for (const host of input.proxmoxNodes) {
    const hostId = `proxmox-host:${host.id}`;
    nodes.push({ id: hostId, kind: 'proxmox-host', label: host.id, cluster: hostId, meta: { status: host.status } });

    for (const vm of input.proxmoxVMsByNode[host.id] ?? []) {
      const vmId = `proxmox-vm:${host.id}/${vm.vmid}`;
      nodes.push({ id: vmId, kind: 'proxmox-vm', label: vm.name, cluster: hostId, meta: { status: vm.status, vmid: String(vm.vmid) } });
      edges.push({ from: hostId, to: vmId });

      const match = addressRecords.find((record) => matchesVmName(record.name, vm.name));
      if (match) {
        const dnsId = `dns-record:${match.name}`;
        if (!nodes.some((n) => n.id === dnsId)) {
          nodes.push({ id: dnsId, kind: 'dns-record', label: match.name, meta: { type: match.type, addresses: match.records.join(', ') } });
        }
        edges.push({ from: vmId, to: dnsId });
      }
    }
  }

  return { nodes, edges };
}

function matchesVmName(dnsName: string, vmName: string): boolean {
  const firstLabel = dnsName.replace(/\.$/, '').split('.')[0]?.toLowerCase() ?? '';
  return firstLabel === vmName.toLowerCase() || firstLabel.startsWith(vmName.toLowerCase());
}
