import { useMemo, useRef, useState } from 'react';

import { useStrings } from '../i18n/LanguageContext.js';

export interface NetworkGraphNode {
  id: string;
  kind: 'proxmox-host' | 'proxmox-vm' | 'dns-record';
  label: string;
  cluster?: string;
  meta?: Record<string, string>;
  services?: string[];
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

const strings = {
  fr: {
    kindLabel: {
      'proxmox-host': 'Hôte Proxmox', 'proxmox-vm': 'VM', 'dns-record': 'Enregistrement DNS',
    } as Record<NetworkGraphNode['kind'], string>,
    noTopologyData: 'Aucune donnée de topologie disponible.',
    zoomIn: 'Zoom +',
    zoomOut: 'Zoom -',
    reset: 'Réinitialiser',
    graphAria: 'Graphe de topologie réseau',
    servicesCount: (count: number) => `, ${count} service(s)`,
    servicesOnMachine: 'Services/outils sur cette machine :',
    close: 'Fermer',
  },
  en: {
    kindLabel: {
      'proxmox-host': 'Proxmox host', 'proxmox-vm': 'VM', 'dns-record': 'DNS record',
    } as Record<NetworkGraphNode['kind'], string>,
    noTopologyData: 'No topology data available.',
    zoomIn: 'Zoom +',
    zoomOut: 'Zoom -',
    reset: 'Reset',
    graphAria: 'Network topology graph',
    servicesCount: (count: number) => `, ${count} service(s)`,
    close: 'Close',
    servicesOnMachine: 'Services/tools on this machine:',
  },
} as const;

const COL_WIDTH = 220;
const ROW_HEIGHT = 90;

/** Layout: hosts in a row, their VMs stacked below in a column. DNS records are placed by the caller, next to the VM they resolve to (see edge-based placement below). */
function layoutNodes(nodes: NetworkGraphNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const hosts = nodes.filter((n) => n.kind === 'proxmox-host');

  hosts.forEach((host, hostIndex) => {
    const baseX = hostIndex * COL_WIDTH * 2.4 + 140;
    positions.set(host.id, { x: baseX, y: 60 });
    const vms = nodes.filter((n) => n.kind === 'proxmox-vm' && n.cluster === host.id);
    vms.forEach((vm, vmIndex) => {
      positions.set(vm.id, { x: baseX, y: 60 + (vmIndex + 1) * ROW_HEIGHT });
    });
  });

  return positions;
}

/** Bug fix: the graph previously used a fixed 520px viewport, which cut off nodes once a host had more than a handful of VMs, or once several hosts pushed the layout past the visible width. Size the SVG from the actual node positions instead, with the shell scrolling if the result is still larger than the panel. */
function computeCanvasSize(nodes: NetworkGraphNode[], positions: Map<string, { x: number; y: number }>): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }
  return { width: Math.max(640, maxX + 220), height: Math.max(360, maxY + 100) };
}

export function NetworkGraph({ nodes, edges }: NetworkGraphProps) {
  const s = useStrings(strings);
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

  const canvasSize = useMemo(() => computeCanvasSize(nodes, positions), [nodes, positions]);

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
    return <p className="empty">{s.noTopologyData}</p>;
  }

  return (
    <div className="network-graph-shell">
      <div className="network-graph-toolbar">
        <button type="button" className="filter" onClick={() => setScale((current) => Math.min(3, current + 0.2))}>{s.zoomIn}</button>
        <button type="button" className="filter" onClick={() => setScale((current) => Math.max(0.3, current - 0.2))}>{s.zoomOut}</button>
        <button type="button" className="filter" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>{s.reset}</button>
      </div>
      <svg
        className="network-graph"
        width={canvasSize.width}
        height={canvasSize.height}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label={s.graphAria}
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
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(node); } }}
                tabIndex={0}
                role="button"
                aria-label={`${s.kindLabel[node.kind]} ${node.label}${node.services?.length ? s.servicesCount(node.services.length) : ''}`}
              >
                <circle r={22} fill={kindColor[node.kind]} />
                {node.services && node.services.length > 0 && (
                  <circle className="network-node-badge" r={7} cx={16} cy={-16} />
                )}
                {node.services && node.services.length > 0 && (
                  <text x={16} y={-16} dy={3} textAnchor="middle" className="network-node-badge-label">{node.services.length}</text>
                )}
                <text textAnchor="middle" dy={38} className="network-node-label">{node.label}</text>
              </g>
            );
          })}
        </g>
      </svg>
      {selected && (
        <div className="network-node-detail">
          <h4>{s.kindLabel[selected.kind]} · {selected.label}</h4>
          {selected.meta && Object.entries(selected.meta).map(([key, value]) => <p className="empty" key={key}>{key} : {value}</p>)}
          {selected.services && selected.services.length > 0 && (
            <div className="network-node-services">
              <p className="empty">{s.servicesOnMachine}</p>
              <ul>{selected.services.map((service) => <li key={service}>{service}</li>)}</ul>
            </div>
          )}
          <button type="button" className="filter" onClick={() => setSelected(null)}>{s.close}</button>
        </div>
      )}
    </div>
  );
}
