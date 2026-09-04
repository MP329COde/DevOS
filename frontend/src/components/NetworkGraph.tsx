import { useMemo, useRef, useState } from 'react';

export interface NetworkGraphNode {
  id: string;
  kind: 'proxmox-host' | 'proxmox-vm' | 'dns-record';
  label: string;
  cluster?: string;
  meta?: Record<string, string>;
}

export interface NetworkGraphEdge {
  from: string;
  to: string;
}

export interface NetworkGraphProps {
  nodes: NetworkGraphNode[];
  edges: NetworkGraphEdge[];
}

const kindColor: Record<NetworkGraphNode['kind'], string> = {
  'proxmox-host': '#49634c',
  'proxmox-vm': '#a34f31',
  'dns-record': '#667569',
};

const kindLabel: Record<NetworkGraphNode['kind'], string> = {
  'proxmox-host': 'Hôte Proxmox',
  'proxmox-vm': 'VM',
  'dns-record': 'Enregistrement DNS',
};

/** Layout: hosts in a row, their VMs stacked below in a column, DNS records one column further right per VM. */
function layoutNodes(nodes: NetworkGraphNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const hosts = nodes.filter((n) => n.kind === 'proxmox-host');
  const colWidth = 220;
  const rowHeight = 90;

  hosts.forEach((host, hostIndex) => {
    const baseX = hostIndex * colWidth * 2.4 + 140;
    positions.set(host.id, { x: baseX, y: 60 });
    const vms = nodes.filter((n) => n.kind === 'proxmox-vm' && n.cluster === host.id);
    vms.forEach((vm, vmIndex) => {
      const vmY = 60 + (vmIndex + 1) * rowHeight;
      positions.set(vm.id, { x: baseX, y: vmY });
      const dnsNodes = nodes.filter((n) => n.kind === 'dns-record' && positions.has(vm.id));
      // A DNS record is linked to exactly one VM in practice; place it to the right of that VM.
      void dnsNodes;
    });
  });

  // Place DNS records to the right of the VM they are connected to (resolved by caller via edges).
  return positions;
}

export function NetworkGraph({ nodes, edges }: NetworkGraphProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<NetworkGraphNode | null>(null);
  const dragState = useRef<{ x: number; y: number } | null>(null);

  const positions = useMemo(() => {
    const base = layoutNodes(nodes);
    // Position DNS-record nodes next to the VM that has an edge to them.
    for (const edge of edges) {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);
      if (fromNode?.kind === 'proxmox-vm' && toNode?.kind === 'dns-record' && base.has(fromNode.id) && !base.has(toNode.id)) {
        const vmPos = base.get(fromNode.id)!;
        base.set(toNode.id, { x: vmPos.x + 220, y: vmPos.y });
      }
    }
    return base;
  }, [nodes, edges]);

  const clusters = useMemo(() => {
    const groups = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const node of nodes) {
      if (!node.cluster) continue;
      const pos = positions.get(node.id);
      if (!pos) continue;
      const box = groups.get(node.cluster) ?? { x: pos.x, y: pos.y, w: pos.x, h: pos.y };
      groups.set(node.cluster, {
        x: Math.min(box.x, pos.x),
        y: Math.min(box.y, pos.y),
        w: Math.max(box.w, pos.x),
        h: Math.max(box.h, pos.y),
      });
    }
    return groups;
  }, [nodes, positions]);

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const next = Math.min(3, Math.max(0.3, scale - event.deltaY * 0.001));
    setScale(next);
  };
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragState.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState.current) return;
    setOffset({ x: event.clientX - dragState.current.x, y: event.clientY - dragState.current.y });
  };
  const onPointerUp = () => { dragState.current = null; };

  if (nodes.length === 0) {
    return <p className="empty">Aucune donnée de topologie disponible.</p>;
  }

  return (
    <div className="network-graph-shell">
      <div className="network-graph-toolbar">
        <button type="button" className="filter" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>Zoom +</button>
        <button type="button" className="filter" onClick={() => setScale((s) => Math.max(0.3, s - 0.2))}>Zoom -</button>
        <button type="button" className="filter" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>Réinitialiser</button>
      </div>
      <svg
        className="network-graph"
        width="100%"
        height="520"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label="Graphe de topologie réseau"
      >
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
          {[...clusters.entries()].map(([clusterId, box]) => (
            <rect
              key={clusterId}
              className="network-cluster"
              x={box.x - 70}
              y={box.y - 40}
              width={box.w - box.x + 140}
              height={box.h - box.y + 80}
              rx={16}
            />
          ))}
          {edges.map((edge, index) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            return <line key={index} className="network-edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
          })}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="network-node"
                onClick={() => setSelected(node)}
                tabIndex={0}
                role="button"
                aria-label={`${kindLabel[node.kind]} ${node.label}`}
              >
                <circle r={22} fill={kindColor[node.kind]} />
                <text textAnchor="middle" dy={38} className="network-node-label">{node.label}</text>
              </g>
            );
          })}
        </g>
      </svg>
      {selected && (
        <div className="network-node-detail">
          <h4>{kindLabel[selected.kind]} · {selected.label}</h4>
          {selected.meta && Object.entries(selected.meta).map(([key, value]) => <p className="empty" key={key}>{key} : {value}</p>)}
          <button type="button" className="filter" onClick={() => setSelected(null)}>Fermer</button>
        </div>
      )}
    </div>
  );
}
