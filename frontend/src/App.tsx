import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Command } from 'cmdk';

import { createAuthorizationRequest } from './auth/oidc.js';
import { NetworkGraph, type NetworkGraphEdge, type NetworkGraphNode } from './components/NetworkGraph.js';
import { ProxmoxPanel } from './components/ProxmoxPanel.js';
import { DeploymentPanel } from './components/DeploymentPanel.js';
import { CustomWidgetsPanel, type CustomWidget } from './components/CustomWidgetsPanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { NotesPanel } from './components/NotesPanel.js';
import { DevelopmentPanel } from './components/DevelopmentPanel.js';
import { DevTemplatesPanel } from './components/DevTemplatesPanel.js';
import { TaskDetailPanel } from './components/TaskDetailPanel.js';
import { ActivityTimelineDrawer } from './components/ActivityTimelineDrawer.js';
import { Icon } from './components/Icon.js';
import { readUrlFilter, readUrlPanel, useUrlState } from './hooks/useUrlState.js';
import { THEME_COLOR_SETTINGS, THEME_PRESETS, type ThemeMode, type ThemePreset } from './theme.js';
import { useLanguage } from './i18n/LanguageContext.js';

// TODO(AM.1/AM.2) : 'dev-templates' est un panel autonome temporaire (catalogue de templates,
// section AM.3) en attendant le panel racine "Développement" avec sous-navigation. À rattacher
// comme sous-vue de ce module une fois posé, plutôt que de rester une entrée de nav séparée.
const PANEL_IDS = ['home', 'work', 'notes', 'haproxy', 'proxmox', 'catalog', 'docs', 'widgets', 'settings', 'network', 'dev-templates', 'development', 'deployment', 'login'] as const;

// Sous-onglets internes du panel "Travail" (section X) : fusionne les anciens panels séparés
// Tâches/Triage/Aujourd'hui en un seul onglet cohérent, sans perdre de fonctionnalité — seule
// la navigation change (barre de sous-onglets au lieu d'entrées de nav séparées).
const WORK_TABS = ['tasks', 'triage', 'today'] as const;
type WorkTab = (typeof WORK_TABS)[number];

function readUrlWorkTab(fallback: WorkTab): WorkTab {
  const value = new URLSearchParams(window.location.search).get('sub');
  return value && (WORK_TABS as readonly string[]).includes(value) ? (value as WorkTab) : fallback;
}

const oidcConfig = {
  issuerUrl: import.meta.env.VITE_KEYCLOAK_ISSUER_URL ?? 'https://keycloak.example.internal/realms/devos',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'devos',
  redirectUri: `${window.location.origin}/auth/callback`,
};

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
  const [items, setItems] = useState<Array<{ id: string; title: string; type: string; status: string; dueAt?: string | null; mergeRequestState?: string | null; pipelineStatus?: string | null; coderWorkspaceName?: string | null; coderWorkspaceStatus?: string | null; required?: boolean; severity?: string | null; environment?: string | null; reproSteps?: string | null; gitlabLinks?: Array<{ gitlabProjectId: string; issueIid: number }> }>>([]);
  const [workspaceLinks, setWorkspaceLinks] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState(() => readUrlFilter('all'));
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [labels, setLabels] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [environment, setEnvironment] = useState('');
  const [reproSteps, setReproSteps] = useState('');
  const [view, setView] = useState<'list' | 'board' | 'gantt' | 'calendar'>('list');
  const [itemsError, setItemsError] = useState('');
  const [panel, setPanel] = useState<(typeof PANEL_IDS)[number]>(() => readUrlPanel(PANEL_IDS, 'home'));
  const [workTab, setWorkTab] = useState<WorkTab>(() => readUrlWorkTab('tasks'));
  const [navLayout, setNavLayout] = useState<'sidebar' | 'topbar'>(() => (localStorage.getItem('devos.navLayout') as 'sidebar' | 'topbar' | null) ?? 'sidebar');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('devos.theme') as ThemeMode | null) ?? 'system');
  const [themeColors, setThemeColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('devos.themeColors') ?? '{}'); } catch { return {}; }
  });
  // Bascule automatique clair/sombre par horaire (section AB) : n'est active que si themeMode === 'auto'.
  const [themeAutoStart, setThemeAutoStart] = useState<string>(() => localStorage.getItem('devos.themeAutoStart') ?? '20:00');
  const [themeAutoEnd, setThemeAutoEnd] = useState<string>(() => localStorage.getItem('devos.themeAutoEnd') ?? '07:00');
  // Historique des dernières couleurs personnalisées modifiées, pour permettre un undo (section AB).
  const [themeColorHistory, setThemeColorHistory] = useState<Array<{ cssVar: string; previous: string | undefined }>>([]);
  const setThemeColorsTracked = (cssVar: string, value: string) => {
    setThemeColorHistory((history) => [{ cssVar, previous: themeColors[cssVar] }, ...history].slice(0, 20));
    setThemeColors((current) => ({ ...current, [cssVar]: value }));
  };
  const undoThemeColor = () => {
    setThemeColorHistory((history) => {
      if (history.length === 0) return history;
      const [last, ...rest] = history;
      setThemeColors((current) => {
        const next = { ...current };
        if (last.previous === undefined) delete next[last.cssVar]; else next[last.cssVar] = last.previous;
        return next;
      });
      return rest;
    });
  };
  // Presets de couleurs personnalisés sauvegardés par l'utilisateur (paires clair/sombre), section AB.
  const [customThemePresets, setCustomThemePresets] = useState<Array<{ id: string; name: string; light: Record<string, string>; dark: Record<string, string> }>>(() => {
    try { return JSON.parse(localStorage.getItem('devos.customThemePresets') ?? '[]'); } catch { return []; }
  });
  const applyThemePreset = (light: Record<string, string>, dark: Record<string, string>) => {
    // Applique la palette correspondant au thème effectif courant (clair/sombre) ;
    // styles.css bascule déjà les jetons via data-theme, on ne stocke que le jeu actif.
    setThemeColors(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? { ...dark } : { ...light }));
  };
  const saveCustomThemePreset = (name: string) => {
    const preset = { id: `custom-${Date.now()}`, name, light: { ...themeColors }, dark: { ...themeColors } };
    setCustomThemePresets((current) => {
      const next = [...current, preset];
      localStorage.setItem('devos.customThemePresets', JSON.stringify(next));
      return next;
    });
  };
  const deleteCustomThemePreset = (id: string) => {
    setCustomThemePresets((current) => {
      const next = current.filter((p) => p.id !== id);
      localStorage.setItem('devos.customThemePresets', JSON.stringify(next));
      return next;
    });
  };
  // Fond d'écran animé (section AB), CSS pur, appliqué globalement via data-bg sur <html>.
  const [profileBackground, setProfileBackground] = useState<string>(() => localStorage.getItem('devos.profileBackground') ?? 'none');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('devos.sidebarCollapsed') === '1');
  // Nom affiché sur le Dashboard ("Bonjour, {nom}") : pas encore de vraie session Keycloak côté frontend,
  // donc on stocke un nom de profil local éditable en place, avec repli générique si non renseigné.
  const [profileName, setProfileName] = useState<string>(() => localStorage.getItem('devos.profileName') ?? '');
  const [editingProfileName, setEditingProfileName] = useState(false);
  useEffect(() => { localStorage.setItem('devos.profileName', profileName); }, [profileName]);
  // Photo de profil (section AC) : uploadée vers le backend (fichier écrit sur disque, URL en base),
  // avec repli local le temps de l'upload. Un profil local est créé à la volée (pas de vraie session
  // Keycloak encore branchée côté frontend) pour rattacher l'avatar à une ligne UserProfile réelle.
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>(() => localStorage.getItem('devos.profileAvatarUrl') ?? '');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileInput = useRef<HTMLInputElement>(null);

  async function ensureLocalProfileId(): Promise<string> {
    const existing = localStorage.getItem('devos.localProfileId');
    if (existing) return existing;
    const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    const response = await fetch(`${apiBase}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `local-${crypto.randomUUID()}@devos.local`, displayName: profileName || 'Utilisateur' }),
    });
    if (!response.ok) throw new Error('Impossible de créer le profil');
    const created = await response.json() as { id: string };
    localStorage.setItem('devos.localProfileId', created.id);
    return created.id;
  }

  async function handleAvatarFile(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setAvatarUploading(true);
    try {
      const profileId = await ensureLocalProfileId();
      const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
      const response = await fetch(`${apiBase}/api/profiles/${profileId}/avatar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      if (!response.ok) throw new Error('Upload impossible');
      const updated = await response.json() as { avatarImageUrl?: string | null };
      const finalUrl = updated.avatarImageUrl ? `${apiBase}${updated.avatarImageUrl}` : dataUrl;
      setProfileAvatarUrl(finalUrl);
      localStorage.setItem('devos.profileAvatarUrl', finalUrl);
    } catch {
      setProfileAvatarUrl(dataUrl);
      localStorage.setItem('devos.profileAvatarUrl', dataUrl);
    } finally {
      setAvatarUploading(false);
    }
  }

  function signOut() {
    localStorage.removeItem('devos.localProfileId');
    setProfileMenuOpen(false);
    setPanel('login');
  }

  // Barre de recherche du header : suggestions locales instantanées (pages, commandes, items déjà
  // chargés) combinées à une recherche backend (`/api/search`, items + projets réels), avec
  // complétion fantôme acceptable via Tab (cf. .header-search-ghost dans styles.css).
  const [headerSearch, setHeaderSearch] = useState('');
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [headerSearchActive, setHeaderSearchActive] = useState(0);
  const [headerSearchRemote, setHeaderSearchRemote] = useState<Array<{ kind: 'item' | 'project'; id: string; title: string; subtitle?: string }>>([]);
  useEffect(() => {
    const query = headerSearch.trim();
    if (query.length < 2) { setHeaderSearchRemote([]); return; }
    const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    const handle = window.setTimeout(() => {
      void fetch(`${apiBase}/api/search?q=${encodeURIComponent(query)}`)
        .then((response) => (response.ok ? response.json() : { results: [] }))
        .then((data: { results?: typeof headerSearchRemote }) => setHeaderSearchRemote(data.results ?? []))
        .catch(() => setHeaderSearchRemote([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [headerSearch]);
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
  const [dashboardItems, setDashboardItems] = useState<Array<{ id: string; title: string; type: string; status: string; dueAt?: string | null; mergeRequestState?: string | null; pipelineStatus?: string | null; gitlabLinks?: Array<{ gitlabProjectId: string; issueIid: number }> }>>([]);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [cycles, setCycles] = useState<Array<{ id: string; name: string; closedAt?: string | null }>>([]);
  const [triage, setTriage] = useState<Array<{ id: string; title: string; type: string }>>([]);
  const [activeTimers, setActiveTimers] = useState<Record<string, string>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [haproxyBackends, setHaproxyBackends] = useState<Array<{ name: string; mode?: string }>>([]);
  const [haproxyServers, setHaproxyServers] = useState<Record<string, Array<{ name: string; address: string; port: number }>>>({});
  const [haproxyError, setHaproxyError] = useState('');
  const [haproxyFrontends, setHaproxyFrontends] = useState<Array<{ name: string; mode?: string; bind?: string }>>([]);
  const [haproxyAcls, setHaproxyAcls] = useState<Record<string, Array<{ index: number; aclName: string; criterion: string; value: string }>>>({});
  const [haproxyCertificates, setHaproxyCertificates] = useState<Array<{ storageName: string; description?: string }>>([]);
  const [aclDraft, setAclDraft] = useState<Record<string, { aclName: string; criterion: string; value: string }>>({});
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
  const [docPages, setDocPages] = useState<Array<{ id: string; title: string; sourceProject: string; path: string; pageType?: 'onboarding' }>>([]);
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [storedNotifications, setStoredNotifications] = useState<Array<{ id: string; title: string; message: string; category: string | null; readAt: string | null; createdAt: string }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const titleInput = useRef<HTMLInputElement>(null);

  useUrlState(panel, setPanel, PANEL_IDS, filter, setFilter);

  // Garde le sous-onglet du panel Travail synchronisé avec `?sub=`, sur le même principe que
  // `useUrlState` pour panel/filter (deep links, retour arrière navigateur).
  useEffect(() => {
    function onPopState() { setWorkTab(readUrlWorkTab('tasks')); }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const current = params.get('sub');
    const next = panel === 'work' && workTab !== 'tasks' ? workTab : null;
    if (current === next) return;
    if (next) params.set('sub', next); else params.delete('sub');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [panel, workTab]);

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

  // Applique le thème effectif (clair/sombre) au DOM avec une courte transition fade (section AB) ;
  // en mode "auto", l'heure courante décide entre les créneaux configurés (themeAutoStart/End).
  const applyEffectiveTheme = (mode: ThemeMode, start: string, end: string) => {
    let effective: 'light' | 'dark' | null = null;
    if (mode === 'light' || mode === 'dark') effective = mode;
    else if (mode === 'auto') {
      const now = new Date();
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      const toMinutes = (value: string) => { const [h, m] = value.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
      const startM = toMinutes(start);
      const endM = toMinutes(end);
      const inNightRange = startM <= endM ? minutesNow >= startM && minutesNow < endM : minutesNow >= startM || minutesNow < endM;
      effective = inNightRange ? 'dark' : 'light';
    }
    document.documentElement.classList.add('theme-fade');
    if (effective === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', effective);
    window.setTimeout(() => document.documentElement.classList.remove('theme-fade'), 400);
  };

  useEffect(() => {
    localStorage.setItem('devos.theme', themeMode);
    applyEffectiveTheme(themeMode, themeAutoStart, themeAutoEnd);
    if (themeMode !== 'auto') return;
    const interval = window.setInterval(() => applyEffectiveTheme(themeMode, themeAutoStart, themeAutoEnd), 60_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode, themeAutoStart, themeAutoEnd]);

  useEffect(() => { localStorage.setItem('devos.themeAutoStart', themeAutoStart); }, [themeAutoStart]);
  useEffect(() => { localStorage.setItem('devos.themeAutoEnd', themeAutoEnd); }, [themeAutoEnd]);
  useEffect(() => {
    localStorage.setItem('devos.profileBackground', profileBackground);
    if (profileBackground === 'none') document.documentElement.removeAttribute('data-bg');
    else document.documentElement.setAttribute('data-bg', profileBackground);
  }, [profileBackground]);

  useEffect(() => {
    localStorage.setItem('devos.themeColors', JSON.stringify(themeColors));
    for (const { cssVar } of THEME_COLOR_SETTINGS) {
      const value = themeColors[cssVar];
      if (value) document.documentElement.style.setProperty(`--${cssVar}`, value);
      else document.documentElement.style.removeProperty(`--${cssVar}`);
    }
  }, [themeColors]);

  // Thème principal de la plateforme, défini par l'administrateur (Paramètres → Administration).
  // Sert de thème imposé sur l'écran de connexion, et de thème par défaut pour tout utilisateur
  // n'ayant pas encore personnalisé son propre thème (voir effet de chargement ci-dessous).
  // Persisté côté backend (clé `platform.theme` de /api/settings, écriture réservée aux Admin) pour
  // s'appliquer à tous les utilisateurs/appareils, avec un repli localStorage hors-ligne.
  const [adminLoginThemeId, setAdminLoginThemeIdState] = useState<string>(() => localStorage.getItem('devos.adminLoginTheme') ?? 'default');
  // Presets additionnels ajoutés par l'administrateur à la bibliothèque de thèmes de la plateforme
  // (au-delà des thèmes préconfigurés fixes de theme.ts), partagés avec tous les utilisateurs.
  const [platformThemePresets, setPlatformThemePresets] = useState<ThemePreset[]>(() => {
    try { return JSON.parse(localStorage.getItem('devos.platformThemePresets') ?? '[]'); } catch { return []; }
  });
  const allThemePresets = useMemo<ThemePreset[]>(() => [...THEME_PRESETS, ...platformThemePresets], [platformThemePresets]);
  const platformDefaultApplied = useRef(false);
  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/settings`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { values?: Record<string, string> } | null) => {
        if (!data?.values) return;
        const rawTheme = data.values['platform.theme'];
        const rawPresets = data.values['platform.themePresets'];
        let platformPresetId: string | undefined;
        if (rawTheme) {
          try {
            const parsed = JSON.parse(rawTheme) as { presetId?: string };
            if (parsed.presetId) { platformPresetId = parsed.presetId; setAdminLoginThemeIdState(parsed.presetId); }
          } catch { /* valeur invalide ignorée, on garde le repli localStorage */ }
        }
        if (rawPresets) {
          try {
            const parsed = JSON.parse(rawPresets) as ThemePreset[];
            setPlatformThemePresets(parsed);
            localStorage.setItem('devos.platformThemePresets', rawPresets);
          } catch { /* valeur invalide ignorée */ }
        }
        // Un utilisateur qui n'a jamais personnalisé son thème (aucune clé locale) hérite du thème
        // principal de la plateforme plutôt que du thème "default" codé en dur.
        if (!platformDefaultApplied.current && localStorage.getItem('devos.themeColors') === null && platformPresetId) {
          const preset = [...THEME_PRESETS, ...(rawPresets ? (JSON.parse(rawPresets) as ThemePreset[]) : [])].find((p) => p.id === platformPresetId);
          if (preset) setThemeColors({ ...preset.light });
        }
        platformDefaultApplied.current = true;
      })
      .catch(() => { /* backend indisponible : on reste sur les valeurs localStorage/par défaut */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setAdminLoginThemeId = (id: string) => {
    setAdminLoginThemeIdState(id);
    localStorage.setItem('devos.adminLoginTheme', id);
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/settings/platform.theme`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-devos-role': 'Admin' },
      body: JSON.stringify({ value: JSON.stringify({ presetId: id }) }),
    }).catch(() => { /* backend indisponible : le choix reste appliqué localement */ });
  };
  // Ajoute un nouveau thème à la bibliothèque de la plateforme (visible par tous), à partir d'une
  // palette clair/sombre — permet à l'administrateur de personnaliser la plateforme au-delà des
  // thèmes préconfigurés fixes de theme.ts.
  const addPlatformThemePreset = (name: string, light: Record<string, string>, dark: Record<string, string>) => {
    const preset: ThemePreset = { id: `platform-${Date.now()}`, label: name, light, dark };
    setPlatformThemePresets((current) => {
      const next = [...current, preset];
      const serialized = JSON.stringify(next);
      localStorage.setItem('devos.platformThemePresets', serialized);
      void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/settings/platform.themePresets`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-devos-role': 'Admin' },
        body: JSON.stringify({ value: serialized }),
      }).catch(() => { /* backend indisponible : le preset reste disponible localement */ });
      return next;
    });
  };
  const [isDarkEffective, setIsDarkEffective] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkEffective(document.documentElement.getAttribute('data-theme') === 'dark'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  const adminLoginTheme = allThemePresets.find((preset) => preset.id === adminLoginThemeId) ?? allThemePresets[0];
  const loginThemeVars = Object.fromEntries(
    Object.entries(isDarkEffective ? adminLoginTheme.dark : adminLoginTheme.light).map(([cssVar, value]) => [`--${cssVar}`, value]),
  ) as Record<string, string>;

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

  const notificationsApiBase = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/notifications`;
  const refreshStoredNotifications = () => {
    void fetch(notificationsApiBase)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) setStoredNotifications(data.notifications); })
      .catch(() => undefined);
  };
  useEffect(() => {
    refreshStoredNotifications();
    const interval = window.setInterval(refreshStoredNotifications, 60_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const markNotificationAsRead = (id: string) => {
    setStoredNotifications((current) => current.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
    void fetch(`${notificationsApiBase}/${id}/read`, { method: 'PATCH' }).catch(() => undefined);
  };
  const deleteStoredNotification = (id: string) => {
    setStoredNotifications((current) => current.filter((n) => n.id !== id));
    void fetch(`${notificationsApiBase}/${id}`, { method: 'DELETE' }).catch(() => undefined);
  };

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
    if (panel !== 'work' || workTab !== 'today') return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/dashboard/${dashboardDay}`)
      .then(async (response) => { if (!response.ok) throw new Error(); setDashboardItems(await response.json()); })
      .catch(() => setDashboardItems([]));
  }, [panel, workTab, dashboardDay]);

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
    if (panel !== 'work' || workTab !== 'tasks' || view !== 'calendar') return;
    setCalendarError('');
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/calendar/events`)
      .then(async (response) => {
        if (!response.ok) { setCalendarEvents([]); setCalendarError(response.status === 503 ? 'Aucun calendrier ICS configuré.' : 'Calendriers externes indisponibles.'); return; }
        setCalendarEvents(await response.json());
      })
      .catch(() => setCalendarError('Calendriers externes indisponibles.'));
  }, [panel, workTab, view]);

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
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/haproxy/frontends`)
      .then(async (response) => {
        if (!response.ok) return;
        const frontends = await response.json();
        setHaproxyFrontends(frontends);
        for (const frontend of frontends as Array<{ name: string }>) {
          void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/haproxy/frontends/${encodeURIComponent(frontend.name)}/acls`)
            .then(async (response) => { if (!response.ok) return; const acls = await response.json(); setHaproxyAcls((current) => ({ ...current, [frontend.name]: acls })); })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/haproxy/certificates`)
      .then(async (response) => { if (response.ok) setHaproxyCertificates(await response.json()); })
      .catch(() => undefined);
  }, [panel]);

  async function addHaproxyAcl(frontendName: string) {
    const draft = aclDraft[frontendName];
    if (!draft?.aclName || !draft.criterion || !draft.value) return;
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/haproxy/frontends/${encodeURIComponent(frontendName)}/acls`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-devos-role': 'Admin' },
      body: JSON.stringify(draft),
    });
    if (!response.ok) { setHaproxyError('L’ajout de la règle ACL a échoué.'); return; }
    const acls = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/haproxy/frontends/${encodeURIComponent(frontendName)}/acls`).then((r) => r.json());
    setHaproxyAcls((current) => ({ ...current, [frontendName]: acls }));
    setAclDraft((current) => ({ ...current, [frontendName]: { aclName: '', criterion: '', value: '' } }));
  }

  async function deleteHaproxyAcl(frontendName: string, index: number) {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/haproxy/frontends/${encodeURIComponent(frontendName)}/acls/${index}`, {
      method: 'DELETE',
      headers: { 'x-devos-role': 'Admin' },
    });
    if (!response.ok) { setHaproxyError('La suppression de la règle ACL a échoué.'); return; }
    setHaproxyAcls((current) => ({ ...current, [frontendName]: (current[frontendName] ?? []).filter((acl) => acl.index !== index) }));
  }

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
        // Defense in depth: an older API instance may still contain historical pages imported
        // from Git repositories. The platform handbook must never render those project pages.
        const pages = await response.json() as Array<{ id: string; title: string; sourceProject: string; path: string; pageType?: 'onboarding' }>;
        setDocPages(pages.filter((page) => page.sourceProject === 'onboarding'));
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

  function requestEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loginEmail.trim() || !loginEmail.includes('@')) { setLoginMessage(language === 'fr' ? 'Saisissez une adresse e-mail valide.' : 'Enter a valid email address.'); return; }
    localStorage.setItem('devos.loginEmail', loginEmail.trim());
    setLoginMessage(language === 'fr' ? `Lien de connexion envoyé à ${loginEmail.trim()} (mode aperçu).` : `Sign-in link sent to ${loginEmail.trim()} (preview mode).`);
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/items`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, title, labels: labels.split(',').map((label) => label.trim()).filter(Boolean), ...(dueAt ? { dueAt: new Date(`${dueAt}T12:00:00`).toISOString() } : {}), ...(type === 'doc' && content ? { content } : {}), ...(type === 'bug' ? { severity, environment: environment || undefined, reproSteps: reproSteps || undefined } : {}) }),
    });
    if (!response.ok) { setItemsError('Création impossible.'); return; }
    const created = await response.json();
    setItems((current) => [created, ...current]);
    setTitle('');
    setLabels('');
    setDueAt('');
    setContent('');
    setSeverity('medium');
    setEnvironment('');
    setReproSteps('');
  }

  async function updateStatus(item: { id: string }, nextStatus: string) {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/items/${item.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) {
      const updated = await response.json();
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setDashboardItems((current) => current.map((entry) => entry.id === updated.id ? { ...entry, status: updated.status, mergeRequestState: updated.mergeRequestState, pipelineStatus: updated.pipelineStatus } : entry));
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

  // Les notes (ItemType.note) ne sont jamais mélangées aux tâches de projet ici — panel Notes dédié.
  const nonNoteItems = items.filter((item) => item.type !== 'note');
  const visibleItems = filter === 'all' ? nonNoteItems : filter === 'required' ? nonNoteItems.filter((item) => item.required) : nonNoteItems.filter((item) => item.type === filter);
  const groupedItems = visibleItems.reduce<Record<string, typeof visibleItems>>((groups, item) => {
    const key = view === 'calendar' || view === 'gantt' ? (item.dueAt ? new Date(item.dueAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'Sans date') : item.status.replace('_', ' ');
    (groups[key] ??= []).push(item);
    return groups;
  }, {});
  const statusCounts = items.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; }, {});
  const navItems: Array<{ id: typeof panel; label: string; badge?: number; icon: string; group: string }> = [
    { id: 'home', label: language === 'fr' ? 'Dashboard' : 'Dashboard', icon: 'home', group: language === 'fr' ? 'Vue d’ensemble' : 'Overview' },
    { id: 'work', label: language === 'fr' ? 'Travail' : 'Work', badge: triage.length, icon: 'tasks', group: language === 'fr' ? 'Travail' : 'Work' },
    { id: 'notes', label: language === 'fr' ? 'Notes' : 'Notes', icon: 'doc', group: language === 'fr' ? 'Travail' : 'Work' },
    { id: 'dev-templates', label: language === 'fr' ? 'Templates dev' : 'Dev templates', icon: 'layers', group: language === 'fr' ? 'Travail' : 'Work' },
    { id: 'development', label: language === 'fr' ? 'Développement' : 'Development', icon: 'layers', group: language === 'fr' ? 'Développement' : 'Development' },
    { id: 'catalog', label: language === 'fr' ? 'Catalogue' : 'Catalog', icon: 'layers', group: language === 'fr' ? 'Infrastructure' : 'Infrastructure' },
    { id: 'network', label: language === 'fr' ? 'Topologie réseau' : 'Network topology', icon: 'network', group: language === 'fr' ? 'Infrastructure' : 'Infrastructure' },
    { id: 'haproxy', label: 'Infra HAProxy', icon: 'network', group: language === 'fr' ? 'Infrastructure' : 'Infrastructure' },
    { id: 'proxmox', label: language === 'fr' ? 'VMs Proxmox' : 'Proxmox VMs', icon: 'network', group: language === 'fr' ? 'Infrastructure' : 'Infrastructure' },
    { id: 'widgets', label: 'Widgets', icon: 'widget', group: language === 'fr' ? 'Infrastructure' : 'Infrastructure' },
    { id: 'deployment', label: language === 'fr' ? 'Déploiement' : 'Deployment', icon: 'layers', group: language === 'fr' ? 'Infrastructure' : 'Infrastructure' },
    { id: 'settings', label: language === 'fr' ? 'Paramètres' : 'Settings', icon: 'gear', group: language === 'fr' ? 'Autres' : 'Other' },
    { id: 'docs', label: 'Docs', icon: 'doc', group: language === 'fr' ? 'Autres' : 'Other' },
  ];
  const navGroups = navItems.reduce<Array<{ group: string; items: typeof navItems }>>((groups, item) => {
    const existing = groups.find((g) => g.group === item.group);
    if (existing) existing.items.push(item); else groups.push({ group: item.group, items: [item] });
    return groups;
  }, []);
  const collapsed = navLayout === 'sidebar' && sidebarCollapsed;
  type HeaderSuggestion = { kind: 'page' | 'item' | 'project'; id: string; label: string; meta?: string; onSelect: () => void };
  const headerSearchQuery = headerSearch.trim().toLowerCase();
  const headerSuggestions: HeaderSuggestion[] = headerSearchQuery.length === 0 ? [] : [
    ...navItems
      .filter((item) => item.label.toLowerCase().includes(headerSearchQuery))
      .slice(0, 4)
      .map((item): HeaderSuggestion => ({ kind: 'page', id: `page-${item.id}`, label: item.label, meta: language === 'fr' ? 'Page' : 'Page', onSelect: () => setPanel(item.id) })),
    ...items
      .filter((item) => item.title.toLowerCase().includes(headerSearchQuery))
      .slice(0, 5)
      .map((item): HeaderSuggestion => ({ kind: 'item', id: `item-${item.id}`, label: item.title, meta: item.type, onSelect: () => { setPanel('work'); setDetailItemId(item.id); } })),
    ...headerSearchRemote
      .filter((result) => !items.some((item) => item.id === result.id))
      .slice(0, 6)
      .map((result): HeaderSuggestion => result.kind === 'item'
        ? { kind: 'item', id: `remote-item-${result.id}`, label: result.title, meta: result.subtitle, onSelect: () => { setPanel('work'); setDetailItemId(result.id); } }
        : { kind: 'project', id: `remote-project-${result.id}`, label: result.title, meta: result.subtitle ?? (language === 'fr' ? 'Projet' : 'Project'), onSelect: () => setPanel('development') }),
  ];
  const headerGhostSuggestion = headerSuggestions.find((s) => s.label.toLowerCase().startsWith(headerSearchQuery));
  function selectHeaderSuggestion(suggestion: HeaderSuggestion) {
    suggestion.onSelect();
    setHeaderSearch('');
    setHeaderSearchOpen(false);
    setHeaderSearchActive(0);
  }
  function handleHeaderSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Tab' && headerGhostSuggestion) {
      event.preventDefault();
      setHeaderSearch(headerGhostSuggestion.label);
      return;
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setHeaderSearchActive((i) => Math.min(i + 1, headerSuggestions.length - 1)); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHeaderSearchActive((i) => Math.max(i - 1, 0)); return; }
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = headerSuggestions[headerSearchActive];
      if (target) selectHeaderSuggestion(target);
      return;
    }
    if (event.key === 'Escape') { setHeaderSearchOpen(false); (event.target as HTMLInputElement).blur(); }
  }
  const navButton = (item: (typeof navItems)[number]) => (
    <button key={item.id} className={panel === item.id ? 'nav-link active' : 'nav-link'} type="button" aria-current={panel === item.id ? 'page' : undefined} title={collapsed ? item.label : undefined} onClick={() => setPanel(item.id)}>
      <Icon name={item.icon} />
      {!collapsed && <span className="nav-label">{item.label}</span>}
      {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
    </button>
  );
  const itemCard = (item: typeof items[number]) =><article className={item.required ? 'item item-required' : 'item'} key={item.id}><span className={`type type-${item.type}`}>{item.type}</span>{item.type === 'bug' && item.severity && <span className={`badge severity-${item.severity}`}>{item.severity}</span>}<span className="item-title"><strong>{item.title}</strong>{item.required && <span className="required-badge" title="Item obligatoire">Obligatoire</span>}</span><span className="integrations">{item.mergeRequestState && `MR ${item.mergeRequestState}`}{item.pipelineStatus && ` · CI ${item.pipelineStatus}`}{item.coderWorkspaceStatus && ` · Workspace ${item.coderWorkspaceStatus}`}</span><select className="item-status" aria-label={`Statut de ${item.title}`} value={item.status} onChange={(event) => void updateStatus(item, event.target.value)}><option value="backlog">backlog</option><option value="in_progress">in progress</option><option value="done">done</option><option value="blocked">blocked</option></select><span className="item-actions"><button className={item.required ? 'required-toggle active' : 'required-toggle'} type="button" aria-pressed={Boolean(item.required)} aria-label={item.required ? `Retirer le caractère obligatoire de ${item.title}` : `Marquer ${item.title} comme obligatoire`} onClick={() => void toggleRequired(item)}>{item.required ? 'Obligatoire ✓' : 'Marquer obligatoire'}</button>{item.type === 'task' && <button className="open-workspace" type="button" onClick={() => void openWorkspace(item)}>{item.coderWorkspaceName ? 'Ouvrir dans VS Code' : 'Ouvrir un environnement'}</button>}<button className="timer" type="button" onClick={() => void toggleTimer(item)}>{activeTimers[item.id] ? 'Arrêter' : 'Démarrer'}</button><button className="detail-open" type="button" onClick={() => setDetailItemId(item.id)}>Détail</button><button className="delete" type="button" aria-label={`Supprimer ${item.title}`} onClick={() => void deleteItem(item)}>×</button></span></article>;

  return (
    <div className={`shell layout-${navLayout}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><Icon name="network" size={18} /></span>
          <div><div className="eyebrow">DEVOS / HOMELAB COMMAND</div><h1 id="title">{navItems.find((n) => n.id === panel)?.label ?? (panel === 'login' ? (language === 'fr' ? 'Connexion' : 'Sign in') : 'Dashboard')}</h1></div>
        </div>
        <div className="header-actions">
          <div className="header-search">
            <Icon name="doc" size={14} />
            <div className="header-search-field">
              {headerGhostSuggestion && (
                <div className="header-search-ghost" aria-hidden="true">
                  <span className="typed">{headerSearch}</span>{headerGhostSuggestion.label.slice(headerSearch.length)}
                </div>
              )}
              <input
                type="text"
                value={headerSearch}
                placeholder={language === 'fr' ? 'Rechercher ou taper une commande...' : 'Search or type a command...'}
                aria-label={language === 'fr' ? 'Recherche' : 'Search'}
                onChange={(event) => { setHeaderSearch(event.target.value); setHeaderSearchOpen(true); setHeaderSearchActive(0); }}
                onFocus={() => setHeaderSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setHeaderSearchOpen(false), 120)}
                onKeyDown={handleHeaderSearchKeyDown}
              />
            </div>
            {!headerSearch && <span className="header-search-hint">Tab</span>}
            {headerSearchOpen && headerSearchQuery.length > 0 && (
              <div className="header-search-results">
                {headerSuggestions.length === 0 ? (
                  <p className="header-search-empty">{language === 'fr' ? 'Aucun résultat.' : 'No results.'}</p>
                ) : (
                  <>
                    {headerSuggestions.some((s) => s.kind === 'page') && <div className="header-search-group">{language === 'fr' ? 'Pages' : 'Pages'}</div>}
                    {headerSuggestions.filter((s) => s.kind === 'page').map((s) => (
                      <button type="button" key={s.id} className={headerSuggestions.indexOf(s) === headerSearchActive ? 'header-search-item active' : 'header-search-item'} onMouseDown={() => selectHeaderSuggestion(s)}>
                        <Icon name="layers" size={13} />{s.label}<span className="meta">{s.meta}</span>
                      </button>
                    ))}
                    {headerSuggestions.some((s) => s.kind === 'item' || s.kind === 'project') && <div className="header-search-group">{language === 'fr' ? 'Résultats' : 'Results'}</div>}
                    {headerSuggestions.filter((s) => s.kind !== 'page').map((s) => (
                      <button type="button" key={s.id} className={headerSuggestions.indexOf(s) === headerSearchActive ? 'header-search-item active' : 'header-search-item'} onMouseDown={() => selectHeaderSuggestion(s)}>
                        <Icon name={s.kind === 'project' ? 'network' : 'tasks'} size={13} />{s.label}<span className="meta">{s.meta}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button type="button" className="header-icon-button" aria-label="Historique" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
            <Icon name="clock" />
          </button>
          <button type="button" className="header-icon-button" aria-label={language === 'fr' ? 'Notifications' : 'Notifications'} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); refreshStoredNotifications(); }}>
            <Icon name="inbox" />
            {(triage.length + (wazuhAlerts?.filter((alert) => alert.level >= CRITICAL_WAZUH_LEVEL).length ?? 0) + storedNotifications.filter((n) => !n.readAt).length) > 0 && <span className="header-notification-badge">{triage.length + (wazuhAlerts?.filter((alert) => alert.level >= CRITICAL_WAZUH_LEVEL).length ?? 0) + storedNotifications.filter((n) => !n.readAt).length}</span>}
          </button>
          <button type="button" className="header-language" aria-label={language === 'fr' ? 'Changer de langue' : 'Change language'} onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}>{language.toUpperCase()}</button>
          <button type="button" className="header-profile" aria-label={language === 'fr' ? 'Menu profil' : 'Profile menu'} aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}>
            {profileAvatarUrl ? <img src={profileAvatarUrl} alt="" /> : (profileName ? profileName.slice(0, 2).toUpperCase() : '??')}
          </button>
        </div>
        {notificationsOpen && <aside className="notification-popover" aria-label="Centre de notifications">
          <h3>{language === 'fr' ? 'Notifications' : 'Notifications'}</h3>
          {triage.length === 0 && !(wazuhAlerts?.some((alert) => alert.level >= CRITICAL_WAZUH_LEVEL)) && storedNotifications.length === 0 && <p className="empty">{language === 'fr' ? 'Aucune notification urgente.' : 'No urgent notifications.'}</p>}
          {triage.slice(0, 5).map((item) => <button type="button" className="notification-entry" key={item.id} onClick={() => { setPanel('work'); setWorkTab('triage'); setNotificationsOpen(false); }}>Triage : {item.title}</button>)}
          {(wazuhAlerts ?? []).filter((alert) => alert.level >= CRITICAL_WAZUH_LEVEL).slice(0, 5).map((alert) => <button type="button" className="notification-entry critical" key={alert.id} onClick={() => { setPanel('home'); setNotificationsOpen(false); }}>Sécurité : {alert.ruleDescription}</button>)}
          {storedNotifications.slice(0, 10).map((notification) => (
            <div className={notification.readAt ? 'notification-entry-row' : 'notification-entry-row unread'} key={notification.id}>
              <button type="button" className="notification-entry" onClick={() => markNotificationAsRead(notification.id)}>
                {notification.title} — {notification.message}
              </button>
              <button type="button" className="notification-entry-delete" aria-label={language === 'fr' ? `Supprimer la notification ${notification.title}` : `Delete notification ${notification.title}`} onClick={() => deleteStoredNotification(notification.id)}>×</button>
            </div>
          ))}
          <button type="button" className="filter" onClick={() => { setPanel('settings'); setNotificationsOpen(false); }}>{language === 'fr' ? 'Configurer dans Administration' : 'Configure in Administration'}</button>
        </aside>}
        {profileMenuOpen && <aside className="header-profile-menu" aria-label={language === 'fr' ? 'Menu profil' : 'Profile menu'}>
          <div className="header-profile-menu-header">
            <span className="header-profile-menu-avatar">{profileAvatarUrl ? <img src={profileAvatarUrl} alt="" /> : (profileName ? profileName.slice(0, 2).toUpperCase() : '??')}</span>
            <span className="header-profile-menu-name">{profileName || (language === 'fr' ? 'Utilisateur' : 'User')}</span>
          </div>
          <button type="button" onClick={() => { setPanel('settings'); setProfileMenuOpen(false); }}>
            <Icon name="gear" size={14} />{language === 'fr' ? 'Profil' : 'Profile'}
          </button>
          <input ref={avatarFileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAvatarFile(file); event.target.value = ''; }} />
          <button type="button" onClick={() => avatarFileInput.current?.click()} disabled={avatarUploading}>
            <Icon name="layers" size={14} />{avatarUploading ? (language === 'fr' ? 'Envoi...' : 'Uploading...') : (language === 'fr' ? 'Changer la photo' : 'Change photo')}
          </button>
          <button type="button" className="danger" onClick={signOut}>
            <Icon name="chevron" size={14} />{language === 'fr' ? 'Déconnexion' : 'Sign out'}
          </button>
        </aside>}
      </header>
      <ActivityTimelineDrawer apiBase={import.meta.env.VITE_API_URL ?? 'http://localhost:3000'} open={historyOpen} onClose={() => setHistoryOpen(false)} />
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
            <div className="home-header">
              <div className="home-greeting">
                {editingProfileName ? (
                  <input
                    className="home-greeting-input"
                    aria-label="Votre nom"
                    autoFocus
                    defaultValue={profileName}
                    placeholder="Votre nom"
                    onBlur={(event) => { setProfileName(event.target.value.trim()); setEditingProfileName(false); }}
                    onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); if (event.key === 'Escape') setEditingProfileName(false); }}
                  />
                ) : (
                  <h2 className="home-greeting-title">
                    {profileName ? `Bonjour, ${profileName}` : 'Bonjour'}
                    <button type="button" className="home-greeting-edit" aria-label="Modifier votre nom" title="Modifier votre nom" onClick={() => setEditingProfileName(true)}>
                      <Icon name="pencil" size={13} />
                    </button>
                  </h2>
                )}
              </div>
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
        ) : panel === 'work' ? (<>
        {/* Section X : Tâches/Triage/Aujourd'hui fusionnés en un seul panel "Travail" avec
            sous-onglets internes, plutôt que trois panels de nav séparés — même fonctionnalité,
            navigation simplifiée. Le sous-onglet actif est piloté par `workTab` (persistant en URL). */}
        <nav className="views work-subnav" aria-label="Sous-onglets Travail">
          <button className={workTab === 'tasks' ? 'filter active' : 'filter'} type="button" onClick={() => setWorkTab('tasks')}>Tâches</button>
          <button className={workTab === 'triage' ? 'filter active' : 'filter'} type="button" onClick={() => setWorkTab('triage')}>Triage{triage.length > 0 ? ` (${triage.length})` : ''}</button>
          <button className={workTab === 'today' ? 'filter active' : 'filter'} type="button" onClick={() => setWorkTab('today')}>Aujourd’hui</button>
        </nav>
        {workTab === 'tasks' ? (<>
        {cycles.length > 0 && <aside className="cycles" aria-label="Cycles"><span className="kicker">CYCLE ACTIF</span>{cycles.filter((cycle) => !cycle.closedAt).map((cycle) => <div className="cycle" key={cycle.id}><strong>{cycle.name}</strong><button type="button" onClick={() => void closeCycle(cycle.id)}>Clôturer</button></div>)}</aside>}
        <div className="section-heading"><div><span className="kicker">WORK QUEUE</span><h2 id="items-title">Vos items</h2></div><div className="filters" aria-label="Filtrer les items">{['all', 'task', 'doc', 'goal', 'bug', 'required'].map((value) => <button className={filter === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => setFilter(value)}>{value === 'all' ? 'Tout' : value === 'required' ? 'Obligatoires' : value}</button>)}</div></div>
        <nav className="views" aria-label="Vues">{(['list', 'board', 'gantt', 'calendar'] as const).map((value) => <button className={view === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => setView(value)}>{value === 'list' ? 'Liste' : value === 'board' ? 'Board' : value === 'gantt' ? 'Gantt' : 'Calendrier'}</button>)}</nav>
        <form className="new-item" onSubmit={createItem}><select aria-label="Type" value={type} onChange={(event) => setType(event.target.value)}><option value="task">Tâche</option><option value="doc">Document</option><option value="goal">Objectif</option><option value="bug">Bug</option></select><input ref={titleInput} aria-label="Titre" placeholder="Ajouter un item..." value={title} onChange={(event) => setTitle(event.target.value)} /><input aria-label="Labels" placeholder="type::bug, priority::high" value={labels} onChange={(event) => setLabels(event.target.value)} /><input aria-label="Échéance" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><button type="submit">Ajouter</button></form>
        {type === 'doc' && <textarea className="doc-editor" aria-label="Contenu du document" placeholder="Contenu Markdown du document..." value={content} onChange={(event) => setContent(event.target.value)} />}
        {type === 'bug' && (
          <div className="new-item bug-fields">
            <select aria-label="Gravité" value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="low">Faible</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="critical">Critique</option>
            </select>
            <input aria-label="Environnement" placeholder="Environnement (prod, staging...)" value={environment} onChange={(event) => setEnvironment(event.target.value)} />
            <input aria-label="Étapes de reproduction" placeholder="Étapes de reproduction" value={reproSteps} onChange={(event) => setReproSteps(event.target.value)} />
          </div>
        )}
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
        </>) : workTab === 'today' ? (
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
                <span className="integrations">{item.mergeRequestState && `MR ${item.mergeRequestState}`}{item.pipelineStatus && ` · CI ${item.pipelineStatus}`}</span>
                <select className="item-status" aria-label={`Statut de ${item.title}`} value={item.status} onChange={(event) => void updateStatus(item, event.target.value)}>
                  <option value="backlog">backlog</option><option value="in_progress">in progress</option><option value="done">done</option><option value="blocked">blocked</option>
                </select>
                <button className="detail-open" type="button" onClick={() => setDetailItemId(item.id)}>Détail</button>
              </article>
            ))}
            {dashboardItems.length === 0 && <p className="empty">Aucun item programmé pour {dashboardDay === 'today' ? "aujourd'hui" : 'demain'}.</p>}
          </div>
        ) : (
          <div className="items triage-list">
            {triage.map((item) => <article className="item" key={item.id}><span className={`type type-${item.type}`}>{item.type}</span><strong>{item.title}</strong><button type="button" onClick={() => void transitionTriage(item.id, 'accept')}>Accepter</button><button className="delete" type="button" aria-label={`Rejeter ${item.title}`} onClick={() => void transitionTriage(item.id, 'reject')}>×</button></article>)}
            {triage.length === 0 && <p className="empty">La file de triage est vide.</p>}
          </div>
        )}
        </>) : panel === 'network' ? (
          <div className="items network-panel">
            {networkError && <p className="error" role="alert">{networkError}</p>}
            {!networkError && !networkGraph && <p className="empty">Chargement de la topologie…</p>}
            {!networkError && networkGraph && <NetworkGraph nodes={networkGraph.nodes} edges={networkGraph.edges} />}
          </div>
        ) : panel === 'haproxy' ? (
          <div className="items haproxy-panel">
            {haproxyError && <p className="error" role="alert">{haproxyError}</p>}
            {!haproxyError && haproxyBackends.length === 0 && haproxyFrontends.length === 0 && <p className="empty">Aucune configuration HAProxy à afficher.</p>}

            {haproxyFrontends.length > 0 && (
              <section className="view-group">
                <h3>Frontends</h3>
                {haproxyFrontends.map((frontend) => (
                  <section className="view-group haproxy-frontend" key={frontend.name}>
                    <h4>{frontend.name}{frontend.mode ? ` (${frontend.mode})` : ''}{frontend.bind ? ` · ${frontend.bind}` : ''}</h4>
                    <div className="haproxy-acls">
                      {(haproxyAcls[frontend.name] ?? []).map((acl) => (
                        <article className="item haproxy-acl" key={acl.index}>
                          <strong>{acl.aclName}</strong>
                          <span>{acl.criterion} {acl.value}</span>
                          <button className="delete" type="button" aria-label={`Supprimer la règle ACL ${acl.aclName}`} onClick={() => void deleteHaproxyAcl(frontend.name, acl.index)}>×</button>
                        </article>
                      ))}
                      {(haproxyAcls[frontend.name] ?? []).length === 0 && <p className="empty">Aucune règle ACL sur ce frontend.</p>}
                    </div>
                    <form className="new-item" onSubmit={(event) => { event.preventDefault(); void addHaproxyAcl(frontend.name); }}>
                      <input aria-label="Nom de la règle ACL" placeholder="Nom (ex: is_api)" value={aclDraft[frontend.name]?.aclName ?? ''} onChange={(event) => setAclDraft((current) => ({ ...current, [frontend.name]: { ...(current[frontend.name] ?? { criterion: '', value: '' }), aclName: event.target.value } }))} />
                      <input aria-label="Critère de la règle ACL" placeholder="Critère (ex: path_beg)" value={aclDraft[frontend.name]?.criterion ?? ''} onChange={(event) => setAclDraft((current) => ({ ...current, [frontend.name]: { ...(current[frontend.name] ?? { aclName: '', value: '' }), criterion: event.target.value } }))} />
                      <input aria-label="Valeur de la règle ACL" placeholder="Valeur (ex: /api)" value={aclDraft[frontend.name]?.value ?? ''} onChange={(event) => setAclDraft((current) => ({ ...current, [frontend.name]: { ...(current[frontend.name] ?? { aclName: '', criterion: '' }), value: event.target.value } }))} />
                      <button type="submit">Ajouter la règle</button>
                    </form>
                  </section>
                ))}
              </section>
            )}

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

            <section className="view-group">
              <h3>Certificats TLS</h3>
              {haproxyCertificates.map((cert) => (
                <p className="empty" key={cert.storageName}>{cert.storageName}{cert.description ? ` — ${cert.description}` : ''}</p>
              ))}
              {haproxyCertificates.length === 0 && <p className="empty">Aucun certificat TLS listé (Data Plane API non configurée ou magasin vide).</p>}
            </section>
          </div>
        ) : panel === 'proxmox' ? (
          <ProxmoxPanel apiBase={import.meta.env.VITE_API_URL ?? 'http://localhost:3000'} />
        ) : panel === 'deployment' ? (
          <DeploymentPanel apiBase={import.meta.env.VITE_API_URL ?? 'http://localhost:3000'} />
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
            <p className="empty">Documentation DevOS uniquement — guides d'usage et de fonctionnement de la plateforme (pas de contenu de dépôts externes).</p>
            <form className="new-item onboarding-form" onSubmit={(event) => void createOnboardingPage(event)}>
              <input aria-label="Titre de la fiche onboarding" placeholder="Titre (ex: Arrivée sur le projet DevOS)" value={onboardingTitle} onChange={(event) => setOnboardingTitle(event.target.value)} />
              <button type="submit">Créer une fiche onboarding</button>
            </form>
            {onboardingTitle && (
              <textarea className="doc-editor" aria-label="Contenu de la fiche onboarding" placeholder="Checklist ou documentation à consulter (Markdown)..." value={onboardingContent} onChange={(event) => setOnboardingContent(event.target.value)} />
            )}
            {docsError && <p className="error" role="alert">{docsError}</p>}
            {!docsError && docPages.length === 0 && <p className="empty">Aucune doc trouvée. Créez une fiche onboarding pour commencer.</p>}
            {docPages.map((page) => (
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
            setThemeColor={setThemeColorsTracked}
            themeColorHistory={themeColorHistory}
            undoThemeColor={undoThemeColor}
            themeAutoStart={themeAutoStart}
            setThemeAutoStart={setThemeAutoStart}
            themeAutoEnd={themeAutoEnd}
            setThemeAutoEnd={setThemeAutoEnd}
            adminLoginThemeId={adminLoginThemeId}
            setAdminLoginThemeId={setAdminLoginThemeId}
            platformThemePresets={platformThemePresets}
            addPlatformThemePreset={addPlatformThemePreset}
            customThemePresets={customThemePresets}
            saveCustomThemePreset={saveCustomThemePreset}
            deleteCustomThemePreset={deleteCustomThemePreset}
            applyThemePreset={applyThemePreset}
            profileBackground={profileBackground}
            setProfileBackground={setProfileBackground}
            notificationPermission={notificationPermission}
            onRequestNotificationPermission={() => void Notification.requestPermission().then(setNotificationPermission)}
          />
        ) : panel === 'login' ? (
          <section className="login-screen" style={loginThemeVars as CSSProperties}>
            <div className="login-screen-panel login-screen-brand">
              <div className="login-logo-orbit" aria-hidden="true">
                <span className="login-logo-ring login-logo-ring-1" />
                <span className="login-logo-ring login-logo-ring-2" />
                <svg className="login-logo-mark" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="DevOS">
                  <rect width="64" height="64" rx="14" fill="var(--accent)" />
                  <path d="M16 15h16.5c9.4 0 15.5 6.7 15.5 17s-6.1 17-15.5 17H16Zm9 8v18h6.8c5.4 0 8.7-3.4 8.7-9s-3.3-9-8.7-9Z" fill="#fffdf4" />
                  <circle className="login-logo-dot" cx="49.5" cy="17" r="5.5" fill="var(--accent-2)" stroke="#fffdf4" strokeWidth="2" />
                </svg>
              </div>
              <span className="kicker">DEVOS ACCESS</span>
              <h2>{language === 'fr' ? 'Votre homelab, un seul endroit' : 'Your homelab, one place'}</h2>
              <p className="empty">
                {language === 'fr'
                  ? "Tâches, déploiements, infra Proxmox, réseau et notes : DevOS centralise le pilotage de votre environnement."
                  : 'Tasks, deployments, Proxmox infra, network and notes: DevOS centralizes your environment in one control plane.'}
              </p>
              <ul className="login-highlight-list">
                <li>{language === 'fr' ? 'Suivi des tâches et du développement' : 'Task and development tracking'}</li>
                <li>{language === 'fr' ? 'Supervision Proxmox et réseau en direct' : 'Live Proxmox and network monitoring'}</li>
                <li>{language === 'fr' ? 'Thèmes et widgets personnalisables' : 'Customizable themes and widgets'}</li>
              </ul>
            </div>
            <div className="login-screen-panel login-screen-form widget-card">
              <h2>{language === 'fr' ? 'Connexion' : 'Sign in'}</h2>
              <p className="empty">{language === 'fr' ? 'Connectez-vous avec votre adresse e-mail. Keycloak reste optionnel.' : 'Sign in with your email address. Keycloak remains optional.'}</p>
              <form className="new-item" onSubmit={requestEmailLogin}><input aria-label="Adresse e-mail" type="email" autoComplete="email" placeholder="vous@example.com" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required /><button type="submit">{language === 'fr' ? 'Recevoir un lien' : 'Send sign-in link'}</button></form>
              {loginMessage && <p className="status" role="status">{loginMessage}</p>}
              <div className="login-divider"><span>{language === 'fr' ? 'ou' : 'or'}</span></div>
              <button type="button" className="filter" onClick={() => void signIn()}>{language === 'fr' ? 'Continuer avec Keycloak' : 'Continue with Keycloak'}</button>
            </div>
          </section>
        ) : panel === 'notes' ? (
          <NotesPanel apiBase={import.meta.env.VITE_API_URL ?? 'http://localhost:3000'} />
        ) : panel === 'dev-templates' ? (
          <DevTemplatesPanel apiBase={import.meta.env.VITE_API_URL ?? 'http://localhost:3000'} />
        ) : panel === 'development' ? (
          <DevelopmentPanel apiBase={import.meta.env.VITE_API_URL ?? 'http://localhost:3000'} />
        ) : null}
      </main>
      {detailItemId && (() => {
        const detailItem = items.find((entry) => entry.id === detailItemId) ?? dashboardItems.find((entry) => entry.id === detailItemId);
        if (!detailItem) return null;
        return (
          <TaskDetailPanel
            item={detailItem}
            apiBase={import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}
            onClose={() => setDetailItemId(null)}
            onStatusChange={(target, nextStatus) => void updateStatus(target, nextStatus)}
          />
        );
      })()}
      {status && <span className="status" role="status">{status}</span>}
      <Command.Dialog open={paletteOpen} onOpenChange={setPaletteOpen} label="Palette de commandes">
        <Command.Input placeholder="Rechercher une commande..." />
        <Command.List>
          <Command.Empty>Aucune commande trouvée.</Command.Empty>
          <Command.Group heading="Navigation">
            {(['list', 'board', 'gantt', 'calendar'] as const).map((value) => <Command.Item key={value} onSelect={() => { setPanel('work'); setWorkTab('tasks'); setView(value); setPaletteOpen(false); }}>{value === 'list' ? 'Ouvrir la liste' : value === 'board' ? 'Ouvrir le board' : value === 'gantt' ? 'Ouvrir Gantt' : 'Ouvrir le calendrier'}</Command.Item>)}
            <Command.Item onSelect={() => { setPanel('work'); setWorkTab('triage'); setPaletteOpen(false); }}>Ouvrir le triage</Command.Item>
            <Command.Item onSelect={() => { setPanel('work'); setWorkTab('today'); setPaletteOpen(false); }}>Ouvrir Aujourd’hui</Command.Item>
            <Command.Item onSelect={() => { setPanel('notes'); setPaletteOpen(false); }}>Ouvrir les notes</Command.Item>
            <Command.Item onSelect={() => { setPanel('home'); setPaletteOpen(false); }}>Ouvrir le dashboard</Command.Item>
          </Command.Group>
          <Command.Group heading="Actions">
            <Command.Item onSelect={() => { setPanel('work'); setWorkTab('tasks'); setPaletteOpen(false); window.setTimeout(() => titleInput.current?.focus(), 0); }}>Créer un item</Command.Item>
            <Command.Item onSelect={() => { setNavLayout((current) => current === 'sidebar' ? 'topbar' : 'sidebar'); setPaletteOpen(false); }}>Changer la disposition de navigation</Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </div>
  );
}
