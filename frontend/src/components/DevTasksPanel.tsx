import { useEffect, useState, type FormEvent } from 'react';

export interface Bug {
  id: string;
  title: string;
  description?: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  environment?: string | null;
  versionAffected?: string | null;
  expectedBehavior?: string | null;
  observedBehavior?: string | null;
  reproSteps?: string | null;
  logs?: string | null;
  screenshots: string[];
  releaseRef?: string | null;
  commitRef?: string | null;
  createdAt: string;
}

interface WorkflowStatus {
  id: string;
  scope?: string | null;
  key: string;
  label: string;
  color?: string | null;
  order: number;
  isDefault: boolean;
  isFinal: boolean;
}

const SEVERITIES: Bug['severity'][] = ['low', 'medium', 'high', 'critical'];
const SEVERITY_LABELS: Record<Bug['severity'], string> = { low: 'Faible', medium: 'Moyenne', high: 'Haute', critical: 'Critique' };

const SUB_TABS = ['bugs', 'workflow'] as const;
type SubTab = (typeof SUB_TABS)[number];
const SUB_TAB_LABELS: Record<SubTab, string> = { bugs: 'Bugs', workflow: 'Workflow de statuts' };

/**
 * Sous-vue "Tâches & bugs" du module Développement (section AM.5 de TODO-refonte-2.md).
 *
 * TODO(AM.1/AM.5 rattachement) : ce composant est monté comme onglet `tasks` directement dans
 * `DevelopmentPanel` (panel racine "Développement" désormais disponible, section AM.1). Reste à
 * faire : filtrer les bugs/workflow par projet sélectionné une fois la sélection de projet
 * partagée entre onglets (actuellement chaque onglet gère son scope indépendamment).
 */
export function DevTasksPanel({ apiBase, devProjectId }: { apiBase: string; devProjectId?: string | null }) {
  const [subTab, setSubTab] = useState<SubTab>('bugs');

  return (
    <div className="items dev-tasks-panel">
      <nav className="views" aria-label="Sous-vues Tâches & bugs">
        {SUB_TABS.map((value) => (
          <button key={value} className={subTab === value ? 'filter active' : 'filter'} type="button" onClick={() => setSubTab(value)}>
            {SUB_TAB_LABELS[value]}
          </button>
        ))}
      </nav>
      {subTab === 'bugs' ? <BugsTab apiBase={apiBase} devProjectId={devProjectId} /> : <WorkflowTab apiBase={apiBase} devProjectId={devProjectId} />}
    </div>
  );
}

function BugsTab({ apiBase, devProjectId }: { apiBase: string; devProjectId?: string | null }) {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Bug['severity']>('medium');
  const [environment, setEnvironment] = useState('');
  const [versionAffected, setVersionAffected] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [observedBehavior, setObservedBehavior] = useState('');
  const [reproSteps, setReproSteps] = useState('');
  const [logs, setLogs] = useState('');

  const load = () => {
    const query = devProjectId ? `?devProjectId=${encodeURIComponent(devProjectId)}` : '';
    void fetch(`${apiBase}/api/bugs${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setBugs(await response.json());
        setError('');
      })
      .catch(() => setError('Impossible de charger les bugs. Démarrez le backend pour connecter vos données.'));
  };

  useEffect(load, [apiBase, devProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    void fetch(`${apiBase}/api/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        severity,
        environment: environment || undefined,
        versionAffected: versionAffected || undefined,
        expectedBehavior: expectedBehavior || undefined,
        observedBehavior: observedBehavior || undefined,
        reproSteps: reproSteps || undefined,
        logs: logs || undefined,
        devProjectId: devProjectId || undefined,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setTitle(''); setEnvironment(''); setVersionAffected(''); setExpectedBehavior(''); setObservedBehavior(''); setReproSteps(''); setLogs(''); setSeverity('medium');
        setShowForm(false);
        load();
      })
      .catch(() => setError('Impossible de créer le bug.'));
  }

  function updateStatus(id: string, status: string) {
    void fetch(`${apiBase}/api/bugs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(load).catch(() => setError('Impossible de mettre à jour le bug.'));
  }

  return (
    <div className="dev-bugs">
      {error && <p className="error">{error}</p>}
      <div className="dev-bugs-toolbar">
        <button type="button" className="filter" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Annuler' : 'Nouveau bug'}
        </button>
      </div>

      {showForm && (
        <form className="dev-bug-form" onSubmit={submit}>
          <label>
            Titre
            <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={300} />
          </label>
          <label>
            Gravité
            <select value={severity} onChange={(event) => setSeverity(event.target.value as Bug['severity'])}>
              {SEVERITIES.map((value) => <option key={value} value={value}>{SEVERITY_LABELS[value]}</option>)}
            </select>
          </label>
          <label>
            Environnement
            <input value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="prod, staging..." />
          </label>
          <label>
            Version concernée
            <input value={versionAffected} onChange={(event) => setVersionAffected(event.target.value)} placeholder="v1.4.0" />
          </label>
          <label>
            Comportement attendu
            <textarea value={expectedBehavior} onChange={(event) => setExpectedBehavior(event.target.value)} />
          </label>
          <label>
            Comportement observé
            <textarea value={observedBehavior} onChange={(event) => setObservedBehavior(event.target.value)} />
          </label>
          <label>
            Étapes de reproduction
            <textarea value={reproSteps} onChange={(event) => setReproSteps(event.target.value)} placeholder="1. ...&#10;2. ..." />
          </label>
          <label>
            Logs
            <textarea value={logs} onChange={(event) => setLogs(event.target.value)} />
          </label>
          <button type="submit" className="filter active">Créer le bug</button>
        </form>
      )}

      <ul className="dev-bug-list">
        {bugs.map((bug) => (
          <li key={bug.id} className={`dev-bug-item severity-${bug.severity}`}>
            <div className="dev-bug-item-header">
              <strong>{bug.title}</strong>
              <span className={`badge severity-${bug.severity}`}>{SEVERITY_LABELS[bug.severity]}</span>
            </div>
            <div className="dev-bug-item-meta">
              {bug.environment && <span>Env : {bug.environment}</span>}
              {bug.versionAffected && <span>Version : {bug.versionAffected}</span>}
              <select value={bug.status} onChange={(event) => updateStatus(bug.id, event.target.value)}>
                {['open', 'confirmed', 'in_progress', 'resolved', 'closed', 'wont_fix'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            {bug.reproSteps && <pre className="dev-bug-repro">{bug.reproSteps}</pre>}
          </li>
        ))}
        {bugs.length === 0 && !error && <li className="empty">Aucun bug enregistré.</li>}
      </ul>
    </div>
  );
}

function WorkflowTab({ apiBase, devProjectId }: { apiBase: string; devProjectId?: string | null }) {
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [isFinal, setIsFinal] = useState(false);

  const load = () => {
    const query = devProjectId ? `?scope=${encodeURIComponent(devProjectId)}` : '';
    void fetch(`${apiBase}/api/workflow-statuses/resolve${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setStatuses(await response.json());
        setError('');
      })
      .catch(() => setError('Impossible de charger le workflow. Démarrez le backend pour connecter vos données.'));
  };

  useEffect(load, [apiBase, devProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!key.trim() || !label.trim()) return;
    void fetch(`${apiBase}/api/workflow-statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, label, isFinal, order: statuses.length, scope: devProjectId || undefined }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setKey(''); setLabel(''); setIsFinal(false);
        load();
      })
      .catch(() => setError('Impossible de créer ce statut.'));
  }

  function remove(id: string) {
    void fetch(`${apiBase}/api/workflow-statuses/${id}`, { method: 'DELETE' }).then(load).catch(() => setError('Impossible de supprimer ce statut.'));
  }

  return (
    <div className="dev-workflow">
      {error && <p className="error">{error}</p>}
      <p className="hint">
        {devProjectId ? 'Workflow spécifique à ce projet (ou repli sur le workflow global si aucun statut n\'est défini ici).' : 'Workflow global par défaut, utilisé par tout projet sans workflow propre.'}
      </p>
      <ol className="dev-workflow-list">
        {statuses.map((status) => (
          <li key={status.id}>
            <span>{status.label}</span>
            <code>{status.key}</code>
            {status.isFinal && <span className="badge">terminal</span>}
            <button type="button" className="filter" onClick={() => remove(status.id)}>Supprimer</button>
          </li>
        ))}
        {statuses.length === 0 && !error && <li className="empty">Aucun statut configuré.</li>}
      </ol>
      <form className="dev-workflow-form" onSubmit={submit}>
        <label>
          Clé
          <input value={key} onChange={(event) => setKey(event.target.value)} placeholder="in_review" required />
        </label>
        <label>
          Libellé
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="En revue" required />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={isFinal} onChange={(event) => setIsFinal(event.target.checked)} />
          Statut terminal
        </label>
        <button type="submit" className="filter active">Ajouter le statut</button>
      </form>
    </div>
  );
}
