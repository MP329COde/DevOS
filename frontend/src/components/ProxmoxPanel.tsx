import { useEffect, useState } from 'react';
import { useLanguage, useStrings } from '../i18n/LanguageContext.js';

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

const actionLabels: Record<'fr' | 'en', Record<VmAction, string>> = {
  fr: {
    start: 'Démarrer',
    shutdown: 'Arrêter',
    reboot: 'Redémarrer',
  },
  en: {
    start: 'Start',
    shutdown: 'Stop',
    reboot: 'Restart',
  },
};

const strings = {
  fr: {
    notConfigured: 'Proxmox n’est pas configuré sur ce backend.',
    loadFailed: 'Impossible de charger les nœuds Proxmox.',
    actionFailed: 'L’action a échoué.',
    noNodes: 'Aucun nœud Proxmox à afficher.',
    noVms: 'Aucune VM sur ce nœud.',
    confirmDialogLabel: "Confirmation d'action VM",
    confirmTitle: (action: string, vmName: string) => `Confirmer : ${action} « ${vmName} » ?`,
    confirmBody: (node: string) => `Cette action agit directement sur une machine réelle de l'infrastructure (nœud ${node}). Elle ne peut pas être annulée une fois lancée.`,
    inProgress: 'En cours…',
    confirmButton: (action: string) => `Confirmer : ${action}`,
    cancel: 'Annuler',
  },
  en: {
    notConfigured: 'Proxmox is not configured on this backend.',
    loadFailed: 'Could not load Proxmox nodes.',
    actionFailed: 'The action failed.',
    noNodes: 'No Proxmox node to display.',
    noVms: 'No VM on this node.',
    confirmDialogLabel: 'VM action confirmation',
    confirmTitle: (action: string, vmName: string) => `Confirm: ${action} "${vmName}"?`,
    confirmBody: (node: string) => `This action acts directly on a real infrastructure machine (node ${node}). It cannot be undone once started.`,
    inProgress: 'In progress…',
    confirmButton: (action: string) => `Confirm: ${action}`,
    cancel: 'Cancel',
  },
} as const;

/**
 * Panel Réseau & Serveurs — contrôle des VMs Proxmox (section Q). Garde l'identité visuelle
 * "infra critique" de Design.md : toute action de contrôle (start/shutdown/reboot) passe par
 * une confirmation explicite affichée en overlay avant d'appeler l'API, jamais sur un simple clic.
 */
export function ProxmoxPanel({ apiBase }: { apiBase: string }) {
  const { language } = useLanguage();
  const s = useStrings(strings);
  const actionLabel = actionLabels[language];
  const [nodes, setNodes] = useState<ProxmoxNode[]>([]);
  const [vmsByNode, setVmsByNode] = useState<Record<string, ProxmoxVM[]>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ node: string; vm: ProxmoxVM; action: VmAction } | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionInFlight, setActionInFlight] = useState(false);

  useEffect(() => {
    void fetch(`${apiBase}/api/extras/proxmox/nodes`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? s.notConfigured : s.loadFailed);
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
        throw new Error((body as { error?: string }).error ?? s.actionFailed);
      }
      setPending(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : s.actionFailed);
    } finally {
      setActionInFlight(false);
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>;
  if (nodes.length === 0) return <p className="empty">{s.noNodes}</p>;

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
                <button type="button" className="proxmox-action" onClick={() => setPending({ node: node.id, vm, action: 'start' })}>{actionLabel.start}</button>
                <button type="button" className="proxmox-action" onClick={() => setPending({ node: node.id, vm, action: 'shutdown' })}>{actionLabel.shutdown}</button>
                <button type="button" className="proxmox-action" onClick={() => setPending({ node: node.id, vm, action: 'reboot' })}>{actionLabel.reboot}</button>
              </span>
            </article>
          ))}
          {(vmsByNode[node.id] ?? []).length === 0 && <p className="empty">{s.noVms}</p>}
        </section>
      ))}

      {pending && (
        <div className="detail-overlay proxmox-confirm-overlay" role="alertdialog" aria-modal="true" aria-label={s.confirmDialogLabel}>
          <div className="detail-panel proxmox-confirm-panel">
            <h2>{s.confirmTitle(actionLabel[pending.action], pending.vm.name)}</h2>
            <p>{s.confirmBody(pending.node)}</p>
            {actionError && <p className="error" role="alert">{actionError}</p>}
            <div className="filters">
              <button type="button" className="proxmox-confirm" disabled={actionInFlight} onClick={() => void confirmAction()}>{actionInFlight ? s.inProgress : s.confirmButton(actionLabel[pending.action])}</button>
              <button type="button" className="filter" disabled={actionInFlight} onClick={() => { setPending(null); setActionError(''); }}>{s.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
