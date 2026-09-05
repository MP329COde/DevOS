import { useEffect, useState, type FormEvent } from 'react';

import { useStrings } from '../i18n/LanguageContext.js';

const strings = {
  fr: {
    loadError: 'Impossible de charger le workflow. Démarrez le backend pour connecter vos données.',
    createError: 'Impossible de créer ce statut.',
    deleteError: 'Impossible de supprimer ce statut.',
    hintScoped: "Workflow spécifique à ce projet (ou repli sur le workflow global si aucun statut n'est défini ici).",
    hintGlobal: 'Workflow global par défaut, utilisé par tout projet sans workflow propre.',
    terminal: 'terminal',
    delete: 'Supprimer',
    empty: 'Aucun statut configuré.',
    keyLabel: 'Clé',
    labelLabel: 'Libellé',
    labelPlaceholder: 'En revue',
    finalStatus: 'Statut terminal',
    addStatus: 'Ajouter le statut',
  },
  en: {
    loadError: 'Could not load the workflow. Start the backend to connect your data.',
    createError: 'Could not create this status.',
    deleteError: 'Could not delete this status.',
    hintScoped: 'Workflow specific to this project (falls back to the global workflow if no status is defined here).',
    hintGlobal: 'Default global workflow, used by any project without its own workflow.',
    terminal: 'final',
    delete: 'Delete',
    empty: 'No status configured.',
    keyLabel: 'Key',
    labelLabel: 'Label',
    labelPlaceholder: 'In review',
    finalStatus: 'Final status',
    addStatus: 'Add status',
  },
} as const;

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

/**
 * Sous-vue "Workflow" du module Développement. Les bugs ne vivent plus ici : ils sont
 * un type d'Item (`bug`) parmi d'autres, visibles et filtrables depuis le panel Travail.
 */
export function DevTasksPanel({ apiBase, devProjectId }: { apiBase: string; devProjectId?: string | null }) {
  const s = useStrings(strings);
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
      .catch(() => setError(s.loadError));
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
      .catch(() => setError(s.createError));
  }

  function remove(id: string) {
    void fetch(`${apiBase}/api/workflow-statuses/${id}`, { method: 'DELETE' }).then(load).catch(() => setError(s.deleteError));
  }

  return (
    <div className="items dev-tasks-panel dev-workflow">
      {error && <p className="error">{error}</p>}
      <p className="hint">
        {devProjectId ? s.hintScoped : s.hintGlobal}
      </p>
      <ol className="dev-workflow-list">
        {statuses.map((status) => (
          <li key={status.id}>
            <span>{status.label}</span>
            <code>{status.key}</code>
            {status.isFinal && <span className="badge">{s.terminal}</span>}
            <button type="button" className="filter" onClick={() => remove(status.id)}>{s.delete}</button>
          </li>
        ))}
        {statuses.length === 0 && !error && <li className="empty">{s.empty}</li>}
      </ol>
      <form className="dev-workflow-form" onSubmit={submit}>
        <label>
          {s.keyLabel}
          <input value={key} onChange={(event) => setKey(event.target.value)} placeholder="in_review" required />
        </label>
        <label>
          {s.labelLabel}
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder={s.labelPlaceholder} required />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={isFinal} onChange={(event) => setIsFinal(event.target.checked)} />
          {s.finalStatus}
        </label>
        <button type="submit" className="filter active">{s.addStatus}</button>
      </form>
    </div>
  );
}
