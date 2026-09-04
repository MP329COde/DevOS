import { useEffect, useMemo, useState } from 'react';

import type { DevProject } from './DevelopmentPanel.js';

// Sous-vue "Roadmap, versions & environnements" du module Développement (section AM.6,
// onglet `roadmap` de DevelopmentPanel.tsx). La roadmap réutilise les fondations existantes
// (Item/taskLevel/Cycle) via GET /api/roadmap — aucun nouveau modèle nécessaire. Versions et
// environnements ont leurs propres modèles Prisma (Release, Environment) liés à DevProject.

interface RoadmapItem {
  id: string;
  title: string;
  status: string;
  taskLevel: string | null;
  parentId: string | null;
  dueAt: string | null;
  createdAt: string;
}

interface RoadmapMilestone {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  closedAt: string | null;
  itemCount: number;
  doneCount: number;
  progress: number;
  isLate: boolean;
  isBlocked: boolean;
  rollupStatus: 'backlog' | 'in_progress' | 'done' | 'blocked';
}

interface RoadmapData {
  items: RoadmapItem[];
  milestones: RoadmapMilestone[];
}

interface Release {
  id: string;
  devProjectId: string;
  version: string;
  name: string | null;
  description: string | null;
  state: 'draft' | 'in_progress' | 'released' | 'deprecated';
  plannedAt: string | null;
  releasedAt: string | null;
  changelog: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Environment {
  id: string;
  devProjectId: string;
  name: string;
  kind: 'dev' | 'staging' | 'prod' | 'other';
  url: string | null;
  status: 'unknown' | 'up' | 'down' | 'degraded';
  currentVersion: string | null;
  expectedVersion: string | null;
  pipelineStatus: string | null;
  lastDeployedAt: string | null;
  lastError: string | null;
  requiresApproval: boolean;
}

const ROADMAP_VIEWS = ['liste', 'kanban', 'calendrier', 'timeline'] as const;
type RoadmapView = (typeof ROADMAP_VIEWS)[number];

const ROADMAP_VIEW_LABELS: Record<RoadmapView, string> = { liste: 'Liste', kanban: 'Kanban', calendrier: 'Calendrier', timeline: 'Timeline' };

const RELEASE_STATE_LABELS: Record<Release['state'], string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  released: 'Publiée',
  deprecated: 'Dépréciée',
};

const SUB_TABS = ['roadmap', 'versions', 'environnements'] as const;
type SubTab = (typeof SUB_TABS)[number];
const SUB_TAB_LABELS: Record<SubTab, string> = { roadmap: 'Roadmap', versions: 'Versions', environnements: 'Environnements' };

export function DevRoadmapPanel({ apiBase, projects }: { apiBase: string; projects: DevProject[] }) {
  const [subTab, setSubTab] = useState<SubTab>('roadmap');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  return (
    <div className="dev-roadmap-panel">
      <nav className="views" aria-label="Roadmap, versions et environnements">
        {SUB_TABS.map((value) => (
          <button key={value} className={subTab === value ? 'filter active' : 'filter'} type="button" onClick={() => setSubTab(value)}>
            {SUB_TAB_LABELS[value]}
          </button>
        ))}
      </nav>

      {(subTab === 'versions' || subTab === 'environnements') && (
        <label className="dev-roadmap-project-select">
          Projet
          <select aria-label="Projet" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            <option value="" disabled>Sélectionner un projet…</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
      )}

      {subTab === 'roadmap' && <RoadmapTab apiBase={apiBase} />}
      {subTab === 'versions' && <ReleasesTab apiBase={apiBase} devProjectId={selectedProjectId} />}
      {subTab === 'environnements' && <EnvironmentsTab apiBase={apiBase} devProjectId={selectedProjectId} />}
    </div>
  );
}

function RoadmapTab({ apiBase }: { apiBase: string }) {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<RoadmapView>('liste');

  useEffect(() => {
    void fetch(`${apiBase}/api/roadmap`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setData(await response.json());
        setError('');
      })
      .catch(() => setError('Impossible de charger la roadmap. Démarrez le backend pour connecter vos données.'));
  }, [apiBase]);

  const lateOrBlocked = useMemo(() => (data?.milestones ?? []).filter((m) => m.isLate || m.isBlocked), [data]);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!data) return <p className="empty">Chargement de la roadmap…</p>;

  return (
    <div className="dev-roadmap">
      {lateOrBlocked.length > 0 && (
        <section className="view-group dev-roadmap-alerts">
          <h3>Jalons en retard ou bloqués</h3>
          {lateOrBlocked.map((m) => (
            <p key={m.id} className="error" role="alert">
              {m.name} — {m.isLate && 'en retard'}{m.isLate && m.isBlocked ? ' · ' : ''}{m.isBlocked && 'bloqué'} ({m.doneCount}/{m.itemCount}, {m.progress}%)
            </p>
          ))}
        </section>
      )}

      <nav className="views" aria-label="Vues de la roadmap">
        {ROADMAP_VIEWS.map((value) => (
          <button key={value} className={view === value ? 'filter active' : 'filter'} type="button" onClick={() => setView(value)}>
            {ROADMAP_VIEW_LABELS[value]}
          </button>
        ))}
      </nav>

      <section className="view-group">
        <h3>Jalons</h3>
        {data.milestones.length === 0 && <p className="empty">Aucun jalon pour l'instant — créez un cycle depuis Travail pour en faire un jalon roadmap.</p>}
        <div className="dev-roadmap-milestones">
          {data.milestones.map((m) => (
            <article className="item widget-card" key={m.id}>
              <span className="item-title">
                <strong>{m.name}</strong>
                {m.isLate && <span className="status-badge status-badge-off">En retard</span>}
                {m.isBlocked && <span className="status-badge status-badge-off">Bloqué</span>}
                {!m.isLate && !m.isBlocked && m.rollupStatus === 'done' && <span className="status-badge status-badge-ok">Terminé</span>}
              </span>
              <span className="item-meta">
                <span>Date cible : {new Date(m.endsAt).toLocaleDateString('fr-FR')}</span>
                <span>Avancement : {m.progress}% ({m.doneCount}/{m.itemCount})</span>
              </span>
            </article>
          ))}
        </div>
      </section>

      {view === 'liste' && (
        <section className="view-group">
          <h3>Objectifs / epics / features / tâches</h3>
          {data.items.length === 0 && <p className="empty">Aucun élément de roadmap pour l'instant.</p>}
          <ul>
            {data.items.map((item) => (
              <li key={item.id}>
                <span className={`status-badge status-${item.status}`}>{item.status}</span> {item.taskLevel ? `[${item.taskLevel}] ` : ''}{item.title}
                {item.dueAt && ` — échéance ${new Date(item.dueAt).toLocaleDateString('fr-FR')}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === 'kanban' && (
        <section className="view-group dev-roadmap-kanban">
          {(['backlog', 'in_progress', 'blocked', 'done'] as const).map((status) => (
            <div className="dev-roadmap-column" key={status}>
              <h4>{status}</h4>
              {data.items.filter((item) => item.status === status).map((item) => <p key={item.id} className="item">{item.title}</p>)}
            </div>
          ))}
        </section>
      )}

      {view === 'calendrier' && (
        <section className="view-group">
          <h3>Échéances</h3>
          {data.items.filter((item) => item.dueAt).length === 0 && <p className="empty">Aucun élément avec échéance.</p>}
          <ul>
            {data.items.filter((item) => item.dueAt).sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : 1)).map((item) => (
              <li key={item.id}>{new Date(item.dueAt!).toLocaleDateString('fr-FR')} — {item.title}</li>
            ))}
          </ul>
        </section>
      )}

      {view === 'timeline' && (
        <section className="view-group">
          <h3>Timeline des jalons</h3>
          <ul>
            {[...data.milestones].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1)).map((m) => (
              <li key={m.id}>{new Date(m.startsAt).toLocaleDateString('fr-FR')} → {new Date(m.endsAt).toLocaleDateString('fr-FR')} : {m.name} ({m.progress}%)</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReleasesTab({ apiBase, devProjectId }: { apiBase: string; devProjectId: string }) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [error, setError] = useState('');
  const [version, setVersion] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function load() {
    if (!devProjectId) return;
    void fetch(`${apiBase}/api/releases?devProjectId=${encodeURIComponent(devProjectId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setReleases(await response.json());
        setError('');
      })
      .catch(() => setError('Impossible de charger les versions.'));
  }

  useEffect(load, [apiBase, devProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    if (!version.trim() || !devProjectId) return;
    try {
      const response = await fetch(`${apiBase}/api/releases`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ devProjectId, version: version.trim(), name: name.trim() || undefined, description: description.trim() || undefined }),
      });
      if (!response.ok) throw new Error();
      setVersion(''); setName(''); setDescription('');
      load();
    } catch {
      setError('La création de la version a échoué.');
    }
  }

  async function publish(id: string) {
    try {
      const response = await fetch(`${apiBase}/api/releases/${id}/publish`, { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Publication refusée');
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La publication a échoué.');
    }
  }

  if (!devProjectId) return <p className="empty">Sélectionnez un projet pour voir ses versions.</p>;

  return (
    <div className="dev-releases">
      {error && <p className="error" role="alert">{error}</p>}

      <section className="view-group">
        <h3>Nouvelle version</h3>
        <div className="item-actions">
          <input aria-label="Numéro de version" placeholder="ex. 1.2.0" value={version} onChange={(event) => setVersion(event.target.value)} />
          <input aria-label="Nom de la version" placeholder="Nom (optionnel)" value={name} onChange={(event) => setName(event.target.value)} />
          <input aria-label="Description de la version" placeholder="Description (optionnel)" value={description} onChange={(event) => setDescription(event.target.value)} />
          <button type="button" onClick={() => void create()}>Créer</button>
        </div>
      </section>

      <section className="view-group">
        <h3>Versions ({releases.length})</h3>
        {releases.length === 0 && <p className="empty">Aucune version pour ce projet pour l'instant.</p>}
        {releases.map((release) => (
          <article className="item widget-card" key={release.id}>
            <span className="item-title">
              <strong>{release.version}</strong>{release.name ? ` — ${release.name}` : ''}
              <span className={`status-badge status-${release.state}`}>{RELEASE_STATE_LABELS[release.state]}</span>
            </span>
            {release.description && <p className="empty">{release.description}</p>}
            <span className="item-meta">
              {release.plannedAt && <span>Prévue : {new Date(release.plannedAt).toLocaleDateString('fr-FR')}</span>}
              {release.releasedAt && <span>Publiée : {new Date(release.releasedAt).toLocaleDateString('fr-FR')}</span>}
            </span>
            {release.changelog && (
              <details>
                <summary>Changelog</summary>
                <pre className="dev-changelog">{release.changelog}</pre>
              </details>
            )}
            {release.state !== 'released' && (
              <span className="item-actions">
                <button type="button" onClick={() => void publish(release.id)}>Publier (validation automatique : au moins un élément associé requis)</button>
              </span>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function EnvironmentsTab({ apiBase, devProjectId }: { apiBase: string; devProjectId: string }) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Environment['kind']>('dev');
  const [expectedVersion, setExpectedVersion] = useState('');
  const [deployVersions, setDeployVersions] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function load() {
    if (!devProjectId) return;
    void fetch(`${apiBase}/api/environments?devProjectId=${encodeURIComponent(devProjectId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setEnvironments(await response.json());
        setError('');
      })
      .catch(() => setError('Impossible de charger les environnements.'));
  }

  useEffect(load, [apiBase, devProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    if (!name.trim() || !devProjectId) return;
    try {
      const response = await fetch(`${apiBase}/api/environments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ devProjectId, name: name.trim(), kind, expectedVersion: expectedVersion.trim() || undefined }),
      });
      if (!response.ok) throw new Error();
      setName(''); setExpectedVersion('');
      load();
    } catch {
      setError("La création de l'environnement a échoué.");
    }
  }

  async function deploy(env: Environment, confirm: boolean) {
    const version = deployVersions[env.id]?.trim();
    if (!version) return;
    const sensitive = env.kind === 'prod' || env.requiresApproval;
    if (sensitive && !confirm) { setConfirmingId(env.id); return; }
    try {
      const response = await fetch(`${apiBase}/api/environments/${env.id}/deploy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-devos-role': 'Admin' },
        body: JSON.stringify({ version, ...(sensitive ? { confirm: true } : {}) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Déploiement refusé');
      }
      setConfirmingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le déploiement a échoué.');
    }
  }

  if (!devProjectId) return <p className="empty">Sélectionnez un projet pour voir ses environnements.</p>;

  return (
    <div className="dev-environments">
      {error && <p className="error" role="alert">{error}</p>}

      <section className="view-group">
        <h3>Nouvel environnement</h3>
        <div className="item-actions">
          <input aria-label="Nom de l'environnement" placeholder="ex. staging" value={name} onChange={(event) => setName(event.target.value)} />
          <select aria-label="Type d'environnement" value={kind} onChange={(event) => setKind(event.target.value as Environment['kind'])}>
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="prod">prod</option>
            <option value="other">autre</option>
          </select>
          <input aria-label="Version attendue" placeholder="Version attendue (optionnel)" value={expectedVersion} onChange={(event) => setExpectedVersion(event.target.value)} />
          <button type="button" onClick={() => void create()}>Créer</button>
        </div>
      </section>

      <section className="view-group dev-environment-grid">
        {environments.length === 0 && <p className="empty">Aucun environnement pour ce projet pour l'instant.</p>}
        {environments.map((env) => {
          const drift = !!env.expectedVersion && env.currentVersion !== env.expectedVersion;
          return (
            <article className="item widget-card" key={env.id}>
              <span className="item-title">
                <strong>{env.name}</strong>
                <span className="status-badge">{env.kind}</span>
                <span className={env.status === 'up' ? 'status-badge status-badge-ok' : env.status === 'down' ? 'status-badge status-badge-off' : 'status-badge'}>{env.status}</span>
              </span>
              <span className="item-meta">
                {env.url && <a href={env.url} target="_blank" rel="noreferrer">{env.url}</a>}
                <span>Version actuelle : {env.currentVersion ?? 'inconnue'}</span>
                {env.expectedVersion && <span>Version attendue : {env.expectedVersion}</span>}
                {drift && <span className="status-badge status-badge-off">Écart de version</span>}
                {env.pipelineStatus && <span>Pipeline : {env.pipelineStatus}</span>}
                {env.lastDeployedAt && <span>Dernière maj : {new Date(env.lastDeployedAt).toLocaleString('fr-FR')}</span>}
              </span>
              {env.lastError && <p className="error" role="alert">{env.lastError}</p>}

              <div className="item-actions">
                <input
                  aria-label={`Version à déployer sur ${env.name}`}
                  placeholder="Version à déployer"
                  value={deployVersions[env.id] ?? ''}
                  onChange={(event) => setDeployVersions((current) => ({ ...current, [env.id]: event.target.value }))}
                />
                <button type="button" onClick={() => void deploy(env, false)}>Déployer</button>
              </div>
              {confirmingId === env.id && (
                <p className="error" role="alert">
                  Action sensible ({env.kind === 'prod' ? 'production' : 'validation requise'}) — confirmer ?{' '}
                  <button type="button" onClick={() => void deploy(env, true)}>Confirmer le déploiement</button>{' '}
                  <button type="button" onClick={() => setConfirmingId(null)}>Annuler</button>
                </p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
