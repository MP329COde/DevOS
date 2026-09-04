import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Command } from 'cmdk';

import { createAuthorizationRequest } from './auth/oidc.js';
import { NetworkGraph, type NetworkGraphEdge, type NetworkGraphNode } from './components/NetworkGraph.js';
import { IntegrationsPanel } from './components/IntegrationsPanel.js';
import { CustomWidgetsPanel, type CustomWidget } from './components/CustomWidgetsPanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { readUrlFilter, readUrlPanel, useUrlState } from './hooks/useUrlState.js';
import { THEME_COLOR_SETTINGS } from './theme.js';

const PANEL_IDS = ['home', 'items', 'today', 'triage', 'haproxy', 'catalog', 'docs', 'widgets', 'settings', 'network', 'integrations'] as const;

const oidcConfig = {
  issuerUrl: import.meta.env.VITE_KEYCLOAK_ISSUER_URL ?? 'https://keycloak.example.internal/realms/devos',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'devos',
  redirectUri: `${window.location.origin}/auth/callback`,
};

const iconPaths: Record<string, string> = {
  home: 'M3 10.5 10 4l7 6.5M5 9.5V17h10V9.5',
  tasks: 'M4 6h12M4 10h12M4 14h8M4 6l0 0M3.5 6l1 1 1.5-1.7M3.5 10l1 1 1.5-1.7',
  inbox: 'M3 5h14v7l-2.5 4h-9L3 12V5Z M3 12h4l1 2h4l1-2h4',
  clock: 'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3v3.2l2.2 1.3',
  network: 'M10 3v4M4.5 16h11M10 7 5 12M10 7l5 5M4.5 16v-3M15.5 16v-3',
  layers: 'M10 3 3 7l7 4 7-4-7-4Zm-7 7 7 4 7-4M3 13l7 4 7-4',
  doc: 'M6 3h6l3 3v11H6V3Zm6 0v3h3M8 10h5M8 13h5',
  widget: 'M4 4h5v5H4V4Zm7 0h5v5h-5V4ZM4 11h5v5H4v-5Zm7 0h5v5h-5v-5Z',
  gear: 'M10 6.5A3.5 3.5 0 1 0 10 13.5 3.5 3.5 0 0 0 10 6.5ZM10 2v2M10 16v2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M2 10h2M16 10h2M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4',
  pencil: 'M13.5 3.5 16.5 6.5 7 16H4v-3L13.5 3.5Z',
  chevron: 'M7 5l6 5-6 5',
  plus: 'M10 4v12M4 10h12',
  up: 'M5 12l5-5 5 5',
  down: 'M5 8l5 5 5-5',
  x: 'M5 5l10 10M15 5 5 15',
  dot: 'M10 10',
  drag: 'M7 5.5h.01M13 5.5h.01M7 10h.01M13 10h.01M7 14.5h.01M13 14.5h.01',
};

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name] ?? ''} />
    </svg>
  );
}

function StatusBadge({ state, label }: { state: 'ok' | 'warn' | 'off'; label: string }) {
  return (
    <span className={`status-badge status-badge-${state}`}>
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>
      {label}
    </span>
  );
}

const CRITICAL_WAZUH_LEVEL = 12;

// Cases de stats du dashboard : intégrées au même système homeWidgets que les autres widgets
// (déplaçables/masquables/réordonnables) au lieu d'un bloc séparé fixe.
const statWidgetDefs: Record<string, { title: string; icon: string; statusKey?: string }> = {
  'stat-total': { title: 'Items au total', icon: 'layers' },
  'stat-in_progress': { title: 'En cours', icon: 'clock', statusKey: 'in_progress' },
  'stat-blocked': { title: 'Bloqués', icon: 'gear', statusKey: 'blocked' },
  'stat-done': { title: 'Terminés', icon: 'doc', statusKey: 'done' },
};

const homeWidgetDefs: Record<string, { title: string; icon: string }> = {
  pipelines: { title: 'Pipelines en cours', icon: 'network' },
  alerts: { title: 'Alertes actives', icon: 'gear' },
  wazuh: { title: 'Sécurité (Wazuh)', icon: 'layers' },
  ...statWidgetDefs,
};

/**
 * Calcule CPU/RAM/disque à partir des métriques brutes d'un exporter Prometheus de type
 * node_exporter (clés standard node_load1, node_memory_*, node_filesystem_*). Best-effort :
 * une ligne n'est produite que si les métriques nécessaires sont présentes.
 */
function summarizeMachinePerformance(metrics: Record<string, number>): string[] {
  const lines: string[] = [];
  const load1 = metrics['node_load1'];
  if (typeof load1 === 'number') lines.push(`Charge CPU (1m) : ${load1.toFixed(2)}`);

  const memTotalKey = Object.keys(metrics).find((k) => k.startsWith('node_memory_MemTotal_bytes'));
  const memAvailKey = Object.keys(metrics).find((k) => k.startsWith('node_memory_MemAvailable_bytes'));
  if (memTotalKey && memAvailKey && metrics[memTotalKey] > 0) {
    const used = 100 - (metrics[memAvailKey] / metrics[memTotalKey]) * 100;
    lines.push(`RAM utilisée : ${used.toFixed(0)}%`);
  }

  const fsSizeKey = Object.keys(metrics).find((k) => k.startsWith('node_filesystem_size_bytes') && k.includes('mountpoint="/"'));
  const fsAvailKey = Object.keys(metrics).find((k) => k.startsWith('node_filesystem_avail_bytes') && k.includes('mountpoint="/"'));
  if (fsSizeKey && fsAvailKey && metrics[fsSizeKey] > 0) {
    const used = 100 - (metrics[fsAvailKey] / metrics[fsSizeKey]) * 100;
    lines.push(`Disque (/) utilisé : ${used.toFixed(0)}%`);
  }

  return lines;
}

// Widgets génériques pour les intégrations exposées via /api/extras/* (voir backend/src/catalog/extras-http.ts).
const extraWidgetCatalog: Record<string, { title: string; icon: string; path: string; extract: (data: unknown) => string[] }> = {
  'extra:grafana': { title: 'Tableaux de bord Grafana', icon: 'layers', path: '/api/extras/grafana/dashboards', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { title?: string }).title ?? d)) : []) },
  'extra:harbor': { title: 'Projets Harbor', icon: 'layers', path: '/api/extras/harbor/projects', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { name?: string }).name ?? d)) : []) },
  'extra:proxmox': { title: 'Nœuds Proxmox', icon: 'network', path: '/api/extras/proxmox/nodes', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { node?: string }).node ?? d)) : []) },
  'extra:minio': { title: 'Buckets MinIO', icon: 'layers', path: '/api/extras/minio/buckets', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { name?: string }).name ?? d)) : []) },
  'extra:rabbitmq': { title: 'Files RabbitMQ', icon: 'layers', path: '/api/extras/rabbitmq/queues', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { name?: string }).name ?? d)) : []) },
  'extra:dns': { title: 'Zones DNS', icon: 'network', path: '/api/extras/dns/zones', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { name?: string }).name ?? d)) : []) },
  'extra:machine-perf': { title: 'Performance machine', icon: 'gear', path: '/api/extras/metrics/node', extract: (data) => summarizeMachinePerformance(data as Record<string, number>) },
};
Object.entries(extraWidgetCatalog).forEach(([id, def]) => { homeWidgetDefs[id] = { title: def.title, icon: def.icon }; });

// Données fictives affichées en mode édition quand un widget n'a pas encore de données réelles
// (503 / intégration non configurée), pour prévisualiser son rendu plutôt que de montrer un vide.
const mockWidgetPreview: Record<string, string[]> = {
  pipelines: ['#128 · main · running (exemple)', '#127 · feature/x · success (exemple)'],
  alerts: ['HighCPU · firing (exemple)', 'DiskSpaceLow · firing (exemple)'],
  wazuh: ['Connexion SSH suspecte · niveau 10 (exemple)', 'Modification fichier système · niveau 7 (exemple)'],
  'extra:grafana': ['Dashboard Infra (exemple)', 'Dashboard Pipelines (exemple)'],
  'extra:harbor': ['projet-devos (exemple)', 'projet-infra (exemple)'],
  'extra:proxmox': ['pve-node-1 (exemple)', 'pve-node-2 (exemple)'],
  'extra:minio': ['backups (exemple)', 'artifacts (exemple)'],
  'extra:rabbitmq': ['tasks.default (exemple)', 'notifications (exemple)'],
  'extra:dns': ['example.internal (exemple)', 'lab.internal (exemple)'],
  'extra:machine-perf': ['Charge CPU (1m) : 0.42 (exemple)', 'RAM utilisée : 61% (exemple)', 'Disque (/) utilisé : 47% (exemple)'],
};

export function App() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<Array<{ id: string; title: string; type: string; status: string; dueAt?: string | null; mergeRequestState?: string | null; pipelineStatus?: string | null; coderWorkspaceName?: string | null; coderWorkspaceStatus?: string | null; required?: boolean }>>([]);
  const [workspaceLinks, setWorkspaceLinks] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState(() => readUrlFilter('all'));
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [labels, setLabels] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [view, setView] = useState<'list' | 'board' | 'gantt' | 'calendar'>('list');
  const [itemsError, setItemsError] = useState('');
  const [panel, setPanel] = useState<(typeof PANEL_IDS)[number]>(() => readUrlPanel(PANEL_IDS, 'home'));
  const [navLayout, setNavLayout] = useState<'sidebar' | 'topbar'>(() => (localStorage.getItem('devos.navLayout') as 'sidebar' | 'topbar' | null) ?? 'sidebar');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => (localStorage.getItem('devos.theme') as 'light' | 'dark' | 'system' | null) ?? 'system');
  const [themeColors, setThemeColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('devos.themeColors') ?? '{}'); } catch { return {}; }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('devos.sidebarCollapsed') === '1');
  const [homeEditMode, setHomeEditMode] = useState(false);
  const [homeWidgets, setHomeWidgets] = useState<Array<{ id: string; visible: boolean }>>(() => {
    const saved = localStorage.getItem('devos.homeWidgets');
    const defaultStats = Object.keys(statWidgetDefs).map((id) => ({ id, visible: true }));
    const base: Array<{ id: string; visible: boolean }> = saved
      ? JSON.parse(saved)
      : [...defaultStats, { id: 'pipelines', visible: true }, { id: 'alerts', visible: true }, { id: 'wazuh', visible: true }];
    const known = new Set(base.map((w) => w.id));
    // Migration : ajoute les nouveaux widgets connus (stats désormais éditables, nouvelles intégrations)
    // absents d'une configuration déjà sauvegardée, sans écraser l'ordre/visibilité existants.
    const missingStats = Object.keys(statWidgetDefs).filter((id) => !known.has(id)).map((id, index) => ({ id, visible: true, _prepend: index }));
    const missingExtras = Object.keys(extraWidgetCatalog).filter((id) => !known.has(id)).map((id) => ({ id, visible: false }));
    return [...missingStats.map(({ id, visible }) => ({ id, visible })), ...base, ...missingExtras];
  });
  const [extraWidgetData, setExtraWidgetData] = useState<Record<string, string[] | 'error'>>({});
  const [customWidgets, setCustomWidgets] = useState<CustomWidget[]>([]);
  const customWidgetDefs = useMemo(() => {
    const defs: Record<string, { title: string; icon: string; path: string; extract: (data: unknown) => string[] }> = {};
    for (const widget of customWidgets) {
      defs[`custom:${widget.id}`] = {
        title: widget.title,
        icon: 'gear',
        path: widget.sourcePath,
        extract: (data) => (Array.isArray(data) ? data.map((entry) => `${widget.label} : ${String((entry as Record<string, unknown>)[widget.dataKey] ?? '—')}`) : []),
      };
    }
    return defs;
  }, [customWidgets]);
  const combinedWidgetDefs = useMemo(() => {
    const defs: Record<string, { title: string; icon: string }> = { ...homeWidgetDefs };
    for (const [id, def] of Object.entries(customWidgetDefs)) defs[id] = { title: def.title, icon: def.icon };
    return defs;
  }, [customWidgetDefs]);
  const combinedExtraCatalog = useMemo(() => ({ ...extraWidgetCatalog, ...customWidgetDefs }), [customWidgetDefs]);
  const [wazuhAlerts, setWazuhAlerts] = useState<Array<{ id: string; ruleDescription: string; level: number; timestamp: string }> | null>(null);
  const [content, setContent] = useState('');
  const [dashboardDay, setDashboardDay] = useState<'today' | 'tomorrow'>('today');
  const [dashboardItems, setDashboardItems] = useState<Array<{ id: string; title: string; type: string; dueAt?: string | null }>>([]);
  const [cycles, setCycles] = useState<Array<{ id: string; name: string; closedAt?: string | null }>>([]);
  const [triage, setTriage] = useState<Array<{ id: string; title: string; type: string }>>([]);
  const [activeTimers, setActiveTimers] = useState<Record<string, string>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [haproxyBackends, setHaproxyBackends] = useState<Array<{ name: string; mode?: string }>>([]);
  const [haproxyServers, setHaproxyServers] = useState<Record<string, Array<{ name: string; address: string; port: number }>>>({});
  const [haproxyError, setHaproxyError] = useState('');
  const [catalogEntities, setCatalogEntities] = useState<Array<{ kind: string; name: string; type: string; owner: string; sourceProject: string }>>([]);
  const [catalogGraph, setCatalogGraph] = useState<{ nodes: Array<{ id: string; known: boolean }>; edges: Array<{ from: string; to: string }> }>({ nodes: [], edges: [] });
  const [catalogError, setCatalogError] = useState('');
  const [templateSource, setTemplateSource] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateOwner, setTemplateOwner] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateResult, setTemplateResult] = useState<{ yaml: string } | null>(null);
  const [templateError, setTemplateError] = useState('');
  const [k8sNodes, setK8sNodes] = useState<Array<{ name: string; ready: boolean }>>([]);
  const [argoApps, setArgoApps] = useState<Array<{ name: string; syncStatus: string; healthStatus: string }>>([]);
  const [docPages, setDocPages] = useState<Array<{ id: string; title: string; sourceProject: string; path: string; pageType?: 'scanned' | 'onboarding' }>>([]);
  const [docsFilter, setDocsFilter] = useState<'all' | 'onboarding' | 'scanned'>('all');
  const [onboardingTitle, setOnboardingTitle] = useState('');
  const [onboardingContent, setOnboardingContent] = useState('');
  const [docsError, setDocsError] = useState('');
  const [widgetData, setWidgetData] = useState<{ pipelines: { running: number; items: Array<{ id: number; status: string; ref: string; web_url: string }> }; alerts: { active: number; critical: number; items: Array<{ fingerprint: string; labels: Record<string, string>; status: { state: string }; startsAt: string }> } } | null>(null);
  const [widgetsError, setWidgetsError] = useState('');
  const [enabledWidgets, setEnabledWidgets] = useState<Record<'pipelines' | 'alerts', boolean>>(() => {
    const saved = localStorage.getItem('devos.widgets');
    return saved ? JSON.parse(saved) : { pipelines: true, alerts: true };
  });
  const [networkGraph, setNetworkGraph] = useState<{ nodes: NetworkGraphNode[]; edges: NetworkGraphEdge[] } | null>(null);
  const [networkError, setNetworkError] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<Array<{ uid: string; title: string; start: string; end?: string; allDay: boolean; source: 'personal' | 'professional' }>>([]);
  const [calendarError, setCalendarError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => (typeof Notification === 'undefined' ? 'denied' : Notification.permission));
  const titleInput = useRef<HTMLInputElement>(null);

  useUrlState(panel, setPanel, PANEL_IDS, filter, setFilter);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => { localStorage.setItem('devos.sidebarCollapsed', sidebarCollapsed ? '1' : '0'); }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('devos.theme', themeMode);
    if (themeMode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('devos.themeColors', JSON.stringify(themeColors));
    for (const { cssVar } of THEME_COLOR_SETTINGS) {
      const value = themeColors[cssVar];
      if (value) document.documentElement.style.setProperty(`--${cssVar}`, value);
      else document.documentElement.style.removeProperty(`--${cssVar}`);
    }
  }, [themeColors]);

  useEffect(() => {
    if (notificationPermission !== 'granted') return;
    const notifiedKey = 'devos.notifiedIds';
    const notifiedSet = new Set<string>(JSON.parse(localStorage.getItem(notifiedKey) ?? '[]'));
    const now = Date.now();
    const overdue = items.filter((item) => item.dueAt && item.status !== 'done' && new Date(item.dueAt).getTime() < now && !notifiedSet.has(`item:${item.id}`));
    const critical = (wazuhAlerts ?? []).filter((alert) => alert.level >= CRITICAL_WAZUH_LEVEL && !notifiedSet.has(`wazuh:${alert.id}`));
    if (overdue.length === 0 && critical.length === 0) return;

    const dispatch = (title: string, message: string) => {
      new Notification(title, { body: message });
      void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/notifications/trigger`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, message }),
      }).catch(() => undefined);
    };
    for (const item of overdue) { dispatch('Échéance dépassée', item.title); notifiedSet.add(`item:${item.id}`); }
    for (const alert of critical) { dispatch('Alerte critique', alert.ruleDescription); notifiedSet.add(`wazuh:${alert.id}`); }
    localStorage.setItem(notifiedKey, JSON.stringify([...notifiedSet]));
  }, [items, wazuhAlerts, notificationPermission]);
  useEffect(() => { localStorage.setItem('devos.homeWidgets', JSON.stringify(homeWidgets)); }, [homeWidgets]);

  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  const reorderHomeWidget = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setHomeWidgets((current) => {
      const sourceIndex = current.findIndex((w) => w.id === sourceId);
      const targetIndex = current.findIndex((w) => w.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };
  const toggleHomeWidget = (id: string) => setHomeWidgets((current) => current.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));

  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/items`)
      .then(async (response) => {
        if (!response.ok) throw new Error('API indisponible');
        setItems(await response.json());
      })
      .catch(() => setItemsError('Impossible de charger les items. Démarrez le backend pour connecter vos données.'));
  }, []);

  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/triage`)
      .then(async (response) => { if (!response.ok) throw new Error(); setTriage(await response.json()); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/cycles`)
      .then(async (response) => { if (!response.ok) throw new Error(); setCycles(await response.json()); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (panel !== 'today') return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/dashboard/${dashboardDay}`)
      .then(async (response) => { if (!response.ok) throw new Error(); setDashboardItems(await response.json()); })
      .catch(() => setDashboardItems([]));
  }, [panel, dashboardDay]);

  useEffect(() => {
    localStorage.setItem('devos.navLayout', navLayout);
  }, [navLayout]);

  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/custom-widgets`)
      .then(async (response) => { if (response.ok) setCustomWidgets(await response.json()); })
      .catch(() => undefined);
  }, []);

  // Ajoute les widgets custom nouvellement créés (chargés après le montage) au set connu, masqués par défaut.
  useEffect(() => {
    if (customWidgets.length === 0) return;
    setHomeWidgets((current) => {
      const known = new Set(current.map((w) => w.id));
      const missing = customWidgets.filter((widget) => !known.has(`custom:${widget.id}`)).map((widget) => ({ id: `custom:${widget.id}`, visible: false }));
      return missing.length > 0 ? [...current, ...missing] : current;
    });
  }, [customWidgets]);

  useEffect(() => {
    if (panel !== 'home') return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/extras/dashboard/widgets`)
      .then(async (response) => { if (response.ok) setWidgetData(await response.json()); })
      .catch(() => undefined);
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/extras/wazuh/alerts`)
      .then(async (response) => { if (response.ok) setWazuhAlerts(await response.json()); })
      .catch(() => undefined);
  }, [panel]);

  useEffect(() => {
    if (panel !== 'home') return;
    homeWidgets.filter((w) => w.visible && combinedExtraCatalog[w.id]).forEach((w) => {
      const def = combinedExtraCatalog[w.id];
      void (async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}${def.path}`);
          if (!response.ok) throw new Error('indisponible');
          const json = await response.json();
          setExtraWidgetData((current) => ({ ...current, [w.id]: def.extract(json) }));
        } catch {
          setExtraWidgetData((current) => ({ ...current, [w.id]: 'error' }));
        }
      })();
    });
  }, [panel, homeWidgets, combinedExtraCatalog]);

  useEffect(() => {
    if (panel !== 'items' || view !== 'calendar') return;
    setCalendarError('');
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/calendar/events`)
      .then(async (response) => {
        if (!response.ok) { setCalendarEvents([]); setCalendarError(response.status === 503 ? 'Aucun calendrier ICS configuré.' : 'Calendriers externes indisponibles.'); return; }
        setCalendarEvents(await response.json());
      })
      .catch(() => setCalendarError('Calendriers externes indisponibles.'));
  }, [panel, view]);

  useEffect(() => {
    if (panel !== 'network') return;
    setNetworkError('');
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/infra/network-topology`)
      .then(async (response) => {
        if (!response.ok) { setNetworkError(response.status === 503 ? 'Non configuré (Proxmox + PowerDNS requis).' : 'Topologie réseau indisponible.'); return; }
        setNetworkGraph(await response.json());
      })
      .catch(() => setNetworkError('Topologie réseau indisponible.'));
  }, [panel]);

  useEffect(() => {
    if (panel !== 'haproxy') return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/haproxy/backends`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? 'HAProxy n’est pas configuré sur ce backend.' : 'Impossible de charger les backends HAProxy.');
        const backends = await response.json();
        setHaproxyBackends(backends);
        setHaproxyError('');
        for (const backend of backends as Array<{ name: string }>) {
          void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/haproxy/backends/${encodeURIComponent(backend.name)}/servers`)
            .then(async (response) => { if (!response.ok) return; const servers = await response.json(); setHaproxyServers((current) => ({ ...current, [backend.name]: servers })); })
            .catch(() => undefined);
        }
      })
      .catch((error: Error) => setHaproxyError(error.message));
  }, [panel]);

  useEffect(() => {
    if (panel !== 'catalog') return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/catalog/entities`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? 'Le catalogue n’est pas configuré sur ce backend.' : 'Impossible de charger le catalogue.');
        setCatalogEntities(await response.json());
        setCatalogError('');
      })
      .catch((error: Error) => setCatalogError(error.message));
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/catalog/graph`)
      .then(async (response) => { if (response.ok) setCatalogGraph(await response.json()); })
      .catch(() => undefined);
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/catalog/kubernetes/nodes`)
      .then(async (response) => { if (response.ok) setK8sNodes(await response.json()); })
      .catch(() => undefined);
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/catalog/argocd/applications`)
      .then(async (response) => { if (response.ok) setArgoApps(await response.json()); })
      .catch(() => undefined);
  }, [panel]);

  useEffect(() => {
    if (panel !== 'docs') return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/docs`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? 'Les docs ne sont pas configurées sur ce backend.' : 'Impossible de charger les docs.');
        setDocPages(await response.json());
        setDocsError('');
      })
      .catch((error: Error) => setDocsError(error.message));
  }, [panel]);

  useEffect(() => {
    if (panel !== 'widgets') return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/extras/dashboard/widgets`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? 'Les widgets ne sont pas configurés sur ce backend.' : 'Impossible de charger les widgets.');
        setWidgetData(await response.json());
        setWidgetsError('');
      })
      .catch((error: Error) => setWidgetsError(error.message));
  }, [panel]);

  useEffect(() => {
    localStorage.setItem('devos.widgets', JSON.stringify(enabledWidgets));
  }, [enabledWidgets]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const expectedState = sessionStorage.getItem('devos.oidc.state');
    const codeVerifier = sessionStorage.getItem('devos.oidc.verifier');

    if (!code && !state) return;
    if (!code || state !== expectedState || !codeVerifier) {
      setStatus('La réponse Keycloak est invalide.');
      return;
    }

    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/auth/callback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, codeVerifier }),
      credentials: 'include',
    }).then((response) => {
      setStatus(response.ok ? 'Session ouverte.' : 'Impossible d’ouvrir la session.');
      sessionStorage.removeItem('devos.oidc.state');
      sessionStorage.removeItem('devos.oidc.verifier');
    }).catch(() => setStatus('Le serveur de session est indisponible.'));
  }, []);

  async function signIn() {
    const request = await createAuthorizationRequest(oidcConfig);
    sessionStorage.setItem('devos.oidc.state', request.state);
    sessionStorage.setItem('devos.oidc.verifier', request.codeVerifier);
    setStatus('Redirection vers Keycloak...');
    window.location.assign(request.url);
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/items`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, title, labels: labels.split(',').map((label) => label.trim()).filter(Boolean), ...(dueAt ? { dueAt: new Date(`${dueAt}T12:00:00`).toISOString() } : {}), ...(type === 'doc' && content ? { content } : {}) }),
    });
    if (!response.ok) { setItemsError('Création impossible.'); return; }
    const created = await response.json();
    setItems((current) => [created, ...current]);
    setTitle('');
    setLabels('');
    setDueAt('');
    setContent('');
  }

  async function updateStatus(item: { id: string }, nextStatus: string) {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/items/${item.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) {
      const updated = await response.json();
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    }
  }

  async function toggleRequired(item: { id: string; required?: boolean }) {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/items/${item.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ required: !item.required }),
    });
    if (response.ok) {
      const updated = await response.json();
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    }
  }

  async function deleteItem(item: { id: string }) {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/items/${item.id}`, { method: 'DELETE' });
    if (response.ok) setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  async function toggleTimer(item: { id: string }) {
    const activeId = activeTimers[item.id];
    const endpoint = activeId ? `/api/time/${activeId}/stop` : `/api/items/${item.id}/time`;
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}${endpoint}`, { method: 'POST' });
    if (!response.ok) return;
    const entry = await response.json();
    setActiveTimers((current) => {
      const next = { ...current };
      if (activeId) delete next[item.id]; else next[item.id] = entry.id;
      return next;
    });
  }

  async function openWorkspace(item: { id: string }) {
    const existingLink = workspaceLinks[item.id];
    if (existingLink) { window.location.assign(existingLink); return; }
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/items/${item.id}/workspace`, { method: 'POST' });
    if (!response.ok) { setItemsError('Impossible d’ouvrir l’environnement Coder.'); return; }
    const workspace = await response.json();
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, coderWorkspaceName: workspace.workspaceName, coderWorkspaceStatus: workspace.status } : entry));
    setWorkspaceLinks((current) => ({ ...current, [item.id]: workspace.vscodeUri }));
    window.location.assign(workspace.vscodeUri);
  }

  async function closeCycle(id: string) {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/cycles/${id}/close`, { method: 'POST' });
    if (response.ok) setCycles((current) => current.map((cycle) => cycle.id === id ? { ...cycle, closedAt: new Date().toISOString() } : cycle));
  }

  async function transitionTriage(id: string, action: 'accept' | 'reject') {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/triage/${id}/${action}`, { method: 'POST' });
    if (response.ok) setTriage((current) => current.filter((item) => item.id !== id));
  }

  async function scanCatalog() {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/catalog/scan`, { method: 'POST' });
    if (!response.ok) { setCatalogError('Le scan du catalogue a échoué.'); return; }
    const [entitiesResponse, graphResponse] = await Promise.all([
      fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/catalog/entities`),
      fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/catalog/graph`),
    ]);
    if (entitiesResponse.ok) setCatalogEntities(await entitiesResponse.json());
    if (graphResponse.ok) setCatalogGraph(await graphResponse.json());
  }

  async function createProjectFromTemplate(event: FormEvent) {
    event.preventDefault();
    setTemplateError('');
    setTemplateResult(null);
    const [templateKind, templateNameOfSource] = templateSource.split(':');
    if (!templateKind || !templateNameOfSource) { setTemplateError('Choisissez un modèle.'); return; }
    if (!templateName.trim()) { setTemplateError('Le nom du nouveau projet est requis.'); return; }
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/catalog/template`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateKind, templateName: templateNameOfSource, name: templateName.trim(), owner: templateOwner.trim() || undefined, description: templateDescription.trim() || undefined }),
    });
    if (!response.ok) { const body = await response.json().catch(() => ({})); setTemplateError((body as { error?: string }).error ?? 'La création du projet a échoué.'); return; }
    const result = await response.json();
    setTemplateResult(result);
    setTemplateName('');
    setTemplateDescription('');
    const entitiesResponse = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/catalog/entities`);
    if (entitiesResponse.ok) setCatalogEntities(await entitiesResponse.json());
  }

  async function scanDocs() {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/docs/scan`, { method: 'POST' });
    if (!response.ok) { setDocsError('Le scan des docs a échoué.'); return; }
    const docsResponse = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/docs`);
    if (docsResponse.ok) setDocPages(await docsResponse.json());
  }

  async function createOnboardingPage(event: FormEvent) {
    event.preventDefault();
    if (!onboardingTitle.trim() || !onboardingContent.trim()) return;
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/docs/onboarding`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: onboardingTitle, content: onboardingContent }),
    });
    if (!response.ok) { setDocsError('La création de la fiche onboarding a échoué.'); return; }
    const created = await response.json();
    setDocPages((current) => [...current, created]);
    setOnboardingTitle('');
    setOnboardingContent('');
  }

  const visibleItems = filter === 'all' ? items : filter === 'required' ? items.filter((item) => item.required) : items.filter((item) => item.type === filter);
  const groupedItems = visibleItems.reduce<Record<string, typeof visibleItems>>((groups, item) => {
    const key = view === 'calendar' || view === 'gantt' ? (item.dueAt ? new Date(item.dueAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'Sans date') : item.status.replace('_', ' ');
    (groups[key] ??= []).push(item);
    return groups;
  }, {});
  const statusCounts = items.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; }, {});
  const navItems: Array<{ id: typeof panel; label: string; badge?: number; icon: string; group: string }> = [
    { id: 'home', label: 'Dashboard', icon: 'home', group: 'Vue d’ensemble' },
    { id: 'items', label: 'Tâches', icon: 'tasks', group: 'Travail' },
    { id: 'triage', label: 'Triage', badge: triage.length, icon: 'inbox', group: 'Travail' },
    { id: 'today', label: 'Aujourd’hui', icon: 'clock', group: 'Travail' },
    { id: 'catalog', label: 'Catalogue', icon: 'layers', group: 'Infrastructure' },
    { id: 'network', label: 'Topologie réseau', icon: 'network', group: 'Infrastructure' },
    { id: 'integrations', label: 'Intégrations', icon: 'widget', group: 'Infrastructure' },
    { id: 'haproxy', label: 'Infra HAProxy', icon: 'network', group: 'Infrastructure' },
    { id: 'widgets', label: 'Widgets', icon: 'widget', group: 'Infrastructure' },
    { id: 'settings', label: 'Paramètres', icon: 'gear', group: 'Autres' },
    { id: 'docs', label: 'Docs', icon: 'doc', group: 'Autres' },
  ];
  const navGroups = navItems.reduce<Array<{ group: string; items: typeof navItems }>>((groups, item) => {
    const existing = groups.find((g) => g.group === item.group);
    if (existing) existing.items.push(item); else groups.push({ group: item.group, items: [item] });
    return groups;
  }, []);
  const collapsed = navLayout === 'sidebar' && sidebarCollapsed;
  const navButton = (item: (typeof navItems)[number]) => (
    <button key={item.id} className={panel === item.id ? 'nav-link active' : 'nav-link'} type="button" aria-current={panel === item.id ? 'page' : undefined} title={collapsed ? item.label : undefined} onClick={() => setPanel(item.id)}>
      <Icon name={item.icon} />
      {!collapsed && <span className="nav-label">{item.label}</span>}
      {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
    </button>
  );
  const itemCard = (item: typeof items[number]) =><article className={item.required ? 'item item-required' : 'item'} key={item.id}><span className={`type type-${item.type}`}>{item.type}</span><span className="item-title"><strong>{item.title}</strong>{item.required && <span className="required-badge" title="Item obligatoire">Obligatoire</span>}</span><span className="integrations">{item.mergeRequestState && `MR ${item.mergeRequestState}`}{item.pipelineStatus && ` · CI ${item.pipelineStatus}`}{item.coderWorkspaceStatus && ` · Workspace ${item.coderWorkspaceStatus}`}</span><select className="item-status" aria-label={`Statut de ${item.title}`} value={item.status} onChange={(event) => void updateStatus(item, event.target.value)}><option value="backlog">backlog</option><option value="in_progress">in progress</option><option value="done">done</option><option value="blocked">blocked</option></select><span className="item-actions"><button className={item.required ? 'required-toggle active' : 'required-toggle'} type="button" aria-pressed={Boolean(item.required)} aria-label={item.required ? `Retirer le caractère obligatoire de ${item.title}` : `Marquer ${item.title} comme obligatoire`} onClick={() => void toggleRequired(item)}>{item.required ? 'Obligatoire ✓' : 'Marquer obligatoire'}</button>{item.type === 'task' && <button className="open-workspace" type="button" onClick={() => void openWorkspace(item)}>{item.coderWorkspaceName ? 'Ouvrir dans VS Code' : 'Ouvrir un environnement'}</button>}<button className="timer" type="button" onClick={() => void toggleTimer(item)}>{activeTimers[item.id] ? 'Arrêter' : 'Démarrer'}</button><button className="delete" type="button" aria-label={`Supprimer ${item.title}`} onClick={() => void deleteItem(item)}>×</button></span></article>;

  return (
    <div className={`shell layout-${navLayout}`}>
      <header className="topbar">
        <div><div className="eyebrow">DEVOS / HOMELAB COMMAND</div><h1 id="title">{navItems.find((n) => n.id === panel)?.label ?? 'Dashboard'}</h1></div>
      </header>
      {navLayout === 'sidebar' && (
        <nav className={collapsed ? 'sidebar collapsed' : 'sidebar'} aria-label="Navigation">
          <button type="button" className="sidebar-collapse" aria-label={collapsed ? 'Déplier la navigation' : 'Replier la navigation'} onClick={() => setSidebarCollapsed((c) => !c)}>
            <Icon name="chevron" />
          </button>
          {navGroups.map((g) => (
            <div className="nav-group" key={g.group}>
              {!collapsed && <div className="nav-group-label">{g.group}</div>}
              {g.items.map(navButton)}
            </div>
          ))}
        </nav>
      )}
      <main className="workspace" aria-labelledby="items-title">
        {navLayout === 'topbar' && <nav className="views topnav" aria-label="Navigation">{navItems.map(navButton)}</nav>}
        {panel === 'home' ? (
          <div className="home-dashboard">
            <div className="widget-toolbar">
              {homeEditMode ? (
                <button type="button" className="filter active finish-edit" onClick={() => setHomeEditMode(false)}>
                  <Icon name="x" size={14} /> Terminer l'édition
                </button>
              ) : (
                <button type="button" className="edit-toggle" aria-label="Modifier le dashboard" title="Modifier le dashboard" onClick={() => setHomeEditMode(true)}>
                  <Icon name="pencil" />
                </button>
              )}
            </div>
            {homeEditMode && homeWidgets.some((w) => !w.visible) && (
              <div className="widget-add-panel">
                <h4>Ajouter un widget</h4>
                <div className="widget-add-list">
                  {homeWidgets.filter((w) => !w.visible).map((w) => (
                    <button type="button" className="widget-add-chip" key={w.id} onClick={() => toggleHomeWidget(w.id)}>
                      <Icon name={combinedWidgetDefs[w.id].icon} size={14} /> {combinedWidgetDefs[w.id].title}
                      <Icon name="plus" size={12} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className={homeEditMode ? 'widget-grid edit-mode' : 'widget-grid'}>
              {homeWidgets.filter((w) => w.visible).map((w) => {
                const def = combinedWidgetDefs[w.id];
                const statDef = statWidgetDefs[w.id];
                const extraDataForWidget = extraWidgetData[w.id];
                const unconfigured = w.id === 'pipelines' ? !widgetData
                  : w.id === 'wazuh' ? !wazuhAlerts
                  : (w.id === 'alerts' ? !widgetData
                  : (!statDef && (extraDataForWidget === 'error' || extraDataForWidget === undefined)));
                const preview = homeEditMode && unconfigured ? mockWidgetPreview[w.id] : undefined;
                const body = statDef
                  ? <span className="stat-widget-value">{statDef.statusKey ? (statusCounts[statDef.statusKey] ?? 0) : items.length}</span>
                  : preview
                  ? <>
                      <p className="widget-preview-label">Aperçu (données d'exemple) — intégration non configurée</p>
                      {preview.map((line, index) => <p className="empty preview-example" key={index}>{line}</p>)}
                    </>
                  : w.id === 'pipelines'
                  ? (widgetData ? (widgetData.pipelines.items.length > 0 ? widgetData.pipelines.items.map((p) => <p key={p.id} className="empty">#{p.id} · {p.ref} · {p.status}</p>) : <p className="empty">Aucun pipeline en cours.</p>) : <StatusBadge state="off" label="Non configuré" />)
                  : w.id === 'alerts'
                  ? (widgetData ? (widgetData.alerts.items.length > 0 ? widgetData.alerts.items.map((a) => <p key={a.fingerprint} className="empty">{a.labels.alertname ?? a.fingerprint} · {a.status.state}</p>) : <p className="empty">Aucune alerte active.</p>) : <StatusBadge state="off" label="Non configuré" />)
                  : w.id === 'wazuh'
                  ? (wazuhAlerts ? (wazuhAlerts.length > 0 ? wazuhAlerts.slice(0, 5).map((a) => <p key={a.id} className="empty">{a.ruleDescription} · niveau {a.level}</p>) : <p className="empty">Aucune alerte Wazuh.</p>) : <StatusBadge state="off" label="Non configuré" />)
                  : extraDataForWidget === 'error' || extraDataForWidget === undefined
                  ? <StatusBadge state="off" label="Non configuré" />
                  : extraDataForWidget.length > 0 ? extraDataForWidget.slice(0, 6).map((line, index) => <p className="empty" key={index}>{line}</p>) : <p className="empty">Aucune donnée.</p>;
                return (
                  <section
                    className={`widget-card${statDef ? ' stat-widget' : ''}${draggedWidgetId === w.id ? ' dragging' : ''}${dragOverWidgetId === w.id && draggedWidgetId !== w.id ? ' drag-over' : ''}`}
                    key={w.id}
                    draggable={homeEditMode}
                    onDragStart={(event) => { setDraggedWidgetId(w.id); event.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={(event) => { if (!homeEditMode || !draggedWidgetId) return; event.preventDefault(); setDragOverWidgetId(w.id); }}
                    onDragLeave={() => setDragOverWidgetId((current) => (current === w.id ? null : current))}
                    onDrop={(event) => { event.preventDefault(); if (draggedWidgetId) reorderHomeWidget(draggedWidgetId, w.id); setDraggedWidgetId(null); setDragOverWidgetId(null); }}
                    onDragEnd={() => { setDraggedWidgetId(null); setDragOverWidgetId(null); }}
                  >
                    <h3><Icon name={def.icon} /> {def.title}{homeEditMode && (
                      <span className="widget-controls">
                        <span className="widget-drag-handle" aria-hidden="true" title="Glisser pour réordonner"><Icon name="drag" size={14} /></span>
                        <button type="button" aria-label="Masquer" onClick={() => toggleHomeWidget(w.id)}><Icon name="x" size={14} /></button>
                      </span>
                    )}</h3>
                    {body}
                  </section>
                );
              })}
            </div>
          </div>
        ) : panel === 'items' ? (<>
        {cycles.length > 0 && <aside className="cycles" aria-label="Cycles"><span className="kicker">CYCLE ACTIF</span>{cycles.filter((cycle) => !cycle.closedAt).map((cycle) => <div className="cycle" key={cycle.id}><strong>{cycle.name}</strong><button type="button" onClick={() => void closeCycle(cycle.id)}>Clôturer</button></div>)}</aside>}
        <div className="section-heading"><div><span className="kicker">WORK QUEUE</span><h2 id="items-title">Vos items</h2></div><div className="filters" aria-label="Filtrer les items">{['all', 'task', 'doc', 'goal', 'required'].map((value) => <button className={filter === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => setFilter(value)}>{value === 'all' ? 'Tout' : value === 'required' ? 'Obligatoires' : value}</button>)}</div></div>
        <nav className="views" aria-label="Vues">{(['list', 'board', 'gantt', 'calendar'] as const).map((value) => <button className={view === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => setView(value)}>{value === 'list' ? 'Liste' : value === 'board' ? 'Board' : value === 'gantt' ? 'Gantt' : 'Calendrier'}</button>)}</nav>
        <form className="new-item" onSubmit={createItem}><select aria-label="Type" value={type} onChange={(event) => setType(event.target.value)}><option value="task">Tâche</option><option value="doc">Document</option><option value="goal">Objectif</option></select><input ref={titleInput} aria-label="Titre" placeholder="Ajouter un item..." value={title} onChange={(event) => setTitle(event.target.value)} /><input aria-label="Labels" placeholder="type::bug, priority::high" value={labels} onChange={(event) => setLabels(event.target.value)} /><input aria-label="Échéance" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><button type="submit">Ajouter</button></form>
        {type === 'doc' && <textarea className="doc-editor" aria-label="Contenu du document" placeholder="Contenu Markdown du document..." value={content} onChange={(event) => setContent(event.target.value)} />}
        {itemsError && <p className="error" role="alert">{itemsError}</p>}
        {view === 'calendar' && calendarError && <p className="empty calendar-integration-note">{calendarError}</p>}
        {view === 'calendar' && calendarEvents.length > 0 && (
          <section className="view-group calendar-external-events">
            <h3>Calendriers externes (ICS, lecture seule)</h3>
            {calendarEvents.map((event) => (
              <p className="empty" key={event.uid}>
                <span className={`calendar-source-badge calendar-source-${event.source}`}>{event.source === 'personal' ? 'Personnel' : 'Pro'}</span>{' '}
                {event.allDay ? new Date(event.start).toLocaleDateString('fr-FR') : new Date(event.start).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {event.title}
              </p>
            ))}
          </section>
        )}
        <div className={`items view-${view}`}>{view === 'list' ? visibleItems.map(itemCard) : Object.entries(groupedItems).map(([group, groupItems]) => <section className="view-group" key={group}><h3>{view === 'gantt' ? `Échéance ${group}` : group}</h3>{groupItems.map(itemCard)}</section>)}{!itemsError && visibleItems.length === 0 && <p className="empty">Aucun item dans cette vue.</p>}</div>
        </>) : panel === 'today' ? (
          <div className="items dashboard-timeline">
            <div className="filters" aria-label="Jour du dashboard">
              <button className={dashboardDay === 'today' ? 'filter active' : 'filter'} type="button" onClick={() => setDashboardDay('today')}>Aujourd’hui</button>
              <button className={dashboardDay === 'tomorrow' ? 'filter active' : 'filter'} type="button" onClick={() => setDashboardDay('tomorrow')}>Demain</button>
            </div>
            {dashboardItems.map((item) => (
              <article className="item timeline-entry" key={item.id}>
                <span className="timeline-time">{item.dueAt ? new Date(item.dueAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                <span className={`type type-${item.type}`}>{item.type}</span>
                <strong>{item.title}</strong>
              </article>
            ))}
            {dashboardItems.length === 0 && <p className="empty">Aucun item programmé pour {dashboardDay === 'today' ? "aujourd'hui" : 'demain'}.</p>}
          </div>
        ) : panel === 'network' ? (
          <div className="items network-panel">
            {networkError && <p className="error" role="alert">{networkError}</p>}
            {!networkError && !networkGraph && <p className="empty">Chargement de la topologie…</p>}
            {!networkError && networkGraph && <NetworkGraph nodes={networkGraph.nodes} edges={networkGraph.edges} />}
          </div>
        ) : panel === 'integrations' ? (
          <IntegrationsPanel />
        ) : panel === 'haproxy' ? (
          <div className="items haproxy-panel">
            {haproxyError && <p className="error" role="alert">{haproxyError}</p>}
            {!haproxyError && haproxyBackends.length === 0 && <p className="empty">Aucun backend HAProxy à afficher.</p>}
            {haproxyBackends.map((backend) => (
              <section className="view-group" key={backend.name}>
                <h3>{backend.name}{backend.mode ? ` (${backend.mode})` : ''}</h3>
                {(haproxyServers[backend.name] ?? []).map((server) => (
                  <article className="item haproxy-server" key={server.name}>
                    <strong>{server.name}</strong>
                    <span>{server.address}:{server.port}</span>
                  </article>
                ))}
                {(haproxyServers[backend.name] ?? []).length === 0 && <p className="empty">Aucun serveur pour ce backend.</p>}
              </section>
            ))}
          </div>
        ) : panel === 'catalog' ? (
          <div className="items catalog-panel">
            <div className="filters" aria-label="Actions catalogue"><button type="button" onClick={() => void scanCatalog()}>Scanner les dépôts GitLab</button></div>
            <section className="view-group catalog-template-form">
              <h3>Créer un projet depuis un template</h3>
              <p className="empty">Génère un nouveau document <code>catalog-info.yaml</code> à partir d'un template existant du catalogue. Rien n'est poussé vers GitLab automatiquement — le document généré reste à copier manuellement dans le nouveau dépôt.</p>
              <form className="new-item" onSubmit={(event) => void createProjectFromTemplate(event)}>
                <select aria-label="Template" value={templateSource} onChange={(event) => setTemplateSource(event.target.value)} required>
                  <option value="">Choisir un template…</option>
                  {catalogEntities.map((entity) => (
                    <option key={`${entity.kind}:${entity.name}`} value={`${entity.kind}:${entity.name}`}>{entity.kind} · {entity.name}</option>
                  ))}
                </select>
                <input aria-label="Nom du nouveau projet" placeholder="Nom du nouveau projet" value={templateName} onChange={(event) => setTemplateName(event.target.value)} required />
                <input aria-label="Propriétaire (optionnel)" placeholder="Propriétaire (optionnel)" value={templateOwner} onChange={(event) => setTemplateOwner(event.target.value)} />
                <input aria-label="Description (optionnel)" placeholder="Description (optionnel)" value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} />
                <button type="submit" disabled={catalogEntities.length === 0}>Créer le projet</button>
              </form>
              {templateError && <p className="error" role="alert">{templateError}</p>}
              {templateResult && (
                <div className="catalog-template-result">
                  <p className="empty">Document généré (non poussé vers GitLab) :</p>
                  <pre>{templateResult.yaml}</pre>
                </div>
              )}
            </section>
            {catalogError && <p className="error" role="alert">{catalogError}</p>}
            {!catalogError && catalogEntities.length === 0 && <p className="empty">Le catalogue est vide. Lancez un scan pour le peupler.</p>}
            {catalogEntities.map((entity) => (
              <article className="item catalog-entity" key={`${entity.kind}:${entity.name}`}>
                <span className={`type type-${entity.kind.toLowerCase()}`}>{entity.kind}</span>
                <strong>{entity.name}</strong>
                <span className="integrations">{entity.type} · {entity.owner} · {entity.sourceProject}</span>
              </article>
            ))}
            {catalogGraph.edges.length > 0 && (
              <section className="view-group">
                <h3>Dépendances</h3>
                {catalogGraph.edges.map((edge, index) => <p className="empty" key={index}>{edge.from} → {edge.to}</p>)}
              </section>
            )}
            {k8sNodes.length > 0 && (
              <section className="view-group">
                <h3>Nœuds Kubernetes ({k8sNodes.filter((node) => node.ready).length}/{k8sNodes.length} prêts)</h3>
                {k8sNodes.map((node) => <p className="empty" key={node.name}>{node.name} — {node.ready ? 'ready' : 'not ready'}</p>)}
              </section>
            )}
            {argoApps.length > 0 && (
              <section className="view-group">
                <h3>Applications ArgoCD</h3>
                {argoApps.map((app) => <p className="empty" key={app.name}>{app.name} — {app.syncStatus} / {app.healthStatus}</p>)}
              </section>
            )}
          </div>
        ) : panel === 'docs' ? (
          <div className="items docs-panel">
            <div className="filters" aria-label="Actions docs"><button type="button" onClick={() => void scanDocs()}>Scanner les dépôts GitLab</button></div>
            <p className="empty">Documentation DevOS uniquement — les pages scannées proviennent des dossiers <code>docs/</code> des dépôts GitLab du homelab (pas de contenu hors sujet).</p>
            <div className="filters" aria-label="Filtrer les pages Docs">
              <button className={docsFilter === 'all' ? 'filter active' : 'filter'} type="button" onClick={() => setDocsFilter('all')}>Toutes ({docPages.length})</button>
              <button className={docsFilter === 'onboarding' ? 'filter active' : 'filter'} type="button" onClick={() => setDocsFilter('onboarding')}>Onboarding ({docPages.filter((p) => p.pageType === 'onboarding').length})</button>
              <button className={docsFilter === 'scanned' ? 'filter active' : 'filter'} type="button" onClick={() => setDocsFilter('scanned')}>Dépôts scannés ({docPages.filter((p) => p.pageType !== 'onboarding').length})</button>
            </div>
            <form className="new-item onboarding-form" onSubmit={(event) => void createOnboardingPage(event)}>
              <input aria-label="Titre de la fiche onboarding" placeholder="Titre (ex: Arrivée sur le projet DevOS)" value={onboardingTitle} onChange={(event) => setOnboardingTitle(event.target.value)} />
              <button type="submit">Créer une fiche onboarding</button>
            </form>
            {onboardingTitle && (
              <textarea className="doc-editor" aria-label="Contenu de la fiche onboarding" placeholder="Checklist ou documentation à consulter (Markdown)..." value={onboardingContent} onChange={(event) => setOnboardingContent(event.target.value)} />
            )}
            {docsError && <p className="error" role="alert">{docsError}</p>}
            {!docsError && docPages.length === 0 && <p className="empty">Aucune doc trouvée. Lancez un scan ou créez une fiche onboarding.</p>}
            {docPages.filter((page) => docsFilter === 'all' || (docsFilter === 'onboarding' ? page.pageType === 'onboarding' : page.pageType !== 'onboarding')).map((page) => (
              <article className={page.pageType === 'onboarding' ? 'item doc-page doc-page-onboarding' : 'item doc-page'} key={page.id}>
                <span className="item-title"><strong>{page.title}</strong>{page.pageType === 'onboarding' && <span className="onboarding-badge">Onboarding</span>}</span>
                <span className="integrations">{page.sourceProject} · {page.path}</span>
              </article>
            ))}
          </div>
        ) : panel === 'widgets' ? (
          <div className="items widgets-panel">
            <div className="filters" aria-label="Widgets activés">
              <label><input type="checkbox" checked={enabledWidgets.pipelines} onChange={(event) => setEnabledWidgets((current) => ({ ...current, pipelines: event.target.checked }))} /> Pipelines</label>
              <label><input type="checkbox" checked={enabledWidgets.alerts} onChange={(event) => setEnabledWidgets((current) => ({ ...current, alerts: event.target.checked }))} /> Alertes</label>
            </div>
            {widgetsError && <p className="error" role="alert">{widgetsError}</p>}
            {!widgetsError && !widgetData && <p className="empty">Chargement des widgets…</p>}
            {enabledWidgets.pipelines && widgetData && (
              <section className="view-group">
                <h3>Pipelines en cours ({widgetData.pipelines.running})</h3>
                {widgetData.pipelines.items.map((pipeline) => <p className="empty" key={pipeline.id}>#{pipeline.id} · {pipeline.ref} · {pipeline.status}</p>)}
                {widgetData.pipelines.items.length === 0 && <p className="empty">Aucun pipeline en cours.</p>}
              </section>
            )}
            {enabledWidgets.alerts && widgetData && (
              <section className="view-group">
                <h3>Alertes actives ({widgetData.alerts.active}, dont {widgetData.alerts.critical} critiques)</h3>
                {widgetData.alerts.items.map((alert) => <p className="empty" key={alert.fingerprint}>{alert.labels.alertname ?? alert.fingerprint} · {alert.status.state}</p>)}
                {widgetData.alerts.items.length === 0 && <p className="empty">Aucune alerte active.</p>}
              </section>
            )}
            <CustomWidgetsPanel onChange={() => {
              void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/custom-widgets`)
                .then(async (response) => { if (response.ok) setCustomWidgets(await response.json()); })
                .catch(() => undefined);
            }} />
          </div>
        ) : panel === 'settings' ? (
          <SettingsPanel
            navLayout={navLayout}
            setNavLayout={setNavLayout}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            themeColors={themeColors}
            setThemeColors={setThemeColors}
            notificationPermission={notificationPermission}
            onRequestNotificationPermission={() => void Notification.requestPermission().then(setNotificationPermission)}
          />
        ) : panel === 'triage' ? <div className="items triage-list">{triage.map((item) => <article className="item" key={item.id}><span className={`type type-${item.type}`}>{item.type}</span><strong>{item.title}</strong><button type="button" onClick={() => void transitionTriage(item.id, 'accept')}>Accepter</button><button className="delete" type="button" aria-label={`Rejeter ${item.title}`} onClick={() => void transitionTriage(item.id, 'reject')}>×</button></article>)}{triage.length === 0 && <p className="empty">La file de triage est vide.</p>}</div> : null}
      </main>
      {status && <span className="status" role="status">{status}</span>}
      <Command.Dialog open={paletteOpen} onOpenChange={setPaletteOpen} label="Palette de commandes">
        <Command.Input placeholder="Rechercher une commande..." />
        <Command.List>
          <Command.Empty>Aucune commande trouvée.</Command.Empty>
          <Command.Group heading="Navigation">
            {(['list', 'board', 'gantt', 'calendar'] as const).map((value) => <Command.Item key={value} onSelect={() => { setPanel('items'); setView(value); setPaletteOpen(false); }}>{value === 'list' ? 'Ouvrir la liste' : value === 'board' ? 'Ouvrir le board' : value === 'gantt' ? 'Ouvrir Gantt' : 'Ouvrir le calendrier'}</Command.Item>)}
            <Command.Item onSelect={() => { setPanel('triage'); setPaletteOpen(false); }}>Ouvrir le triage</Command.Item>
            <Command.Item onSelect={() => { setPanel('home'); setPaletteOpen(false); }}>Ouvrir le dashboard</Command.Item>
          </Command.Group>
          <Command.Group heading="Actions">
            <Command.Item onSelect={() => { setPaletteOpen(false); titleInput.current?.focus(); }}>Créer un item</Command.Item>
            <Command.Item onSelect={() => { setNavLayout((current) => current === 'sidebar' ? 'topbar' : 'sidebar'); setPaletteOpen(false); }}>Changer la disposition de navigation</Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </div>
  );
}