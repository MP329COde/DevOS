import { useEffect, useState, type FormEvent } from 'react';

import { DevActivityPanel, type DevActivityTab } from './DevActivityPanel.js';
import { DevReposPanel } from './DevReposPanel.js';
import { DevCiCdPanel, type CiCdSubView } from './DevCiCdPanel.js';
import { DevTasksPanel } from './DevTasksPanel.js';
import { useStrings } from '../i18n/LanguageContext.js';

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

const WIZARD_STEPS = ['template', 'stack', 'environnements', 'git', 'résumé'] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

/** Sous-navigation interne du module Développement (section AM), à plat : les sous-onglets qui
 * appartenaient auparavant à "Activité & recherche" et "CI/CD & sécurité" (2 niveaux de nav
 * imbriqués) sont remontés ici au même niveau que les autres onglets, dans une seule barre
 * scrollable — chaque nouvel onglet s'ajoute simplement à `DEV_TABS` et à son rendu conditionnel. */
const DEV_TABS = [
  'overview', 'new', 'dashboard', 'repos', 'tasks',
  'activity-search', 'activity-integrations', 'activity-dashboard', 'activity-ai',
  'cicd-pipelines', 'cicd-deployments', 'cicd-tests', 'cicd-quality',
] as const;
type DevTab = (typeof DEV_TABS)[number];

const strings = {
  fr: {
    statusLabels: {
      planning: 'Planification', development: 'Développement', maintenance: 'Maintenance',
      done: 'Terminé', archived: 'Archivé',
    } as Record<DevProject['status'], string>,
    wizardStepLabels: {
      template: 'Template', stack: 'Langage & gestionnaire de paquets', environnements: 'Environnements',
      git: 'Fournisseur Git', résumé: 'Résumé',
    } as Record<WizardStep, string>,
    devTabLabels: {
      overview: 'Vue globale', new: 'Nouveau projet', dashboard: 'Dashboard projet', repos: 'Dépôts',
      tasks: 'Workflow', 'activity-search': 'Recherche globale', 'activity-integrations': 'Intégrations dev',
      'activity-dashboard': 'Dashboard perso', 'activity-ai': 'Assistant IA (aperçu)', 'cicd-pipelines': 'CI/CD',
      'cicd-deployments': 'Déploiements', 'cicd-tests': 'Tests', 'cicd-quality': 'Qualité & sécurité',
    } as Record<DevTab, string>,
    subViewsAria: 'Sous-vues Développement',
    overviewLoadFailed: 'Impossible de charger les projets de développement. Démarrez le backend pour connecter vos données.',
    dashboardLoadFailed: 'Impossible de charger le dashboard de ce projet.',
    searchProjectAria: 'Rechercher un projet de développement',
    searchProjectPlaceholder: 'Rechercher un projet…',
    noProjectsYet: 'Aucun projet de développement pour l\'instant. Créez-en un depuis "Nouveau projet".',
    groupActive: 'Actifs',
    groupWaiting: 'En attente',
    groupDone: 'Terminés',
    groupArchived: 'Archivés',
    ownerLabel: (owner: string) => `Responsable : ${owner}`,
    membersLabel: (members: string) => `Membres : ${members}`,
    openDashboard: 'Ouvrir le dashboard',
    chooseProjectHint: 'Choisissez un projet pour afficher son dashboard.',
    chooseProjectAria: 'Choisir un projet',
    selectProjectOption: 'Sélectionner un projet…',
    loadingDashboard: 'Chargement du dashboard…',
    lastRelease: 'Dernière version',
    pipeline: 'Pipeline',
    deployment: 'Déploiement',
    openTasks: 'Tâches ouvertes',
    knownBugs: 'Bugs connus',
    security: 'Sécurité',
    deliveryGoalLabel: 'Objectif de livraison :',
    plannedStart: (date: string) => `Début prévu : ${date}`,
    plannedEnd: (date: string) => `Fin prévue : ${date}`,
    progress: 'Avancement',
    progressDone: (percent: number, done: number, total: number) => `${percent}% (${done}/${total} tâches terminées)`,
    progressUnavailable: 'Non disponible — aucune tâche liée à ce projet pour l\'instant.',
    lastActivity: (value: string) => `Dernière activité : ${value}`,
    notAvailable: 'Non disponible',
    projectNameRequired: 'Le titre du projet est requis.',
    creationFailed: 'La création du projet a échoué. Vérifiez que le backend est démarré.',
    wizardStepsAria: 'Étapes de création de projet',
    templateHeading: 'Template de départ',
    templateHint: 'Le catalogue de templates détaillé arrivera dans une prochaine itération ; ce choix reste modifiable jusqu\'au résumé.',
    templateAria: 'Template',
    templateBlank: 'Projet vierge',
    templateApiNode: 'API Node.js',
    templateFrontendReact: 'Frontend React',
    templateWorker: 'Worker / job planifié',
    stackHeading: 'Langage, framework et gestionnaire de paquets',
    stackAria: 'Stack technique',
    environmentsHeading: 'Environnements de déploiement',
    gitHeading: 'Fournisseur Git — création auto du dépôt et des branches',
    gitAria: 'Fournisseur Git',
    gitHint: 'La création effective du dépôt et des branches est prise en charge par la sous-vue Dépôts (Dépôts Git centralisés) ; le choix ici est mémorisé pour la suite de l\'assistant.',
    summaryHeading: 'Résumé avant validation',
    projectTitle: 'Titre du projet',
    description: 'Description',
    descriptionAria: 'Description du projet',
    owner: 'Responsable',
    ownerAria: 'Responsable du projet',
    summaryTemplate: (value: string) => `Template : ${value}`,
    summaryStack: (value: string) => `Stack : ${value}`,
    summaryEnvironments: (value: string) => `Environnements : ${value}`,
    summaryGitProvider: (value: string) => `Fournisseur Git : ${value}`,
    none: 'aucun',
    creating: 'Création…',
    createProject: 'Créer le projet',
    previous: 'Précédent',
    next: 'Suivant',
    deliveryGoal: (template: string, stack: string, environments: string, gitProvider: string) =>
      `Template ${template} · stack ${stack} · environnements ${environments} · dépôt ${gitProvider}`,
  },
  en: {
    statusLabels: {
      planning: 'Planning', development: 'In development', maintenance: 'Maintenance',
      done: 'Done', archived: 'Archived',
    } as Record<DevProject['status'], string>,
    wizardStepLabels: {
      template: 'Template', stack: 'Language & package manager', environnements: 'Environments',
      git: 'Git provider', résumé: 'Summary',
    } as Record<WizardStep, string>,
    devTabLabels: {
      overview: 'Overview', new: 'New project', dashboard: 'Project dashboard', repos: 'Repositories',
      tasks: 'Workflow', 'activity-search': 'Global search', 'activity-integrations': 'Dev integrations',
      'activity-dashboard': 'Personal dashboard', 'activity-ai': 'AI assistant (preview)', 'cicd-pipelines': 'CI/CD',
      'cicd-deployments': 'Deployments', 'cicd-tests': 'Tests', 'cicd-quality': 'Quality & security',
    } as Record<DevTab, string>,
    subViewsAria: 'Development sub-views',
    overviewLoadFailed: 'Unable to load development projects. Start the backend to connect your data.',
    dashboardLoadFailed: 'Unable to load this project\'s dashboard.',
    searchProjectAria: 'Search a development project',
    searchProjectPlaceholder: 'Search a project…',
    noProjectsYet: 'No development projects yet. Create one from "New project".',
    groupActive: 'Active',
    groupWaiting: 'Waiting',
    groupDone: 'Done',
    groupArchived: 'Archived',
    ownerLabel: (owner: string) => `Owner: ${owner}`,
    membersLabel: (members: string) => `Members: ${members}`,
    openDashboard: 'Open dashboard',
    chooseProjectHint: 'Choose a project to display its dashboard.',
    chooseProjectAria: 'Choose a project',
    selectProjectOption: 'Select a project…',
    loadingDashboard: 'Loading dashboard…',
    lastRelease: 'Last release',
    pipeline: 'Pipeline',
    deployment: 'Deployment',
    openTasks: 'Open tasks',
    knownBugs: 'Known bugs',
    security: 'Security',
    deliveryGoalLabel: 'Delivery goal:',
    plannedStart: (date: string) => `Planned start: ${date}`,
    plannedEnd: (date: string) => `Planned end: ${date}`,
    progress: 'Progress',
    progressDone: (percent: number, done: number, total: number) => `${percent}% (${done}/${total} tasks done)`,
    progressUnavailable: 'Not available — no task linked to this project yet.',
    lastActivity: (value: string) => `Last activity: ${value}`,
    notAvailable: 'Not available',
    projectNameRequired: 'The project title is required.',
    creationFailed: 'Failed to create the project. Check that the backend is running.',
    wizardStepsAria: 'Project creation steps',
    templateHeading: 'Starting template',
    templateHint: 'The detailed template catalog will arrive in a future iteration; this choice can still be changed until the summary.',
    templateAria: 'Template',
    templateBlank: 'Blank project',
    templateApiNode: 'Node.js API',
    templateFrontendReact: 'React frontend',
    templateWorker: 'Worker / scheduled job',
    stackHeading: 'Language, framework and package manager',
    stackAria: 'Technical stack',
    environmentsHeading: 'Deployment environments',
    gitHeading: 'Git provider — automatic repository and branch creation',
    gitAria: 'Git provider',
    gitHint: 'The actual creation of the repository and branches is handled by the Repositories sub-view (centralized Git repositories); the choice here is remembered for the rest of the wizard.',
    summaryHeading: 'Summary before submission',
    projectTitle: 'Project title',
    description: 'Description',
    descriptionAria: 'Project description',
    owner: 'Owner',
    ownerAria: 'Project owner',
    summaryTemplate: (value: string) => `Template: ${value}`,
    summaryStack: (value: string) => `Stack: ${value}`,
    summaryEnvironments: (value: string) => `Environments: ${value}`,
    summaryGitProvider: (value: string) => `Git provider: ${value}`,
    none: 'none',
    creating: 'Creating…',
    createProject: 'Create project',
    previous: 'Previous',
    next: 'Next',
    deliveryGoal: (template: string, stack: string, environments: string, gitProvider: string) =>
      `Template ${template} · stack ${stack} · environments ${environments} · repo ${gitProvider}`,
  },
} as const;

export function DevelopmentPanel({ apiBase }: { apiBase: string }) {
  const s = useStrings(strings);
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
      .catch(() => setError(s.overviewLoadFailed));
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
      .catch(() => setDashboardError(s.dashboardLoadFailed));
  }, [apiBase, tab, selectedProjectId]);

  function openDashboard(projectId: string) {
    setSelectedProjectId(projectId);
    setTab('dashboard');
  }

  return (
    <div className="items dev-panel">
      <nav className="views" aria-label={s.subViewsAria}>
        {DEV_TABS.map((value) => (
          <button key={value} className={tab === value ? 'filter active' : 'filter'} type="button" onClick={() => setTab(value)}>
            {s.devTabLabels[value]}
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

      {tab === 'tasks' && <DevTasksPanel apiBase={apiBase} devProjectId={selectedProjectId} />}

      {tab.startsWith('activity-') && <DevActivityPanel apiBase={apiBase} tab={tab.slice('activity-'.length) as DevActivityTab} />}

      {tab.startsWith('cicd-') && <DevCiCdPanel apiBase={apiBase} subView={(tab === 'cicd-pipelines' ? 'cicd' : tab.slice('cicd-'.length)) as CiCdSubView} />}
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
  const s = useStrings(strings);
  const groups: Array<{ key: keyof DevOverview; label: string }> = [
    { key: 'active', label: s.groupActive },
    { key: 'waiting', label: s.groupWaiting },
    { key: 'done', label: s.groupDone },
    { key: 'archived', label: s.groupArchived },
  ];

  return (
    <div className="dev-overview">
      <input
        aria-label={s.searchProjectAria}
        placeholder={s.searchProjectPlaceholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {error && <p className="error" role="alert">{error}</p>}
      {!error && overview && groups.every((g) => overview[g.key].length === 0) && <p className="empty">{s.noProjectsYet}</p>}
      {!error && overview && groups.map(({ key, label }) => overview[key].length > 0 && (
        <section className="view-group" key={key}>
          <h3>{label} ({overview[key].length})</h3>
          {overview[key].map((project) => (
            <article className="item widget-card dev-project-card" key={project.id}>
              <span className="item-title">
                <strong>{project.name}</strong>
                <span className={`status-badge status-${project.status}`}>{s.statusLabels[project.status]}</span>
              </span>
              {project.description && <p className="empty">{project.description}</p>}
              <span className="item-meta">
                {project.owner && <span>{s.ownerLabel(project.owner)}</span>}
                {project.members.length > 0 && <span>{s.membersLabel(project.members.join(', '))}</span>}
              </span>
              <span className="item-actions">
                <button type="button" onClick={() => onOpen(project.id)}>{s.openDashboard}</button>
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
  const s = useStrings(strings);
  if (!projectId) {
    return (
      <div className="dev-dashboard">
        <p className="empty">{s.chooseProjectHint}</p>
        {allProjects.length > 0 && (
          <select aria-label={s.chooseProjectAria} defaultValue="" onChange={(event) => event.target.value && onSelect(event.target.value)}>
            <option value="" disabled>{s.selectProjectOption}</option>
            {allProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        )}
      </div>
    );
  }

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!dashboard) return <p className="empty">{s.loadingDashboard}</p>;

  const { project, progress, lastActivityAt } = dashboard;
  const sections: Array<{ label: string; section: DevProjectDashboardSection }> = [
    { label: s.lastRelease, section: dashboard.lastRelease },
    { label: s.pipeline, section: dashboard.pipeline },
    { label: s.deployment, section: dashboard.deployment },
    { label: s.openTasks, section: dashboard.openTasks },
    { label: s.knownBugs, section: dashboard.knownBugs },
    { label: s.security, section: dashboard.security },
  ];

  return (
    <div className="dev-dashboard">
      <header className="dev-dashboard-header">
        <h2>{project.name}</h2>
        <span className={`status-badge status-${project.status}`}>{s.statusLabels[project.status]}</span>
      </header>
      {project.description && <p className="empty">{project.description}</p>}
      {project.deliveryGoal && <p><strong>{s.deliveryGoalLabel}</strong> {project.deliveryGoal}</p>}
      <span className="item-meta">
        {project.owner && <span>{s.ownerLabel(project.owner)}</span>}
        {project.members.length > 0 && <span>{s.membersLabel(project.members.join(', '))}</span>}
        {project.plannedStartAt && <span>{s.plannedStart(new Date(project.plannedStartAt).toLocaleDateString('fr-FR'))}</span>}
        {project.plannedEndAt && <span>{s.plannedEnd(new Date(project.plannedEndAt).toLocaleDateString('fr-FR'))}</span>}
      </span>

      <section className="view-group">
        <h3>{s.progress}</h3>
        <p>
          {progress.totalTasks > 0
            ? s.progressDone(progress.percentDone ?? 0, progress.totalTasks - progress.openTasks, progress.totalTasks)
            : s.progressUnavailable}
        </p>
        <p className="empty">{s.lastActivity(lastActivityAt ? new Date(lastActivityAt).toLocaleString('fr-FR') : s.notAvailable)}</p>
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
  const s = useStrings(strings);
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
    if (!name.trim()) { setError(s.projectNameRequired); setStep('résumé'); return; }
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
          deliveryGoal: s.deliveryGoal(template, stack, environments.join(', ') || s.none, gitProvider),
        }),
      });
      if (!response.ok) throw new Error();
      const created = await response.json();
      onCreated(created);
      setName(''); setDescription(''); setOwner(''); setStep('template');
    } catch {
      setError(s.creationFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="dev-wizard" onSubmit={(event) => void submit(event)}>
      <nav className="views" aria-label={s.wizardStepsAria}>
        {WIZARD_STEPS.map((value, index) => (
          <button
            key={value}
            type="button"
            className={step === value ? 'filter active' : 'filter'}
            aria-current={step === value ? 'step' : undefined}
            onClick={() => setStep(value)}
          >
            {index + 1}. {s.wizardStepLabels[value]}
          </button>
        ))}
      </nav>

      {step === 'template' && (
        <section className="view-group">
          <h3>{s.templateHeading}</h3>
          <p className="empty">{s.templateHint}</p>
          <select aria-label={s.templateAria} value={template} onChange={(event) => setTemplate(event.target.value)}>
            <option value="vierge">{s.templateBlank}</option>
            <option value="api-node">{s.templateApiNode}</option>
            <option value="frontend-react">{s.templateFrontendReact}</option>
            <option value="worker">{s.templateWorker}</option>
          </select>
        </section>
      )}

      {step === 'stack' && (
        <section className="view-group">
          <h3>{s.stackHeading}</h3>
          <select aria-label={s.stackAria} value={stack} onChange={(event) => setStack(event.target.value)}>
            <option value="node-npm">Node.js / npm</option>
            <option value="node-pnpm">Node.js / pnpm</option>
            <option value="python-pip">Python / pip</option>
            <option value="go-mod">Go / go mod</option>
          </select>
        </section>
      )}

      {step === 'environnements' && (
        <section className="view-group">
          <h3>{s.environmentsHeading}</h3>
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
          <h3>{s.gitHeading}</h3>
          <select aria-label={s.gitAria} value={gitProvider} onChange={(event) => setGitProvider(event.target.value as 'gitlab' | 'github')}>
            <option value="gitlab">GitLab</option>
            <option value="github">GitHub</option>
          </select>
          <p className="empty">{s.gitHint}</p>
        </section>
      )}

      {step === 'résumé' && (
        <section className="view-group">
          <h3>{s.summaryHeading}</h3>
          <label htmlFor="dev-wizard-name">{s.projectTitle}</label>
          <input id="dev-wizard-name" aria-label={s.projectTitle} placeholder={s.projectTitle} value={name} onChange={(event) => setName(event.target.value)} />
          <label htmlFor="dev-wizard-description">{s.description}</label>
          <textarea id="dev-wizard-description" className="doc-editor" aria-label={s.descriptionAria} value={description} onChange={(event) => setDescription(event.target.value)} />
          <label htmlFor="dev-wizard-owner">{s.owner}</label>
          <input id="dev-wizard-owner" aria-label={s.ownerAria} placeholder={s.owner} value={owner} onChange={(event) => setOwner(event.target.value)} />
          <ul>
            <li>{s.summaryTemplate(template)}</li>
            <li>{s.summaryStack(stack)}</li>
            <li>{s.summaryEnvironments(environments.join(', ') || s.none)}</li>
            <li>{s.summaryGitProvider(gitProvider)}</li>
          </ul>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}>{submitting ? s.creating : s.createProject}</button>
        </section>
      )}

      {step !== 'résumé' && (
        <div className="item-actions">
          {stepIndex > 0 && <button type="button" onClick={() => setStep(WIZARD_STEPS[stepIndex - 1])}>{s.previous}</button>}
          <button type="button" onClick={() => setStep(WIZARD_STEPS[stepIndex + 1])}>{s.next}</button>
        </div>
      )}
    </form>
  );
}
