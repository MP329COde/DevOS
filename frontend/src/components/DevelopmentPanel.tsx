import { useEffect, useState, type FormEvent } from 'react';

import { DevActivityPanel, type DevActivityTab } from './DevActivityPanel.js';
import { DevReposPanel } from './DevReposPanel.js';
import { DevCiCdPanel, type CiCdSubView } from './DevCiCdPanel.js';
import { DevTasksPanel } from './DevTasksPanel.js';
import { DevTemplatesPanel } from './DevTemplatesPanel.js';
import { useStrings, useLanguage } from '../i18n/LanguageContext.js';

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
  templateId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DevTemplateOption {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  technologies: string[];
  version: string;
  isDefault: boolean;
  active: boolean;
  source: string;
  registry?: string | null;
  packageName?: string | null;
  repositoryUrl?: string | null;
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

interface DevProjectRepo {
  id: string;
  devProjectId: string;
  provider: 'gitlab' | 'github';
  repoIdentifier: string;
  role: string;
  name?: string | null;
  webUrl?: string | null;
  defaultBranch?: string | null;
  vaultSecretName: string;
  argoAppName?: string | null;
  harborProject?: string | null;
  harborRepo?: string | null;
}

interface DevProjectResource {
  id: string;
  devProjectId: string;
  name: string;
  type: string;
  host?: string | null;
  note?: string | null;
}

interface DevRepoOption {
  key: string;
  provider: 'gitlab' | 'github';
  id: string;
  name: string;
  webUrl: string;
  defaultBranch: string | null;
}

interface DevProjectPipelineGroup {
  cicdConfigId: string;
  role: string;
  name: string | null;
  repoIdentifier: string;
  pipelines?: Array<{ id: number; status: string; ref: string; webUrl: string; createdAt: string; updatedAt: string }>;
  error?: string;
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
  'overview', 'new', 'dashboard', 'repos', 'templates', 'tasks',
  'activity-search', 'activity-integrations', 'activity-dashboard', 'activity-ai',
  'cicd-pipelines', 'cicd-deployments', 'cicd-tests', 'cicd-quality',
] as const;
type DevTab = (typeof DEV_TABS)[number];

/** Regroupement visuel des sous-onglets (deuxième niveau de nav) : purement d'affichage, ne
 * change pas le comportement de sélection (`setTab`). */
const DEV_TAB_GROUPS: Array<{ labelFr: string; labelEn: string; tabs: DevTab[] }> = [
  { labelFr: 'Projet', labelEn: 'Project', tabs: ['overview', 'new', 'dashboard', 'repos', 'templates', 'tasks'] },
  { labelFr: 'CI/CD & déploiement', labelEn: 'CI/CD & deployment', tabs: ['cicd-pipelines', 'cicd-deployments'] },
  { labelFr: 'Qualité', labelEn: 'Quality', tabs: ['cicd-tests', 'cicd-quality'] },
  { labelFr: 'Personnel', labelEn: 'Personal', tabs: ['activity-search', 'activity-integrations', 'activity-dashboard', 'activity-ai'] },
];

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
      templates: 'Gabarits',
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
    errorCreate: (detail?: string) => detail
      ? `La création du projet a échoué : ${detail}`
      : 'La création du projet a échoué. Vérifiez que le backend est démarré.',
    wizardStepsAria: 'Étapes de création de projet',
    templateHeading: 'Template de départ',
    templateHint: 'Choisissez un template du catalogue (interne ou communautaire) ou partez d\'un projet vierge ; ce choix reste modifiable jusqu\'au résumé.',
    templateAria: 'Template',
    templateBlank: 'Projet vierge',
    templateLoadFailed: 'Impossible de charger le catalogue de templates.',
    templateSourceFilterAria: 'Filtrer par source',
    templateSourceAll: 'Toutes les sources',
    templateSourceCustom: 'Templates internes',
    templateSourceCommunity: 'Templates communautaires',
    templateTypeFilterAria: 'Filtrer par type',
    templateTypeAll: 'Tous les types',
    templateSortAria: 'Trier par',
    templateSortDefault: 'Par défaut',
    templateSortName: 'Nom',
    templateSortUpdated: 'Dernière mise à jour',
    templateCommunityBadge: 'Communautaire',
    templatePackageLabel: (registry: string, name: string) => `${registry} : ${name}`,
    templateSelectedNone: 'Aucun template sélectionné (projet vierge)',
    templateSelected: (name: string) => `Template sélectionné : ${name}`,
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
    reposHeading: 'Dépôts liés',
    reposLoadFailed: 'Impossible de charger les dépôts liés.',
    noLinkedRepo: 'Aucun dépôt lié pour l\'instant.',
    unlink: 'Délier',
    showPipelines: 'Voir les pipelines',
    hidePipelines: 'Masquer les pipelines',
    pipelinesLoadFailed: 'Impossible de charger les pipelines.',
    noPipeline: 'Aucun pipeline pour ce dépôt.',
    linkExistingRepoHeading: 'Lier un dépôt existant',
    createNewRepoHeading: 'Créer un nouveau dépôt',
    repoRoleAria: 'Rôle du dépôt',
    repoRolePlaceholder: 'Rôle (ex. backend, frontend, infra)',
    vaultSecretAria: 'Nom du secret Vault',
    vaultSecretPlaceholder: 'Nom du secret Vault',
    repoNameAria: 'Nom du dépôt',
    repoNamePlaceholder: 'Nom du dépôt',
    selectRepoOption: 'Sélectionner un dépôt…',
    link: 'Lier',
    create: 'Créer',
    repoOperationFailed: 'L\'opération sur le dépôt a échoué.',
    resourcesHeading: 'Ressources',
    resourcesLoadFailed: 'Impossible de charger les ressources.',
    noResource: 'Aucune ressource pour l\'instant.',
    resourceNameAria: 'Nom de la ressource',
    resourceNamePlaceholder: 'Nom de la ressource',
    resourceTypeAria: 'Type de ressource',
    resourceTypePlaceholder: 'Type (ex. base de données, cache…)',
    resourceHostAria: 'Hôte',
    resourceHostPlaceholder: 'Hôte (optionnel)',
    resourceNoteAria: 'Note',
    resourceNotePlaceholder: 'Note (optionnelle)',
    addResource: 'Ajouter',
    resourceOperationFailed: 'L\'opération sur la ressource a échoué.',
    delete: 'Supprimer',
    defaultBranchLabel: 'Branche par défaut :',
    gitModeLink: 'Lier des dépôts existants',
    gitModeCreate: 'Créer un nouveau dépôt',
    wizardAddedRepos: 'Dépôts à lier/créer',
    wizardNoRepos: 'Aucun dépôt sélectionné pour l\'instant.',
    wizardAddRepo: 'Ajouter à la liste',
    wizardRemoveRepo: 'Retirer',
    wizardRepoModeLinked: (provider: string, identifier: string, role: string) => `Lier ${provider}:${identifier} (${role})`,
    wizardRepoModeCreated: (provider: string, name: string, role: string) => `Créer ${provider}:${name} (${role})`,
    wizardRepoFieldsRequired: 'Rôle et nom du secret Vault requis.',
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
      templates: 'Templates',
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
    errorCreate: (detail?: string) => detail
      ? `Failed to create the project: ${detail}`
      : 'Failed to create the project. Check that the backend is running.',
    wizardStepsAria: 'Project creation steps',
    templateHeading: 'Starting template',
    templateHint: 'Choose a template from the catalog (internal or community) or start from a blank project; this choice can still be changed until the summary.',
    templateAria: 'Template',
    templateBlank: 'Blank project',
    templateLoadFailed: 'Unable to load the template catalog.',
    templateSourceFilterAria: 'Filter by source',
    templateSourceAll: 'All sources',
    templateSourceCustom: 'Internal templates',
    templateSourceCommunity: 'Community templates',
    templateTypeFilterAria: 'Filter by type',
    templateTypeAll: 'All types',
    templateSortAria: 'Sort by',
    templateSortDefault: 'Default',
    templateSortName: 'Name',
    templateSortUpdated: 'Last updated',
    templateCommunityBadge: 'Community',
    templatePackageLabel: (registry: string, name: string) => `${registry}: ${name}`,
    templateSelectedNone: 'No template selected (blank project)',
    templateSelected: (name: string) => `Selected template: ${name}`,
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
    reposHeading: 'Linked repositories',
    reposLoadFailed: 'Unable to load linked repositories.',
    noLinkedRepo: 'No linked repository yet.',
    unlink: 'Unlink',
    showPipelines: 'Show pipelines',
    hidePipelines: 'Hide pipelines',
    pipelinesLoadFailed: 'Unable to load pipelines.',
    noPipeline: 'No pipeline for this repository.',
    linkExistingRepoHeading: 'Link an existing repository',
    createNewRepoHeading: 'Create a new repository',
    repoRoleAria: 'Repository role',
    repoRolePlaceholder: 'Role (e.g. backend, frontend, infra)',
    vaultSecretAria: 'Vault secret name',
    vaultSecretPlaceholder: 'Vault secret name',
    repoNameAria: 'Repository name',
    repoNamePlaceholder: 'Repository name',
    selectRepoOption: 'Select a repository…',
    link: 'Link',
    create: 'Create',
    repoOperationFailed: 'The repository operation failed.',
    resourcesHeading: 'Resources',
    resourcesLoadFailed: 'Unable to load resources.',
    noResource: 'No resource yet.',
    resourceNameAria: 'Resource name',
    resourceNamePlaceholder: 'Resource name',
    resourceTypeAria: 'Resource type',
    resourceTypePlaceholder: 'Type (e.g. database, cache…)',
    resourceHostAria: 'Host',
    resourceHostPlaceholder: 'Host (optional)',
    resourceNoteAria: 'Note',
    resourceNotePlaceholder: 'Note (optional)',
    addResource: 'Add',
    resourceOperationFailed: 'The resource operation failed.',
    delete: 'Delete',
    defaultBranchLabel: 'Default branch:',
    gitModeLink: 'Link existing repositories',
    gitModeCreate: 'Create a new repository',
    wizardAddedRepos: 'Repositories to link/create',
    wizardNoRepos: 'No repository selected yet.',
    wizardAddRepo: 'Add to list',
    wizardRemoveRepo: 'Remove',
    wizardRepoModeLinked: (provider: string, identifier: string, role: string) => `Link ${provider}:${identifier} (${role})`,
    wizardRepoModeCreated: (provider: string, name: string, role: string) => `Create ${provider}:${name} (${role})`,
    wizardRepoFieldsRequired: 'Role and Vault secret name are required.',
  },
} as const;

export function DevelopmentPanel({ apiBase }: { apiBase: string }) {
  const s = useStrings(strings);
  const { language } = useLanguage();
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
      <nav className="views dev-tab-groups" aria-label={s.subViewsAria}>
        {DEV_TAB_GROUPS.map((group) => (
          <div className="dev-tab-group" key={group.labelEn}>
            <span className="dev-tab-group-label">{language === 'fr' ? group.labelFr : group.labelEn}</span>
            {group.tabs.map((value) => (
              <button key={value} className={tab === value ? 'filter active' : 'filter'} type="button" onClick={() => setTab(value)}>
                {s.devTabLabels[value]}
              </button>
            ))}
          </div>
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
          apiBase={apiBase}
          projectId={selectedProjectId}
          dashboard={dashboard}
          error={dashboardError}
          allProjects={overview ? [...overview.active, ...overview.waiting, ...overview.done, ...overview.archived] : []}
          onSelect={openDashboard}
        />
      )}

      {tab === 'repos' && <DevReposPanel apiBase={apiBase} />}

      {tab === 'templates' && <DevTemplatesPanel apiBase={apiBase} />}

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

function DevProjectDashboardTab({ apiBase, projectId, dashboard, error, allProjects, onSelect }: {
  apiBase: string;
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

      <DevProjectRepositoriesSection apiBase={apiBase} projectId={projectId} />
      <DevProjectResourcesSection apiBase={apiBase} projectId={projectId} />
    </div>
  );
}

function DevProjectRepositoriesSection({ apiBase, projectId }: { apiBase: string; projectId: string }) {
  const s = useStrings(strings);
  const [repos, setRepos] = useState<DevProjectRepo[]>([]);
  const [error, setError] = useState('');
  const [availableRepos, setAvailableRepos] = useState<DevRepoOption[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<DevProjectPipelineGroup[] | null>(null);
  const [pipelinesError, setPipelinesError] = useState('');

  const [linkRepoKey, setLinkRepoKey] = useState('');
  const [linkRole, setLinkRole] = useState('');
  const [linkVaultSecret, setLinkVaultSecret] = useState('');

  const [createProvider, setCreateProvider] = useState<'gitlab' | 'github'>('gitlab');
  const [createName, setCreateName] = useState('');
  const [createRole, setCreateRole] = useState('');
  const [createVaultSecret, setCreateVaultSecret] = useState('');

  function loadRepos() {
    void fetch(`${apiBase}/api/dev-projects/${projectId}/repositories`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setRepos(await response.json());
        setError('');
      })
      .catch(() => setError(s.reposLoadFailed));
  }

  useEffect(() => { loadRepos(); }, [apiBase, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetch(`${apiBase}/api/extras/dev/repos`)
      .then(async (response) => (response.ok ? setAvailableRepos(await response.json()) : setAvailableRepos([])))
      .catch(() => setAvailableRepos([]));
  }, [apiBase]);

  async function unlink(cicdConfigId: string) {
    try {
      const response = await fetch(`${apiBase}/api/dev-projects/${projectId}/repositories/${cicdConfigId}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) throw new Error();
      loadRepos();
    } catch {
      setError(s.repoOperationFailed);
    }
  }

  function togglePipelines(cicdConfigId: string) {
    if (expandedId === cicdConfigId) { setExpandedId(null); return; }
    setExpandedId(cicdConfigId);
    void fetch(`${apiBase}/api/dev-cicd/by-project/${projectId}/pipelines`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setPipelines(await response.json());
        setPipelinesError('');
      })
      .catch(() => setPipelinesError(s.pipelinesLoadFailed));
  }

  async function submitLink(event: FormEvent) {
    event.preventDefault();
    const repo = availableRepos.find((r) => r.key === linkRepoKey);
    if (!repo || !linkRole.trim() || !linkVaultSecret.trim()) return;
    try {
      const response = await fetch(`${apiBase}/api/dev-projects/${projectId}/repositories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: repo.provider,
          repoIdentifier: repo.id,
          role: linkRole.trim(),
          vaultSecretName: linkVaultSecret.trim(),
          name: repo.name,
          webUrl: repo.webUrl,
          defaultBranch: repo.defaultBranch,
        }),
      });
      if (!response.ok) throw new Error();
      setLinkRepoKey(''); setLinkRole(''); setLinkVaultSecret('');
      loadRepos();
    } catch {
      setError(s.repoOperationFailed);
    }
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!createName.trim() || !createRole.trim() || !createVaultSecret.trim()) return;
    try {
      const response = await fetch(`${apiBase}/api/dev-projects/${projectId}/repositories/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: createProvider, name: createName.trim(), role: createRole.trim(), vaultSecretName: createVaultSecret.trim() }),
      });
      if (!response.ok) throw new Error();
      setCreateName(''); setCreateRole(''); setCreateVaultSecret('');
      loadRepos();
    } catch {
      setError(s.repoOperationFailed);
    }
  }

  return (
    <section className="view-group">
      <h3>{s.reposHeading}</h3>
      {error && <p className="error" role="alert">{error}</p>}
      {repos.length === 0 && !error && <p className="empty">{s.noLinkedRepo}</p>}
      {repos.map((repo) => (
        <article className="item widget-card" key={repo.id}>
          <span className="item-title">
            <strong>{repo.name ?? repo.repoIdentifier}</strong>{' '}
            <span className={`type type-${repo.provider}`}>{repo.provider === 'gitlab' ? 'GitLab' : 'GitHub'}</span>{' '}
            <span className="status-badge">{repo.role}</span>
          </span>
          <p className="empty">{s.defaultBranchLabel} <strong>{repo.defaultBranch ?? '—'}</strong></p>
          <span className="item-actions">
            {repo.webUrl && <a href={repo.webUrl} target="_blank" rel="noreferrer"><button type="button">{s.link}</button></a>}
            <button type="button" onClick={() => togglePipelines(repo.id)}>{expandedId === repo.id ? s.hidePipelines : s.showPipelines}</button>
            <button type="button" onClick={() => void unlink(repo.id)}>{s.unlink}</button>
          </span>
          {expandedId === repo.id && (
            <div className="dev-repo-detail">
              {pipelinesError && <p className="error" role="alert">{pipelinesError}</p>}
              {!pipelinesError && (() => {
                const group = pipelines?.find((p) => p.cicdConfigId === repo.id);
                if (!group || !group.pipelines || group.pipelines.length === 0) return <p className="empty">{s.noPipeline}</p>;
                return (
                  <ul>
                    {group.pipelines.map((pipeline) => (
                      <li key={pipeline.id}>
                        <a href={pipeline.webUrl} target="_blank" rel="noreferrer">#{pipeline.id}</a>{' '}
                        <span className="status-badge">{pipeline.status}</span>{' '}
                        <span className="empty">{pipeline.ref}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          )}
        </article>
      ))}

      <form className="item widget-card" onSubmit={(event) => void submitLink(event)}>
        <h4>{s.linkExistingRepoHeading}</h4>
        <select aria-label={s.repoNameAria} value={linkRepoKey} onChange={(event) => setLinkRepoKey(event.target.value)}>
          <option value="">{s.selectRepoOption}</option>
          {availableRepos.map((repo) => <option key={repo.key} value={repo.key}>{repo.name} ({repo.provider})</option>)}
        </select>
        <input aria-label={s.repoRoleAria} placeholder={s.repoRolePlaceholder} value={linkRole} onChange={(event) => setLinkRole(event.target.value)} />
        <input aria-label={s.vaultSecretAria} placeholder={s.vaultSecretPlaceholder} value={linkVaultSecret} onChange={(event) => setLinkVaultSecret(event.target.value)} />
        <button type="submit">{s.link}</button>
      </form>

      <form className="item widget-card" onSubmit={(event) => void submitCreate(event)}>
        <h4>{s.createNewRepoHeading}</h4>
        <select aria-label={s.gitAria} value={createProvider} onChange={(event) => setCreateProvider(event.target.value as 'gitlab' | 'github')}>
          <option value="gitlab">GitLab</option>
          <option value="github">GitHub</option>
        </select>
        <input aria-label={s.repoNameAria} placeholder={s.repoNamePlaceholder} value={createName} onChange={(event) => setCreateName(event.target.value)} />
        <input aria-label={s.repoRoleAria} placeholder={s.repoRolePlaceholder} value={createRole} onChange={(event) => setCreateRole(event.target.value)} />
        <input aria-label={s.vaultSecretAria} placeholder={s.vaultSecretPlaceholder} value={createVaultSecret} onChange={(event) => setCreateVaultSecret(event.target.value)} />
        <button type="submit">{s.create}</button>
      </form>
    </section>
  );
}

function DevProjectResourcesSection({ apiBase, projectId }: { apiBase: string; projectId: string }) {
  const s = useStrings(strings);
  const [resources, setResources] = useState<DevProjectResource[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [host, setHost] = useState('');
  const [note, setNote] = useState('');

  function loadResources() {
    void fetch(`${apiBase}/api/dev-projects/${projectId}/resources`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setResources(await response.json());
        setError('');
      })
      .catch(() => setError(s.resourcesLoadFailed));
  }

  useEffect(() => { loadResources(); }, [apiBase, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !type.trim()) return;
    try {
      const response = await fetch(`${apiBase}/api/dev-projects/${projectId}/resources`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), type: type.trim(), host: host.trim() || undefined, note: note.trim() || undefined }),
      });
      if (!response.ok) throw new Error();
      setName(''); setType(''); setHost(''); setNote('');
      loadResources();
    } catch {
      setError(s.resourceOperationFailed);
    }
  }

  async function remove(resourceId: string) {
    try {
      const response = await fetch(`${apiBase}/api/dev-projects/${projectId}/resources/${resourceId}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) throw new Error();
      loadResources();
    } catch {
      setError(s.resourceOperationFailed);
    }
  }

  return (
    <section className="view-group">
      <h3>{s.resourcesHeading}</h3>
      {error && <p className="error" role="alert">{error}</p>}
      {resources.length === 0 && !error && <p className="empty">{s.noResource}</p>}
      {resources.map((resource) => (
        <article className="item widget-card" key={resource.id}>
          <span className="item-title">
            <strong>{resource.name}</strong>{' '}
            <span className="status-badge">{resource.type}</span>
          </span>
          {resource.host && <p className="empty">{resource.host}</p>}
          {resource.note && <p className="empty">{resource.note}</p>}
          <span className="item-actions">
            <button type="button" onClick={() => void remove(resource.id)}>{s.delete}</button>
          </span>
        </article>
      ))}

      <form className="item widget-card" onSubmit={(event) => void submit(event)}>
        <input aria-label={s.resourceNameAria} placeholder={s.resourceNamePlaceholder} value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label={s.resourceTypeAria} placeholder={s.resourceTypePlaceholder} value={type} onChange={(event) => setType(event.target.value)} />
        <input aria-label={s.resourceHostAria} placeholder={s.resourceHostPlaceholder} value={host} onChange={(event) => setHost(event.target.value)} />
        <input aria-label={s.resourceNoteAria} placeholder={s.resourceNotePlaceholder} value={note} onChange={(event) => setNote(event.target.value)} />
        <button type="submit">{s.addResource}</button>
      </form>
    </section>
  );
}

function NewProjectWizard({ apiBase, onCreated }: { apiBase: string; onCreated: (project: DevProject) => void }) {
  const s = useStrings(strings);
  const [step, setStep] = useState<WizardStep>('template');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DevTemplateOption | null>(null);
  const [stack, setStack] = useState('node-npm');
  const [environments, setEnvironments] = useState<string[]>(['dev', 'staging', 'prod']);
  const [gitProvider, setGitProvider] = useState<'gitlab' | 'github'>('gitlab');
  const [owner, setOwner] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  type WizardRepoEntry =
    | { mode: 'link'; provider: 'gitlab' | 'github'; repoIdentifier: string; name: string | null; webUrl: string | null; defaultBranch: string | null; role: string; vaultSecretName: string }
    | { mode: 'create'; provider: 'gitlab' | 'github'; name: string; role: string; vaultSecretName: string };
  const [wizardRepos, setWizardRepos] = useState<WizardRepoEntry[]>([]);
  const [gitMode, setGitMode] = useState<'link' | 'create'>('link');
  const [availableRepos, setAvailableRepos] = useState<DevRepoOption[]>([]);
  const [wizardLinkRepoKey, setWizardLinkRepoKey] = useState('');
  const [wizardRepoRole, setWizardRepoRole] = useState('');
  const [wizardVaultSecret, setWizardVaultSecret] = useState('');
  const [wizardCreateName, setWizardCreateName] = useState('');
  const [wizardRepoError, setWizardRepoError] = useState('');

  useEffect(() => {
    void fetch(`${apiBase}/api/extras/dev/repos`)
      .then(async (response) => (response.ok ? setAvailableRepos(await response.json()) : setAvailableRepos([])))
      .catch(() => setAvailableRepos([]));
  }, [apiBase]);

  function addWizardRepo() {
    if (!wizardRepoRole.trim() || !wizardVaultSecret.trim()) {
      setWizardRepoError(s.wizardRepoFieldsRequired);
      return;
    }
    if (gitMode === 'link') {
      const repo = availableRepos.find((r) => r.key === wizardLinkRepoKey);
      if (!repo) return;
      setWizardRepos((current) => [...current, {
        mode: 'link', provider: repo.provider, repoIdentifier: repo.id, name: repo.name,
        webUrl: repo.webUrl, defaultBranch: repo.defaultBranch, role: wizardRepoRole.trim(), vaultSecretName: wizardVaultSecret.trim(),
      }]);
      setWizardLinkRepoKey('');
    } else {
      if (!wizardCreateName.trim()) return;
      setWizardRepos((current) => [...current, {
        mode: 'create', provider: gitProvider, name: wizardCreateName.trim(), role: wizardRepoRole.trim(), vaultSecretName: wizardVaultSecret.trim(),
      }]);
      setWizardCreateName('');
    }
    setWizardRepoError('');
    setWizardRepoRole(''); setWizardVaultSecret('');
  }

  function removeWizardRepo(index: number) {
    setWizardRepos((current) => current.filter((_, i) => i !== index));
  }

  const [templates, setTemplates] = useState<DevTemplateOption[]>([]);
  const [templateLoadError, setTemplateLoadError] = useState('');
  const [templateSourceFilter, setTemplateSourceFilter] = useState<'' | 'custom' | 'community'>('');
  const [templateTypeFilter, setTemplateTypeFilter] = useState('');
  const [templateSort, setTemplateSort] = useState<'' | 'name' | 'updatedAt'>('');

  useEffect(() => {
    const params = new URLSearchParams({ includeInactive: 'false' });
    if (templateSourceFilter) params.set('source', templateSourceFilter);
    if (templateTypeFilter) params.set('type', templateTypeFilter);
    if (templateSort) params.set('sortBy', templateSort);
    void fetch(`${apiBase}/api/dev/templates?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setTemplates(await response.json());
        setTemplateLoadError('');
      })
      .catch(() => setTemplateLoadError(s.templateLoadFailed));
  }, [apiBase, templateSourceFilter, templateTypeFilter, templateSort, s.templateLoadFailed]);

  const stepIndex = WIZARD_STEPS.indexOf(step);
  const templateTypes = Array.from(new Set(templates.map((t) => t.type))).sort();

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
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          owner: owner.trim() || undefined,
          status: 'planning',
          templateId: selectedTemplate?.id,
          deliveryGoal: s.deliveryGoal(selectedTemplate?.name ?? s.templateBlank, stack, environments.join(', ') || s.none, gitProvider),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data && typeof data.error === 'string' ? data.error : undefined);
      }
      const created = await response.json();
      for (const entry of wizardRepos) {
        try {
          if (entry.mode === 'link') {
            await fetch(`${apiBase}/api/dev-projects/${created.id}/repositories`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                provider: entry.provider, repoIdentifier: entry.repoIdentifier, role: entry.role,
                vaultSecretName: entry.vaultSecretName, name: entry.name, webUrl: entry.webUrl, defaultBranch: entry.defaultBranch,
              }),
            });
          } else {
            await fetch(`${apiBase}/api/dev-projects/${created.id}/repositories/create`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ provider: entry.provider, name: entry.name, role: entry.role, vaultSecretName: entry.vaultSecretName }),
            });
          }
        } catch {
          // Un dépôt en échec ne doit pas bloquer les autres ni la création du projet.
        }
      }
      onCreated(created);
      setName(''); setDescription(''); setOwner(''); setStep('template'); setSelectedTemplate(null); setWizardRepos([]);
    } catch (err) {
      setError(err instanceof Error && err.message ? s.errorCreate(err.message) : s.errorCreate());
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
        <section className="view-group template-picker">
          <h3>{s.templateHeading}</h3>
          <p className="empty">{s.templateHint}</p>

          <div className="template-picker-filters">
            <select aria-label={s.templateSourceFilterAria} value={templateSourceFilter} onChange={(event) => setTemplateSourceFilter(event.target.value as '' | 'custom' | 'community')}>
              <option value="">{s.templateSourceAll}</option>
              <option value="custom">{s.templateSourceCustom}</option>
              <option value="community">{s.templateSourceCommunity}</option>
            </select>
            <select aria-label={s.templateTypeFilterAria} value={templateTypeFilter} onChange={(event) => setTemplateTypeFilter(event.target.value)}>
              <option value="">{s.templateTypeAll}</option>
              {templateTypes.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select aria-label={s.templateSortAria} value={templateSort} onChange={(event) => setTemplateSort(event.target.value as '' | 'name' | 'updatedAt')}>
              <option value="">{s.templateSortDefault}</option>
              <option value="name">{s.templateSortName}</option>
              <option value="updatedAt">{s.templateSortUpdated}</option>
            </select>
          </div>

          {templateLoadError && <p className="error" role="alert">{templateLoadError}</p>}

          <div className="template-picker-grid" role="listbox" aria-label={s.templateAria}>
            <button
              type="button"
              role="option"
              aria-selected={selectedTemplate === null}
              className={`template-picker-card${selectedTemplate === null ? ' selected' : ''}`}
              onClick={() => setSelectedTemplate(null)}
            >
              <strong>{s.templateBlank}</strong>
            </button>
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                role="option"
                aria-selected={selectedTemplate?.id === tpl.id}
                className={`template-picker-card${selectedTemplate?.id === tpl.id ? ' selected' : ''}`}
                onClick={() => setSelectedTemplate(tpl)}
              >
                <strong>{tpl.name}</strong>{' '}
                <span className="type type-template">{tpl.type}</span>{' '}
                {tpl.source === 'community' && <span className="status-badge status-badge-community">{s.templateCommunityBadge}</span>}
                {tpl.description && <p className="template-picker-desc">{tpl.description}</p>}
                {tpl.registry && tpl.packageName && (
                  <p className="template-picker-desc">{s.templatePackageLabel(tpl.registry, tpl.packageName)}</p>
                )}
              </button>
            ))}
          </div>

          <p className="empty">{selectedTemplate ? s.templateSelected(selectedTemplate.name) : s.templateSelectedNone}</p>
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
          <p className="empty">{s.gitHint}</p>

          <div className="item-actions">
            <label className="note-checkbox">
              <input type="radio" checked={gitMode === 'link'} onChange={() => setGitMode('link')} />
              <span>{s.gitModeLink}</span>
            </label>
            <label className="note-checkbox">
              <input type="radio" checked={gitMode === 'create'} onChange={() => setGitMode('create')} />
              <span>{s.gitModeCreate}</span>
            </label>
          </div>

          {gitMode === 'link' ? (
            <>
              <select aria-label={s.repoNameAria} value={wizardLinkRepoKey} onChange={(event) => setWizardLinkRepoKey(event.target.value)}>
                <option value="">{s.selectRepoOption}</option>
                {availableRepos.map((repo) => <option key={repo.key} value={repo.key}>{repo.name} ({repo.provider})</option>)}
              </select>
            </>
          ) : (
            <>
              <select aria-label={s.gitAria} value={gitProvider} onChange={(event) => setGitProvider(event.target.value as 'gitlab' | 'github')}>
                <option value="gitlab">GitLab</option>
                <option value="github">GitHub</option>
              </select>
              <input aria-label={s.repoNameAria} placeholder={s.repoNamePlaceholder} value={wizardCreateName} onChange={(event) => setWizardCreateName(event.target.value)} />
            </>
          )}
          <input aria-label={s.repoRoleAria} placeholder={s.repoRolePlaceholder} value={wizardRepoRole} onChange={(event) => setWizardRepoRole(event.target.value)} />
          <input aria-label={s.vaultSecretAria} placeholder={s.vaultSecretPlaceholder} value={wizardVaultSecret} onChange={(event) => setWizardVaultSecret(event.target.value)} />
          <button type="button" onClick={addWizardRepo}>{s.wizardAddRepo}</button>
          {wizardRepoError && <p className="error" role="alert">{wizardRepoError}</p>}

          <h4>{s.wizardAddedRepos}</h4>
          {wizardRepos.length === 0 && <p className="empty">{s.wizardNoRepos}</p>}
          <ul>
            {wizardRepos.map((entry, index) => (
              <li key={index}>
                {entry.mode === 'link' ? s.wizardRepoModeLinked(entry.provider, entry.repoIdentifier, entry.role) : s.wizardRepoModeCreated(entry.provider, entry.name, entry.role)}
                {' '}
                <button type="button" onClick={() => removeWizardRepo(index)}>{s.wizardRemoveRepo}</button>
              </li>
            ))}
          </ul>
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
            <li>{s.summaryTemplate(selectedTemplate?.name ?? s.templateBlank)}</li>
            <li>{s.summaryStack(stack)}</li>
            <li>{s.summaryEnvironments(environments.join(', ') || s.none)}</li>
          </ul>
          <h4>{s.wizardAddedRepos}</h4>
          {wizardRepos.length === 0 && <p className="empty">{s.wizardNoRepos}</p>}
          <ul>
            {wizardRepos.map((entry, index) => (
              <li key={index}>
                {entry.mode === 'link' ? s.wizardRepoModeLinked(entry.provider, entry.repoIdentifier, entry.role) : s.wizardRepoModeCreated(entry.provider, entry.name, entry.role)}
              </li>
            ))}
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
