import { useEffect, useState, type FormEvent } from 'react';

import { useLanguage, useStrings } from '../i18n/LanguageContext.js';

const strings = {
  fr: {
    commentsNotConfigured: 'Commentaires non configurés.',
    cannotLoadComments: 'Impossible de charger les commentaires.',
    commentSendFailed: "Échec de l'envoi du commentaire.",
    detailOf: (title: string) => `Détail de ${title}`,
    closeDetail: 'Fermer le détail',
    status: 'Statut',
    mrStatus: (state: string) => `MR ${state}`,
    ciStatus: (status: string) => ` · CI ${status}`,
    commentsTitle: 'Commentaires',
    commentsTitleWithIssue: (issueIid: number) => `Commentaires — issue GitLab #${issueIid}`,
    notLinkedHint: 'Item non lié à une issue GitLab : les commentaires restent locaux.',
    loading: 'Chargement…',
    noCommentYet: 'Aucun commentaire pour le moment.',
    you: 'Vous',
    propagatedToGitlab: 'Propagé vers GitLab',
    newComment: 'Nouveau commentaire',
    commentPlaceholderLinked: 'Écrire un commentaire (propagé vers GitLab)…',
    commentPlaceholder: 'Écrire un commentaire…',
    sending: 'Envoi…',
    send: 'Envoyer',
  },
  en: {
    commentsNotConfigured: 'Comments not configured.',
    cannotLoadComments: 'Could not load comments.',
    commentSendFailed: 'Failed to send the comment.',
    detailOf: (title: string) => `Details for ${title}`,
    closeDetail: 'Close details',
    status: 'Status',
    mrStatus: (state: string) => `MR ${state}`,
    ciStatus: (status: string) => ` · CI ${status}`,
    commentsTitle: 'Comments',
    commentsTitleWithIssue: (issueIid: number) => `Comments — GitLab issue #${issueIid}`,
    notLinkedHint: 'Item not linked to a GitLab issue: comments stay local.',
    loading: 'Loading…',
    noCommentYet: 'No comments yet.',
    you: 'You',
    propagatedToGitlab: 'Propagated to GitLab',
    newComment: 'New comment',
    commentPlaceholderLinked: 'Write a comment (propagated to GitLab)…',
    commentPlaceholder: 'Write a comment…',
    sending: 'Sending…',
    send: 'Send',
  },
} as const;

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
  const s = useStrings(strings);
  const { language } = useLanguage();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
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
        if (response.status === 503) { setCommentsError(s.commentsNotConfigured); return []; }
        if (!response.ok) throw new Error('load-failed');
        return response.json();
      })
      .then((data) => { if (!cancelled) setComments(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setCommentsError(s.cannotLoadComments); })
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
      setCommentsError(s.commentSendFailed);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="detail-overlay" role="dialog" aria-modal="true" aria-label={s.detailOf(item.title)} onClick={onClose}>
      <div className="detail-panel" onClick={(event) => event.stopPropagation()}>
        <header className="detail-header">
          <h2>{item.title}</h2>
          <button type="button" className="detail-close" aria-label={s.closeDetail} onClick={onClose}>×</button>
        </header>

        <div className="detail-body">
          <label className="detail-field">
            <span>{s.status}</span>
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
              {item.mergeRequestState && s.mrStatus(item.mergeRequestState)}
              {item.pipelineStatus && s.ciStatus(item.pipelineStatus)}
            </p>
          )}

          <section className="detail-comments">
            <h3>{linkedIssue ? s.commentsTitleWithIssue(linkedIssue.issueIid) : s.commentsTitle}</h3>
            {!linkedIssue && <p className="hint">{s.notLinkedHint}</p>}
            {commentsLoading && <p className="empty">{s.loading}</p>}
            {commentsError && <p className="empty">{commentsError}</p>}
            {!commentsLoading && !commentsError && comments.length === 0 && <p className="empty">{s.noCommentYet}</p>}
            <ul className="comment-list">
              {comments.map((comment) => (
                <li className="comment-entry" key={comment.id}>
                  <div className="comment-meta">
                    <span>{comment.author ?? s.you}</span>
                    <span>{new Date(comment.createdAt).toLocaleString(locale)}</span>
                    {comment.propagatedToGitlab && <span className="comment-synced" title={s.propagatedToGitlab}>GitLab ✓</span>}
                  </div>
                  <p>{comment.body}</p>
                </li>
              ))}
            </ul>
            <form className="comment-form" onSubmit={postComment}>
              <textarea
                aria-label={s.newComment}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={linkedIssue ? s.commentPlaceholderLinked : s.commentPlaceholder}
                rows={3}
              />
              <button type="submit" className="filter" disabled={posting || !draft.trim()}>{posting ? s.sending : s.send}</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
