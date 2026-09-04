import { useEffect, useState } from 'react';

interface ProxmoxNode {
  id: string;
  status: string;
}

interface ProxmoxVM {
  vmid: number;
  name: string;
  status: string;
}

type VmAction = 'start' | 'shutdown' | 'reboot';

const actionLabel: Record<VmAction, string> = {
  start: 'Démarrer',
  shutdown: 'Arrêter',
  reboot: 'Redémarrer',
};

/**
 * Panel Réseau & Serveurs — contrôle des VMs Proxmox (section Q). Garde l'identité visuelle
 * "infra critique" de Design.md : toute action de contrôle (start/shutdown/reboot) passe par
 * une confirmation explicite affichée en overlay avant d'appeler l'API, jamais sur un simple clic.
 */
export function ProxmoxPanel({ apiBase }: { apiBase: string }) {
  const [nodes, setNodes] = useState<ProxmoxNode[]>([]);
  const [vmsByNode, setVmsByNode] = useState<Record<string, ProxmoxVM[]>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ node: string; vm: ProxmoxVM; action: VmAction } | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionInFlight, setActionInFlight] = useState(false);

  useEffect(() => {
    void fetch(`${apiBase}/api/extras/proxmox/nodes`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? 'Proxmox n’est pas configuré sur ce backend.' : 'Impossible de charger les nœuds Proxmox.');
        const list = (await response.json()) as ProxmoxNode[];
        setNodes(list);
        setError('');
        for (const node of list) {
          void fetch(`${apiBase}/api/extras/proxmox/${encodeURIComponent(node.id)}/vms`)
            .then(async (response) => { if (!response.ok) return; const vms = await response.json(); setVmsByNode((current) => ({ ...current, [node.id]: vms })); })
            .catch(() => undefined);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [apiBase]);

  async function confirmAction() {
    if (!pending) return;
    setActionInFlight(true);
    setActionError('');
    try {
      const response = await fetch(`${apiBase}/api/proxmox/nodes/${encodeURIComponent(pending.node)}/vms/${pending.vm.vmid}/${pending.action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-devos-role': 'Admin' },
        body: JSON.stringify({ confirm: true }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'L’action a échoué.');
      }
      setPending(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'L’action a échoué.');
    } finally {
      setActionInFlight(false);
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>;
  if (nodes.length === 0) return <p className="empty">Aucun nœud Proxmox à afficher.</p>;

  return (
    <div className="proxmox-panel">
      {nodes.map((node) => (
        <section className="view-group proxmox-node" key={node.id}>
          <h3>{node.id} <span className={`status-badge status-badge-${node.status === 'online' ? 'ok' : 'off'}`}>{node.status}</span></h3>
          {(vmsByNode[node.id] ?? []).map((vm) => (
            <article className="item proxmox-vm" key={vm.vmid}>
              <strong>{vm.name}</strong>
              <span className={`status-badge status-badge-${vm.status === 'running' ? 'ok' : 'off'}`}>{vm.status}</span>
              <span className="item-actions">
                <button type="button" className="proxmox-action" onClick={() => setPending({ node: node.id, vm, action: 'start' })}>Démarrer</button>
                <button type="button" className="proxmox-action" onClick={() => setPending({ node: node.id, vm, action: 'shutdown' })}>Arrêter</button>
                <button type="button" className="proxmox-action" onClick={() => setPending({ node: node.id, vm, action: 'reboot' })}>Redémarrer</button>
              </span>
            </article>
          ))}
          {(vmsByNode[node.id] ?? []).length === 0 && <p className="empty">Aucune VM sur ce nœud.</p>}
        </section>
      ))}

      {pending && (
        <div className="detail-overlay proxmox-confirm-overlay" role="alertdialog" aria-modal="true" aria-label="Confirmation d'action VM">
          <div className="detail-panel proxmox-confirm-panel">
            <h2>Confirmer : {actionLabel[pending.action]} « {pending.vm.name} » ?</h2>
            <p>Cette action agit directement sur une machine réelle de l'infrastructure (nœud {pending.node}). Elle ne peut pas être annulée une fois lancée.</p>
            {actionError && <p className="error" role="alert">{actionError}</p>}
            <div className="filters">
              <button type="button" className="proxmox-confirm" disabled={actionInFlight} onClick={() => void confirmAction()}>{actionInFlight ? 'En cours…' : `Confirmer : ${actionLabel[pending.action]}`}</button>
              <button type="button" className="filter" disabled={actionInFlight} onClick={() => { setPending(null); setActionError(''); }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
