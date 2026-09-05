import { useState } from 'react';

import { Icon } from './Icon.js';
import { useLanguage, useStrings } from '../i18n/LanguageContext.js';

const strings = {
  fr: {
    notAvailableNoIntegration: 'Non disponible — aucune intégration configurée.',
    noDataForRef: 'Aucune donnée disponible pour cette référence.',
    errorWithCode: (code: number) => `Erreur (${code})`,
    cannotContactBackend: 'Impossible de contacter le backend.',
    recentPipelines: 'Pipelines récentes',
    projectIdLabel: 'Identifiant projet GitLab',
    projectIdPlaceholder: 'Identifiant projet GitLab (ex: groupe/projet)',
    loading: 'Chargement…',
    load: 'Charger',
    noCommitTitle: '(sans titre de commit)',
    unknownAuthor: 'auteur inconnu',
    duration: (d: string) => `durée ${d}`,
    steps: 'Étapes',
    retry: 'Relancer',
    openInGitLab: 'Ouvrir dans GitLab',
    retryFailed: 'La relance a échoué.',
    pipelineSteps: (id: number) => `Étapes de la pipeline #${id}`,
    noStepFound: 'Aucune étape trouvée.',
    artifactsAvailable: 'artefacts disponibles',
    viewLogs: 'Voir les logs',
    logsFor: (jobId: number) => `Logs du job ${jobId}`,
    emptyLogs: '(logs vides)',
    deploymentHistory: 'Historique de déploiement (ArgoCD)',
    deploymentHint: "Rollback non disponible en lecture seule depuis cette vue — utilisez ArgoCD directement. Diff entre deux déploiements : comparez les révisions ci-dessous.",
    argoAppLabel: "Nom de l'application ArgoCD",
    argoAppPlaceholder: "Nom de l'application ArgoCD",
    fillGitlabProjectHint: 'Renseignez un projet GitLab pour afficher ses pipelines.',
    fillArgoAppHint: 'Renseignez une application ArgoCD pour afficher son historique.',
    deployment: (id: number) => `Déploiement #${id}`,
    testsTitle: 'Tests (unitaires / intégration / e2e)',
    testsUnavailable: "Non disponible — aucune intégration configurée. Aucun outil de reporting de tests (JUnit/coverage, Playwright, etc.) n'est branché à ce jour ; brancher une intégration réelle (ex. artefacts JUnit exposés par GitLab CI) avant d'afficher un taux de réussite ou un historique.",
    securityTitle: 'Sécurité images (Harbor / Trivy)',
    harborProjectLabel: 'Projet Harbor',
    imageRepoLabel: "Dépôt d'image",
    tagLabel: 'Tag',
    scan: 'Scanner',
    scanStatus: (status: string) => `Statut du scan : ${status}`,
    critical: 'Critique',
    high: 'Haute',
    medium: 'Moyenne',
    low: 'Basse',
    codeQualityTitle: 'Qualité de code, dépendances, secrets',
    codeQualityUnavailable: "Non disponible — aucune intégration configurée. Aucun outil d'analyse de qualité de code (SonarQube, ESLint agrégé), de scan de secrets (Gitleaks/TruffleHog) ou de dépendances (Dependabot/Renovate/SCA) n'est branché à ce jour.",
    artifactsTitle: 'Artefacts / packages',
    artifactsUnavailable: 'Non disponible — aucune intégration configurée. Les artefacts de pipeline sont visibles depuis la vue CI/CD (icône "artefacts disponibles" par étape) ; un registre de packages dédié (Nexus/Verdaccio) est déjà exposé ailleurs (Paramètres → Intégrations) mais pas encore relié à un projet précis ici.',
  },
  en: {
    notAvailableNoIntegration: 'Not available — no integration configured.',
    noDataForRef: 'No data available for this reference.',
    errorWithCode: (code: number) => `Error (${code})`,
    cannotContactBackend: 'Could not reach the backend.',
    recentPipelines: 'Recent pipelines',
    projectIdLabel: 'GitLab project identifier',
    projectIdPlaceholder: 'GitLab project identifier (e.g. group/project)',
    loading: 'Loading…',
    load: 'Load',
    noCommitTitle: '(no commit title)',
    unknownAuthor: 'unknown author',
    duration: (d: string) => `duration ${d}`,
    steps: 'Steps',
    retry: 'Retry',
    openInGitLab: 'Open in GitLab',
    retryFailed: 'The retry failed.',
    pipelineSteps: (id: number) => `Steps for pipeline #${id}`,
    noStepFound: 'No step found.',
    artifactsAvailable: 'artifacts available',
    viewLogs: 'View logs',
    logsFor: (jobId: number) => `Logs for job ${jobId}`,
    emptyLogs: '(empty logs)',
    deploymentHistory: 'Deployment history (ArgoCD)',
    deploymentHint: 'Rollback is not available read-only from this view — use ArgoCD directly. To diff two deployments, compare the revisions below.',
    argoAppLabel: 'ArgoCD application name',
    argoAppPlaceholder: 'ArgoCD application name',
    fillGitlabProjectHint: 'Enter a GitLab project to display its pipelines.',
    fillArgoAppHint: 'Enter an ArgoCD application to display its history.',
    deployment: (id: number) => `Deployment #${id}`,
    testsTitle: 'Tests (unit / integration / e2e)',
    testsUnavailable: 'Not available — no integration configured. No test reporting tool (JUnit/coverage, Playwright, etc.) is connected yet; connect a real integration (e.g. JUnit artifacts exposed by GitLab CI) before showing a pass rate or history.',
    securityTitle: 'Image security (Harbor / Trivy)',
    harborProjectLabel: 'Harbor project',
    imageRepoLabel: 'Image repository',
    tagLabel: 'Tag',
    scan: 'Scan',
    scanStatus: (status: string) => `Scan status: ${status}`,
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    codeQualityTitle: 'Code quality, dependencies, secrets',
    codeQualityUnavailable: 'Not available — no integration configured. No code quality analysis tool (SonarQube, aggregated ESLint), secret scanner (Gitleaks/TruffleHog), or dependency scanner (Dependabot/Renovate/SCA) is connected yet.',
    artifactsTitle: 'Artifacts / packages',
    artifactsUnavailable: 'Not available — no integration configured. Pipeline artifacts are visible from the CI/CD view ("artifacts available" icon per step); a dedicated package registry (Nexus/Verdaccio) is already exposed elsewhere (Settings → Integrations) but not yet linked to a specific project here.',
  },
} as const;

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

export type CiCdSubView = 'cicd' | 'deployments' | 'tests' | 'quality';

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

async function fetchJson<T>(url: string, s: typeof strings['fr']): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url);
    if (response.status === 503) return { data: null, error: s.notAvailableNoIntegration };
    if (response.status === 404) return { data: null, error: s.noDataForRef };
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { data: null, error: (body as { error?: string }).error ?? s.errorWithCode(response.status) };
    }
    return { data: (await response.json()) as T, error: null };
  } catch {
    return { data: null, error: s.cannotContactBackend };
  }
}

/**
 * Panel CI/CD, déploiements, tests, qualité/sécurité par projet (AM.7). Réutilise les intégrations
 * déjà branchées côté backend (GitLab pipelines, ArgoCD sync history, Harbor/Trivy) via /api/dev-cicd.
 * Tests unitaires/intégration/e2e et qualité de code (lint/complexité/duplication) n'ont pas encore
 * de source réelle branchée : affichés en placeholder explicite plutôt qu'inventés.
 * La sous-vue active est pilotée par `DevelopmentPanel` (une seule barre de sous-onglets au niveau
 * du module Développement, plutôt que deux niveaux de navigation imbriqués).
 */
export function DevCiCdPanel({ apiBase, subView }: { apiBase: string; subView: CiCdSubView }) {
  const s = useStrings(strings);
  const { language } = useLanguage();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
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
    const { data, error } = await fetchJson<GitLabPipelineDetail[]>(`${apiBase}/api/dev-cicd/${encodeURIComponent(projectId.trim())}/pipelines`, s);
    setPipelines(data ?? []);
    setPipelinesError(error ?? '');
    setPipelinesLoading(false);
  }

  async function loadJobs(pipelineId: number) {
    setSelectedPipeline(pipelineId);
    setJobLog(null);
    setJobsError('');
    const { data, error } = await fetchJson<GitLabPipelineJob[]>(`${apiBase}/api/dev-cicd/${encodeURIComponent(projectId.trim())}/pipelines/${pipelineId}/jobs`, s);
    setJobs(data ?? []);
    setJobsError(error ?? '');
  }

  async function loadJobLog(jobId: number) {
    const { data, error } = await fetchJson<{ log: string }>(`${apiBase}/api/dev-cicd/${encodeURIComponent(projectId.trim())}/jobs/${jobId}/log`, s);
    setJobLog({ jobId, text: data?.log ?? error ?? '' });
  }

  async function relancePipeline(pipelineId: number) {
    setRetrying(true);
    setRetryError('');
    try {
      const response = await fetch(`${apiBase}/api/dev-cicd/${encodeURIComponent(projectId.trim())}/pipelines/${pipelineId}/retry`, { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? s.retryFailed);
      }
      await loadPipelines();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : s.retryFailed);
    } finally {
      setRetrying(false);
    }
  }

  async function loadDeployments() {
    if (!appName.trim()) return;
    setDeploymentsLoading(true);
    setDeploymentsError('');
    const { data, error } = await fetchJson<ArgoSyncEntry[]>(`${apiBase}/api/dev-cicd/deployments/${encodeURIComponent(appName.trim())}`, s);
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
      s,
    );
    setSecurity(data);
    setSecurityError(error ?? '');
    setSecurityLoading(false);
  }

  return (
    <div className="items dev-cicd-panel">
      {subView === 'cicd' && (
        <section className="view-group dev-cicd-pipelines">
          <h3>{s.recentPipelines}</h3>
          <form className="new-item" onSubmit={(event) => { event.preventDefault(); void loadPipelines(); }}>
            <input aria-label={s.projectIdLabel} placeholder={s.projectIdPlaceholder} value={projectId} onChange={(event) => setProjectId(event.target.value)} required />
            <button type="submit" disabled={pipelinesLoading}>{pipelinesLoading ? s.loading : s.load}</button>
          </form>
          {pipelinesError && <p className="empty">{pipelinesError}</p>}
          {!pipelinesError && pipelines.length === 0 && !pipelinesLoading && <p className="empty">{s.fillGitlabProjectHint}</p>}
          {pipelines.map((pipeline) => (
            <article className="item dev-pipeline" key={pipeline.id}>
              <span className="item-title">
                <span className={statusBadgeClass(pipeline.status)}>{pipeline.status}</span>
                <strong>#{pipeline.id}</strong> · {pipeline.ref} · {pipeline.sha.slice(0, 8)}
              </span>
              <span className="integrations">
                {pipeline.commitTitle ?? s.noCommitTitle} — {pipeline.authorName ?? s.unknownAuthor} · {new Date(pipeline.createdAt).toLocaleString(locale)} · {s.duration(formatDuration(pipeline.durationSeconds))}
              </span>
              <span className="item-actions">
                <button type="button" className="filter" onClick={() => void loadJobs(pipeline.id)}>{s.steps}</button>
                <button type="button" className="filter" disabled={retrying} onClick={() => void relancePipeline(pipeline.id)}>{s.retry}</button>
                <a className="filter" href={pipeline.webUrl} target="_blank" rel="noreferrer">{s.openInGitLab}</a>
              </span>
            </article>
          ))}
          {retryError && <p className="error" role="alert">{retryError}</p>}

          {selectedPipeline !== null && (
            <section className="view-group dev-pipeline-jobs">
              <h3>{s.pipelineSteps(selectedPipeline)}</h3>
              {jobsError && <p className="empty">{jobsError}</p>}
              {!jobsError && jobs.length === 0 && <p className="empty">{s.noStepFound}</p>}
              {jobs.map((job) => (
                <article className="item dev-job" key={job.id}>
                  <span className="item-title">
                    <span className={statusBadgeClass(job.status)}>{job.status}</span>
                    <strong>{job.name}</strong> ({job.stage})
                  </span>
                  <span className="integrations">{s.duration(formatDuration(job.durationSeconds))}{job.hasArtifacts ? <> · <Icon name="doc" size={12} /> {s.artifactsAvailable}</> : ''}</span>
                  <span className="item-actions">
                    <button type="button" className="filter" onClick={() => void loadJobLog(job.id)}>{s.viewLogs}</button>
                    <a className="filter" href={job.webUrl} target="_blank" rel="noreferrer">{s.openInGitLab}</a>
                  </span>
                </article>
              ))}
              {jobLog && (
                <pre className="dev-job-log" aria-label={s.logsFor(jobLog.jobId)}>{jobLog.text || s.emptyLogs}</pre>
              )}
            </section>
          )}
        </section>
      )}

      {subView === 'deployments' && (
        <section className="view-group dev-deployments">
          <h3>{s.deploymentHistory}</h3>
          <p className="empty">{s.deploymentHint}</p>
          <form className="new-item" onSubmit={(event) => { event.preventDefault(); void loadDeployments(); }}>
            <input aria-label={s.argoAppLabel} placeholder={s.argoAppPlaceholder} value={appName} onChange={(event) => setAppName(event.target.value)} required />
            <button type="submit" disabled={deploymentsLoading}>{deploymentsLoading ? s.loading : s.load}</button>
          </form>
          {deploymentsError && <p className="empty">{deploymentsError}</p>}
          {!deploymentsError && deployments.length === 0 && !deploymentsLoading && <p className="empty">{s.fillArgoAppHint}</p>}
          {deployments.map((entry) => (
            <article className="item dev-deployment" key={entry.id}>
              <span className="item-title"><strong>{s.deployment(entry.id)}</strong> — {entry.revision.slice(0, 12)}</span>
              <span className="integrations">{new Date(entry.deployedAt).toLocaleString(locale)}</span>
            </article>
          ))}
        </section>
      )}

      {subView === 'tests' && (
        <section className="view-group dev-tests">
          <h3>{s.testsTitle}</h3>
          <p className="empty">{s.testsUnavailable}</p>
        </section>
      )}

      {subView === 'quality' && (
        <section className="view-group dev-quality">
          <h3>{s.securityTitle}</h3>
          <form className="new-item" onSubmit={(event) => { event.preventDefault(); void loadSecurity(); }}>
            <input aria-label={s.harborProjectLabel} placeholder={s.harborProjectLabel} value={harborProject} onChange={(event) => setHarborProject(event.target.value)} required />
            <input aria-label={s.imageRepoLabel} placeholder={s.imageRepoLabel} value={harborRepo} onChange={(event) => setHarborRepo(event.target.value)} required />
            <input aria-label={s.tagLabel} placeholder={s.tagLabel} value={harborTag} onChange={(event) => setHarborTag(event.target.value)} />
            <button type="submit" disabled={securityLoading}>{securityLoading ? s.loading : s.scan}</button>
          </form>
          {securityError && <p className="empty">{securityError}</p>}
          {security && (
            <article className="item dev-security-summary">
              <span className="item-title"><strong>{s.scanStatus(security.scanStatus)}</strong></span>
              <span className="integrations">{s.critical}: {security.critical} · {s.high}: {security.high} · {s.medium}: {security.medium} · {s.low}: {security.low}</span>
            </article>
          )}

          <h3>{s.codeQualityTitle}</h3>
          <p className="empty">{s.codeQualityUnavailable}</p>

          <h3>{s.artifactsTitle}</h3>
          <p className="empty">{s.artifactsUnavailable}</p>
        </section>
      )}
    </div>
  );
}
