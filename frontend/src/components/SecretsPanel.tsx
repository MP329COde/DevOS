import { useEffect, useState, type FormEvent } from 'react';

import { useStrings } from '../i18n/LanguageContext.js';

const strings = {
  fr: {
    vaultNotConfigured: "Vault n'est pas configuré.",
    loadError: 'Impossible de charger les secrets.',
    serverUnreachable: 'Impossible de joindre le serveur.',
    saveError: 'Échec de la sauvegarde du secret.',
    revealError: 'Échec de la révélation du secret.',
    deleteError: 'Échec de la suppression du secret.',
    title: 'Secrets (Vault)',
    loading: 'Chargement des secrets…',
    empty: 'Aucun secret enregistré.',
    hide: 'Masquer',
    reveal: 'Révéler',
    deleteSecret: (name: string) => `Supprimer ${name}`,
    nameLabel: 'Nom du secret',
    namePlaceholder: 'Nom (ex: pve1-root-password)',
    valueLabel: 'Valeur du secret',
    valuePlaceholder: 'Valeur',
    save: 'Enregistrer',
  },
  en: {
    vaultNotConfigured: 'Vault is not configured.',
    loadError: 'Could not load secrets.',
    serverUnreachable: 'Could not reach the server.',
    saveError: 'Failed to save the secret.',
    revealError: 'Failed to reveal the secret.',
    deleteError: 'Failed to delete the secret.',
    title: 'Secrets (Vault)',
    loading: 'Loading secrets…',
    empty: 'No secrets saved.',
    hide: 'Hide',
    reveal: 'Reveal',
    deleteSecret: (name: string) => `Delete ${name}`,
    nameLabel: 'Secret name',
    namePlaceholder: 'Name (e.g.: pve1-root-password)',
    valueLabel: 'Secret value',
    valuePlaceholder: 'Value',
    save: 'Save',
  },
} as const;

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function SecretsPanel() {
  const s = useStrings(strings);
  const [names, setNames] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const load = () => {
    void fetch(`${apiBase()}/api/secrets`, { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 503) { setError(s.vaultNotConfigured); setNames([]); return; }
        if (!response.ok) { setError(s.loadError); return; }
        const body = await response.json();
        setNames(body.names);
      })
      .catch(() => setError(s.serverUnreachable));
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
        credentials: 'include',
        body: JSON.stringify({ value: newValue }),
      });
      if (!response.ok) { setError(s.saveError); return; }
      setNewName('');
      setNewValue('');
      load();
    } catch {
      setError(s.serverUnreachable);
    }
  };

  const reveal = async (name: string) => {
    try {
      const response = await fetch(`${apiBase()}/api/secrets/${encodeURIComponent(name)}/reveal`, { credentials: 'include' });
      if (!response.ok) { setError(s.revealError); return; }
      const body = await response.json();
      setRevealed((current) => ({ ...current, [name]: body.value }));
    } catch {
      setError(s.serverUnreachable);
    }
  };

  const remove = async (name: string) => {
    try {
      const response = await fetch(`${apiBase()}/api/secrets/${encodeURIComponent(name)}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) { setError(s.deleteError); return; }
      setRevealed((current) => { const next = { ...current }; delete next[name]; return next; });
      load();
    } catch {
      setError(s.serverUnreachable);
    }
  };

  return (
    <section className="widget-card secrets-panel">
      <h3>{s.title}</h3>
      {error && <p className="error" role="alert">{error}</p>}
      {names === null && !error && <p className="empty">{s.loading}</p>}
      {names !== null && names.length === 0 && !error && <p className="empty">{s.empty}</p>}
      {names?.map((name) => (
        <article className="item secret-row" key={name}>
          <strong>{name}</strong>
          <span className="secret-value" data-revealed={name in revealed}>
            {name in revealed ? revealed[name] : '••••••••'}
          </span>
          <span className="setting-actions">
            {name in revealed
              ? <button type="button" onClick={() => setRevealed((current) => { const next = { ...current }; delete next[name]; return next; })}>{s.hide}</button>
              : <button type="button" onClick={() => void reveal(name)}>{s.reveal}</button>}
            <button className="delete" type="button" aria-label={s.deleteSecret(name)} onClick={() => void remove(name)}>×</button>
          </span>
        </article>
      ))}
      <form className="new-item secret-form" onSubmit={(event) => void create(event)}>
        <input aria-label={s.nameLabel} placeholder={s.namePlaceholder} value={newName} onChange={(event) => setNewName(event.target.value)} />
        <input aria-label={s.valueLabel} type="password" placeholder={s.valuePlaceholder} value={newValue} onChange={(event) => setNewValue(event.target.value)} />
        <button type="submit">{s.save}</button>
      </form>
    </section>
  );
}
