import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Command } from 'cmdk';

import { createAuthorizationRequest } from './auth/oidc.js';

const oidcConfig = {
  issuerUrl: import.meta.env.VITE_KEYCLOAK_ISSUER_URL ?? 'https://keycloak.example.internal/realms/devos',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'devos',
  redirectUri: `${window.location.origin}/auth/callback`,
};

export function App() {
  const [status, setStatus] = useState('Prêt pour une session sécurisée.');
  const [items, setItems] = useState<Array<{ id: string; title: string; type: string; status: string; dueAt?: string | null; mergeRequestState?: string | null; pipelineStatus?: string | null; coderWorkspaceName?: string | null; coderWorkspaceStatus?: string | null }>>([]);
  const [workspaceLinks, setWorkspaceLinks] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [labels, setLabels] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [view, setView] = useState<'list' | 'board' | 'gantt' | 'calendar'>('list');
  const [itemsError, setItemsError] = useState('');
  const [panel, setPanel] = useState<'none' | 'dashboard' | 'triage' | 'haproxy' | 'catalog' | 'docs' | 'widgets'>('none');
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
    if (panel !== 'dashboard') return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/dashboard/${dashboardDay}`)
      .then(async (response) => { if (!response.ok) throw new Error(); setDashboardItems(await response.json()); })
      .catch(() => setDashboardItems([]));
  }, [panel, dashboardDay]);

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

  const visibleItems = filter === 'all' ? items : items.filter((item) => item.type === filter);
  const groupedItems = visibleItems.reduce<Record<string, typeof visibleItems>>((groups, item) => {
    const key = view === 'calendar' || view === 'gantt' ? (item.dueAt ? new Date(item.dueAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'Sans date') : item.status.replace('_', ' ');
    (groups[key] ??= []).push(item);
    return groups;
  }, {});
  const itemCard = (item: typeof items[number]) => <article className="item" key={item.id}><span className={`type type-${item.type}`}>{item.type}</span><strong>{item.title}</strong><span className="integrations">{item.mergeRequestState && `MR ${item.mergeRequestState}`}{item.pipelineStatus && ` · CI ${item.pipelineStatus}`}{item.coderWorkspaceStatus && ` · Workspace ${item.coderWorkspaceStatus}`}</span><select className="item-status" aria-label={`Statut de ${item.title}`} value={item.status} onChange={(event) => void updateStatus(item, event.target.value)}><option value="backlog">backlog</option><option value="in_progress">in progress</option><option value="done">done</option><option value="blocked">blocked</option></select><span className="item-actions">{item.type === 'task' && <button className="open-workspace" type="button" onClick={() => void openWorkspace(item)}>{item.coderWorkspaceName ? 'Ouvrir dans VS Code' : 'Ouvrir un environnement'}</button>}<button className="timer" type="button" onClick={() => void toggleTimer(item)}>{activeTimers[item.id] ? 'Arrêter' : 'Démarrer'}</button><button className="delete" type="button" aria-label={`Supprimer ${item.title}`} onClick={() => void deleteItem(item)}>×</button></span></article>;

  return (
    <main className="shell">
      <header className="topbar"><div><div className="eyebrow">DEVOS / HOMELAB COMMAND</div><h1 id="title">Aujourd’hui.</h1></div><button type="button" className="login" onClick={signIn}>Connexion SSO</button></header>
      <section className="workspace" aria-labelledby="items-title">
        {cycles.length > 0 && <aside className="cycles" aria-label="Cycles"><span className="kicker">CYCLE ACTIF</span>{cycles.filter((cycle) => !cycle.closedAt).map((cycle) => <div className="cycle" key={cycle.id}><strong>{cycle.name}</strong><button type="button" onClick={() => void closeCycle(cycle.id)}>Clôturer</button></div>)}</aside>}
        <div className="section-heading"><div><span className="kicker">WORK QUEUE</span><h2 id="items-title">Vos items</h2></div><div className="filters" aria-label="Filtrer les items">{['all', 'task', 'doc', 'goal'].map((value) => <button className={filter === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => setFilter(value)}>{value === 'all' ? 'Tout' : value}</button>)}</div></div>
        <nav className="views" aria-label="Vues">{(['list', 'board', 'gantt', 'calendar'] as const).map((value) => <button className={panel === 'none' && view === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => { setPanel('none'); setView(value); }}>{value === 'list' ? 'Liste' : value === 'board' ? 'Board' : value === 'gantt' ? 'Gantt' : 'Calendrier'}</button>)}<button className={panel === 'triage' ? 'filter active' : 'filter'} type="button" onClick={() => setPanel('triage')}>Triage ({triage.length})</button><button className={panel === 'dashboard' ? 'filter active' : 'filter'} type="button" onClick={() => setPanel('dashboard')}>Aujourd’hui</button><button className={panel === 'haproxy' ? 'filter active' : 'filter'} type="button" onClick={() => setPanel('haproxy')}>Infra HAProxy</button><button className={panel === 'catalog' ? 'filter active' : 'filter'} type="button" onClick={() => setPanel('catalog')}>Catalogue</button><button className={panel === 'docs' ? 'filter active' : 'filter'} type="button" onClick={() => setPanel('docs')}>Docs</button><button className={panel === 'widgets' ? 'filter active' : 'filter'} type="button" onClick={() => setPanel('widgets')}>Widgets</button></nav>
        <form className="new-item" onSubmit={createItem}><select aria-label="Type" value={type} onChange={(event) => setType(event.target.value)}><option value="task">Tâche</option><option value="doc">Document</option><option value="goal">Objectif</option></select><input ref={titleInput} aria-label="Titre" placeholder="Ajouter un item..." value={title} onChange={(event) => setTitle(event.target.value)} /><input aria-label="Labels" placeholder="type::bug, priority::high" value={labels} onChange={(event) => setLabels(event.target.value)} /><input aria-label="Échéance" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><button type="submit">Ajouter</button></form>
        {type === 'doc' && <textarea className="doc-editor" aria-label="Contenu du document" placeholder="Contenu Markdown du document..." value={content} onChange={(event) => setContent(event.target.value)} />}
        {itemsError && <p className="error" role="alert">{itemsError}</p>}
        {panel === 'dashboard' ? (
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
        ) : panel === 'triage' ? <div className="items triage-list">{triage.map((item) => <article className="item" key={item.id}><span className={`type type-${item.type}`}>{item.type}</span><strong>{item.title}</strong><button type="button" onClick={() => void transitionTriage(item.id, 'accept')}>Accepter</button><button className="delete" type="button" aria-label={`Rejeter ${item.title}`} onClick={() => void transitionTriage(item.id, 'reject')}>×</button></article>)}{triage.length === 0 && <p className="empty">La file de triage est vide.</p>}</div> : <div className={`items view-${view}`}>{view === 'list' ? visibleItems.map(itemCard) : Object.entries(groupedItems).map(([group, groupItems]) => <section className="view-group" key={group}><h3>{view === 'gantt' ? `Échéance ${group}` : group}</h3>{groupItems.map(itemCard)}</section>)}{!itemsError && visibleItems.length === 0 && <p className="empty">Aucun item dans cette vue.</p>}</div>}
      </section>
      <span className="status" role="status">{status}</span>
      <Command.Dialog open={paletteOpen} onOpenChange={setPaletteOpen} label="Palette de commandes">
        <Command.Input placeholder="Rechercher une commande..." />
        <Command.List>
          <Command.Empty>Aucune commande trouvée.</Command.Empty>
          <Command.Group heading="Navigation">
            {(['list', 'board', 'gantt', 'calendar'] as const).map((value) => <Command.Item key={value} onSelect={() => { setPanel('none'); setView(value); setPaletteOpen(false); }}>{value === 'list' ? 'Ouvrir la liste' : value === 'board' ? 'Ouvrir le board' : value === 'gantt' ? 'Ouvrir Gantt' : 'Ouvrir le calendrier'}</Command.Item>)}
            <Command.Item onSelect={() => { setPanel('triage'); setPaletteOpen(false); }}>Ouvrir le triage</Command.Item>
          </Command.Group>
          <Command.Group heading="Actions">
            <Command.Item onSelect={() => { setPaletteOpen(false); titleInput.current?.focus(); }}>Créer un item</Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </main>
  );
}