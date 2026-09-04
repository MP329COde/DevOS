import { useEffect, useState, type FormEvent } from 'react';

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function SecretsPanel() {
  const [names, setNames] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const load = () => {
    void fetch(`${apiBase()}/api/secrets`)
      .then(async (response) => {
        if (response.status === 503) { setError('Vault n\'est pas configuré.'); setNames([]); return; }
        if (!response.ok) { setError('Impossible de charger les secrets.'); return; }
        const body = await response.json();
        setNames(body.names);
      })
      .catch(() => setError('Impossible de joindre le serveur.'));
  };

  useEffect(load, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim() || !newValue) return;
    setError('');
    try {
      const response = await fetch(`${apiBase()}/api/secrets/${encodeURIComponent(newName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue }),
      });
      if (!response.ok) { setError('Échec de la sauvegarde du secret.'); return; }
      setNewName('');
      setNewValue('');
      load();
    } catch {
      setError('Impossible de joindre le serveur.');
    }
  };

  const reveal = async (name: string) => {
    try {
      const response = await fetch(`${apiBase()}/api/secrets/${encodeURIComponent(name)}/reveal`);
      if (!response.ok) { setError('Échec de la révélation du secret.'); return; }
      const body = await response.json();
      setRevealed((current) => ({ ...current, [name]: body.value }));
    } catch {
      setError('Impossible de joindre le serveur.');
    }
  };

  const remove = async (name: string) => {
    try {
      const response = await fetch(`${apiBase()}/api/secrets/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!response.ok) { setError('Échec de la suppression du secret.'); return; }
      setRevealed((current) => { const next = { ...current }; delete next[name]; return next; });
      load();
    } catch {
      setError('Impossible de joindre le serveur.');
    }
  };

  return (
    <section className="widget-card secrets-panel">
      <h3>Secrets (Vault)</h3>
      {error && <p className="error" role="alert">{error}</p>}
      {names === null && !error && <p className="empty">Chargement des secrets…</p>}
      {names !== null && names.length === 0 && !error && <p className="empty">Aucun secret enregistré.</p>}
      {names?.map((name) => (
        <article className="item secret-row" key={name}>
          <strong>{name}</strong>
          <span className="secret-value" data-revealed={name in revealed}>
            {name in revealed ? revealed[name] : '••••••••'}
          </span>
          <span className="setting-actions">
            {name in revealed
              ? <button type="button" onClick={() => setRevealed((current) => { const next = { ...current }; delete next[name]; return next; })}>Masquer</button>
              : <button type="button" onClick={() => void reveal(name)}>Révéler</button>}
            <button className="delete" type="button" aria-label={`Supprimer ${name}`} onClick={() => void remove(name)}>×</button>
          </span>
        </article>
      ))}
      <form className="new-item secret-form" onSubmit={(event) => void create(event)}>
        <input aria-label="Nom du secret" placeholder="Nom (ex: pve1-root-password)" value={newName} onChange={(event) => setNewName(event.target.value)} />
        <input aria-label="Valeur du secret" type="password" placeholder="Valeur" value={newValue} onChange={(event) => setNewValue(event.target.value)} />
        <button type="submit">Enregistrer</button>
      </form>
    </section>
  );
}
