import { GitHubClient } from '../integrations/github.js';
import { GitLabClient } from '../integrations/gitlab.js';

/** Section AM.4 — vue dépôt unifiée GitHub/GitLab. */

export type DevRepoProvider = 'gitlab' | 'github';

export interface DevRepoSummary {
  key: string;
  provider: DevRepoProvider;
  id: string;
  name: string;
  webUrl: string;
  defaultBranch: string | null;
  lastActivityAt: string | null;
  lastCommit: { sha: string; message: string; author: string; date: string } | null;
  latestRelease: { tag: string; name: string | null; date: string } | null;
  pipeline: { status: string; webUrl: string | null; updatedAt: string | null } | null;
  branchCount: number;
  openChangeCount: number;
}

export interface DevRepoCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  webUrl?: string;
}

export interface DevRepoChange {
  id: number;
  title: string;
  state: string;
  sourceBranch: string;
  targetBranch: string;
  webUrl: string;
  author: string;
  updatedAt: string;
}

export interface DevRepoDetail extends DevRepoSummary {
  recentCommits: DevRepoCommit[];
  changes: DevRepoChange[];
}

export interface DevRepoBranch {
  name: string;
  default: boolean;
  protected: boolean;
  lastCommitDate: string | null;
  aheadBy: number | null;
  behindBy: number | null;
  merged: boolean | null;
  stale: boolean;
}

export interface DevReposConfig {
  gitlab?: { client: GitLabClient; projectId: string };
  github?: { client: GitHubClient; repos: string[] };
}

const STALE_AFTER_DAYS = 90;

function isStale(dateIso: string | null): boolean {
  if (!dateIso) return false;
  const ageMs = Date.now() - new Date(dateIso).getTime();
  return ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

function findRepoConfig(config: DevReposConfig, provider: DevRepoProvider, id: string): { client: GitLabClient; projectId: string } | { client: GitHubClient; owner: string; repo: string } {
  if (provider === 'gitlab') {
    if (!config.gitlab || config.gitlab.projectId !== id) throw new Error(`Dépôt GitLab inconnu: ${id}`);
    return { client: config.gitlab.client, projectId: config.gitlab.projectId };
  }
  if (!config.github || !config.github.repos.includes(id)) throw new Error(`Dépôt GitHub inconnu: ${id}`);
  const [owner, repo] = id.split('/');
  return { client: config.github.client, owner, repo };
}

async function summarizeGitLab(client: GitLabClient, projectId: string): Promise<DevRepoSummary> {
  const project = await client.getProject(projectId);
  const defaultBranch = project.default_branch ?? null;

  let branchCount = 0;
  for await (const _branch of client.listBranches(projectId)) branchCount++;

  let lastCommit: DevRepoSummary['lastCommit'] = null;
  for await (const commit of client.listCommits(projectId, defaultBranch ?? undefined, 1)) {
    lastCommit = { sha: commit.short_id ?? commit.id, message: commit.title, author: commit.author_name, date: commit.committed_date };
    break;
  }

  let latestRelease: DevRepoSummary['latestRelease'] = null;
  for await (const release of client.listReleases(projectId)) {
    latestRelease = { tag: release.tag_name, name: release.name, date: release.released_at };
    break;
  }

  const pipeline = await client.getLatestPipeline(projectId).catch(() => null);

  let openChangeCount = 0;
  for await (const _mr of client.listMergeRequests(projectId, 'opened')) openChangeCount++;

  return {
    key: `gitlab:${projectId}`,
    provider: 'gitlab',
    id: projectId,
    name: project.path_with_namespace,
    webUrl: project.web_url ?? '',
    defaultBranch,
    lastActivityAt: project.last_activity_at ?? lastCommit?.date ?? null,
    lastCommit,
    latestRelease,
    pipeline: pipeline ? { status: pipeline.status, webUrl: pipeline.web_url, updatedAt: pipeline.updated_at } : null,
    branchCount,
    openChangeCount,
  };
}

async function summarizeGitHub(client: GitHubClient, owner: string, repo: string): Promise<DevRepoSummary> {
  const project = await client.getRepo(owner, repo);
  const defaultBranch = project.default_branch ?? null;

  let branchCount = 0;
  for await (const _branch of client.listBranches(owner, repo)) branchCount++;

  let lastCommit: DevRepoSummary['lastCommit'] = null;
  for await (const commit of client.listCommits(owner, repo, defaultBranch ?? undefined, 1)) {
    lastCommit = { sha: commit.sha.slice(0, 8), message: commit.commit.message.split('\n')[0], author: commit.commit.author?.name ?? 'inconnu', date: commit.commit.author?.date ?? '' };
    break;
  }

  let latestRelease: DevRepoSummary['latestRelease'] = null;
  for await (const release of client.listReleases(owner, repo)) {
    latestRelease = { tag: release.tag_name, name: release.name, date: release.published_at };
    break;
  }

  let pipeline: DevRepoSummary['pipeline'] = null;
  for await (const run of client.listWorkflowRuns(owner, repo)) {
    pipeline = { status: run.conclusion ?? run.status, webUrl: run.html_url, updatedAt: run.updated_at };
    break;
  }

  let openChangeCount = 0;
  for await (const _pr of client.listPulls(owner, repo, 'open')) openChangeCount++;

  return {
    key: `github:${owner}/${repo}`,
    provider: 'github',
    id: `${owner}/${repo}`,
    name: project.full_name,
    webUrl: project.html_url,
    defaultBranch,
    lastActivityAt: project.pushed_at ?? lastCommit?.date ?? null,
    lastCommit,
    latestRelease,
    pipeline,
    branchCount,
    openChangeCount,
  };
}

export async function listDevRepos(config: DevReposConfig): Promise<DevRepoSummary[]> {
  const summaries: DevRepoSummary[] = [];
  if (config.gitlab) summaries.push(await summarizeGitLab(config.gitlab.client, config.gitlab.projectId));
  if (config.github) {
    for (const id of config.github.repos) {
      const [owner, repo] = id.split('/');
      summaries.push(await summarizeGitHub(config.github.client, owner, repo));
    }
  }
  return summaries;
}

export async function getDevRepoDetail(config: DevReposConfig, provider: DevRepoProvider, id: string): Promise<DevRepoDetail> {
  if (provider === 'gitlab') {
    const { client, projectId } = findRepoConfig(config, 'gitlab', id) as { client: GitLabClient; projectId: string };
    const summary = await summarizeGitLab(client, projectId);
    const recentCommits: DevRepoCommit[] = [];
    for await (const commit of client.listCommits(projectId, summary.defaultBranch ?? undefined, 20)) {
      recentCommits.push({ sha: commit.short_id ?? commit.id, message: commit.title, author: commit.author_name, date: commit.committed_date });
    }
    const changes: DevRepoChange[] = [];
    for await (const mr of client.listMergeRequests(projectId, 'all')) {
      changes.push({ id: mr.iid, title: mr.title, state: mr.state, sourceBranch: mr.source_branch, targetBranch: mr.target_branch, webUrl: mr.web_url, author: mr.author?.name ?? mr.author?.username ?? 'inconnu', updatedAt: mr.updated_at });
      if (changes.length >= 50) break;
    }
    return { ...summary, recentCommits, changes };
  }

  const { client, owner, repo } = findRepoConfig(config, 'github', id) as { client: GitHubClient; owner: string; repo: string };
  const summary = await summarizeGitHub(client, owner, repo);
  const recentCommits: DevRepoCommit[] = [];
  for await (const commit of client.listCommits(owner, repo, summary.defaultBranch ?? undefined, 20)) {
    recentCommits.push({ sha: commit.sha.slice(0, 8), message: commit.commit.message.split('\n')[0], author: commit.commit.author?.name ?? 'inconnu', date: commit.commit.author?.date ?? '' });
  }
  const changes: DevRepoChange[] = [];
  for await (const pr of client.listPulls(owner, repo, 'all')) {
    changes.push({ id: pr.number, title: pr.title, state: pr.merged_at ? 'merged' : pr.state, sourceBranch: pr.head.ref, targetBranch: pr.base.ref, webUrl: pr.html_url, author: pr.user?.login ?? 'inconnu', updatedAt: pr.updated_at });
    if (changes.length >= 50) break;
  }
  return { ...summary, recentCommits, changes };
}

export async function listDevRepoBranches(config: DevReposConfig, provider: DevRepoProvider, id: string): Promise<DevRepoBranch[]> {
  if (provider === 'gitlab') {
    const { client, projectId } = findRepoConfig(config, 'gitlab', id) as { client: GitLabClient; projectId: string };
    const project = await client.getProject(projectId);
    const defaultBranch = project.default_branch;
    const mergedSourceBranches = new Set<string>();
    if (defaultBranch) {
      for await (const mr of client.listMergeRequests(projectId, 'merged')) mergedSourceBranches.add(mr.source_branch);
    }
    const branches: DevRepoBranch[] = [];
    for await (const branch of client.listBranches(projectId)) {
      let aheadBy: number | null = null;
      let behindBy: number | null = null;
      if (defaultBranch && branch.name !== defaultBranch) {
        try {
          const ahead = await client.compare(projectId, defaultBranch, branch.name);
          aheadBy = ahead.commits.length;
          const behind = await client.compare(projectId, branch.name, defaultBranch);
          behindBy = behind.commits.length;
        } catch {
          aheadBy = null;
          behindBy = null;
        }
      } else {
        aheadBy = 0;
        behindBy = 0;
      }
      branches.push({
        name: branch.name,
        default: branch.default,
        protected: branch.protected,
        lastCommitDate: branch.commit?.committed_date ?? null,
        aheadBy,
        behindBy,
        merged: branch.default ? null : (branch.merged || (aheadBy === 0) || mergedSourceBranches.has(branch.name)),
        stale: !branch.default && isStale(branch.commit?.committed_date ?? null),
      });
    }
    return branches;
  }

  const { client, owner, repo } = findRepoConfig(config, 'github', id) as { client: GitHubClient; owner: string; repo: string };
  const project = await client.getRepo(owner, repo);
  const defaultBranch = project.default_branch;
  const branches: DevRepoBranch[] = [];
  const commitDates = new Map<string, string>();
  for await (const commit of client.listCommits(owner, repo, undefined, 100)) {
    commitDates.set(commit.sha, commit.commit.author?.date ?? '');
  }
  for await (const branch of client.listBranches(owner, repo)) {
    let aheadBy: number | null = null;
    let behindBy: number | null = null;
    if (defaultBranch && branch.name !== defaultBranch) {
      try {
        const cmp = await client.compareCommits(owner, repo, defaultBranch, branch.name);
        aheadBy = cmp.ahead_by;
        behindBy = cmp.behind_by;
      } catch {
        aheadBy = null;
        behindBy = null;
      }
    } else {
      aheadBy = 0;
      behindBy = 0;
    }
    const lastCommitDate = commitDates.get(branch.commit.sha) ?? null;
    branches.push({
      name: branch.name,
      default: branch.name === defaultBranch,
      protected: branch.protected,
      lastCommitDate,
      aheadBy,
      behindBy,
      merged: branch.name === defaultBranch ? null : aheadBy === 0,
      stale: branch.name !== defaultBranch && isStale(lastCommitDate),
    });
  }
  return branches;
}
