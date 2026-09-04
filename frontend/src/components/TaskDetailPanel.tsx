import { useEffect, useState, type FormEvent } from 'react';

export interface TaskDetailItem {
  id: string;
  title: string;
  type: string;
  status: string;
  mergeRequestState?: string | null;
  pipelineStatus?: string | null;
  gitlabLinks?: Array<{ gitlabProjectId: string; issueIid: number }>;
}

export interface TaskComment {
  id: string;
  body: string;
  author?: string | null;
  propagatedToGitlab: boolean;
  createdAt: string;
}

const STATUS_OPTIONS = ['backlog', 'in_progress', 'done', 'blocked'];

/**
 * Détail d'une tâche accessible depuis n'importe quel panel (Aujourd'hui, Items) : contrôle du
 * statut sans changer de panel, et — quand l'item est lié à une issue GitLab — historique des
 * commentaires avec possibilité d'en ajouter un, propagé vers GitLab côté serveur.
 */
export function TaskDetailPanel({
  item,
  apiBase,
  onClose,
  onStatusChange,
}: {
  item: TaskDetailItem;
  apiBase: string;
  onClose: () => void;
  onStatusChange: (item: { id: string }, nextStatus: string) => void;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsError, setCommentsError] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const linkedIssue = item.gitlabLinks?.[0];

  useEffect(() => {
    let cancelled = false;
    setCommentsLoading(true);
    setCommentsError('');
    fetch(`${apiBase}/api/items/${item.id}/comments`)
      .then((response) => {
        if (response.status === 503) { setCommentsError('Commentaires non configurés.'); return []; }
        if (!response.ok) throw new Error('load-failed');
        return response.json();
      })
      .then((data) => { if (!cancelled) setComments(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setCommentsError('Impossible de charger les commentaires.'); })
      .finally(() => { if (!cancelled) setCommentsLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, item.id]);

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setCommentsError('');
    try {
      const response = await fetch(`${apiBase}/api/items/${item.id}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) throw new Error('post-failed');
      const created = await response.json();
      setComments((current) => [...current, created]);
      setDraft('');
    } catch {
      setCommentsError("Échec de l'envoi du commentaire.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="detail-overlay" role="dialog" aria-modal="true" aria-label={`Détail de ${item.title}`} onClick={onClose}>
      <div className="detail-panel" onClick={(event) => event.stopPropagation()}>
        <header className="detail-header">
          <h2>{item.title}</h2>
          <button type="button" className="detail-close" aria-label="Fermer le détail" onClick={onClose}>×</button>
        </header>

        <div className="detail-body">
          <label className="detail-field">
            <span>Statut</span>
            <select
              className="item-status"
              value={item.status}
              onChange={(event) => onStatusChange(item, event.target.value)}
            >
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>

          {(item.mergeRequestState || item.pipelineStatus) && (
            <p className="integrations">
              {item.mergeRequestState && `MR ${item.mergeRequestState}`}
              {item.pipelineStatus && ` · CI ${item.pipelineStatus}`}
            </p>
          )}

          <section className="detail-comments">
            <h3>Commentaires{linkedIssue ? ` — issue GitLab #${linkedIssue.issueIid}` : ''}</h3>
            {!linkedIssue && <p className="hint">Item non lié à une issue GitLab : les commentaires restent locaux.</p>}
            {commentsLoading && <p className="empty">Chargement…</p>}
            {commentsError && <p className="empty">{commentsError}</p>}
            {!commentsLoading && !commentsError && comments.length === 0 && <p className="empty">Aucun commentaire pour le moment.</p>}
            <ul className="comment-list">
              {comments.map((comment) => (
                <li className="comment-entry" key={comment.id}>
                  <div className="comment-meta">
                    <span>{comment.author ?? 'Vous'}</span>
                    <span>{new Date(comment.createdAt).toLocaleString('fr-FR')}</span>
                    {comment.propagatedToGitlab && <span className="comment-synced" title="Propagé vers GitLab">GitLab ✓</span>}
                  </div>
                  <p>{comment.body}</p>
                </li>
              ))}
            </ul>
            <form className="comment-form" onSubmit={postComment}>
              <textarea
                aria-label="Nouveau commentaire"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={linkedIssue ? 'Écrire un commentaire (propagé vers GitLab)…' : 'Écrire un commentaire…'}
                rows={3}
              />
              <button type="submit" className="filter" disabled={posting || !draft.trim()}>{posting ? 'Envoi…' : 'Envoyer'}</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
