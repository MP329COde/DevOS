import { useEffect, useState, type FormEvent } from 'react';
import { useLanguage, useStrings } from '../i18n/LanguageContext.js';

export interface CustomWidget {
  id: string;
  title: string;
  sourcePath: string;
  dataKey: string;
  label: string;
}

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Sources /api/extras/* autorisées pour un widget custom — doit rester synchronisé avec ALLOWED_CUSTOM_WIDGET_SOURCES côté backend. */
const ALLOWED_SOURCES: Record<'fr' | 'en', Array<{ path: string; label: string }>> = {
  fr: [
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
  ],
  en: [
    { path: '/api/extras/mcp/tools', label: 'MCP tools' },
    { path: '/api/extras/grafana/dashboards', label: 'Grafana dashboards' },
    { path: '/api/extras/harbor/projects', label: 'Harbor projects' },
    { path: '/api/extras/proxmox/nodes', label: 'Proxmox nodes' },
    { path: '/api/extras/minio/buckets', label: 'MinIO buckets' },
    { path: '/api/extras/rabbitmq/queues', label: 'RabbitMQ queues' },
    { path: '/api/extras/rabbitmq/nodes', label: 'RabbitMQ nodes' },
    { path: '/api/extras/dns/zones', label: 'DNS zones' },
    { path: '/api/extras/woodpecker/repos', label: 'Woodpecker repositories' },
    { path: '/api/extras/ollama/models', label: 'Ollama models' },
    { path: '/api/extras/n8n/workflows', label: 'n8n workflows' },
    { path: '/api/extras/nexus/repositories', label: 'Nexus repositories' },
    { path: '/api/extras/meilisearch/indexes', label: 'Meilisearch indexes' },
    { path: '/api/extras/redpanda/brokers', label: 'Redpanda brokers' },
    { path: '/api/extras/redpanda/topics', label: 'Redpanda topics' },
  ],
};

const strings = {
  fr: {
    titleRequired: 'Titre, clé et libellé sont requis.',
    notConfigured: 'Les widgets custom ne sont pas configurés sur ce backend.',
    createFailed: 'Échec de la création du widget.',
    unreachable: 'Impossible de joindre le serveur.',
    deleteFailed: 'Échec de la suppression du widget.',
    panelTitle: 'Widgets custom',
    widgetTitleLabel: 'Titre du widget',
    widgetTitlePlaceholder: 'Titre du widget',
    sourceLabel: 'Source de données',
    dataKeyLabel: 'Clé du champ à afficher',
    dataKeyPlaceholder: 'Clé (ex: name)',
    labelLabel: 'Libellé affiché',
    labelPlaceholder: 'Libellé (ex: Nom)',
    createButton: 'Créer le widget',
    noWidgets: "Aucun widget custom créé pour l'instant.",
    fieldSummary: (sourcePath: string, dataKey: string, label: string) => `${sourcePath} · champ « ${dataKey} » (${label})`,
    deleteAria: (name: string) => `Supprimer ${name}`,
  },
  en: {
    titleRequired: 'Title, key and label are required.',
    notConfigured: 'Custom widgets are not configured on this backend.',
    createFailed: 'Failed to create the widget.',
    unreachable: 'Could not reach the server.',
    deleteFailed: 'Failed to delete the widget.',
    panelTitle: 'Custom widgets',
    widgetTitleLabel: 'Widget title',
    widgetTitlePlaceholder: 'Widget title',
    sourceLabel: 'Data source',
    dataKeyLabel: 'Field key to display',
    dataKeyPlaceholder: 'Key (e.g. name)',
    labelLabel: 'Displayed label',
    labelPlaceholder: 'Label (e.g. Name)',
    createButton: 'Create widget',
    noWidgets: 'No custom widget created yet.',
    fieldSummary: (sourcePath: string, dataKey: string, label: string) => `${sourcePath} · field "${dataKey}" (${label})`,
    deleteAria: (name: string) => `Delete ${name}`,
  },
} as const;

interface CustomWidgetsPanelProps {
  onChange?: () => void;
}

/** Section R : création de widgets custom pour le Dashboard, à partir d'une source /api/extras/* existante. Pas d'exécution de code côté serveur. */
export function CustomWidgetsPanel({ onChange }: CustomWidgetsPanelProps) {
  const { language } = useLanguage();
  const s = useStrings(strings);
  const allowedSources = ALLOWED_SOURCES[language];
  const [widgets, setWidgets] = useState<CustomWidget[]>([]);
  const [title, setTitle] = useState('');
  const [sourcePath, setSourcePath] = useState(allowedSources[0].path);
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
    if (!title.trim() || !dataKey.trim() || !label.trim()) { setError(s.titleRequired); return; }
    setError('');
    try {
      const response = await fetch(`${apiBase()}/api/custom-widgets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, sourcePath, dataKey, label }),
      });
      if (response.status === 503) { setError(s.notConfigured); return; }
      if (!response.ok) { setError(s.createFailed); return; }
      setTitle(''); setDataKey(''); setLabel('');
      load();
      onChange?.();
    } catch {
      setError(s.unreachable);
    }
  };

  const removeWidget = async (id: string) => {
    const response = await fetch(`${apiBase()}/api/custom-widgets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) { setError(s.deleteFailed); return; }
    load();
    onChange?.();
  };

  return (
    <section className="view-group custom-widgets-panel">
      <h3>{s.panelTitle}</h3>
      <form className="new-item custom-widget-form" onSubmit={(event) => void createWidget(event)}>
        <input aria-label={s.widgetTitleLabel} placeholder={s.widgetTitlePlaceholder} value={title} onChange={(event) => setTitle(event.target.value)} required />
        <select aria-label={s.sourceLabel} value={sourcePath} onChange={(event) => setSourcePath(event.target.value)}>
          {allowedSources.map((source) => <option key={source.path} value={source.path}>{source.label}</option>)}
        </select>
        <input aria-label={s.dataKeyLabel} placeholder={s.dataKeyPlaceholder} value={dataKey} onChange={(event) => setDataKey(event.target.value)} required />
        <input aria-label={s.labelLabel} placeholder={s.labelPlaceholder} value={label} onChange={(event) => setLabel(event.target.value)} required />
        <button type="submit">{s.createButton}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {widgets.length === 0 && <p className="empty">{s.noWidgets}</p>}
      {widgets.map((widget) => (
        <article className="item" key={widget.id}>
          <strong>{widget.title}</strong>
          <span className="integrations">{s.fieldSummary(widget.sourcePath, widget.dataKey, widget.label)}</span>
          <button className="delete" type="button" aria-label={s.deleteAria(widget.title)} onClick={() => void removeWidget(widget.id)}>×</button>
        </article>
      ))}
    </section>
  );
}
