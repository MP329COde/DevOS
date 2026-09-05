import { useEffect, useState, type FormEvent } from 'react';

import { useStrings } from '../i18n/LanguageContext.js';

// TODO(AM.1/AM.2 — panel racine "Développement") : ce panel est monté en autonome (`dev-templates`)
// en attendant le panel racine "Développement" avec sous-navigation prévu en AM.1/AM.2. Une fois
// ce panel racine posé, déplacer cette vue en sous-onglet "Templates" de ce module plutôt que de
// garder une entrée de nav de premier niveau.

interface DevTemplateDependency {
  name: string;
  version: string;
}

interface DevTemplate {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  technologies: string[];
  dependencies: DevTemplateDependency[];
  version: string;
  environments: string[];
  integrableTools: string[];
  generatedItems: string[];
  isDefault: boolean;
  active: boolean;
  previousVersionId?: string | null;
  source: string;
  registry?: string | null;
  packageName?: string | null;
  repositoryUrl?: string | null;
}

function parseCommaList(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parseDependencies(value: string): DevTemplateDependency[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, version] = entry.split('@').map((part) => part.trim());
      return { name: name ?? entry, version: version ?? '' };
    });
}

const strings = {
  fr: {
    catalogHint: 'Catalogue de templates du module Développement : gabarits réutilisables pour la création guidée de projet.',
    nameAria: 'Nom du template',
    namePlaceholder: 'Nom (ex : API Node/Express)',
    typeAria: 'Type de template',
    typePlaceholder: 'Type (ex : api, web-app, cli, worker)',
    descriptionAria: 'Description du template',
    descriptionPlaceholder: 'Description (optionnel)',
    technologiesAria: 'Technologies',
    technologiesPlaceholder: 'Technologies (séparées par des virgules)',
    dependenciesAria: 'Dépendances',
    dependenciesPlaceholder: 'Dépendances (ex : express@4.19.2, dotenv@16.4.5)',
    versionAria: 'Version',
    versionPlaceholder: 'Version',
    environmentsAria: 'Environnements compatibles',
    environmentsPlaceholder: 'Environnements compatibles (dev, staging, prod)',
    toolsAria: 'Outils intégrables',
    toolsPlaceholder: 'Outils intégrables (gitlab-ci, sonarqube, argocd)',
    generatedItemsAria: 'Éléments générés automatiquement',
    generatedItemsPlaceholder: 'Éléments générés (Dockerfile, .gitlab-ci.yml)',
    registryAria: 'Registre',
    registryPlaceholder: 'Registre (npm, github…) — optionnel',
    packageNameAria: 'Paquet / dépôt',
    packageNamePlaceholder: 'Nom du paquet npm ou "org/repo" — optionnel',
    repositoryUrlAria: 'URL du dépôt',
    repositoryUrlPlaceholder: 'URL du dépôt source — optionnel',
    createTemplate: 'Créer le template',
    loadFailed: 'Impossible de charger les templates. Démarrez le backend pour connecter vos données.',
    createFailed: 'La création du template a échoué.',
    statusChangeFailed: 'Le changement de statut a échoué.',
    defaultChangeFailed: 'La désignation par défaut a échoué.',
    newVersionPrompt: (name: string, current: string) => `Nouvelle version pour "${name}" (actuelle : ${current})`,
    publishFailed: 'La publication de la nouvelle version a échoué.',
    showInactive: 'Afficher les templates désactivés',
    noTemplatesYet: "Aucun template pour l'instant.",
    default: 'Par défaut',
    disabled: 'Désactivé',
    closeDetail: 'Fermer le détail',
    detail: 'Détail',
    setDefault: 'Définir par défaut',
    newVersion: 'Nouvelle version',
    deactivate: 'Désactiver',
    reactivate: 'Réactiver',
    technologiesLabel: 'Technologies :',
    environmentsLabel: 'Environnements compatibles :',
    toolsLabel: 'Outils intégrables :',
    generatedItemsLabel: 'Éléments générés automatiquement :',
    previousVersion: (id: string) => `Version précédente : ${id}`,
    community: 'Communautaire',
    custom: 'Interne',
    sourceAllOption: 'Toutes les sources',
    sourceCustomOption: 'Templates internes',
    sourceCommunityOption: 'Templates communautaires',
    sourceFilterAria: 'Filtrer par source',
    typeFilterAria: 'Filtrer par type',
    typeAllOption: 'Tous les types',
    technologyFilterAria: 'Filtrer par technologie',
    technologyFilterPlaceholder: 'Filtrer par technologie (ex : node, npm)',
    sortByAria: 'Trier par',
    sortByName: 'Nom',
    sortByUpdated: 'Dernière mise à jour',
    sortByVersion: 'Version',
    repositoryLink: 'Dépôt',
    packageLabel: (registry: string, name: string) => `${registry} : ${name}`,
  },
  en: {
    catalogHint: 'Development module template catalog: reusable blueprints for guided project creation.',
    nameAria: 'Template name',
    namePlaceholder: 'Name (e.g. Node/Express API)',
    typeAria: 'Template type',
    typePlaceholder: 'Type (e.g. api, web-app, cli, worker)',
    descriptionAria: 'Template description',
    descriptionPlaceholder: 'Description (optional)',
    technologiesAria: 'Technologies',
    technologiesPlaceholder: 'Technologies (comma-separated)',
    dependenciesAria: 'Dependencies',
    dependenciesPlaceholder: 'Dependencies (e.g. express@4.19.2, dotenv@16.4.5)',
    versionAria: 'Version',
    versionPlaceholder: 'Version',
    environmentsAria: 'Compatible environments',
    environmentsPlaceholder: 'Compatible environments (dev, staging, prod)',
    toolsAria: 'Integrable tools',
    toolsPlaceholder: 'Integrable tools (gitlab-ci, sonarqube, argocd)',
    generatedItemsAria: 'Automatically generated items',
    generatedItemsPlaceholder: 'Generated items (Dockerfile, .gitlab-ci.yml)',
    registryAria: 'Registry',
    registryPlaceholder: 'Registry (npm, github…) — optional',
    packageNameAria: 'Package / repo',
    packageNamePlaceholder: 'npm package name or "org/repo" — optional',
    repositoryUrlAria: 'Repository URL',
    repositoryUrlPlaceholder: 'Source repository URL — optional',
    createTemplate: 'Create template',
    loadFailed: 'Unable to load templates. Start the backend to connect your data.',
    createFailed: 'Failed to create the template.',
    statusChangeFailed: 'Failed to change the status.',
    defaultChangeFailed: 'Failed to set as default.',
    newVersionPrompt: (name: string, current: string) => `New version for "${name}" (current: ${current})`,
    publishFailed: 'Failed to publish the new version.',
    showInactive: 'Show disabled templates',
    noTemplatesYet: 'No templates yet.',
    default: 'Default',
    disabled: 'Disabled',
    closeDetail: 'Close detail',
    detail: 'Detail',
    setDefault: 'Set as default',
    newVersion: 'New version',
    deactivate: 'Disable',
    reactivate: 'Reactivate',
    technologiesLabel: 'Technologies:',
    environmentsLabel: 'Compatible environments:',
    toolsLabel: 'Integrable tools:',
    generatedItemsLabel: 'Automatically generated items:',
    previousVersion: (id: string) => `Previous version: ${id}`,
    community: 'Community',
    custom: 'Internal',
    sourceAllOption: 'All sources',
    sourceCustomOption: 'Internal templates',
    sourceCommunityOption: 'Community templates',
    sourceFilterAria: 'Filter by source',
    typeFilterAria: 'Filter by type',
    typeAllOption: 'All types',
    technologyFilterAria: 'Filter by technology',
    technologyFilterPlaceholder: 'Filter by technology (e.g. node, npm)',
    sortByAria: 'Sort by',
    sortByName: 'Name',
    sortByUpdated: 'Last updated',
    sortByVersion: 'Version',
    repositoryLink: 'Repository',
    packageLabel: (registry: string, name: string) => `${registry}: ${name}`,
  },
} as const;

export function DevTemplatesPanel({ apiBase }: { apiBase: string }) {
  const s = useStrings(strings);
  const [templates, setTemplates] = useState<DevTemplate[]>([]);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState<'' | 'custom' | 'community'>('');
  const [typeFilter, setTypeFilter] = useState('');
  const [technologyFilter, setTechnologyFilter] = useState('');
  const [sortBy, setSortBy] = useState<'' | 'name' | 'updatedAt' | 'version'>('');

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [technologies, setTechnologies] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [environments, setEnvironments] = useState('');
  const [integrableTools, setIntegrableTools] = useState('');
  const [generatedItems, setGeneratedItems] = useState('');
  const [registry, setRegistry] = useState('');
  const [packageName, setPackageName] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (sourceFilter) params.set('source', sourceFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (technologyFilter.trim()) params.set('technology', technologyFilter.trim());
    if (sortBy) params.set('sortBy', sortBy);
    const query = params.toString();
    void fetch(`${apiBase}/api/dev/templates${query ? `?${query}` : ''}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setTemplates(await response.json());
        setError('');
      })
      .catch(() => setError(s.loadFailed));
  };

  useEffect(load, [apiBase, sourceFilter, typeFilter, technologyFilter, sortBy]);

  async function createTemplate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !type.trim()) return;
    const response = await fetch(`${apiBase}/api/dev/templates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        type: type.trim(),
        description: description.trim() || undefined,
        technologies: parseCommaList(technologies),
        dependencies: parseDependencies(dependencies),
        version: version.trim() || '1.0.0',
        environments: parseCommaList(environments),
        integrableTools: parseCommaList(integrableTools),
        generatedItems: parseCommaList(generatedItems),
        registry: registry.trim() || undefined,
        packageName: packageName.trim() || undefined,
        repositoryUrl: repositoryUrl.trim() || undefined,
      }),
    });
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError((body as { error?: string }).error ?? s.createFailed); return; }
    const created = await response.json();
    setTemplates((current) => [created, ...current]);
    setName(''); setType(''); setDescription(''); setTechnologies(''); setDependencies('');
    setVersion('1.0.0'); setEnvironments(''); setIntegrableTools(''); setGeneratedItems('');
    setRegistry(''); setPackageName(''); setRepositoryUrl('');
  }

  async function toggleActive(template: DevTemplate) {
    const response = await fetch(`${apiBase}/api/dev/templates/${template.id}/active`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active: !template.active }),
    });
    if (!response.ok) { setError(s.statusChangeFailed); return; }
    const updated = await response.json();
    setTemplates((current) => current.map((entry) => (entry.id === template.id ? { ...entry, active: updated.active } : entry)));
  }

  async function setAsDefault(template: DevTemplate) {
    const response = await fetch(`${apiBase}/api/dev/templates/${template.id}/default`, { method: 'POST' });
    if (!response.ok) { setError(s.defaultChangeFailed); return; }
    setTemplates((current) => current.map((entry) => ({ ...entry, isDefault: entry.id === template.id })));
  }

  async function publishNewVersion(template: DevTemplate) {
    const nextVersion = window.prompt(s.newVersionPrompt(template.name, template.version), '');
    if (!nextVersion || !nextVersion.trim()) return;
    const response = await fetch(`${apiBase}/api/dev/templates/${template.id}/versions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: nextVersion.trim() }),
    });
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError((body as { error?: string }).error ?? s.publishFailed); return; }
    const created = await response.json();
    setTemplates((current) => [created, ...current]);
  }

  const visibleTemplates = showInactive ? templates : templates.filter((template) => template.active);

  return (
    <div className="items dev-templates-panel">
      <p className="empty">{s.catalogHint}</p>

      <form className="new-item dev-template-form" onSubmit={(event) => void createTemplate(event)}>
        <input aria-label={s.nameAria} placeholder={s.namePlaceholder} value={name} onChange={(event) => setName(event.target.value)} required />
        <input aria-label={s.typeAria} placeholder={s.typePlaceholder} value={type} onChange={(event) => setType(event.target.value)} required />
        <input aria-label={s.descriptionAria} placeholder={s.descriptionPlaceholder} value={description} onChange={(event) => setDescription(event.target.value)} />
        <input aria-label={s.technologiesAria} placeholder={s.technologiesPlaceholder} value={technologies} onChange={(event) => setTechnologies(event.target.value)} />
        <input aria-label={s.dependenciesAria} placeholder={s.dependenciesPlaceholder} value={dependencies} onChange={(event) => setDependencies(event.target.value)} />
        <input aria-label={s.versionAria} placeholder={s.versionPlaceholder} value={version} onChange={(event) => setVersion(event.target.value)} />
        <input aria-label={s.environmentsAria} placeholder={s.environmentsPlaceholder} value={environments} onChange={(event) => setEnvironments(event.target.value)} />
        <input aria-label={s.toolsAria} placeholder={s.toolsPlaceholder} value={integrableTools} onChange={(event) => setIntegrableTools(event.target.value)} />
        <input aria-label={s.generatedItemsAria} placeholder={s.generatedItemsPlaceholder} value={generatedItems} onChange={(event) => setGeneratedItems(event.target.value)} />
        <input aria-label={s.registryAria} placeholder={s.registryPlaceholder} value={registry} onChange={(event) => setRegistry(event.target.value)} />
        <input aria-label={s.packageNameAria} placeholder={s.packageNamePlaceholder} value={packageName} onChange={(event) => setPackageName(event.target.value)} />
        <input aria-label={s.repositoryUrlAria} placeholder={s.repositoryUrlPlaceholder} value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} />
        <button type="submit">{s.createTemplate}</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="dev-templates-filters">
        <select aria-label={s.sourceFilterAria} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as '' | 'custom' | 'community')}>
          <option value="">{s.sourceAllOption}</option>
          <option value="custom">{s.sourceCustomOption}</option>
          <option value="community">{s.sourceCommunityOption}</option>
        </select>
        <select aria-label={s.typeFilterAria} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">{s.typeAllOption}</option>
          {Array.from(new Set(templates.map((template) => template.type))).sort().map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <input
          aria-label={s.technologyFilterAria}
          placeholder={s.technologyFilterPlaceholder}
          value={technologyFilter}
          onChange={(event) => setTechnologyFilter(event.target.value)}
        />
        <select aria-label={s.sortByAria} value={sortBy} onChange={(event) => setSortBy(event.target.value as '' | 'name' | 'updatedAt' | 'version')}>
          <option value="">{s.sortByName} / {s.default}</option>
          <option value="name">{s.sortByName}</option>
          <option value="updatedAt">{s.sortByUpdated}</option>
          <option value="version">{s.sortByVersion}</option>
        </select>
        <label className="filter">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> {s.showInactive}
        </label>
      </div>

      {!error && visibleTemplates.length === 0 && <p className="empty">{s.noTemplatesYet}</p>}

      <div className="dev-templates-list">
        {visibleTemplates.map((template) => {
          const isExpanded = expandedId === template.id;
          return (
            <article className={`item widget-card dev-template-card${template.active ? '' : ' dev-template-inactive'}`} key={template.id}>
              <span className="item-title">
                <strong>{template.name}</strong>{' '}
                <span className="type type-template">{template.type}</span>{' '}
                <span className="status-badge">v{template.version}</span>{' '}
                <span className={`status-badge${template.source === 'community' ? ' status-badge-community' : ''}`}>
                  {template.source === 'community' ? s.community : s.custom}
                </span>{' '}
                {template.isDefault && <span className="status-badge status-badge-default">{s.default}</span>}
                {!template.active && <span className="status-badge status-badge-inactive">{s.disabled}</span>}
              </span>
              {template.description && <p className="empty">{template.description}</p>}
              {(template.registry || template.repositoryUrl) && (
                <p className="empty">
                  {template.registry && template.packageName && <span>{s.packageLabel(template.registry, template.packageName)}</span>}
                  {template.repositoryUrl && (
                    <>
                      {template.registry && template.packageName ? ' · ' : ''}
                      <a href={template.repositoryUrl} target="_blank" rel="noreferrer">{s.repositoryLink}</a>
                    </>
                  )}
                </p>
              )}

              {template.dependencies.length > 0 && (
                <div className="dependency-cards">
                  {template.dependencies.map((dependency, index) => (
                    <span className="dependency-card" key={`${dependency.name}-${index}`}>
                      <strong>{dependency.name}</strong>{dependency.version ? <span className="dependency-version">{dependency.version}</span> : null}
                    </span>
                  ))}
                </div>
              )}

              <span className="item-actions">
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : template.id)}>
                  {isExpanded ? s.closeDetail : s.detail}
                </button>
                {!template.isDefault && template.active && (
                  <button type="button" onClick={() => void setAsDefault(template)}>{s.setDefault}</button>
                )}
                <button type="button" onClick={() => void publishNewVersion(template)}>{s.newVersion}</button>
                <button type="button" onClick={() => void toggleActive(template)}>{template.active ? s.deactivate : s.reactivate}</button>
              </span>

              {isExpanded && (
                <div className="dev-template-detail">
                  {template.technologies.length > 0 && <p><strong>{s.technologiesLabel}</strong> {template.technologies.join(', ')}</p>}
                  {template.environments.length > 0 && <p><strong>{s.environmentsLabel}</strong> {template.environments.join(', ')}</p>}
                  {template.integrableTools.length > 0 && <p><strong>{s.toolsLabel}</strong> {template.integrableTools.join(', ')}</p>}
                  {template.generatedItems.length > 0 && <p><strong>{s.generatedItemsLabel}</strong> {template.generatedItems.join(', ')}</p>}
                  {template.previousVersionId && <p className="empty">{s.previousVersion(template.previousVersionId)}</p>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
