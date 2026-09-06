export interface GitLabPipelineTokenProvider {
  getToken(): Promise<string>;
}

export interface GitLabPipelinesClientOptions {
  baseUrl: string;
  tokenProvider: GitLabPipelineTokenProvider;
  fetchImpl?: typeof fetch;
}

export interface GitLabPipelineSummary {
  id: number;
  status: string;
  ref: string;
  web_url: string;
}

/** Détail d'une pipeline pour la vue CI/CD par projet (AM.7) : état, durée, branche, commit, auteur, date. */
export interface GitLabPipelineDetail {
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

/** Étape (job) d'une pipeline, avec accès aux logs et aux artefacts éventuels. */
export interface GitLabPipelineJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  durationSeconds: number | null;
  webUrl: string;
  hasArtifacts: boolean;
}

async function gitlabGet<T>(gitlab: GitLabPipelinesClientOptions, path: string): Promise<T> {
  const fetchImpl = gitlab.fetchImpl ?? fetch;
  const token = await gitlab.tokenProvider.getToken();
  const response = await fetchImpl(`${gitlab.baseUrl}${path}`, { headers: { 'private-token': token } });
  if (!response.ok) throw new Error(`GitLab API request failed (${response.status})`);
  return (await response.json()) as T;
}

/**
 * Lists currently running pipelines for a GitLab project. Implemented as a standalone function
 * (rather than a `GitLabClient` method) to avoid touching the shared `gitlab.ts` client file.
 */
export async function listRunningPipelines(
  gitlab: GitLabPipelinesClientOptions,
  projectId: string,
): Promise<GitLabPipelineSummary[]> {
  const body = await gitlabGet<GitLabPipelineSummary[]>(gitlab, `/projects/${encodeURIComponent(projectId)}/pipelines?status=running`);
  return body.map((pipeline) => ({
    id: pipeline.id,
    status: pipeline.status,
    ref: pipeline.ref,
    web_url: pipeline.web_url,
  }));
}

/** Liste les pipelines récentes d'un projet (tous statuts), triées par date décroissante, pour la vue CI/CD (AM.7). */
export async function listProjectPipelines(
  gitlab: GitLabPipelinesClientOptions,
  projectId: string,
  limit = 20,
): Promise<GitLabPipelineDetail[]> {
  type RawPipeline = {
    id: number; status: string; ref: string; sha: string; web_url: string;
    created_at: string; updated_at: string; duration?: number | null;
    user?: { name?: string } | null;
  };
  const list = await gitlabGet<RawPipeline[]>(
    gitlab,
    `/projects/${encodeURIComponent(projectId)}/pipelines?per_page=${encodeURIComponent(String(limit))}&order_by=id&sort=desc`,
  );
  const details = await Promise.all(
    list.map(async (pipeline) => {
      let commitTitle: string | null = null;
      try {
        const commit = await gitlabGet<{ title?: string }>(gitlab, `/projects/${encodeURIComponent(projectId)}/repository/commits/${encodeURIComponent(pipeline.sha)}`);
        commitTitle = commit.title ?? null;
      } catch {
        commitTitle = null;
      }
      return {
        id: pipeline.id,
        status: pipeline.status,
        ref: pipeline.ref,
        sha: pipeline.sha,
        webUrl: pipeline.web_url,
        createdAt: pipeline.created_at,
        updatedAt: pipeline.updated_at,
        durationSeconds: pipeline.duration ?? null,
        authorName: pipeline.user?.name ?? null,
        commitTitle,
      };
    }),
  );
  return details;
}

/** Récupère le détail d'une pipeline précise (utilisé pour rafraîchir après une relance). */
export async function getPipeline(gitlab: GitLabPipelinesClientOptions, projectId: string, pipelineId: number): Promise<GitLabPipelineDetail> {
  type RawPipeline = {
    id: number; status: string; ref: string; sha: string; web_url: string;
    created_at: string; updated_at: string; duration?: number | null; user?: { name?: string } | null;
  };
  const pipeline = await gitlabGet<RawPipeline>(gitlab, `/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}`);
  return {
    id: pipeline.id,
    status: pipeline.status,
    ref: pipeline.ref,
    sha: pipeline.sha,
    webUrl: pipeline.web_url,
    createdAt: pipeline.created_at,
    updatedAt: pipeline.updated_at,
    durationSeconds: pipeline.duration ?? null,
    authorName: pipeline.user?.name ?? null,
    commitTitle: null,
  };
}

/** Liste les jobs (étapes) d'une pipeline, avec indication de disponibilité d'artefacts. */
export async function listPipelineJobs(gitlab: GitLabPipelinesClientOptions, projectId: string, pipelineId: number): Promise<GitLabPipelineJob[]> {
  type RawJob = {
    id: number; name: string; stage: string; status: string; duration?: number | null; web_url: string;
    artifacts?: Array<{ file_type?: string }>;
  };
  const jobs = await gitlabGet<RawJob[]>(gitlab, `/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}/jobs`);
  return jobs.map((job) => ({
    id: job.id,
    name: job.name,
    stage: job.stage,
    status: job.status,
    durationSeconds: job.duration ?? null,
    webUrl: job.web_url,
    hasArtifacts: Boolean(job.artifacts && job.artifacts.length > 0),
  }));
}

/** Récupère le log brut d'un job (texte tronqué côté GitLab si trop volumineux). */
export async function getJobLog(gitlab: GitLabPipelinesClientOptions, projectId: string, jobId: number): Promise<string> {
  const fetchImpl = gitlab.fetchImpl ?? fetch;
  const token = await gitlab.tokenProvider.getToken();
  const response = await fetchImpl(`${gitlab.baseUrl}/projects/${encodeURIComponent(projectId)}/jobs/${jobId}/trace`, { headers: { 'private-token': token } });
  if (!response.ok) throw new Error(`GitLab API request failed (${response.status})`);
  return response.text();
}

/** Relance (retry) une pipeline entière. */
export async function retryPipeline(gitlab: GitLabPipelinesClientOptions, projectId: string, pipelineId: number): Promise<GitLabPipelineDetail> {
  const fetchImpl = gitlab.fetchImpl ?? fetch;
  const token = await gitlab.tokenProvider.getToken();
  const response = await fetchImpl(`${gitlab.baseUrl}/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}/retry`, {
    method: 'POST',
    headers: { 'private-token': token },
  });
  if (!response.ok) throw new Error(`GitLab API request failed (${response.status})`);
  return getPipeline(gitlab, projectId, pipelineId);
}

/** Télécharge le zip d'artefacts d'un job (GitLab n'expose les artefacts qu'au niveau job, pas pipeline). */
export async function getJobArtifactsZip(gitlab: GitLabPipelinesClientOptions, projectId: string, jobId: number): Promise<Buffer> {
  const fetchImpl = gitlab.fetchImpl ?? fetch;
  const token = await gitlab.tokenProvider.getToken();
  const response = await fetchImpl(`${gitlab.baseUrl}/projects/${encodeURIComponent(projectId)}/jobs/${jobId}/artifacts`, {
    headers: { 'private-token': token },
  });
  if (!response.ok) throw new Error(`GitLab API request failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export interface GitLabTestReport {
  total_time: number;
  total_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  error_count: number;
  test_suites: Array<{ name: string }>;
}

/** Rapport de tests agrégé (JUnit) d'une pipeline — disponible en Community Edition si publié via artifacts:reports:junit. */
export async function getTestReport(gitlab: GitLabPipelinesClientOptions, projectId: string, pipelineId: number): Promise<GitLabTestReport> {
  return gitlabGet<GitLabTestReport>(gitlab, `/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}/test_report`);
}

/** Cherche un job par nom dans une pipeline (ex. "code_quality", "dependency_scanning"). */
export async function findJobByName(gitlab: GitLabPipelinesClientOptions, projectId: string, pipelineId: number, name: string): Promise<GitLabPipelineJob | null> {
  const jobs = await listPipelineJobs(gitlab, projectId, pipelineId);
  return jobs.find((job) => job.name === name) ?? null;
}

/** Lit un fichier texte précis dans les artefacts d'un job (ex. gl-code-quality-report.json). */
export async function getJobArtifactFile<T>(gitlab: GitLabPipelinesClientOptions, projectId: string, jobId: number, path: string): Promise<T> {
  return gitlabGet<T>(gitlab, `/projects/${encodeURIComponent(projectId)}/jobs/${jobId}/artifacts/${path}`);
}

export interface GitLabPackage {
  id: number;
  name: string;
  version: string;
  package_type: string;
  _links: { web_path: string };
}

/** Liste les packages publiés dans le Package Registry du projet (disponible en Community Edition). */
export async function listPackages(gitlab: GitLabPipelinesClientOptions, projectId: string): Promise<GitLabPackage[]> {
  return gitlabGet<GitLabPackage[]>(gitlab, `/projects/${encodeURIComponent(projectId)}/packages`);
}
