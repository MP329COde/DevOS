import { useEffect, useRef, useState } from 'react';

import { Icon } from './Icon.js';
import { useLanguage, useStrings } from '../i18n/LanguageContext.js';

type TimelineEntryType =
  | 'item-created'
  | 'item-updated'
  | 'comment'
  | 'commit'
  | 'pipeline_started'
  | 'pipeline_finished'
  | 'tests'
  | 'image_published'
  | 'security_scan'
  | 'manifest_updated'
  | 'argocd_sync'
  | 'deployment_healthy'
  | 'release_published'
  | 'platform_update';

interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  occurredAt: string;
  itemId: string | null;
  itemTitle: string | null;
  itemType: string | null;
  devProjectId: string | null;
  summary: string;
  status?: string;
  actorEmail?: string;
  actorName?: string;
  releaseId?: string;
  environmentId?: string;
  commitRef?: string;
  pipelineRef?: string;
  version?: string;
}

/** Groupes de filtres affichés dans le tiroir — un type technique par bouton pour rester lisible. */
const FILTERABLE_TYPES: TimelineEntryType[] = [
  'item-created',
  'item-updated',
  'comment',
  'commit',
  'pipeline_started',
  'pipeline_finished',
  'tests',
  'image_published',
  'security_scan',
  'manifest_updated',
  'argocd_sync',
  'deployment_healthy',
  'release_published',
  'platform_update',
];

const strings = {
  fr: {
    loadError: 'Impossible de charger la timeline. Démarrez le backend pour connecter vos données.',
    ariaLabel: "Historique d'activité",
    title: 'Historique',
    close: "Fermer l'historique",
    filterAria: 'Filtrer la timeline',
    all: 'Tout',
    empty: 'Aucune activité pour ce filtre.',
    typeLabel: {
      'item-created': 'Création',
      'item-updated': 'Mise à jour',
      comment: 'Commentaire',
      commit: 'Commit',
      pipeline_started: 'Pipeline lancée',
      pipeline_finished: 'Pipeline terminée',
      tests: 'Tests',
      image_published: 'Image publiée',
      security_scan: 'Scan sécurité',
      manifest_updated: 'Manifest modifié',
      argocd_sync: 'ArgoCD Sync',
      deployment_healthy: 'Déploiement',
      release_published: 'Version publiée',
      platform_update: 'Mise à jour plateforme',
    } as Record<TimelineEntryType, string>,
    project: (id: string) => `projet ${id}`,
  },
  en: {
    loadError: 'Could not load the timeline. Start the backend to connect your data.',
    ariaLabel: 'Activity history',
    title: 'History',
    close: 'Close history',
    filterAria: 'Filter the timeline',
    all: 'All',
    empty: 'No activity for this filter.',
    typeLabel: {
      'item-created': 'Created',
      'item-updated': 'Updated',
      comment: 'Comment',
      commit: 'Commit',
      pipeline_started: 'Pipeline started',
      pipeline_finished: 'Pipeline finished',
      tests: 'Tests',
      image_published: 'Image published',
      security_scan: 'Security scan',
      manifest_updated: 'Manifest updated',
      argocd_sync: 'ArgoCD sync',
      deployment_healthy: 'Deployment',
      release_published: 'Release published',
      platform_update: 'Platform update',
    } as Record<TimelineEntryType, string>,
    project: (id: string) => `project ${id}`,
  },
} as const;

/**
 * Tiroir "Historique" consultable depuis n'importe quel panel (bouton dans le header), plutôt
 * qu'un onglet dédié dans le module Développement qui dupliquait une info utile partout ailleurs.
 * Ne charge les données que pendant que le tiroir est ouvert.
 */
export function ActivityTimelineDrawer({ apiBase, open, onClose }: { apiBase: string; open: boolean; onClose: () => void }) {
  const { language } = useLanguage();
  const s = useStrings(strings);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | TimelineEntryType>('all');
  const [error, setError] = useState('');
  const drawerRef = useRef<HTMLElement | null>(null);
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const timeout = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 160);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const url = new URL(`${apiBase}/api/dev-activity/timeline`);
    if (typeFilter !== 'all') url.searchParams.set('type', typeFilter);
    void fetch(url.toString())
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setTimeline((await response.json()) as TimelineEntry[]);
        setError('');
      })
      .catch(() => setError(s.loadError));
  }, [apiBase, open, typeFilter]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (drawerRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-history-toggle]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <aside className={closing ? 'history-drawer closing' : 'history-drawer'} aria-label={s.ariaLabel} ref={drawerRef}>
      <div className="history-drawer-header">
        <h3>{s.title}</h3>
        <button type="button" className="header-icon-button" aria-label={s.close} onClick={onClose}><Icon name="x" size={14} /></button>
      </div>
      <div className="filters" aria-label={s.filterAria}>
        <button className={typeFilter === 'all' ? 'filter active' : 'filter'} type="button" onClick={() => setTypeFilter('all')}>{s.all}</button>
        {FILTERABLE_TYPES.map((type) => (
          <button key={type} className={typeFilter === type ? 'filter active' : 'filter'} type="button" onClick={() => setTypeFilter(type)}>{s.typeLabel[type]}</button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!error && timeline.length === 0 && <p className="empty">{s.empty}</p>}
      {timeline.map((entry) => {
        const meta = [
          entry.itemType,
          entry.devProjectId ? s.project(entry.devProjectId) : null,
          entry.status,
          entry.commitRef ? `commit ${entry.commitRef}` : null,
          entry.pipelineRef ? `pipeline ${entry.pipelineRef}` : null,
          entry.version ? `v${entry.version}` : null,
          entry.actorName ?? entry.actorEmail ?? null,
        ].filter(Boolean);
        return (
          <article className="item" key={entry.id}>
            <span className="item-title"><strong>{s.typeLabel[entry.type]}</strong> — {entry.summary}</span>
            <span className="integrations">
              {new Date(entry.occurredAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}
              {meta.length > 0 ? ` · ${meta.join(' · ')}` : ''}
            </span>
          </article>
        );
      })}
    </aside>
  );
}
