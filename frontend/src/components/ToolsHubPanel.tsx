import { useEffect, useState } from 'react';

import { Icon } from './Icon.js';
import { useStrings } from '../i18n/LanguageContext.js';

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Un outil externe pilotable depuis DevOS : la clé du setting qui porte son URL, un libellé, une icône et un groupe d'affichage. */
interface ToolDef { key: string; label: string; icon: string; group: string }

const TOOL_DEFS: ToolDef[] = [
  { key: 'ARGOCD_BASE_URL', label: 'ArgoCD', icon: 'layers', group: 'Kubernetes / CI-CD' },
  { key: 'K8S_API_SERVER', label: 'API Kubernetes', icon: 'network', group: 'Kubernetes / CI-CD' },
  { key: 'WOODPECKER_BASE_URL', label: 'Woodpecker CI', icon: 'layers', group: 'Kubernetes / CI-CD' },
  { key: 'GITLAB_BASE_URL', label: 'GitLab', icon: 'doc', group: 'Kubernetes / CI-CD' },
  { key: 'GITHUB_BASE_URL', label: 'GitHub', icon: 'doc', group: 'Kubernetes / CI-CD' },
  { key: 'CODER_BASE_URL', label: 'Coder', icon: 'layers', group: 'Kubernetes / CI-CD' },
  { key: 'PROXMOX_BASE_URL', label: 'Proxmox', icon: 'network', group: 'Infrastructure' },
  { key: 'HAPROXY_DATA_PLANE_URL', label: 'HAProxy Data Plane', icon: 'network', group: 'Infrastructure' },
  { key: 'POWERDNS_BASE_URL', label: 'PowerDNS', icon: 'network', group: 'Infrastructure' },
  { key: 'WIREGUARD_EXPORTER_BASE_URL', label: 'WireGuard', icon: 'network', group: 'Infrastructure' },
  { key: 'GRAFANA_BASE_URL', label: 'Grafana', icon: 'layers', group: 'Monitoring & sécurité' },
  { key: 'ALERTMANAGER_BASE_URL', label: 'Alertmanager', icon: 'gear', group: 'Monitoring & sécurité' },
  { key: 'WAZUH_BASE_URL', label: 'Wazuh', icon: 'layers', group: 'Monitoring & sécurité' },
  { key: 'SURICATA_BASE_URL', label: 'Suricata', icon: 'network', group: 'Monitoring & sécurité' },
  { key: 'NATS_MONITOR_BASE_URL', label: 'NATS Monitor', icon: 'network', group: 'Monitoring & sécurité' },
  { key: 'HARBOR_BASE_URL', label: 'Harbor', icon: 'layers', group: 'Stockage & registres' },
  { key: 'NEXUS_BASE_URL', label: 'Nexus', icon: 'layers', group: 'Stockage & registres' },
  { key: 'VERDACCIO_BASE_URL', label: 'Verdaccio', icon: 'layers', group: 'Stockage & registres' },
  { key: 'MINIO_BASE_URL', label: 'MinIO', icon: 'layers', group: 'Stockage & registres' },
  { key: 'MEILISEARCH_BASE_URL', label: 'Meilisearch', icon: 'layers', group: 'Stockage & registres' },
  { key: 'REDPANDA_BASE_URL', label: 'Redpanda', icon: 'layers', group: 'Stockage & registres' },
  { key: 'RABBITMQ_BASE_URL', label: 'RabbitMQ', icon: 'widget', group: 'Stockage & registres' },
  { key: 'N8N_BASE_URL', label: 'n8n', icon: 'widget', group: 'Automatisation' },
  { key: 'OLLAMA_BASE_URL', label: 'Ollama', icon: 'widget', group: 'Automatisation' },
];

const strings = {
  fr: {
    heading: "Gestionnaire d'outils",
    hint: "Accès direct aux outils externes configurés dans Administration → Intégrations. Une carte n'apparaît ici que si son URL est renseignée.",
    open: 'Ouvrir',
    loadFailed: 'Impossible de charger les outils configurés.',
    empty: "Aucun outil configuré pour l'instant.",
    emptyHint: "Renseignez les URL de vos outils (ex. ARGOCD_BASE_URL, PROXMOX_BASE_URL…) dans Administration → Intégrations pour les faire apparaître ici.",
  },
  en: {
    heading: 'Tools hub',
    hint: 'Direct access to the external tools configured in Administration → Integrations. A card only appears here once its URL is set.',
    open: 'Open',
    loadFailed: 'Unable to load configured tools.',
    empty: 'No tool configured yet.',
    emptyHint: 'Fill in your tool URLs (e.g. ARGOCD_BASE_URL, PROXMOX_BASE_URL…) in Administration → Integrations so they show up here.',
  },
} as const;

/** Redirige directement vers les interfaces web des outils externes dont l'URL est configurée (ArgoCD, Proxmox, Grafana…), regroupés par catégorie, sans repasser par les Paramètres. */
export function ToolsHubPanel() {
  const s = useStrings(strings);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch(`${apiBase()}/api/settings`)
      .then(async (response) => {
        if (!response.ok) throw new Error(s.loadFailed);
        const data = await response.json();
        setValues(data.values ?? {});
      })
      .catch(() => setError(s.loadFailed));
  }, []);

  const available = TOOL_DEFS.filter((tool) => (values[tool.key] ?? '').trim() !== '');
  const groups = available.reduce<Array<{ group: string; tools: ToolDef[] }>>((acc, tool) => {
    const bucket = acc.find((g) => g.group === tool.group);
    if (bucket) bucket.tools.push(tool); else acc.push({ group: tool.group, tools: [tool] });
    return acc;
  }, []);

  return (
    <div className="items tools-hub-panel">
      <section className="widget-card">
        <h3>{s.heading}</h3>
        <p className="empty">{s.hint}</p>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      {!error && available.length === 0 && (
        <section className="widget-card">
          <p className="empty">{s.empty}</p>
          <p className="empty">{s.emptyHint}</p>
        </section>
      )}
      {groups.map((group) => (
        <section className="widget-card" key={group.group}>
          <h4 className="settings-subheading">{group.group}</h4>
          <div className="tools-hub-grid">
            {group.tools.map((tool) => {
              const url = values[tool.key];
              return (
                <a
                  key={tool.key}
                  className="tools-hub-card"
                  href={/^https?:\/\//i.test(url) ? url : `https://${url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="tools-hub-card-icon" aria-hidden="true"><Icon name={tool.icon} size={20} /></span>
                  <span className="tools-hub-card-body">
                    <strong>{tool.label}</strong>
                    <span className="tools-hub-card-url">{url}</span>
                  </span>
                  <span className="tools-hub-card-action">{s.open} →</span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
