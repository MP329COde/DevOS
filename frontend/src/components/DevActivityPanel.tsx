import { useEffect, useState, type FormEvent } from 'react';

interface TimelineEntry {
  id: string;
  type: 'item-created' | 'item-updated' | 'comment';
  occurredAt: string;
  itemTitle: string;
  itemType: string;
  devProjectId: string | null;
  summary: string;
}

interface SearchResult {
  kind: 'project' | 'item' | 'doc';
  id: string;
  title: string;
  subtitle: string;
}

interface IntegrationStatus {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
}

interface PersonalDashboard {
  member: string;
  assignedOpenTasks: Array<{ id: string; title: string; status: string; devProjectId: string | null }>;
  pipelinesFailing: Array<{ id: string; title: string; pipelineStatus: string | null }>;
  mergeRequestsToReview: Array<{ id: string; title: string; mergeRequestState: string | null }>;
}

interface AiStub {
  configured: false;
  message: string;
}

const TIMELINE_TYPE_LABEL: Record<TimelineEntry['type'], string> = {
  'item-created': 'Création',
  'item-updated': 'Mise à jour',
  comment: 'Commentaire',
};

/**
 * Historique/activité, intégrations dev, recherche globale et dashboard développeur personnel
 * (module Développement, section AM.8). Regroupe plusieurs sous-vues dans un seul panel plutôt
 * que d'en créer cinq séparés, en cohérence avec le service backend `dev-activity-service.ts`
 * qui expose ces facettes sous un préfixe commun `/api/dev-activity`.
 */
export function DevActivityPanel({ apiBase }: { apiBase: string }) {
  const [tab, setTab] = useState<'timeline' | 'search' | 'integrations' | 'dashboard' | 'ai'>('timeline');
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | TimelineEntry['type']>('all');
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);

  const [member, setMember] = useState('');
  const [dashboard, setDashboard] = useState<PersonalDashboard | null>(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<AiStub | null>(null);

  useEffect(() => {
    const url = new URL(`${apiBase}/api/dev-activity/timeline`);
    if (typeFilter !== 'all') url.searchParams.set('type', typeFilter);
    void fetch(url.toString())
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setTimeline((await response.json()) as TimelineEntry[]);
        setError('');
      })
      .catch(() => setError('Impossible de charger la timeline. Démarrez le backend pour connecter vos données.'));
  }, [apiBase, typeFilter]);

  useEffect(() => {
    if (tab !== 'integrations') return;
    void fetch(`${apiBase}/api/dev-activity/integrations`)
      .then(async (response) => (response.ok ? setIntegrations((await response.json()) as IntegrationStatus[]) : undefined))
      .catch(() => setError('Impossible de charger l’état des intégrations.'));
  }, [apiBase, tab]);

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) { setResults([]); return; }
    const response = await fetch(`${apiBase}/api/dev-activity/search?q=${encodeURIComponent(query)}`);
    if (response.ok) setResults((await response.json()) as SearchResult[]);
  }

  async function loadDashboard(event: FormEvent) {
    event.preventDefault();
    if (!member.trim()) return;
    const response = await fetch(`${apiBase}/api/dev-activity/dashboard?member=${encodeURIComponent(member)}`);
    if (response.ok) setDashboard((await response.json()) as PersonalDashboard);
  }

  async function askAssistant(event: FormEvent) {
    event.preventDefault();
    if (!aiPrompt.trim()) return;
    const response = await fetch(`${apiBase}/api/dev-activity/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: aiPrompt }),
    });
    if (response.ok) setAiResponse((await response.json()) as AiStub);
  }

  return (
    <div className="items dev-activity-panel">
      <div className="filters" aria-label="Sous-vues Développement — Activité">
        <button className={tab === 'timeline' ? 'filter active' : 'filter'} type="button" onClick={() => setTab('timeline')}>Historique / timeline</button>
        <button className={tab === 'search' ? 'filter active' : 'filter'} type="button" onClick={() => setTab('search')}>Recherche globale</button>
        <button className={tab === 'integrations' ? 'filter active' : 'filter'} type="button" onClick={() => setTab('integrations')}>Intégrations dev</button>
        <button className={tab === 'dashboard' ? 'filter active' : 'filter'} type="button" onClick={() => setTab('dashboard')}>Dashboard personnel</button>
        <button className={tab === 'ai' ? 'filter active' : 'filter'} type="button" onClick={() => setTab('ai')}>Assistant IA (aperçu)</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {tab === 'timeline' && (
        <div>
          <div className="filters" aria-label="Filtrer la timeline">
            <button className={typeFilter === 'all' ? 'filter active' : 'filter'} type="button" onClick={() => setTypeFilter('all')}>Tout</button>
            <button className={typeFilter === 'item-created' ? 'filter active' : 'filter'} type="button" onClick={() => setTypeFilter('item-created')}>Créations</button>
            <button className={typeFilter === 'item-updated' ? 'filter active' : 'filter'} type="button" onClick={() => setTypeFilter('item-updated')}>Mises à jour</button>
            <button className={typeFilter === 'comment' ? 'filter active' : 'filter'} type="button" onClick={() => setTypeFilter('comment')}>Commentaires</button>
          </div>
          {timeline.length === 0 && <p className="empty">Aucune activité pour ce filtre.</p>}
          {timeline.map((entry) => (
            <article className="item" key={entry.id}>
              <span className="item-title"><strong>{TIMELINE_TYPE_LABEL[entry.type]}</strong> — {entry.summary}</span>
              <span className="integrations">{new Date(entry.occurredAt).toLocaleString('fr-FR')} · {entry.itemType}{entry.devProjectId ? ` · projet ${entry.devProjectId}` : ''}</span>
            </article>
          ))}
        </div>
      )}

      {tab === 'search' && (
        <div>
          <form className="new-item" onSubmit={(event) => void runSearch(event)}>
            <input aria-label="Recherche globale développement" placeholder="Rechercher un projet, une tâche, une doc..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit">Rechercher</button>
          </form>
          {results.length === 0 && <p className="empty">Aucun résultat.</p>}
          {results.map((result) => (
            <article className="item" key={`${result.kind}-${result.id}`}>
              <span className="item-title"><strong>{result.title}</strong></span>
              <span className="integrations">{result.kind} · {result.subtitle}</span>
            </article>
          ))}
        </div>
      )}

      {tab === 'integrations' && (
        <div>
          {integrations.map((integration) => (
            <article className="item" key={integration.id}>
              <span className="item-title"><strong>{integration.label}</strong> <span className={integration.configured ? 'onboarding-badge' : 'type type-note'}>{integration.configured ? 'Configuré' : 'Non configuré'}</span></span>
              <span className="integrations">{integration.detail}</span>
            </article>
          ))}
          {integrations.length === 0 && <p className="empty">Chargement…</p>}
        </div>
      )}

      {tab === 'dashboard' && (
        <div>
          <form className="new-item" onSubmit={(event) => void loadDashboard(event)}>
            <input aria-label="Identifiant membre" placeholder="Membre (ex: owner d'un projet)" value={member} onChange={(event) => setMember(event.target.value)} />
            <button type="submit">Charger mon dashboard</button>
          </form>
          {dashboard && (
            <div>
              <h3>Tâches ouvertes ({dashboard.assignedOpenTasks.length})</h3>
              {dashboard.assignedOpenTasks.map((task) => <article className="item" key={task.id}><span className="item-title">{task.title}</span><span className="integrations">{task.status}</span></article>)}
              <h3>Pipelines en échec ({dashboard.pipelinesFailing.length})</h3>
              {dashboard.pipelinesFailing.map((task) => <article className="item" key={task.id}><span className="item-title">{task.title}</span></article>)}
              <h3>Merge requests à review ({dashboard.mergeRequestsToReview.length})</h3>
              {dashboard.mergeRequestsToReview.map((task) => <article className="item" key={task.id}><span className="item-title">{task.title}</span></article>)}
            </div>
          )}
        </div>
      )}

      {tab === 'ai' && (
        <div>
          <p className="empty">Assistant/agent IA développement : aucune vraie API IA n'est branchée pour ce module. Les réponses ci-dessous sont un aperçu de démonstration, pas une réponse générée par un modèle réel.</p>
          <form className="new-item" onSubmit={(event) => void askAssistant(event)}>
            <input aria-label="Question à l'assistant IA" placeholder="Question sur le projet..." value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} />
            <button type="submit">Demander</button>
          </form>
          {aiResponse && <p className="empty">{aiResponse.message}</p>}
        </div>
      )}
    </div>
  );
}
