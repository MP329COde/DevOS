import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Command } from 'cmdk';

import { createAuthorizationRequest } from './auth/oidc.js';
import { NetworkGraph, type NetworkGraphEdge, type NetworkGraphNode } from './components/NetworkGraph.js';
import { IntegrationsPanel } from './components/IntegrationsPanel.js';

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

const homeWidgetDefs: Record<string, { title: string; icon: string }> = {
  pipelines: { title: 'Pipelines en cours', icon: 'network' },
  alerts: { title: 'Alertes actives', icon: 'gear' },
  wazuh: { title: 'Sécurité (Wazuh)', icon: 'layers' },
};

// Widgets génériques pour les intégrations exposées via /api/extras/* (voir backend/src/catalog/extras-http.ts).
const extraWidgetCatalog: Record<string, { title: string; icon: string; path: string; extract: (data: unknown) => string[] }> = {
  'extra:grafana': { title: 'Tableaux de bord Grafana', icon: 'layers', path: '/api/extras/grafana/dashboards', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { title?: string }).title ?? d)) : []) },
  'extra:harbor': { title: 'Projets Harbor', icon: 'layers', path: '/api/extras/harbor/projects', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { name?: string }).name ?? d)) : []) },
  'extra:proxmox': { title: 'Nœuds Proxmox', icon: 'network', path: '/api/extras/proxmox/nodes', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { node?: string }).node ?? d)) : []) },
  'extra:minio': { title: 'Buckets MinIO', icon: 'layers', path: '/api/extras/minio/buckets', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { name?: string }).name ?? d)) : []) },
  'extra:rabbitmq': { title: 'Files RabbitMQ', icon: 'layers', path: '/api/extras/rabbitmq/queues', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { name?: string }).name ?? d)) : []) },
  'extra:dns': { title: 'Zones DNS', icon: 'network', path: '/api/extras/dns/zones', extract: (data) => (Array.isArray(data) ? data.map((d) => String((d as { name?: string }).name ?? d)) : []) },
};
Object.entries(extraWidgetCatalog).forEach(([id, def]) => { homeWidgetDefs[id] = { title: def.title, icon: def.icon }; });

export function App() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<Array<{ id: string; title: string; type: string; status: string; dueAt?: string | null; mergeRequestState?: string | null; pipelineStatus?: string | null; coderWorkspaceName?: string | null; coderWorkspaceStatus?: string | null }>>([]);
  const [workspaceLinks, setWorkspaceLinks] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [labels, setLabels] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [view, setView] = useState<'list' | 'board' | 'gantt' | 'calendar'>('list');
  const [itemsError, setItemsError] = useState('');
  const [panel, setPanel] = useState<'home' | 'items' | 'today' | 'triage' | 'haproxy' | 'catalog' | 'docs' | 'widgets' | 'settings' | 'network' | 'integrations'>('home');
  const [navLayout, setNavLayout] = useState<'sidebar' | 'topbar'>(() => (localStorage.getItem('devos.navLayout') as 'sidebar' | 'topbar' | null) ?? 'sidebar');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('devos.sidebarCollapsed') === '1');
  const [homeEditMode, setHomeEditMode] = useState(false);
  const [homeWidgets, setHomeWidgets] = useState<Array<{ id: string; visible: boolean }>>(() => {
    const saved = localStorage.getItem('devos.homeWidgets');
    const base: Array<{ id: string; visible: boolean }> = saved ? JSON.parse(saved) : [{ id: 'pipelines', visible: true }, { id: 'alerts', visible: true }, { id: 'wazuh', visible: true }];
    const known = new Set(base.map((w) => w.id));
    const extras = Object.keys(extraWidgetCatalog).filter((id) => !known.has(id)).map((id) => ({ id, visible: false }));
    return [...base, ...extras];
  });
  const [extraWidgetData, setExtraWidgetData] = useState<Record<string, string[] | 'error'>>({});
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
  const [k8sNodes, setK8sNodes] = useState<Array<{ name: string; ready: boolean }>>([]);
  const [argoApps, setArgoApps] = useState<Array<{ name: string; syncStatus: string; healthStatus: string }>>([]);
  const [docPages, setDocPages] = useState<Array<{ id: string; title: string; sourceProject: string; path: string }>>([]);
  const [docsError, setDocsError] = useState('');
  const [widgetData, setWidgetData] = useState<{ pipelines: { running: number; items: Array<{ id: number; status: string; ref: string; web_url: string }> }; alerts: { active: number; critical: number; items: Array<{ fingerprint: string; labels: Record<string, string>; status: { state: string }; startsAt: string }> } } | null>(null);
  const [widgetsError, setWidgetsError] = useState('');
  const [enabledWidgets, setEnabledWidgets] = useState<Record<'pipelines' | 'alerts', boolean>>(() => {
    const saved = localStorage.getItem('devos.widgets');
    return saved ? JSON.parse(saved) : { pipelines: true, alerts: true };
  });
  const [settingsKnown, setSettingsKnown] = useState<string[]>([]);
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>({});
  const [settingsDrafts, setSettingsDrafts] = useState<Record<string, string>>({});
  const [settingsError, setSettingsError] = useState('');
  const [settingsSavedKey, setSettingsSavedKey] = useState('');
  const [networkGraph, setNetworkGraph] = useState<{ nodes: NetworkGraphNode[]; edges: NetworkGraphEdge[] } | null>(null);
  const [networkError, setNetworkError] = useState('');
  const titleInput = useRef<HTMLInputElement>(null);

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
    homeWidgets.filter((w) => w.visible && extraWidgetCatalog[w.id]).forEach((w) => {
      const def = extraWidgetCatalog[w.id];
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
  }, [panel, homeWidgets]);

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
    if (panel !== 'settings') return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/settings`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? 'Les paramètres ne sont pas configurés sur ce backend.' : 'Impossible de charger les paramètres.');
        const data = await response.json();
        setSettingsKnown(data.known);
        setSettingsValues(data.values);
        setSettingsDrafts(data.values);
        setSettingsError('');
      })
      .catch((error: Error) => setSettingsError(error.message));
  }, [panel]);

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

  async function scanDocs() {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/docs/scan`, { method: 'POST' });
    if (!response.ok) { setDocsError('Le scan des docs a échoué.'); return; }
    const docsResponse = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/docs`);
    if (docsResponse.ok) setDocPages(await docsResponse.json());
  }

  async function saveSetting(key: string) {
    const value = settingsDrafts[key] ?? '';
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/settings/${encodeURIComponent(key)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value }),
    });
    if (!response.ok) { setSettingsError(`Échec de l'enregistrement de ${key}.`); return; }
    setSettingsValues((current) => ({ ...current, [key]: value }));
    setSettingsSavedKey(key);
    setTimeout(() => setSettingsSavedKey(''), 1500);
  }

  async function clearSetting(key: string) {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/settings/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (!response.ok) { setSettingsError(`Échec de la suppression de ${key}.`); return; }
    setSettingsValues((current) => { const next = { ...current }; delete next[key]; return next; });
    setSettingsDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  const visibleItems = filter === 'all' ? items : items.filter((item) => item.type === filter);
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
  const itemCard = (item: typeof items[number]) =><article className="item" key={item.id}><span className={`type type-${item.type}`}>{item.type}</span><strong>{item.title}</strong><span className="integrations">{item.mergeRequestState && `MR ${item.mergeRequestState}`}{item.pipelineStatus && ` · CI ${item.pipelineStatus}`}{item.coderWorkspaceStatus && ` · Workspace ${item.coderWorkspaceStatus}`}</span><select className="item-status" aria-label={`Statut de ${item.title}`} value={item.status} onChange={(event) => void updateStatus(item, event.target.value)}><option value="backlog">backlog</option><option value="in_progress">in progress</option><option value="done">done</option><option value="blocked">blocked</option></select><span className="item-actions">{item.type === 'task' && <button className="open-workspace" type="button" onClick={() => void openWorkspace(item)}>{item.coderWorkspaceName ? 'Ouvrir dans VS Code' : 'Ouvrir un environnement'}</button>}<button className="timer" type="button" onClick={() => void toggleTimer(item)}>{activeTimers[item.id] ? 'Arrêter' : 'Démarrer'}</button><button className="delete" type="button" aria-label={`Supprimer ${item.title}`} onClick={() => void deleteItem(item)}>×</button></span></article>;

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
            <div className="stat-cards">
              <div className="stat-card"><span className="stat-value">{items.length}</span><span className="stat-label">Items au total</span></div>
              <div className="stat-card"><span className="stat-value">{statusCounts.in_progress ?? 0}</span><span className="stat-label">En cours</span></div>
              <div className="stat-card"><span className="stat-value">{statusCounts.blocked ?? 0}</span><span className="stat-label">Bloqués</span></div>
              <div className="stat-card"><span className="stat-value">{statusCounts.done ?? 0}</span><span className="stat-label">Terminés</span></div>
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
            {homeEditMode && homeWidgets.some((w) => !w.visible) && (
              <div className="widget-add-panel">
                <h4>Ajouter un widget</h4>
                <div className="widget-add-list">
                  {homeWidgets.filter((w) => !w.visible).map((w) => (
                    <button type="button" className="widget-add-chip" key={w.id} onClick={() => toggleHomeWidget(w.id)}>
                      <Icon name={homeWidgetDefs[w.id].icon} size={14} /> {homeWidgetDefs[w.id].title}
                      <Icon name="plus" size={12} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className={homeEditMode ? 'widget-grid edit-mode' : 'widget-grid'}>
              {homeWidgets.filter((w) => w.visible).map((w) => {
                const def = homeWidgetDefs[w.id];
                const extraDataForWidget = extraWidgetData[w.id];
                const body = w.id === 'pipelines'
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
                    className={`widget-card${draggedWidgetId === w.id ? ' dragging' : ''}${dragOverWidgetId === w.id && draggedWidgetId !== w.id ? ' drag-over' : ''}`}
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
        <div className="section-heading"><div><span className="kicker">WORK QUEUE</span><h2 id="items-title">Vos items</h2></div><div className="filters" aria-label="Filtrer les items">{['all', 'task', 'doc', 'goal'].map((value) => <button className={filter === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => setFilter(value)}>{value === 'all' ? 'Tout' : value}</button>)}</div></div>
        <nav className="views" aria-label="Vues">{(['list', 'board', 'gantt', 'calendar'] as const).map((value) => <button className={view === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => setView(value)}>{value === 'list' ? 'Liste' : value === 'board' ? 'Board' : value === 'gantt' ? 'Gantt' : 'Calendrier'}</button>)}</nav>
        <form className="new-item" onSubmit={createItem}><select aria-label="Type" value={type} onChange={(event) => setType(event.target.value)}><option value="task">Tâche</option><option value="doc">Document</option><option value="goal">Objectif</option></select><input ref={titleInput} aria-label="Titre" placeholder="Ajouter un item..." value={title} onChange={(event) => setTitle(event.target.value)} /><input aria-label="Labels" placeholder="type::bug, priority::high" value={labels} onChange={(event) => setLabels(event.target.value)} /><input aria-label="Échéance" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><button type="submit">Ajouter</button></form>
        {type === 'doc' && <textarea className="doc-editor" aria-label="Contenu du document" placeholder="Contenu Markdown du document..." value={content} onChange={(event) => setContent(event.target.value)} />}
        {itemsError && <p className="error" role="alert">{itemsError}</p>}
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
            {docsError && <p className="error" role="alert">{docsError}</p>}
            {!docsError && docPages.length === 0 && <p className="empty">Aucune doc trouvée. Lancez un scan pour peupler la liste.</p>}
            {docPages.map((page) => (
              <article className="item doc-page" key={page.id}>
                <strong>{page.title}</strong>
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
          </div>
        ) : panel === 'settings' ? (
          <div className="items settings-panel">
            <section className="widget-card">
              <h3>Apparence</h3>
              <div className="filters" aria-label="Disposition de navigation">
                <button className={navLayout === 'sidebar' ? 'filter active' : 'filter'} type="button" onClick={() => setNavLayout('sidebar')}>Barre latérale</button>
                <button className={navLayout === 'topbar' ? 'filter active' : 'filter'} type="button" onClick={() => setNavLayout('topbar')}>Barre du haut</button>
              </div>
            </section>
            {settingsError && <p className="error" role="alert">{settingsError}</p>}
            {!settingsError && settingsKnown.length === 0 && <p className="empty">Chargement des paramètres…</p>}
            {settingsKnown.map((key) => (
              <article className="item setting-row" key={key}>
                <strong>{key}</strong>
                <input
                  aria-label={key}
                  type="text"
                  placeholder={settingsValues[key] ? '••••••••' : 'Non configuré'}
                  value={settingsDrafts[key] ?? ''}
                  onChange={(event) => setSettingsDrafts((current) => ({ ...current, [key]: event.target.value }))}
                />
                <span className="setting-actions">
                  <button type="button" onClick={() => void saveSetting(key)}>{settingsSavedKey === key ? 'Enregistré ✓' : 'Enregistrer'}</button>
                  {settingsValues[key] && <button className="delete" type="button" aria-label={`Effacer ${key}`} onClick={() => void clearSetting(key)}>×</button>}
                </span>
              </article>
            ))}
          </div>
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