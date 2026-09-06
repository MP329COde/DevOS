import { useEffect, useState } from 'react';
import { useStrings } from '../i18n/LanguageContext.js';

interface ProxmoxNode {
  id: string;
  status: string;
  cpu?: number;
  mem?: number;
}

interface ProxmoxVM {
  vmid: number;
  name: string;
  status: string;
}

const strings = {
  fr: {
    notConfigured: 'Proxmox n’est pas configuré sur ce backend.',
    loadFailed: 'Impossible de charger les données Proxmox.',
    noNodes: 'Aucun nœud Proxmox à afficher.',
    noVms: 'Aucune VM sur ce nœud.',
    openCluster: 'Ouvrir Proxmox',
    noUrl: "L'URL du cluster Proxmox n'est pas configurée.",
    intro: "Aperçu en lecture seule. Toute action de gestion (démarrage, arrêt, redémarrage…) se fait directement dans l'interface Proxmox.",
  },
  en: {
    notConfigured: 'Proxmox is not configured on this backend.',
    loadFailed: 'Could not load Proxmox data.',
    noNodes: 'No Proxmox node to display.',
    noVms: 'No VM on this node.',
    openCluster: 'Open Proxmox',
    noUrl: 'The Proxmox cluster URL is not configured.',
    intro: 'Read-only overview. Any management action (start, stop, reboot…) happens directly in the Proxmox interface.',
  },
} as const;

/**
 * Panel Réseau & Serveurs — aperçu en lecture seule des nœuds/VMs Proxmox. Toute action de
 * gestion redirige désormais vers l'interface Proxmox réelle plutôt que d'être exécutée depuis
 * l'app : le contrôle effectif d'une infra critique ne doit pas dépendre d'un intermédiaire.
 */
export function ProxmoxPanel({ apiBase }: { apiBase: string }) {
  const s = useStrings(strings);
  const [nodes, setNodes] = useState<ProxmoxNode[]>([]);
  const [vmsByNode, setVmsByNode] = useState<Record<string, ProxmoxVM[]>>({});
  const [clusterUrl, setClusterUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch(`${apiBase}/api/extras/proxmox/cluster-url`)
      .then(async (response) => { if (!response.ok) return; const body = await response.json(); setClusterUrl((body as { url?: string }).url ?? ''); })
      .catch(() => undefined);

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

  return (
    <div className="proxmox-panel">
      <div className="view-group proxmox-header">
        <p className="hint">{s.intro}</p>
        <a
          className={`proxmox-open-cluster${clusterUrl ? '' : ' disabled'}`}
          href={clusterUrl || undefined}
          target="_blank"
          rel="noreferrer noopener"
          aria-disabled={!clusterUrl}
          title={clusterUrl ? undefined : s.noUrl}
        >
          {s.openCluster}
        </a>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!error && nodes.length === 0 && <p className="empty">{s.noNodes}</p>}

      {nodes.map((node) => (
        <section className="view-group proxmox-node" key={node.id}>
          <h3>{node.id} <span className={`status-badge status-badge-${node.status === 'online' ? 'ok' : 'off'}`}>{node.status}</span></h3>
          {(vmsByNode[node.id] ?? []).map((vm) => (
            <article className="item proxmox-vm" key={vm.vmid}>
              <strong>{vm.name}</strong>
              <span className={`status-badge status-badge-${vm.status === 'running' ? 'ok' : 'off'}`}>{vm.status}</span>
            </article>
          ))}
          {(vmsByNode[node.id] ?? []).length === 0 && <p className="empty">{s.noVms}</p>}
        </section>
      ))}
    </div>
  );
}
