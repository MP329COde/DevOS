import { useEffect, useState, type FormEvent } from 'react';
import { useLanguage, useStrings } from '../i18n/LanguageContext.js';
import { Icon, ICON_NAMES } from './Icon.js';

export type CustomWidgetSize = 'small' | 'medium' | 'large';
export type CustomWidgetMetric = 'list' | 'count' | 'sum' | 'first';

export interface CustomWidget {
  id: string;
  title: string;
  sourcePath: string;
  dataKey: string;
  label: string;
  icon: string;
  refreshSeconds: number;
  size: CustomWidgetSize;
  metric: CustomWidgetMetric;
  visible: boolean;
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

const SIZES: CustomWidgetSize[] = ['small', 'medium', 'large'];
const METRICS: CustomWidgetMetric[] = ['list', 'count', 'sum', 'first'];

const strings = {
  fr: {
    titleRequired: 'Titre, clé et libellé sont requis.',
    notConfigured: 'Les widgets custom ne sont pas configurés sur ce backend.',
    createFailed: 'Échec de la création du widget.',
    updateFailed: 'Échec de la modification du widget.',
    unreachable: 'Impossible de joindre le serveur.',
    deleteFailed: 'Échec de la suppression du widget.',
    previewFailed: "Impossible de charger l'aperçu.",
    panelTitle: 'Widgets custom',
    widgetTitleLabel: 'Titre du widget',
    widgetTitlePlaceholder: 'Titre du widget',
    sourceLabel: 'Source de données',
    dataKeyLabel: 'Clé du champ à afficher',
    dataKeyPlaceholder: 'Clé (ex: name)',
    labelLabel: 'Libellé affiché',
    labelPlaceholder: 'Libellé (ex: Nom)',
    iconLabel: 'Icône',
    refreshLabel: 'Rafraîchissement (secondes)',
    sizeLabel: 'Taille',
    metricLabel: 'Métrique',
    sizeOptions: { small: 'Petite', medium: 'Moyenne', large: 'Grande' } as Record<CustomWidgetSize, string>,
    metricOptions: { list: 'Liste', count: 'Compteur', sum: 'Somme', first: 'Premier élément' } as Record<CustomWidgetMetric, string>,
    createButton: 'Créer le widget',
    updateButton: 'Enregistrer les modifications',
    cancelEdit: 'Annuler',
    noWidgets: "Aucun widget custom créé pour l'instant.",
    fieldSummary: (sourcePath: string, dataKey: string, label: string) => `${sourcePath} · champ « ${dataKey} » (${label})`,
    deleteAria: (name: string) => `Supprimer ${name}`,
    editAria: (name: string) => `Modifier ${name}`,
    duplicateAria: (name: string) => `Dupliquer ${name}`,
    previewAria: (name: string) => `Aperçu de ${name}`,
    enableAria: (name: string) => `Activer ${name}`,
    disableAria: (name: string) => `Désactiver ${name}`,
    enabled: 'Activé',
    disabled: 'Désactivé',
    previewTitle: 'Aperçu',
    previewEmpty: 'Aucune donnée à afficher.',
    closePreview: 'Fermer',
  },
  en: {
    titleRequired: 'Title, key and label are required.',
    notConfigured: 'Custom widgets are not configured on this backend.',
    createFailed: 'Failed to create the widget.',
    updateFailed: 'Failed to update the widget.',
    unreachable: 'Could not reach the server.',
    deleteFailed: 'Failed to delete the widget.',
    previewFailed: 'Unable to load the preview.',
    panelTitle: 'Custom widgets',
    widgetTitleLabel: 'Widget title',
    widgetTitlePlaceholder: 'Widget title',
    sourceLabel: 'Data source',
    dataKeyLabel: 'Field key to display',
    dataKeyPlaceholder: 'Key (e.g. name)',
    labelLabel: 'Displayed label',
    labelPlaceholder: 'Label (e.g. Name)',
    iconLabel: 'Icon',
    refreshLabel: 'Refresh (seconds)',
    sizeLabel: 'Size',
    metricLabel: 'Metric',
    sizeOptions: { small: 'Small', medium: 'Medium', large: 'Large' } as Record<CustomWidgetSize, string>,
    metricOptions: { list: 'List', count: 'Count', sum: 'Sum', first: 'First item' } as Record<CustomWidgetMetric, string>,
    createButton: 'Create widget',
    updateButton: 'Save changes',
    cancelEdit: 'Cancel',
    noWidgets: 'No custom widget created yet.',
    fieldSummary: (sourcePath: string, dataKey: string, label: string) => `${sourcePath} · field "${dataKey}" (${label})`,
    deleteAria: (name: string) => `Delete ${name}`,
    editAria: (name: string) => `Edit ${name}`,
    duplicateAria: (name: string) => `Duplicate ${name}`,
    previewAria: (name: string) => `Preview ${name}`,
    enableAria: (name: string) => `Enable ${name}`,
    disableAria: (name: string) => `Disable ${name}`,
    enabled: 'Enabled',
    disabled: 'Disabled',
    previewTitle: 'Preview',
    previewEmpty: 'No data to display.',
    closePreview: 'Close',
  },
} as const;

interface CustomWidgetsPanelProps {
  onChange?: () => void;
}

const emptyDraft = (defaultSource: string) => ({
  id: '',
  title: '',
  sourcePath: defaultSource,
  dataKey: '',
  label: '',
  icon: 'gear',
  refreshSeconds: 60,
  size: 'medium' as CustomWidgetSize,
  metric: 'list' as CustomWidgetMetric,
  visible: true,
});

/** Section R : gestion des widgets custom pour le Dashboard, à partir d'une source /api/extras/* existante. Pas d'exécution de code côté serveur. */
export function CustomWidgetsPanel({ onChange }: CustomWidgetsPanelProps) {
  const { language } = useLanguage();
  const s = useStrings(strings);
  const allowedSources = ALLOWED_SOURCES[language];
  const [widgets, setWidgets] = useState<CustomWidget[]>([]);
  const [draft, setDraft] = useState(() => emptyDraft(allowedSources[0].path));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewLines, setPreviewLines] = useState<string[] | null>(null);

  const load = () => {
    void fetch(`${apiBase()}/api/custom-widgets`)
      .then(async (response) => { if (response.ok) setWidgets(await response.json()); })
      .catch(() => undefined);
  };

  useEffect(load, []);

  const resetDraft = () => { setDraft(emptyDraft(allowedSources[0].path)); setEditingId(null); };

  const submitWidget = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.dataKey.trim() || !draft.label.trim()) { setError(s.titleRequired); return; }
    setError('');
    try {
      const response = editingId
        ? await fetch(`${apiBase()}/api/custom-widgets/${encodeURIComponent(editingId)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(draft),
          })
        : await fetch(`${apiBase()}/api/custom-widgets`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(draft),
          });
      if (response.status === 503) { setError(s.notConfigured); return; }
      if (!response.ok) { setError(editingId ? s.updateFailed : s.createFailed); return; }
      resetDraft();
      load();
      onChange?.();
    } catch {
      setError(s.unreachable);
    }
  };

  const removeWidget = async (id: string) => {
    const response = await fetch(`${apiBase()}/api/custom-widgets/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok && response.status !== 204) { setError(s.deleteFailed); return; }
    if (editingId === id) resetDraft();
    load();
    onChange?.();
  };

  const startEdit = (widget: CustomWidget) => {
    setEditingId(widget.id);
    setDraft({ ...widget });
    setError('');
  };

  const duplicateWidget = async (widget: CustomWidget) => {
    const response = await fetch(`${apiBase()}/api/custom-widgets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...widget, id: '', title: `${widget.title} (copie)` }),
    });
    if (!response.ok) { setError(s.createFailed); return; }
    load();
    onChange?.();
  };

  const toggleVisible = async (widget: CustomWidget) => {
    const response = await fetch(`${apiBase()}/api/custom-widgets/${encodeURIComponent(widget.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visible: !widget.visible }),
    });
    if (!response.ok) { setError(s.updateFailed); return; }
    load();
    onChange?.();
  };

  const previewWidget = async (widget: CustomWidget) => {
    setPreviewId(widget.id);
    setPreviewLines(null);
    try {
      const response = await fetch(`${apiBase()}${widget.sourcePath}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      const lines = Array.isArray(data)
        ? data.slice(0, 6).map((entry) => `${widget.label} : ${String((entry as Record<string, unknown>)[widget.dataKey] ?? '—')}`)
        : [];
      setPreviewLines(lines);
    } catch {
      setPreviewLines([s.previewFailed]);
    }
  };

  return (
    <section className="view-group custom-widgets-panel">
      <h3>{s.panelTitle}</h3>
      <form className="new-item custom-widget-form" onSubmit={(event) => void submitWidget(event)}>
        <input aria-label={s.widgetTitleLabel} placeholder={s.widgetTitlePlaceholder} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required />
        <select aria-label={s.sourceLabel} value={draft.sourcePath} onChange={(event) => setDraft((current) => ({ ...current, sourcePath: event.target.value }))}>
          {allowedSources.map((source) => <option key={source.path} value={source.path}>{source.label}</option>)}
        </select>
        <input aria-label={s.dataKeyLabel} placeholder={s.dataKeyPlaceholder} value={draft.dataKey} onChange={(event) => setDraft((current) => ({ ...current, dataKey: event.target.value }))} required />
        <input aria-label={s.labelLabel} placeholder={s.labelPlaceholder} value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} required />
        <select aria-label={s.iconLabel} value={draft.icon} onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))}>
          {ICON_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <input aria-label={s.refreshLabel} type="number" min={5} step={5} placeholder={s.refreshLabel} value={draft.refreshSeconds} onChange={(event) => setDraft((current) => ({ ...current, refreshSeconds: Number(event.target.value) || 60 }))} />
        <select aria-label={s.sizeLabel} value={draft.size} onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value as CustomWidgetSize }))}>
          {SIZES.map((size) => <option key={size} value={size}>{s.sizeOptions[size]}</option>)}
        </select>
        <select aria-label={s.metricLabel} value={draft.metric} onChange={(event) => setDraft((current) => ({ ...current, metric: event.target.value as CustomWidgetMetric }))}>
          {METRICS.map((metric) => <option key={metric} value={metric}>{s.metricOptions[metric]}</option>)}
        </select>
        <label className="custom-widget-visible-toggle">
          <input type="checkbox" checked={draft.visible} onChange={(event) => setDraft((current) => ({ ...current, visible: event.target.checked }))} />
          {draft.visible ? s.enabled : s.disabled}
        </label>
        <button type="submit">{editingId ? s.updateButton : s.createButton}</button>
        {editingId && <button type="button" onClick={resetDraft}>{s.cancelEdit}</button>}
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {widgets.length === 0 && <p className="empty">{s.noWidgets}</p>}
      {widgets.map((widget) => (
        <article className={widget.visible ? 'item' : 'item custom-widget-disabled'} key={widget.id}>
          <strong><Icon name={widget.icon} size={14} /> {widget.title}</strong>
          <span className="integrations">{s.fieldSummary(widget.sourcePath, widget.dataKey, widget.label)} · {s.sizeOptions[widget.size]} · {s.metricOptions[widget.metric]} · {widget.refreshSeconds}s</span>
          <span className="custom-widget-actions">
            <button type="button" onClick={() => void previewWidget(widget)} aria-label={s.previewAria(widget.title)}>👁</button>
            <button type="button" onClick={() => startEdit(widget)} aria-label={s.editAria(widget.title)}>✎</button>
            <button type="button" onClick={() => void duplicateWidget(widget)} aria-label={s.duplicateAria(widget.title)}>⧉</button>
            <button type="button" onClick={() => void toggleVisible(widget)} aria-label={widget.visible ? s.disableAria(widget.title) : s.enableAria(widget.title)}>
              {widget.visible ? '⏸' : '▶'}
            </button>
            <button className="delete" type="button" aria-label={s.deleteAria(widget.title)} onClick={() => void removeWidget(widget.id)}>×</button>
          </span>
          {previewId === widget.id && (
            <div className="custom-widget-preview">
              <strong>{s.previewTitle}</strong>
              {previewLines === null && <p className="empty">…</p>}
              {previewLines && previewLines.length === 0 && <p className="empty">{s.previewEmpty}</p>}
              {previewLines?.map((line, index) => <p className="empty" key={index}>{line}</p>)}
              <button type="button" onClick={() => { setPreviewId(null); setPreviewLines(null); }}>{s.closePreview}</button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
