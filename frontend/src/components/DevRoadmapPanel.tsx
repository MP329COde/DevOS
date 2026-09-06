import { useEffect, useMemo, useState } from 'react';

import type { DevProject } from './DevelopmentPanel.js';
import { useStrings } from '../i18n/LanguageContext.js';

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

const SUB_TABS = ['roadmap', 'versions', 'environnements'] as const;
type SubTab = (typeof SUB_TABS)[number];

const strings = {
  fr: {
    roadmapViewLabels: { liste: 'Liste', kanban: 'Kanban', calendrier: 'Calendrier', timeline: 'Timeline' } as Record<RoadmapView, string>,
    releaseStateLabels: {
      draft: 'Brouillon', in_progress: 'En cours', released: 'Publiée', deprecated: 'Dépréciée',
    } as Record<Release['state'], string>,
    subTabLabels: { roadmap: 'Roadmap', versions: 'Versions', environnements: 'Environnements' } as Record<SubTab, string>,
    navAria: 'Roadmap, versions et environnements',
    project: 'Projet',
    projectAria: 'Projet',
    selectProjectOption: 'Sélectionner un projet…',
    roadmapLoadFailed: 'Impossible de charger la roadmap. Démarrez le backend pour connecter vos données.',
    loadingRoadmap: 'Chargement de la roadmap…',
    lateOrBlockedHeading: 'Jalons en retard ou bloqués',
    late: 'en retard',
    blocked: 'bloqué',
    roadmapViewsAria: 'Vues de la roadmap',
    milestones: 'Jalons',
    noMilestonesYet: "Aucun jalon pour l'instant — créez un cycle depuis Travail pour en faire un jalon roadmap.",
    lateBadge: 'En retard',
    blockedBadge: 'Bloqué',
    doneBadge: 'Terminé',
    targetDate: (date: string) => `Date cible : ${date}`,
    progressLabel: (percent: number, done: number, total: number) => `Avancement : ${percent}% (${done}/${total})`,
    objectivesHeading: 'Objectifs / epics / features / tâches',
    noRoadmapItems: 'Aucun élément de roadmap pour l\'instant.',
    dueDate: (date: string) => ` — échéance ${date}`,
    deadlinesHeading: 'Échéances',
    noItemsWithDueDate: 'Aucun élément avec échéance.',
    milestonesTimelineHeading: 'Timeline des jalons',
    versionsLoadFailed: 'Impossible de charger les versions.',
    versionCreateFailed: 'La création de la version a échoué.',
    publishRefused: 'Publication refusée',
    publishFailed: 'La publication a échoué.',
    selectProjectForReleases: 'Sélectionnez un projet pour voir ses versions.',
    newVersionHeading: 'Nouvelle version',
    versionNumberAria: 'Numéro de version',
    versionNumberPlaceholder: 'ex. 1.2.0',
    versionNameAria: 'Nom de la version',
    versionNamePlaceholder: 'Nom (optionnel)',
    versionDescriptionAria: 'Description de la version',
    versionDescriptionPlaceholder: 'Description (optionnel)',
    create: 'Créer',
    versionsHeading: (count: number) => `Versions (${count})`,
    noVersionsYet: "Aucune version pour ce projet pour l'instant.",
    planned: (date: string) => `Prévue : ${date}`,
    released: (date: string) => `Publiée : ${date}`,
    changelog: 'Changelog',
    publishAction: 'Publier (validation automatique : au moins un élément associé requis)',
    environmentsLoadFailed: 'Impossible de charger les environnements.',
    environmentCreateFailed: "La création de l'environnement a échoué.",
    deployRefused: 'Déploiement refusé',
    deployFailed: 'Le déploiement a échoué.',
    selectProjectForEnvironments: 'Sélectionnez un projet pour voir ses environnements.',
    newEnvironmentHeading: 'Nouvel environnement',
    environmentNameAria: "Nom de l'environnement",
    environmentNamePlaceholder: 'ex. staging',
    environmentTypeAria: "Type d'environnement",
    other: 'autre',
    expectedVersionAria: 'Version attendue',
    expectedVersionPlaceholder: 'Version attendue (optionnel)',
    noEnvironmentsYet: "Aucun environnement pour ce projet pour l'instant.",
    currentVersion: (version: string) => `Version actuelle : ${version}`,
    unknown: 'inconnue',
    expectedVersionLabel: (version: string) => `Version attendue : ${version}`,
    versionDrift: 'Écart de version',
    pipelineLabel: (status: string) => `Pipeline : ${status}`,
    lastUpdate: (value: string) => `Dernière maj : ${value}`,
    versionToDeployAria: (name: string) => `Version à déployer sur ${name}`,
    versionToDeployPlaceholder: 'Version à déployer',
    deploy: 'Déployer',
    sensitiveAction: (production: boolean) => `Action sensible (${production ? 'production' : 'validation requise'}) — confirmer ?`,
    confirmDeploy: 'Confirmer le déploiement',
    cancel: 'Annuler',
  },
  en: {
    roadmapViewLabels: { liste: 'List', kanban: 'Kanban', calendrier: 'Calendar', timeline: 'Timeline' } as Record<RoadmapView, string>,
    releaseStateLabels: {
      draft: 'Draft', in_progress: 'In progress', released: 'Released', deprecated: 'Deprecated',
    } as Record<Release['state'], string>,
    subTabLabels: { roadmap: 'Roadmap', versions: 'Versions', environnements: 'Environments' } as Record<SubTab, string>,
    navAria: 'Roadmap, versions and environments',
    project: 'Project',
    projectAria: 'Project',
    selectProjectOption: 'Select a project…',
    roadmapLoadFailed: 'Unable to load the roadmap. Start the backend to connect your data.',
    loadingRoadmap: 'Loading roadmap…',
    lateOrBlockedHeading: 'Late or blocked milestones',
    late: 'late',
    blocked: 'blocked',
    roadmapViewsAria: 'Roadmap views',
    milestones: 'Milestones',
    noMilestonesYet: 'No milestones yet — create a cycle from Work to turn it into a roadmap milestone.',
    lateBadge: 'Late',
    blockedBadge: 'Blocked',
    doneBadge: 'Done',
    targetDate: (date: string) => `Target date: ${date}`,
    progressLabel: (percent: number, done: number, total: number) => `Progress: ${percent}% (${done}/${total})`,
    objectivesHeading: 'Objectives / epics / features / tasks',
    noRoadmapItems: 'No roadmap items yet.',
    dueDate: (date: string) => ` — due ${date}`,
    deadlinesHeading: 'Deadlines',
    noItemsWithDueDate: 'No items with a due date.',
    milestonesTimelineHeading: 'Milestones timeline',
    versionsLoadFailed: 'Unable to load versions.',
    versionCreateFailed: 'Failed to create the version.',
    publishRefused: 'Publish refused',
    publishFailed: 'Publishing failed.',
    selectProjectForReleases: 'Select a project to see its versions.',
    newVersionHeading: 'New version',
    versionNumberAria: 'Version number',
    versionNumberPlaceholder: 'e.g. 1.2.0',
    versionNameAria: 'Version name',
    versionNamePlaceholder: 'Name (optional)',
    versionDescriptionAria: 'Version description',
    versionDescriptionPlaceholder: 'Description (optional)',
    create: 'Create',
    versionsHeading: (count: number) => `Versions (${count})`,
    noVersionsYet: 'No versions for this project yet.',
    planned: (date: string) => `Planned: ${date}`,
    released: (date: string) => `Released: ${date}`,
    changelog: 'Changelog',
    publishAction: 'Publish (automatic validation: at least one associated item required)',
    environmentsLoadFailed: 'Unable to load environments.',
    environmentCreateFailed: 'Failed to create the environment.',
    deployRefused: 'Deployment refused',
    deployFailed: 'Deployment failed.',
    selectProjectForEnvironments: 'Select a project to see its environments.',
    newEnvironmentHeading: 'New environment',
    environmentNameAria: 'Environment name',
    environmentNamePlaceholder: 'e.g. staging',
    environmentTypeAria: 'Environment type',
    other: 'other',
    expectedVersionAria: 'Expected version',
    expectedVersionPlaceholder: 'Expected version (optional)',
    noEnvironmentsYet: 'No environments for this project yet.',
    currentVersion: (version: string) => `Current version: ${version}`,
    unknown: 'unknown',
    expectedVersionLabel: (version: string) => `Expected version: ${version}`,
    versionDrift: 'Version drift',
    pipelineLabel: (status: string) => `Pipeline: ${status}`,
    lastUpdate: (value: string) => `Last update: ${value}`,
    versionToDeployAria: (name: string) => `Version to deploy on ${name}`,
    versionToDeployPlaceholder: 'Version to deploy',
    deploy: 'Deploy',
    sensitiveAction: (production: boolean) => `Sensitive action (${production ? 'production' : 'approval required'}) — confirm?`,
    confirmDeploy: 'Confirm deployment',
    cancel: 'Cancel',
  },
} as const;

export function DevRoadmapPanel({ apiBase, projects }: { apiBase: string; projects: DevProject[] }) {
  const s = useStrings(strings);
  const [subTab, setSubTab] = useState<SubTab>('roadmap');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  return (
    <div className="dev-roadmap-panel">
      <nav className="views" aria-label={s.navAria}>
        {SUB_TABS.map((value) => (
          <button key={value} className={subTab === value ? 'filter active' : 'filter'} type="button" onClick={() => setSubTab(value)}>
            {s.subTabLabels[value]}
          </button>
        ))}
      </nav>

      {(subTab === 'versions' || subTab === 'environnements') && (
        <label className="dev-roadmap-project-select">
          {s.project}
          <select aria-label={s.projectAria} value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            <option value="" disabled>{s.selectProjectOption}</option>
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
  const s = useStrings(strings);
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
      .catch(() => setError(s.roadmapLoadFailed));
  }, [apiBase]); // eslint-disable-line react-hooks/exhaustive-deps

  const lateOrBlocked = useMemo(() => (data?.milestones ?? []).filter((m) => m.isLate || m.isBlocked), [data]);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!data) return <p className="empty">{s.loadingRoadmap}</p>;

  return (
    <div className="dev-roadmap">
      {lateOrBlocked.length > 0 && (
        <section className="view-group dev-roadmap-alerts">
          <h3>{s.lateOrBlockedHeading}</h3>
          {lateOrBlocked.map((m) => (
            <p key={m.id} className="error" role="alert">
              {m.name} — {m.isLate && s.late}{m.isLate && m.isBlocked ? ' · ' : ''}{m.isBlocked && s.blocked} ({m.doneCount}/{m.itemCount}, {m.progress}%)
            </p>
          ))}
        </section>
      )}

      <nav className="views" aria-label={s.roadmapViewsAria}>
        {ROADMAP_VIEWS.map((value) => (
          <button key={value} className={view === value ? 'filter active' : 'filter'} type="button" onClick={() => setView(value)}>
            {s.roadmapViewLabels[value]}
          </button>
        ))}
      </nav>

      <section className="view-group">
        <h3>{s.milestones}</h3>
        {data.milestones.length === 0 && <p className="empty">{s.noMilestonesYet}</p>}
        <div className="dev-roadmap-milestones">
          {data.milestones.map((m) => (
            <article className="item widget-card" key={m.id}>
              <span className="item-title">
                <strong>{m.name}</strong>
                {m.isLate && <span className="status-badge status-badge-off">{s.lateBadge}</span>}
                {m.isBlocked && <span className="status-badge status-badge-off">{s.blockedBadge}</span>}
                {!m.isLate && !m.isBlocked && m.rollupStatus === 'done' && <span className="status-badge status-badge-ok">{s.doneBadge}</span>}
              </span>
              <span className="item-meta">
                <span>{s.targetDate(new Date(m.endsAt).toLocaleDateString('fr-FR'))}</span>
                <span>{s.progressLabel(m.progress, m.doneCount, m.itemCount)}</span>
              </span>
            </article>
          ))}
        </div>
      </section>

      {view === 'liste' && (
        <section className="view-group">
          <h3>{s.objectivesHeading}</h3>
          {data.items.length === 0 && <p className="empty">{s.noRoadmapItems}</p>}
          <ul>
            {data.items.map((item) => (
              <li key={item.id}>
                <span className={`status-badge status-${item.status}`}>{item.status}</span> {item.taskLevel ? `[${item.taskLevel}] ` : ''}{item.title}
                {item.dueAt && s.dueDate(new Date(item.dueAt).toLocaleDateString('fr-FR'))}
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
          <h3>{s.deadlinesHeading}</h3>
          {data.items.filter((item) => item.dueAt).length === 0 && <p className="empty">{s.noItemsWithDueDate}</p>}
          <ul>
            {data.items.filter((item) => item.dueAt).sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : 1)).map((item) => (
              <li key={item.id}>{new Date(item.dueAt!).toLocaleDateString('fr-FR')} — {item.title}</li>
            ))}
          </ul>
        </section>
      )}

      {view === 'timeline' && (
        <section className="view-group">
          <h3>{s.milestonesTimelineHeading}</h3>
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
  const s = useStrings(strings);
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
      .catch(() => setError(s.versionsLoadFailed));
  }

  useEffect(load, [apiBase, devProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    if (!version.trim() || !devProjectId) return;
    try {
      const response = await fetch(`${apiBase}/api/releases`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ devProjectId, version: version.trim(), name: name.trim() || undefined, description: description.trim() || undefined }),
      });
      if (!response.ok) throw new Error();
      setVersion(''); setName(''); setDescription('');
      load();
    } catch {
      setError(s.versionCreateFailed);
    }
  }

  async function publish(id: string) {
    try {
      const response = await fetch(`${apiBase}/api/releases/${id}/publish`, { method: 'POST', credentials: 'include' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? s.publishRefused);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : s.publishFailed);
    }
  }

  if (!devProjectId) return <p className="empty">{s.selectProjectForReleases}</p>;

  return (
    <div className="dev-releases">
      {error && <p className="error" role="alert">{error}</p>}

      <section className="view-group">
        <h3>{s.newVersionHeading}</h3>
        <div className="item-actions">
          <input aria-label={s.versionNumberAria} placeholder={s.versionNumberPlaceholder} value={version} onChange={(event) => setVersion(event.target.value)} />
          <input aria-label={s.versionNameAria} placeholder={s.versionNamePlaceholder} value={name} onChange={(event) => setName(event.target.value)} />
          <input aria-label={s.versionDescriptionAria} placeholder={s.versionDescriptionPlaceholder} value={description} onChange={(event) => setDescription(event.target.value)} />
          <button type="button" onClick={() => void create()}>{s.create}</button>
        </div>
      </section>

      <section className="view-group">
        <h3>{s.versionsHeading(releases.length)}</h3>
        {releases.length === 0 && <p className="empty">{s.noVersionsYet}</p>}
        {releases.map((release) => (
          <article className="item widget-card" key={release.id}>
            <span className="item-title">
              <strong>{release.version}</strong>{release.name ? ` — ${release.name}` : ''}
              <span className={`status-badge status-${release.state}`}>{s.releaseStateLabels[release.state]}</span>
            </span>
            {release.description && <p className="empty">{release.description}</p>}
            <span className="item-meta">
              {release.plannedAt && <span>{s.planned(new Date(release.plannedAt).toLocaleDateString('fr-FR'))}</span>}
              {release.releasedAt && <span>{s.released(new Date(release.releasedAt).toLocaleDateString('fr-FR'))}</span>}
            </span>
            {release.changelog && (
              <details>
                <summary>{s.changelog}</summary>
                <pre className="dev-changelog">{release.changelog}</pre>
              </details>
            )}
            {release.state !== 'released' && (
              <span className="item-actions">
                <button type="button" onClick={() => void publish(release.id)}>{s.publishAction}</button>
              </span>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function EnvironmentsTab({ apiBase, devProjectId }: { apiBase: string; devProjectId: string }) {
  const s = useStrings(strings);
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
      .catch(() => setError(s.environmentsLoadFailed));
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
      setError(s.environmentCreateFailed);
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
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ version, ...(sensitive ? { confirm: true } : {}) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? s.deployRefused);
      }
      setConfirmingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : s.deployFailed);
    }
  }

  if (!devProjectId) return <p className="empty">{s.selectProjectForEnvironments}</p>;

  return (
    <div className="dev-environments">
      {error && <p className="error" role="alert">{error}</p>}

      <section className="view-group">
        <h3>{s.newEnvironmentHeading}</h3>
        <div className="item-actions">
          <input aria-label={s.environmentNameAria} placeholder={s.environmentNamePlaceholder} value={name} onChange={(event) => setName(event.target.value)} />
          <select aria-label={s.environmentTypeAria} value={kind} onChange={(event) => setKind(event.target.value as Environment['kind'])}>
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="prod">prod</option>
            <option value="other">{s.other}</option>
          </select>
          <input aria-label={s.expectedVersionAria} placeholder={s.expectedVersionPlaceholder} value={expectedVersion} onChange={(event) => setExpectedVersion(event.target.value)} />
          <button type="button" onClick={() => void create()}>{s.create}</button>
        </div>
      </section>

      <section className="view-group dev-environment-grid">
        {environments.length === 0 && <p className="empty">{s.noEnvironmentsYet}</p>}
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
                <span>{s.currentVersion(env.currentVersion ?? s.unknown)}</span>
                {env.expectedVersion && <span>{s.expectedVersionLabel(env.expectedVersion)}</span>}
                {drift && <span className="status-badge status-badge-off">{s.versionDrift}</span>}
                {env.pipelineStatus && <span>{s.pipelineLabel(env.pipelineStatus)}</span>}
                {env.lastDeployedAt && <span>{s.lastUpdate(new Date(env.lastDeployedAt).toLocaleString('fr-FR'))}</span>}
              </span>
              {env.lastError && <p className="error" role="alert">{env.lastError}</p>}

              <div className="item-actions">
                <input
                  aria-label={s.versionToDeployAria(env.name)}
                  placeholder={s.versionToDeployPlaceholder}
                  value={deployVersions[env.id] ?? ''}
                  onChange={(event) => setDeployVersions((current) => ({ ...current, [env.id]: event.target.value }))}
                />
                <button type="button" onClick={() => void deploy(env, false)}>{s.deploy}</button>
              </div>
              {confirmingId === env.id && (
                <p className="error" role="alert">
                  {s.sensitiveAction(env.kind === 'prod')}{' '}
                  <button type="button" onClick={() => void deploy(env, true)}>{s.confirmDeploy}</button>{' '}
                  <button type="button" onClick={() => setConfirmingId(null)}>{s.cancel}</button>
                </p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
