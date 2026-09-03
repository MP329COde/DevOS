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
  const [items, setItems] = useState<Array<{ id: string; title: string; type: string; status: string; dueAt?: string | null; mergeRequestState?: string | null; pipelineStatus?: string | null }>>([]);
  const [filter, setFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [labels, setLabels] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [view, setView] = useState<'list' | 'board' | 'gantt' | 'calendar'>('list');
  const [itemsError, setItemsError] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardDay, setDashboardDay] = useState<'today' | 'tomorrow'>('today');
  const [dashboardItems, setDashboardItems] = useState<Array<{ id: string; title: string; type: string; dueAt?: string | null }>>([]);
  const [cycles, setCycles] = useState<Array<{ id: string; name: string; closedAt?: string | null }>>([]);
  const [triage, setTriage] = useState<Array<{ id: string; title: string; type: string }>>([]);
  const [showTriage, setShowTriage] = useState(false);
  const [activeTimers, setActiveTimers] = useState<Record<string, string>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showHAProxy, setShowHAProxy] = useState(false);
  const [haproxyBackends, setHaproxyBackends] = useState<Array<{ name: string; mode?: string }>>([]);
  const [haproxyServers, setHaproxyServers] = useState<Record<string, Array<{ name: string; address: string; port: number }>>>({});
  const [haproxyError, setHaproxyError] = useState('');
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
    if (!showDashboard) return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/dashboard/${dashboardDay}`)
      .then(async (response) => { if (!response.ok) throw new Error(); setDashboardItems(await response.json()); })
      .catch(() => setDashboardItems([]));
  }, [showDashboard, dashboardDay]);

  useEffect(() => {
    if (!showHAProxy) return;
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
  }, [showHAProxy]);

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
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, title, labels: labels.split(',').map((label) => label.trim()).filter(Boolean), ...(dueAt ? { dueAt: new Date(`${dueAt}T12:00:00`).toISOString() } : {}) }),
    });
    if (!response.ok) { setItemsError('Création impossible.'); return; }
    const created = await response.json();
    setItems((current) => [created, ...current]);
    setTitle('');
    setLabels('');
    setDueAt('');
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

  async function closeCycle(id: string) {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/cycles/${id}/close`, { method: 'POST' });
    if (response.ok) setCycles((current) => current.map((cycle) => cycle.id === id ? { ...cycle, closedAt: new Date().toISOString() } : cycle));
  }

  async function transitionTriage(id: string, action: 'accept' | 'reject') {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/triage/${id}/${action}`, { method: 'POST' });
    if (response.ok) setTriage((current) => current.filter((item) => item.id !== id));
  }

  const visibleItems = filter === 'all' ? items : items.filter((item) => item.type === filter);
  const groupedItems = visibleItems.reduce<Record<string, typeof visibleItems>>((groups, item) => {
    const key = view === 'calendar' || view === 'gantt' ? (item.dueAt ? new Date(item.dueAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'Sans date') : item.status.replace('_', ' ');
    (groups[key] ??= []).push(item);
    return groups;
  }, {});
  const itemCard = (item: typeof items[number]) => <article className="item" key={item.id}><span className={`type type-${item.type}`}>{item.type}</span><strong>{item.title}</strong><span className="integrations">{item.mergeRequestState && `MR ${item.mergeRequestState}`}{item.pipelineStatus && ` · CI ${item.pipelineStatus}`}</span><select className="item-status" aria-label={`Statut de ${item.title}`} value={item.status} onChange={(event) => void updateStatus(item, event.target.value)}><option value="backlog">backlog</option><option value="in_progress">in progress</option><option value="done">done</option><option value="blocked">blocked</option></select><button className="timer" type="button" onClick={() => void toggleTimer(item)}>{activeTimers[item.id] ? 'Arrêter' : 'Démarrer'}</button><button className="delete" type="button" aria-label={`Supprimer ${item.title}`} onClick={() => void deleteItem(item)}>×</button></article>;

  return (
    <main className="shell">
      <header className="topbar"><div><div className="eyebrow">DEVOS / HOMELAB COMMAND</div><h1 id="title">Aujourd’hui.</h1></div><button type="button" className="login" onClick={signIn}>Connexion SSO</button></header>
      <section className="workspace" aria-labelledby="items-title">
        {cycles.length > 0 && <aside className="cycles" aria-label="Cycles"><span className="kicker">CYCLE ACTIF</span>{cycles.filter((cycle) => !cycle.closedAt).map((cycle) => <div className="cycle" key={cycle.id}><strong>{cycle.name}</strong><button type="button" onClick={() => void closeCycle(cycle.id)}>Clôturer</button></div>)}</aside>}
        <div className="section-heading"><div><span className="kicker">WORK QUEUE</span><h2 id="items-title">Vos items</h2></div><div className="filters" aria-label="Filtrer les items">{['all', 'task', 'doc', 'goal'].map((value) => <button className={filter === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => setFilter(value)}>{value === 'all' ? 'Tout' : value}</button>)}</div></div>
        <nav className="views" aria-label="Vues">{(['list', 'board', 'gantt', 'calendar'] as const).map((value) => <button className={!showDashboard && !showTriage && !showHAProxy && view === value ? 'filter active' : 'filter'} key={value} type="button" onClick={() => { setShowTriage(false); setShowDashboard(false); setShowHAProxy(false); setView(value); }}>{value === 'list' ? 'Liste' : value === 'board' ? 'Board' : value === 'gantt' ? 'Gantt' : 'Calendrier'}</button>)}<button className={showTriage ? 'filter active' : 'filter'} type="button" onClick={() => { setShowDashboard(false); setShowHAProxy(false); setShowTriage(true); }}>Triage ({triage.length})</button><button className={showDashboard ? 'filter active' : 'filter'} type="button" onClick={() => { setShowTriage(false); setShowDashboard(true); setShowHAProxy(false); }}>Aujourd’hui</button><button className={showHAProxy ? 'filter active' : 'filter'} type="button" onClick={() => { setShowTriage(false); setShowDashboard(false); setShowHAProxy(true); }}>Infra HAProxy</button></nav>
        <form className="new-item" onSubmit={createItem}><select aria-label="Type" value={type} onChange={(event) => setType(event.target.value)}><option value="task">Tâche</option><option value="doc">Document</option><option value="goal">Objectif</option></select><input ref={titleInput} aria-label="Titre" placeholder="Ajouter un item..." value={title} onChange={(event) => setTitle(event.target.value)} /><input aria-label="Labels" placeholder="type::bug, priority::high" value={labels} onChange={(event) => setLabels(event.target.value)} /><input aria-label="Échéance" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><button type="submit">Ajouter</button></form>
        {itemsError && <p className="error" role="alert">{itemsError}</p>}
        {showDashboard ? (
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
        ) : showHAProxy ? (
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
        ) : showTriage ? <div className="items triage-list">{triage.map((item) => <article className="item" key={item.id}><span className={`type type-${item.type}`}>{item.type}</span><strong>{item.title}</strong><button type="button" onClick={() => void transitionTriage(item.id, 'accept')}>Accepter</button><button className="delete" type="button" aria-label={`Rejeter ${item.title}`} onClick={() => void transitionTriage(item.id, 'reject')}>×</button></article>)}{triage.length === 0 && <p className="empty">La file de triage est vide.</p>}</div> : <div className={`items view-${view}`}>{view === 'list' ? visibleItems.map(itemCard) : Object.entries(groupedItems).map(([group, groupItems]) => <section className="view-group" key={group}><h3>{view === 'gantt' ? `Échéance ${group}` : group}</h3>{groupItems.map(itemCard)}</section>)}{!itemsError && visibleItems.length === 0 && <p className="empty">Aucun item dans cette vue.</p>}</div>}
      </section>
      <span className="status" role="status">{status}</span>
      <Command.Dialog open={paletteOpen} onOpenChange={setPaletteOpen} label="Palette de commandes">
        <Command.Input placeholder="Rechercher une commande..." />
        <Command.List>
          <Command.Empty>Aucune commande trouvée.</Command.Empty>
          <Command.Group heading="Navigation">
            {(['list', 'board', 'gantt', 'calendar'] as const).map((value) => <Command.Item key={value} onSelect={() => { setShowTriage(false); setView(value); setPaletteOpen(false); }}>{value === 'list' ? 'Ouvrir la liste' : value === 'board' ? 'Ouvrir le board' : value === 'gantt' ? 'Ouvrir Gantt' : 'Ouvrir le calendrier'}</Command.Item>)}
            <Command.Item onSelect={() => { setShowTriage(true); setPaletteOpen(false); }}>Ouvrir le triage</Command.Item>
          </Command.Group>
          <Command.Group heading="Actions">
            <Command.Item onSelect={() => { setPaletteOpen(false); titleInput.current?.focus(); }}>Créer un item</Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </main>
  );
}