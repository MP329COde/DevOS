import { useEffect, useState, type FormEvent } from 'react';

export interface NoteItem {
  id: string;
  title: string;
  content?: string | null;
  createdAt?: string;
}

/**
 * Panel "Notes" indépendant : notes libres + todo-list externe (`ItemType.note`), jamais
 * rattachées à un projet (pas de `parentId` vers un epic/story) et jamais mélangées aux items
 * de type task/doc/goal des autres panels — ce composant interroge `/api/items` et filtre
 * localement sur `type === 'note'`, sans jamais écrire une note dans les listes des autres vues.
 */
export function NotesPanel({ apiBase }: { apiBase: string }) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');

  const load = () => {
    void fetch(`${apiBase}/api/items`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const all = (await response.json()) as NoteItem[] & Array<{ type: string }>;
        setNotes((all as unknown as Array<NoteItem & { type: string }>).filter((entry) => entry.type === 'note'));
        setError('');
      })
      .catch(() => setError('Impossible de charger les notes. Démarrez le backend pour connecter vos données.'));
  };

  useEffect(load, [apiBase]);

  async function createNote(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const response = await fetch(`${apiBase}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'note', title: title.trim(), ...(content.trim() ? { content } : {}) }),
    });
    if (!response.ok) { setError('La création de la note a échoué.'); return; }
    const created = await response.json();
    setNotes((current) => [created, ...current]);
    setTitle('');
    setContent('');
  }

  async function saveContent(id: string, nextContent: string) {
    const response = await fetch(`${apiBase}/api/items/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: nextContent }),
    });
    if (!response.ok) { setError('La mise à jour de la note a échoué.'); return; }
    const updated = await response.json();
    setNotes((current) => current.map((note) => (note.id === id ? { ...note, content: updated.content } : note)));
  }

  async function deleteNote(id: string) {
    const response = await fetch(`${apiBase}/api/items/${id}`, { method: 'DELETE' });
    if (response.ok) setNotes((current) => current.filter((note) => note.id !== id));
  }

  function toggleCheckbox(note: NoteItem, lineIndex: number) {
    const lines = (note.content ?? '').split('\n');
    const line = lines[lineIndex];
    if (/^\s*-\s\[ \]/.test(line)) lines[lineIndex] = line.replace('[ ]', '[x]');
    else if (/^\s*-\s\[x\]/i.test(line)) lines[lineIndex] = line.replace(/\[x\]/i, '[ ]');
    else return;
    const nextContent = lines.join('\n');
    void saveContent(note.id, nextContent);
  }

  return (
    <div className="items notes-panel">
      <p className="empty">Notes libres et todo-lists personnelles, indépendantes des projets — jamais mélangées aux tâches.</p>
      <form className="new-item" onSubmit={(event) => void createNote(event)}>
        <input aria-label="Titre de la note" placeholder="Titre de la note" value={title} onChange={(event) => setTitle(event.target.value)} />
        <button type="submit">Créer une note</button>
      </form>
      <textarea
        className="doc-editor"
        aria-label="Contenu de la nouvelle note"
        placeholder={'Contenu Markdown (ex : - [ ] Acheter du café)'}
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      {error && <p className="error" role="alert">{error}</p>}
      {!error && notes.length === 0 && <p className="empty">Aucune note pour l'instant.</p>}
      <div className="notes-list">
        {notes.map((note) => {
          const lines = (note.content ?? '').split('\n').filter((line) => line.length > 0);
          const isExpanded = expandedId === note.id;
          return (
            <article className="item note-card" key={note.id}>
              <span className="item-title"><strong>{note.title}</strong></span>
              <div className="note-body">
                {lines.map((line, index) => {
                  const checkboxMatch = line.match(/^\s*-\s\[( |x|X)\]\s?(.*)$/);
                  if (checkboxMatch) {
                    const checked = checkboxMatch[1].toLowerCase() === 'x';
                    return (
                      <label className="note-checkbox" key={index}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCheckbox(note, index)} />
                        <span>{checkboxMatch[2]}</span>
                      </label>
                    );
                  }
                  return <p className="empty" key={index}>{line}</p>;
                })}
                {lines.length === 0 && <p className="empty">Note vide.</p>}
              </div>
              <span className="item-actions">
                <button type="button" onClick={() => { setExpandedId(isExpanded ? null : note.id); setDraftContent(note.content ?? ''); }}>
                  {isExpanded ? 'Fermer l\'édition' : 'Éditer'}
                </button>
                <button className="delete" type="button" aria-label={`Supprimer ${note.title}`} onClick={() => void deleteNote(note.id)}>×</button>
              </span>
              {isExpanded && (
                <div className="note-edit">
                  <textarea
                    className="doc-editor"
                    aria-label={`Contenu de ${note.title}`}
                    value={draftContent}
                    onChange={(event) => setDraftContent(event.target.value)}
                  />
                  <button type="button" onClick={() => { void saveContent(note.id, draftContent); setExpandedId(null); }}>Enregistrer</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
