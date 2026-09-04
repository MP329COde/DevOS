import { useEffect, useState, type FormEvent } from 'react';

import { DevActivityPanel } from './DevActivityPanel.js';
import { DevReposPanel } from './DevReposPanel.js';
import { DevCiCdPanel } from './DevCiCdPanel.js';

export interface DevProject {
  id: string;
  name: string;
  description?: string | null;
  status: 'planning' | 'development' | 'maintenance' | 'done' | 'archived';
  owner?: string | null;
  members: string[];
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  deliveryGoal?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DevProjectDashboardSection {
  available: boolean;
  summary: string;
}

interface DevProjectDashboard {
  project: DevProject;
  progress: { openTasks: number; totalTasks: number; percentDone: number | null };
  lastActivityAt: string | null;
  lastRelease: DevProjectDashboardSection;
  pipeline: DevProjectDashboardSection;
  deployment: DevProjectDashboardSection;
  openTasks: DevProjectDashboardSection;
  knownBugs: DevProjectDashboardSection;
  security: DevProjectDashboardSection;
}

interface DevOverview {
  active: DevProject[];
  waiting: DevProject[];
  done: DevProject[];
  archived: DevProject[];
}

const STATUS_LABELS: Record<DevProject['status'], string> = {
  planning: 'Planification',
  development: 'Développement',
  maintenance: 'Maintenance',
  done: 'Terminé',
  archived: 'Archivé',
};

const WIZARD_STEPS = ['template', 'stack', 'environnements', 'git', 'résumé'] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  template: 'Template',
  stack: 'Langage & gestionnaire de paquets',
  environnements: 'Environnements',
  git: 'Fournisseur Git',
  résumé: 'Résumé',
};

/** Sous-navigation interne du module Développement (section AM). Pensée pour accueillir les
 * futurs sous-modules des autres sous-vagues (dépôts AM.4, tâches/bugs AM.5, roadmap AM.6,
 * CI/CD AM.7, doc/architecture/membres AM.8) sans restructurer ce composant : chaque nouvel
 * onglet s'ajoute à `DEV_TABS` et à son rendu conditionnel, exactement comme les onglets déjà
 * présents. */
const DEV_TABS = ['overview', 'new', 'dashboard', 'repos', 'activity', 'cicd'] as const;
type DevTab = (typeof DEV_TABS)[number];
const DEV_TAB_LABELS: Record<DevTab, string> = { overview: 'Vue globale', new: 'Nouveau projet', dashboard: 'Dashboard projet', repos: 'Dépôts', activity: 'Activité & recherche', cicd: 'CI/CD & sécurité' };

export function DevelopmentPanel({ apiBase }: { apiBase: string }) {
  const [tab, setTab] = useState<DevTab>('overview');
  const [overview, setOverview] = useState<DevOverview | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DevProjectDashboard | null>(null);
  const [dashboardError, setDashboardError] = useState('');

  const loadOverview = (query: string) => {
    void fetch(`${apiBase}/api/dev-projects/overview${query ? `?search=${encodeURIComponent(query)}` : ''}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setOverview(await response.json());
        setError('');
      })
      .catch(() => setError('Impossible de charger les projets de développement. Démarrez le backend pour connecter vos données.'));
  };

  useEffect(() => { loadOverview(search); }, [apiBase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'dashboard' || !selectedProjectId) return;
    void fetch(`${apiBase}/api/dev-projects/${selectedProjectId}/dashboard`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setDashboard(await response.json());
        setDashboardError('');
      })
      .catch(() => setDashboardError('Impossible de charger le dashboard de ce projet.'));
  }, [apiBase, tab, selectedProjectId]);

  function openDashboard(projectId: string) {
    setSelectedProjectId(projectId);
    setTab('dashboard');
  }

  return (
    <div className="items dev-panel">
      <nav className="views" aria-label="Sous-vues Développement">
        {DEV_TABS.map((value) => (
          <button key={value} className={tab === value ? 'filter active' : 'filter'} type="button" onClick={() => setTab(value)}>
            {DEV_TAB_LABELS[value]}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <DevOverviewTab
          overview={overview}
          error={error}
          search={search}
          onSearchChange={(value) => { setSearch(value); loadOverview(value); }}
          onOpen={openDashboard}
        />
      )}

      {tab === 'new' && (
        <NewProjectWizard
          apiBase={apiBase}
          onCreated={(project) => { loadOverview(search); openDashboard(project.id); }}
        />
      )}

      {tab === 'dashboard' && (
        <DevProjectDashboardTab
          projectId={selectedProjectId}
          dashboard={dashboard}
          error={dashboardError}
          allProjects={overview ? [...overview.active, ...overview.waiting, ...overview.done, ...overview.archived] : []}
          onSelect={openDashboard}
        />
      )}

      {tab === 'repos' && <DevReposPanel apiBase={apiBase} />}

      {tab === 'activity' && <DevActivityPanel apiBase={apiBase} />}

      {tab === 'cicd' && <DevCiCdPanel apiBase={apiBase} />}
    </div>
  );
}

function DevOverviewTab({ overview, error, search, onSearchChange, onOpen }: {
  overview: DevOverview | null;
  error: string;
  search: string;
  onSearchChange: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  const groups: Array<{ key: keyof DevOverview; label: string }> = [
    { key: 'active', label: 'Actifs' },
    { key: 'waiting', label: 'En attente' },
    { key: 'done', label: 'Terminés' },
    { key: 'archived', label: 'Archivés' },
  ];

  return (
    <div className="dev-overview">
      <input
        aria-label="Rechercher un projet de développement"
        placeholder="Rechercher un projet…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {error && <p className="error" role="alert">{error}</p>}
      {!error && overview && groups.every((g) => overview[g.key].length === 0) && <p className="empty">Aucun projet de développement pour l'instant. Créez-en un depuis "Nouveau projet".</p>}
      {!error && overview && groups.map(({ key, label }) => overview[key].length > 0 && (
        <section className="view-group" key={key}>
          <h3>{label} ({overview[key].length})</h3>
          {overview[key].map((project) => (
            <article className="item widget-card dev-project-card" key={project.id}>
              <span className="item-title">
                <strong>{project.name}</strong>
                <span className={`status-badge status-${project.status}`}>{STATUS_LABELS[project.status]}</span>
              </span>
              {project.description && <p className="empty">{project.description}</p>}
              <span className="item-meta">
                {project.owner && <span>Responsable : {project.owner}</span>}
                {project.members.length > 0 && <span>Membres : {project.members.join(', ')}</span>}
              </span>
              <span className="item-actions">
                <button type="button" onClick={() => onOpen(project.id)}>Ouvrir le dashboard</button>
              </span>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function DevProjectDashboardTab({ projectId, dashboard, error, allProjects, onSelect }: {
  projectId: string | null;
  dashboard: DevProjectDashboard | null;
  error: string;
  allProjects: DevProject[];
  onSelect: (id: string) => void;
}) {
  if (!projectId) {
    return (
      <div className="dev-dashboard">
        <p className="empty">Choisissez un projet pour afficher son dashboard.</p>
        {allProjects.length > 0 && (
          <select aria-label="Choisir un projet" defaultValue="" onChange={(event) => event.target.value && onSelect(event.target.value)}>
            <option value="" disabled>Sélectionner un projet…</option>
            {allProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        )}
      </div>
    );
  }

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!dashboard) return <p className="empty">Chargement du dashboard…</p>;

  const { project, progress, lastActivityAt } = dashboard;
  const sections: Array<{ label: string; section: DevProjectDashboardSection }> = [
    { label: 'Dernière version', section: dashboard.lastRelease },
    { label: 'Pipeline', section: dashboard.pipeline },
    { label: 'Déploiement', section: dashboard.deployment },
    { label: 'Tâches ouvertes', section: dashboard.openTasks },
    { label: 'Bugs connus', section: dashboard.knownBugs },
    { label: 'Sécurité', section: dashboard.security },
  ];

  return (
    <div className="dev-dashboard">
      <header className="dev-dashboard-header">
        <h2>{project.name}</h2>
        <span className={`status-badge status-${project.status}`}>{STATUS_LABELS[project.status]}</span>
      </header>
      {project.description && <p className="empty">{project.description}</p>}
      {project.deliveryGoal && <p><strong>Objectif de livraison :</strong> {project.deliveryGoal}</p>}
      <span className="item-meta">
        {project.owner && <span>Responsable : {project.owner}</span>}
        {project.members.length > 0 && <span>Membres : {project.members.join(', ')}</span>}
        {project.plannedStartAt && <span>Début prévu : {new Date(project.plannedStartAt).toLocaleDateString('fr-FR')}</span>}
        {project.plannedEndAt && <span>Fin prévue : {new Date(project.plannedEndAt).toLocaleDateString('fr-FR')}</span>}
      </span>

      <section className="view-group">
        <h3>Avancement</h3>
        <p>
          {progress.totalTasks > 0
            ? `${progress.percentDone ?? 0}% (${progress.totalTasks - progress.openTasks}/${progress.totalTasks} tâches terminées)`
            : 'Non disponible — aucune tâche liée à ce projet pour l\'instant.'}
        </p>
        <p className="empty">Dernière activité : {lastActivityAt ? new Date(lastActivityAt).toLocaleString('fr-FR') : 'Non disponible'}</p>
      </section>

      <section className="view-group dev-dashboard-grid">
        {sections.map(({ label, section }) => (
          <article className="widget-card" key={label}>
            <h4>{label}</h4>
            <p className={section.available ? '' : 'empty'}>{section.summary}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function NewProjectWizard({ apiBase, onCreated }: { apiBase: string; onCreated: (project: DevProject) => void }) {
  const [step, setStep] = useState<WizardStep>('template');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('vierge');
  const [stack, setStack] = useState('node-npm');
  const [environments, setEnvironments] = useState<string[]>(['dev', 'staging', 'prod']);
  const [gitProvider, setGitProvider] = useState<'gitlab' | 'github'>('gitlab');
  const [owner, setOwner] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const stepIndex = WIZARD_STEPS.indexOf(step);

  function toggleEnvironment(env: string) {
    setEnvironments((current) => (current.includes(env) ? current.filter((e) => e !== env) : [...current, env]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError('Le titre du projet est requis.'); setStep('résumé'); return; }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/dev-projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          owner: owner.trim() || undefined,
          status: 'planning',
          deliveryGoal: `Template ${template} · stack ${stack} · environnements ${environments.join(', ') || 'aucun'} · dépôt ${gitProvider}`,
        }),
      });
      if (!response.ok) throw new Error();
      const created = await response.json();
      onCreated(created);
      setName(''); setDescription(''); setOwner(''); setStep('template');
    } catch {
      setError('La création du projet a échoué. Vérifiez que le backend est démarré.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="dev-wizard" onSubmit={(event) => void submit(event)}>
      <nav className="views" aria-label="Étapes de création de projet">
        {WIZARD_STEPS.map((value, index) => (
          <button
            key={value}
            type="button"
            className={step === value ? 'filter active' : 'filter'}
            aria-current={step === value ? 'step' : undefined}
            onClick={() => setStep(value)}
          >
            {index + 1}. {WIZARD_STEP_LABELS[value]}
          </button>
        ))}
      </nav>

      {step === 'template' && (
        <section className="view-group">
          <h3>Template de départ</h3>
          <p className="empty">Le catalogue de templates détaillé arrive avec la section AM.3 ; ce choix reste modifiable jusqu'au résumé.</p>
          <select aria-label="Template" value={template} onChange={(event) => setTemplate(event.target.value)}>
            <option value="vierge">Projet vierge</option>
            <option value="api-node">API Node.js</option>
            <option value="frontend-react">Frontend React</option>
            <option value="worker">Worker / job planifié</option>
          </select>
        </section>
      )}

      {step === 'stack' && (
        <section className="view-group">
          <h3>Langage, framework et gestionnaire de paquets</h3>
          <select aria-label="Stack technique" value={stack} onChange={(event) => setStack(event.target.value)}>
            <option value="node-npm">Node.js / npm</option>
            <option value="node-pnpm">Node.js / pnpm</option>
            <option value="python-pip">Python / pip</option>
            <option value="go-mod">Go / go mod</option>
          </select>
        </section>
      )}

      {step === 'environnements' && (
        <section className="view-group">
          <h3>Environnements de déploiement</h3>
          {['dev', 'staging', 'prod'].map((env) => (
            <label key={env} className="note-checkbox">
              <input type="checkbox" checked={environments.includes(env)} onChange={() => toggleEnvironment(env)} />
              <span>{env}</span>
            </label>
          ))}
        </section>
      )}

      {step === 'git' && (
        <section className="view-group">
          <h3>Fournisseur Git — création auto du dépôt et des branches</h3>
          <select aria-label="Fournisseur Git" value={gitProvider} onChange={(event) => setGitProvider(event.target.value as 'gitlab' | 'github')}>
            <option value="gitlab">GitLab</option>
            <option value="github">GitHub</option>
          </select>
          <p className="empty">La création effective du dépôt + branches est prise en charge par la section AM.4 (Dépôts Git centralisés) ; le choix ici est mémorisé pour cette sous-vague.</p>
        </section>
      )}

      {step === 'résumé' && (
        <section className="view-group">
          <h3>Résumé avant validation</h3>
          <label htmlFor="dev-wizard-name">Titre du projet</label>
          <input id="dev-wizard-name" aria-label="Titre du projet" placeholder="Titre du projet" value={name} onChange={(event) => setName(event.target.value)} />
          <label htmlFor="dev-wizard-description">Description</label>
          <textarea id="dev-wizard-description" className="doc-editor" aria-label="Description du projet" value={description} onChange={(event) => setDescription(event.target.value)} />
          <label htmlFor="dev-wizard-owner">Responsable</label>
          <input id="dev-wizard-owner" aria-label="Responsable du projet" placeholder="Responsable" value={owner} onChange={(event) => setOwner(event.target.value)} />
          <ul>
            <li>Template : {template}</li>
            <li>Stack : {stack}</li>
            <li>Environnements : {environments.join(', ') || 'aucun'}</li>
            <li>Fournisseur Git : {gitProvider}</li>
          </ul>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}>{submitting ? 'Création…' : 'Créer le projet'}</button>
        </section>
      )}

      {step !== 'résumé' && (
        <div className="item-actions">
          {stepIndex > 0 && <button type="button" onClick={() => setStep(WIZARD_STEPS[stepIndex - 1])}>Précédent</button>}
          <button type="button" onClick={() => setStep(WIZARD_STEPS[stepIndex + 1])}>Suivant</button>
        </div>
      )}
    </form>
  );
}
