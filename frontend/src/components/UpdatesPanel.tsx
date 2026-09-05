import { useEffect, useState } from 'react';

import { useStrings } from '../i18n/LanguageContext.js';

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type UpdateMechanism = 'argocd' | 'fallback' | 'none';

interface UpdateStatus {
  current: string;
  latest: string | null;
  status: 'up-to-date' | 'update-available' | 'ahead' | 'unknown';
  mechanism: UpdateMechanism;
  changelog?: { tag: string; title: string | null; releasedAt: string | null } | null;
}

const strings = {
  fr: {
    heading: 'Mises à jour',
    notConfigured: "La vérification de mise à jour n'est pas configurée sur ce backend (GitLab non renseigné).",
    loadFailed: 'Impossible de vérifier les mises à jour.',
    current: (version: string) => `Version actuelle : ${version}`,
    latest: (version: string) => `Dernière version : ${version}`,
    unknown: 'Dernière version inconnue.',
    statusUpToDate: 'À jour ✓',
    statusAvailable: 'Une mise à jour est disponible',
    statusAhead: 'Version locale plus récente que la dernière release',
    changelogHeading: 'Notes de version',
    mechanismNone: "Aucun mécanisme de mise à jour n'est configuré (ArgoCD ou webhook/commande de déploiement). Voir Paramètres → Kubernetes/ArgoCD.",
    mechanismArgocd: 'Mise à jour via synchronisation ArgoCD.',
    mechanismFallback: 'Mise à jour via webhook/commande de déploiement configuré côté serveur.',
    apply: 'Mettre à jour',
    applying: 'Mise à jour en cours…',
    rollback: 'Revenir en arrière',
    rollingBack: 'Retour en arrière…',
    adminOnly: 'Réservé aux administrateurs.',
    applySuccess: 'Mise à jour déclenchée.',
    rollbackSuccess: 'Retour en arrière déclenché.',
    actionFailed: "Échec de l'action.",
  },
  en: {
    heading: 'Updates',
    notConfigured: 'Update checking is not configured on this backend (GitLab not set).',
    loadFailed: 'Unable to check for updates.',
    current: (version: string) => `Current version: ${version}`,
    latest: (version: string) => `Latest version: ${version}`,
    unknown: 'Latest version unknown.',
    statusUpToDate: 'Up to date ✓',
    statusAvailable: 'An update is available',
    statusAhead: 'Local version is newer than the latest release',
    changelogHeading: 'Release notes',
    mechanismNone: 'No update mechanism is configured (ArgoCD or a deploy webhook/command). See Settings → Kubernetes/ArgoCD.',
    mechanismArgocd: 'Update via ArgoCD synchronization.',
    mechanismFallback: 'Update via a server-configured deploy webhook/command.',
    apply: 'Update now',
    applying: 'Updating…',
    rollback: 'Roll back',
    rollingBack: 'Rolling back…',
    adminOnly: 'Admin only.',
    applySuccess: 'Update triggered.',
    rollbackSuccess: 'Rollback triggered.',
    actionFailed: 'Action failed.',
  },
} as const;

export function UpdatesPanel({ isAdmin }: { isAdmin: boolean }) {
  const s = useStrings(strings);
  const [statusData, setStatusData] = useState<UpdateStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'apply' | 'rollback' | null>(null);
  const [message, setMessage] = useState('');
  const [canRollback, setCanRollback] = useState(false);

  function load() {
    void fetch(`${apiBase()}/api/updates/status`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? s.notConfigured : s.loadFailed);
        setStatusData(await response.json());
        setError('');
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(load, []);

  async function apply() {
    setBusy('apply');
    setMessage('');
    try {
      const response = await fetch(`${apiBase()}/api/updates/apply`, { method: 'POST', headers: { 'x-devos-role': 'Admin' } });
      if (!response.ok) throw new Error(s.actionFailed);
      setMessage(s.applySuccess);
      setCanRollback(true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : s.actionFailed);
    } finally {
      setBusy(null);
    }
  }

  async function rollback() {
    setBusy('rollback');
    setMessage('');
    try {
      const response = await fetch(`${apiBase()}/api/updates/rollback`, { method: 'POST', headers: { 'x-devos-role': 'Admin' } });
      if (!response.ok) throw new Error(s.actionFailed);
      setMessage(s.rollbackSuccess);
      setCanRollback(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : s.actionFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="widget-card settings-updates">
      <h3>{s.heading}</h3>
      {error && <p className="error" role="alert">{error}</p>}
      {statusData && (
        <>
          <p>{s.current(statusData.current)}</p>
          <p>{statusData.latest ? s.latest(statusData.latest) : s.unknown}</p>
          {statusData.status === 'up-to-date' && <p className="empty">{s.statusUpToDate}</p>}
          {statusData.status === 'update-available' && <p className="status" role="status">{s.statusAvailable}</p>}
          {statusData.status === 'ahead' && <p className="empty">{s.statusAhead}</p>}
          {statusData.changelog && (
            <div className="changelog">
              <h4 className="settings-subheading">{s.changelogHeading}</h4>
              <p>{statusData.changelog.title ?? statusData.changelog.tag}{statusData.changelog.releasedAt ? ` — ${new Date(statusData.changelog.releasedAt).toLocaleDateString()}` : ''}</p>
            </div>
          )}
          <p className="empty">
            {statusData.mechanism === 'none' ? s.mechanismNone : statusData.mechanism === 'argocd' ? s.mechanismArgocd : s.mechanismFallback}
          </p>
          <div className="filters">
            <button
              type="button"
              disabled={!isAdmin || statusData.mechanism === 'none' || busy !== null || statusData.status !== 'update-available'}
              title={!isAdmin ? s.adminOnly : undefined}
              onClick={() => void apply()}
            >
              {busy === 'apply' ? s.applying : s.apply}
            </button>
            {canRollback && statusData.mechanism === 'argocd' && (
              <button type="button" disabled={!isAdmin || busy !== null} onClick={() => void rollback()}>
                {busy === 'rollback' ? s.rollingBack : s.rollback}
              </button>
            )}
          </div>
          {message && <p className="status" role="status">{message}</p>}
        </>
      )}
    </section>
  );
}
