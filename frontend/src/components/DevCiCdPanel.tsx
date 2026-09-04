import { useState } from 'react';

// Sous-vue "CI/CD & sécurité" du module Développement (onglet `cicd` de DevelopmentPanel.tsx).
// TODO(AM.7/AM.4) : les identifiants (projet GitLab, application ArgoCD, projet/dépôt Harbor)
// sont saisis manuellement ici car le modèle "Projet" (AM.1) n'a pas encore de champs dédiés
// pour ces références externes. Une fois AM.4 (dépôts Git centralisés par projet) en place,
// préremplir/masquer ces champs à partir du projet sélectionné plutôt que d'une saisie libre.

interface GitLabPipelineDetail {
  id: number;
  status: string;
  ref: string;
  sha: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
  durationSeconds: number | null;
  authorName: string | null;
  commitTitle: string | null;
}

interface GitLabPipelineJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  durationSeconds: number | null;
  webUrl: string;
  hasArtifacts: boolean;
}

interface ArgoSyncEntry {
  id: number;
  revision: string;
  deployedAt: string;
}

interface TrivySummary {
  scanStatus: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

type SubView = 'cicd' | 'deployments' | 'tests' | 'quality';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}min ${Math.round(seconds % 60)}s`;
}

function statusBadgeClass(status: string): string {
  const ok = ['success', 'passed', 'Synced', 'Healthy'];
  const bad = ['failed', 'canceled', 'error'];
  if (ok.includes(status)) return 'status-badge status-badge-ok';
  if (bad.includes(status)) return 'status-badge status-badge-off';
  return 'status-badge';
}

async function fetchJson<T>(url: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url);
    if (response.status === 503) return { data: null, error: 'Non disponible — aucune intégration configurée.' };
    if (response.status === 404) return { data: null, error: 'Aucune donnée disponible pour cette référence.' };
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { data: null, error: (body as { error?: string }).error ?? `Erreur (${response.status})` };
    }
    return { data: (await response.json()) as T, error: null };
  } catch {
    return { data: null, error: 'Impossible de contacter le backend.' };
  }
}

/**
 * Panel CI/CD, déploiements, tests, qualité/sécurité par projet (AM.7). Réutilise les intégrations
 * déjà branchées côté backend (GitLab pipelines, ArgoCD sync history, Harbor/Trivy) via /api/dev-cicd.
 * Tests unitaires/intégration/e2e et qualité de code (lint/complexité/duplication) n'ont pas encore
 * de source réelle branchée : affichés en placeholder explicite plutôt qu'inventés.
 */
export function DevCiCdPanel({ apiBase }: { apiBase: string }) {
  const [subView, setSubView] = useState<SubView>('cicd');
  const [projectId, setProjectId] = useState('');
  const [appName, setAppName] = useState('');
  const [harborProject, setHarborProject] = useState('');
  const [harborRepo, setHarborRepo] = useState('');
  const [harborTag, setHarborTag] = useState('latest');

  const [pipelines, setPipelines] = useState<GitLabPipelineDetail[]>([]);
  const [pipelinesError, setPipelinesError] = useState('');
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<number | null>(null);
  const [jobs, setJobs] = useState<GitLabPipelineJob[]>([]);
  const [jobsError, setJobsError] = useState('');
  const [jobLog, setJobLog] = useState<{ jobId: number; text: string } | null>(null);
  const [retryError, setRetryError] = useState('');
  const [retrying, setRetrying] = useState(false);

  const [deployments, setDeployments] = useState<ArgoSyncEntry[]>([]);
  const [deploymentsError, setDeploymentsError] = useState('');
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);

  const [security, setSecurity] = useState<TrivySummary | null>(null);
  const [securityError, setSecurityError] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);

  async function loadPipelines() {
    if (!projectId.trim()) return;
    setPipelinesLoading(true);
    setPipelinesError('');
    setSelectedPipeline(null);
    setJobs([]);
    const { data, error } = await fetchJson<GitLabPipelineDetail[]>(`${apiBase}/api/dev-cicd/${encodeURIComponent(projectId.trim())}/pipelines`);
    setPipelines(data ?? []);
    setPipelinesError(error ?? '');
    setPipelinesLoading(false);
  }

  async function loadJobs(pipelineId: number) {
    setSelectedPipeline(pipelineId);
    setJobLog(null);
    setJobsError('');
    const { data, error } = await fetchJson<GitLabPipelineJob[]>(`${apiBase}/api/dev-cicd/${encodeURIComponent(projectId.trim())}/pipelines/${pipelineId}/jobs`);
    setJobs(data ?? []);
    setJobsError(error ?? '');
  }

  async function loadJobLog(jobId: number) {
    const { data, error } = await fetchJson<{ log: string }>(`${apiBase}/api/dev-cicd/${encodeURIComponent(projectId.trim())}/jobs/${jobId}/log`);
    setJobLog({ jobId, text: data?.log ?? error ?? '' });
  }

  async function relancePipeline(pipelineId: number) {
    setRetrying(true);
    setRetryError('');
    try {
      const response = await fetch(`${apiBase}/api/dev-cicd/${encodeURIComponent(projectId.trim())}/pipelines/${pipelineId}/retry`, { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'La relance a échoué.');
      }
      await loadPipelines();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'La relance a échoué.');
    } finally {
      setRetrying(false);
    }
  }

  async function loadDeployments() {
    if (!appName.trim()) return;
    setDeploymentsLoading(true);
    setDeploymentsError('');
    const { data, error } = await fetchJson<ArgoSyncEntry[]>(`${apiBase}/api/dev-cicd/deployments/${encodeURIComponent(appName.trim())}`);
    setDeployments(data ?? []);
    setDeploymentsError(error ?? '');
    setDeploymentsLoading(false);
  }

  async function loadSecurity() {
    if (!harborProject.trim() || !harborRepo.trim() || !harborTag.trim()) return;
    setSecurityLoading(true);
    setSecurityError('');
    const { data, error } = await fetchJson<TrivySummary>(
      `${apiBase}/api/dev-cicd/security/${encodeURIComponent(harborProject.trim())}/${encodeURIComponent(harborRepo.trim())}/${encodeURIComponent(harborTag.trim())}`,
    );
    setSecurity(data);
    setSecurityError(error ?? '');
    setSecurityLoading(false);
  }

  return (
    <div className="items dev-cicd-panel">
      <div className="filters" aria-label="Sous-vues CI/CD">
        <button className={subView === 'cicd' ? 'filter active' : 'filter'} type="button" onClick={() => setSubView('cicd')}>CI/CD</button>
        <button className={subView === 'deployments' ? 'filter active' : 'filter'} type="button" onClick={() => setSubView('deployments')}>Déploiements</button>
        <button className={subView === 'tests' ? 'filter active' : 'filter'} type="button" onClick={() => setSubView('tests')}>Tests</button>
        <button className={subView === 'quality' ? 'filter active' : 'filter'} type="button" onClick={() => setSubView('quality')}>Qualité &amp; sécurité</button>
      </div>

      {subView === 'cicd' && (
        <section className="view-group dev-cicd-pipelines">
          <h3>Pipelines récentes</h3>
          <form className="new-item" onSubmit={(event) => { event.preventDefault(); void loadPipelines(); }}>
            <input aria-label="Identifiant projet GitLab" placeholder="Identifiant projet GitLab (ex: groupe/projet)" value={projectId} onChange={(event) => setProjectId(event.target.value)} required />
            <button type="submit" disabled={pipelinesLoading}>{pipelinesLoading ? 'Chargement…' : 'Charger'}</button>
          </form>
          {pipelinesError && <p className="empty">{pipelinesError}</p>}
          {!pipelinesError && pipelines.length === 0 && !pipelinesLoading && <p className="empty">Renseignez un projet GitLab pour afficher ses pipelines.</p>}
          {pipelines.map((pipeline) => (
            <article className="item dev-pipeline" key={pipeline.id}>
              <span className="item-title">
                <span className={statusBadgeClass(pipeline.status)}>{pipeline.status}</span>
                <strong>#{pipeline.id}</strong> · {pipeline.ref} · {pipeline.sha.slice(0, 8)}
              </span>
              <span className="integrations">
                {pipeline.commitTitle ?? '(sans titre de commit)'} — {pipeline.authorName ?? 'auteur inconnu'} · {new Date(pipeline.createdAt).toLocaleString('fr-FR')} · durée {formatDuration(pipeline.durationSeconds)}
              </span>
              <span className="item-actions">
                <button type="button" className="filter" onClick={() => void loadJobs(pipeline.id)}>Étapes</button>
                <button type="button" className="filter" disabled={retrying} onClick={() => void relancePipeline(pipeline.id)}>Relancer</button>
                <a className="filter" href={pipeline.webUrl} target="_blank" rel="noreferrer">Ouvrir dans GitLab</a>
              </span>
            </article>
          ))}
          {retryError && <p className="error" role="alert">{retryError}</p>}

          {selectedPipeline !== null && (
            <section className="view-group dev-pipeline-jobs">
              <h3>Étapes de la pipeline #{selectedPipeline}</h3>
              {jobsError && <p className="empty">{jobsError}</p>}
              {!jobsError && jobs.length === 0 && <p className="empty">Aucune étape trouvée.</p>}
              {jobs.map((job) => (
                <article className="item dev-job" key={job.id}>
                  <span className="item-title">
                    <span className={statusBadgeClass(job.status)}>{job.status}</span>
                    <strong>{job.name}</strong> ({job.stage})
                  </span>
                  <span className="integrations">durée {formatDuration(job.durationSeconds)}{job.hasArtifacts ? ' · artefacts disponibles' : ''}</span>
                  <span className="item-actions">
                    <button type="button" className="filter" onClick={() => void loadJobLog(job.id)}>Voir les logs</button>
                    <a className="filter" href={job.webUrl} target="_blank" rel="noreferrer">Ouvrir dans GitLab</a>
                  </span>
                </article>
              ))}
              {jobLog && (
                <pre className="dev-job-log" aria-label={`Logs du job ${jobLog.jobId}`}>{jobLog.text || '(logs vides)'}</pre>
              )}
            </section>
          )}
        </section>
      )}

      {subView === 'deployments' && (
        <section className="view-group dev-deployments">
          <h3>Historique de déploiement (ArgoCD)</h3>
          <p className="empty">Rollback non disponible en lecture seule depuis cette vue — utilisez ArgoCD directement. Diff entre deux déploiements : comparez les révisions ci-dessous.</p>
          <form className="new-item" onSubmit={(event) => { event.preventDefault(); void loadDeployments(); }}>
            <input aria-label="Nom de l'application ArgoCD" placeholder="Nom de l'application ArgoCD" value={appName} onChange={(event) => setAppName(event.target.value)} required />
            <button type="submit" disabled={deploymentsLoading}>{deploymentsLoading ? 'Chargement…' : 'Charger'}</button>
          </form>
          {deploymentsError && <p className="empty">{deploymentsError}</p>}
          {!deploymentsError && deployments.length === 0 && !deploymentsLoading && <p className="empty">Renseignez une application ArgoCD pour afficher son historique.</p>}
          {deployments.map((entry) => (
            <article className="item dev-deployment" key={entry.id}>
              <span className="item-title"><strong>Déploiement #{entry.id}</strong> — {entry.revision.slice(0, 12)}</span>
              <span className="integrations">{new Date(entry.deployedAt).toLocaleString('fr-FR')}</span>
            </article>
          ))}
        </section>
      )}

      {subView === 'tests' && (
        <section className="view-group dev-tests">
          <h3>Tests (unitaires / intégration / e2e)</h3>
          <p className="empty">Non disponible — aucune intégration configurée. Aucun outil de reporting de tests (JUnit/coverage, Playwright, etc.) n'est branché à ce jour ; brancher une intégration réelle (ex. artefacts JUnit exposés par GitLab CI) avant d'afficher un taux de réussite ou un historique.</p>
        </section>
      )}

      {subView === 'quality' && (
        <section className="view-group dev-quality">
          <h3>Sécurité images (Harbor / Trivy)</h3>
          <form className="new-item" onSubmit={(event) => { event.preventDefault(); void loadSecurity(); }}>
            <input aria-label="Projet Harbor" placeholder="Projet Harbor" value={harborProject} onChange={(event) => setHarborProject(event.target.value)} required />
            <input aria-label="Dépôt d'image" placeholder="Dépôt d'image" value={harborRepo} onChange={(event) => setHarborRepo(event.target.value)} required />
            <input aria-label="Tag" placeholder="Tag" value={harborTag} onChange={(event) => setHarborTag(event.target.value)} />
            <button type="submit" disabled={securityLoading}>{securityLoading ? 'Chargement…' : 'Scanner'}</button>
          </form>
          {securityError && <p className="empty">{securityError}</p>}
          {security && (
            <article className="item dev-security-summary">
              <span className="item-title"><strong>Statut du scan : {security.scanStatus}</strong></span>
              <span className="integrations">Critique: {security.critical} · Haute: {security.high} · Moyenne: {security.medium} · Basse: {security.low}</span>
            </article>
          )}

          <h3>Qualité de code, dépendances, secrets</h3>
          <p className="empty">Non disponible — aucune intégration configurée. Aucun outil d'analyse de qualité de code (SonarQube, ESLint agrégé), de scan de secrets (Gitleaks/TruffleHog) ou de dépendances (Dependabot/Renovate/SCA) n'est branché à ce jour.</p>

          <h3>Artefacts / packages</h3>
          <p className="empty">Non disponible — aucune intégration configurée. Les artefacts de pipeline sont visibles depuis la vue CI/CD (icône "artefacts disponibles" par étape) ; un registre de packages dédié (Nexus/Verdaccio) est déjà exposé ailleurs (Paramètres → Intégrations) mais pas encore relié à un projet précis ici.</p>
        </section>
      )}
    </div>
  );
}
