import { useEffect, useState, type FormEvent } from 'react';

export interface CustomWidget {
  id: string;
  title: string;
  sourcePath: string;
  dataKey: string;
  label: string;
}

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Sources /api/extras/* autorisées pour un widget custom — doit rester synchronisé avec ALLOWED_CUSTOM_WIDGET_SOURCES côté backend. */
const ALLOWED_SOURCES: Array<{ path: string; label: string }> = [
  { path: '/api/extras/mcp/tools', label: 'Outils MCP' },
  { path: '/api/extras/grafana/dashboards', label: 'Tableaux de bord Grafana' },
  { path: '/api/extras/harbor/projects', label: 'Projets Harbor' },
  { path: '/api/extras/proxmox/nodes', label: 'Nœuds Proxmox' },
  { path: '/api/extras/minio/buckets', label: 'Buckets MinIO' },
  { path: '/api/extras/rabbitmq/queues', label: 'Files RabbitMQ' },
  { path: '/api/extras/rabbitmq/nodes', label: 'Nœuds RabbitMQ' },
  { path: '/api/extras/dns/zones', label: 'Zones DNS' },
  { path: '/api/extras/woodpecker/repos', label: 'Dépôts Woodpecker' },
  { path: '/api/extras/ollama/models', label: 'Modèles Ollama' },
  { path: '/api/extras/n8n/workflows', label: 'Workflows n8n' },
  { path: '/api/extras/nexus/repositories', label: 'Dépôts Nexus' },
  { path: '/api/extras/meilisearch/indexes', label: 'Index Meilisearch' },
  { path: '/api/extras/redpanda/brokers', label: 'Brokers Redpanda' },
  { path: '/api/extras/redpanda/topics', label: 'Topics Redpanda' },
];

interface CustomWidgetsPanelProps {
  onChange?: () => void;
}

/** Section R : création de widgets custom pour le Dashboard, à partir d'une source /api/extras/* existante. Pas d'exécution de code côté serveur. */
export function CustomWidgetsPanel({ onChange }: CustomWidgetsPanelProps) {
  const [widgets, setWidgets] = useState<CustomWidget[]>([]);
  const [title, setTitle] = useState('');
  const [sourcePath, setSourcePath] = useState(ALLOWED_SOURCES[0].path);
  const [dataKey, setDataKey] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    void fetch(`${apiBase()}/api/custom-widgets`)
      .then(async (response) => { if (response.ok) setWidgets(await response.json()); })
      .catch(() => undefined);
  };

  useEffect(load, []);

  const createWidget = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !dataKey.trim() || !label.trim()) { setError('Titre, clé et libellé sont requis.'); return; }
    setError('');
    try {
      const response = await fetch(`${apiBase()}/api/custom-widgets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, sourcePath, dataKey, label }),
      });
      if (response.status === 503) { setError('Les widgets custom ne sont pas configurés sur ce backend.'); return; }
      if (!response.ok) { setError('Échec de la création du widget.'); return; }
      setTitle(''); setDataKey(''); setLabel('');
      load();
      onChange?.();
    } catch {
      setError('Impossible de joindre le serveur.');
    }
  };

  const removeWidget = async (id: string) => {
    const response = await fetch(`${apiBase()}/api/custom-widgets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) { setError('Échec de la suppression du widget.'); return; }
    load();
    onChange?.();
  };

  return (
    <section className="view-group custom-widgets-panel">
      <h3>Widgets custom</h3>
      <p className="empty">
        Crée un widget pour le Dashboard à partir d'une source de données déjà branchée
        (<code>/api/extras/*</code>) : choisis la source, la clé du champ à afficher et son libellé.
        Aucune exécution de code côté serveur.
      </p>
      <form className="new-item custom-widget-form" onSubmit={(event) => void createWidget(event)}>
        <input aria-label="Titre du widget" placeholder="Titre du widget" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <select aria-label="Source de données" value={sourcePath} onChange={(event) => setSourcePath(event.target.value)}>
          {ALLOWED_SOURCES.map((source) => <option key={source.path} value={source.path}>{source.label}</option>)}
        </select>
        <input aria-label="Clé du champ à afficher" placeholder="Clé (ex: name)" value={dataKey} onChange={(event) => setDataKey(event.target.value)} required />
        <input aria-label="Libellé affiché" placeholder="Libellé (ex: Nom)" value={label} onChange={(event) => setLabel(event.target.value)} required />
        <button type="submit">Créer le widget</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {widgets.length === 0 && <p className="empty">Aucun widget custom créé pour l'instant.</p>}
      {widgets.map((widget) => (
        <article className="item" key={widget.id}>
          <strong>{widget.title}</strong>
          <span className="integrations">{widget.sourcePath} · champ « {widget.dataKey} » ({widget.label})</span>
          <button className="delete" type="button" aria-label={`Supprimer ${widget.title}`} onClick={() => void removeWidget(widget.id)}>×</button>
        </article>
      ))}
    </section>
  );
}
