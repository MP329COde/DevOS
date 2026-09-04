import { useEffect, useState, type FormEvent } from 'react';

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

export function DevTemplatesPanel({ apiBase }: { apiBase: string }) {
  const [templates, setTemplates] = useState<DevTemplate[]>([]);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [technologies, setTechnologies] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [environments, setEnvironments] = useState('');
  const [integrableTools, setIntegrableTools] = useState('');
  const [generatedItems, setGeneratedItems] = useState('');

  const load = () => {
    void fetch(`${apiBase}/api/dev/templates`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setTemplates(await response.json());
        setError('');
      })
      .catch(() => setError('Impossible de charger les templates. Démarrez le backend pour connecter vos données.'));
  };

  useEffect(load, [apiBase]);

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
      }),
    });
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError((body as { error?: string }).error ?? 'La création du template a échoué.'); return; }
    const created = await response.json();
    setTemplates((current) => [created, ...current]);
    setName(''); setType(''); setDescription(''); setTechnologies(''); setDependencies('');
    setVersion('1.0.0'); setEnvironments(''); setIntegrableTools(''); setGeneratedItems('');
  }

  async function toggleActive(template: DevTemplate) {
    const response = await fetch(`${apiBase}/api/dev/templates/${template.id}/active`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active: !template.active }),
    });
    if (!response.ok) { setError('Le changement de statut a échoué.'); return; }
    const updated = await response.json();
    setTemplates((current) => current.map((entry) => (entry.id === template.id ? { ...entry, active: updated.active } : entry)));
  }

  async function setAsDefault(template: DevTemplate) {
    const response = await fetch(`${apiBase}/api/dev/templates/${template.id}/default`, { method: 'POST' });
    if (!response.ok) { setError('La désignation par défaut a échoué.'); return; }
    setTemplates((current) => current.map((entry) => ({ ...entry, isDefault: entry.id === template.id })));
  }

  async function publishNewVersion(template: DevTemplate) {
    const nextVersion = window.prompt(`Nouvelle version pour "${template.name}" (actuelle : ${template.version})`, '');
    if (!nextVersion || !nextVersion.trim()) return;
    const response = await fetch(`${apiBase}/api/dev/templates/${template.id}/versions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: nextVersion.trim() }),
    });
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError((body as { error?: string }).error ?? 'La publication de la nouvelle version a échoué.'); return; }
    const created = await response.json();
    setTemplates((current) => [created, ...current]);
  }

  const visibleTemplates = showInactive ? templates : templates.filter((template) => template.active);

  return (
    <div className="items dev-templates-panel">
      <p className="empty">Catalogue de templates du module Développement : gabarits réutilisables pour la création guidée de projet.</p>

      <form className="new-item dev-template-form" onSubmit={(event) => void createTemplate(event)}>
        <input aria-label="Nom du template" placeholder="Nom (ex : API Node/Express)" value={name} onChange={(event) => setName(event.target.value)} required />
        <input aria-label="Type de template" placeholder="Type (ex : api, web-app, cli, worker)" value={type} onChange={(event) => setType(event.target.value)} required />
        <input aria-label="Description du template" placeholder="Description (optionnel)" value={description} onChange={(event) => setDescription(event.target.value)} />
        <input aria-label="Technologies" placeholder="Technologies (séparées par des virgules)" value={technologies} onChange={(event) => setTechnologies(event.target.value)} />
        <input aria-label="Dépendances" placeholder="Dépendances (ex : express@4.19.2, dotenv@16.4.5)" value={dependencies} onChange={(event) => setDependencies(event.target.value)} />
        <input aria-label="Version" placeholder="Version" value={version} onChange={(event) => setVersion(event.target.value)} />
        <input aria-label="Environnements compatibles" placeholder="Environnements compatibles (dev, staging, prod)" value={environments} onChange={(event) => setEnvironments(event.target.value)} />
        <input aria-label="Outils intégrables" placeholder="Outils intégrables (gitlab-ci, sonarqube, argocd)" value={integrableTools} onChange={(event) => setIntegrableTools(event.target.value)} />
        <input aria-label="Éléments générés automatiquement" placeholder="Éléments générés (Dockerfile, .gitlab-ci.yml)" value={generatedItems} onChange={(event) => setGeneratedItems(event.target.value)} />
        <button type="submit">Créer le template</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      <label className="filter">
        <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Afficher les templates désactivés
      </label>

      {!error && visibleTemplates.length === 0 && <p className="empty">Aucun template pour l'instant.</p>}

      <div className="dev-templates-list">
        {visibleTemplates.map((template) => {
          const isExpanded = expandedId === template.id;
          return (
            <article className={`item widget-card dev-template-card${template.active ? '' : ' dev-template-inactive'}`} key={template.id}>
              <span className="item-title">
                <strong>{template.name}</strong>{' '}
                <span className="type type-template">{template.type}</span>{' '}
                <span className="status-badge">v{template.version}</span>{' '}
                {template.isDefault && <span className="status-badge status-badge-default">Par défaut</span>}
                {!template.active && <span className="status-badge status-badge-inactive">Désactivé</span>}
              </span>
              {template.description && <p className="empty">{template.description}</p>}

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
                  {isExpanded ? 'Fermer le détail' : 'Détail'}
                </button>
                {!template.isDefault && template.active && (
                  <button type="button" onClick={() => void setAsDefault(template)}>Définir par défaut</button>
                )}
                <button type="button" onClick={() => void publishNewVersion(template)}>Nouvelle version</button>
                <button type="button" onClick={() => void toggleActive(template)}>{template.active ? 'Désactiver' : 'Réactiver'}</button>
              </span>

              {isExpanded && (
                <div className="dev-template-detail">
                  {template.technologies.length > 0 && <p><strong>Technologies :</strong> {template.technologies.join(', ')}</p>}
                  {template.environments.length > 0 && <p><strong>Environnements compatibles :</strong> {template.environments.join(', ')}</p>}
                  {template.integrableTools.length > 0 && <p><strong>Outils intégrables :</strong> {template.integrableTools.join(', ')}</p>}
                  {template.generatedItems.length > 0 && <p><strong>Éléments générés automatiquement :</strong> {template.generatedItems.join(', ')}</p>}
                  {template.previousVersionId && <p className="empty">Version précédente : {template.previousVersionId}</p>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
