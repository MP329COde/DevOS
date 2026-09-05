import { useEffect, useState } from 'react';

import { useLanguage, useStrings } from '../i18n/LanguageContext.js';

// Sous-vue "Dépôts" du module Développement (AM.4) — montée comme onglet de DevelopmentPanel
// (voir DEV_TABS), pas comme entrée de nav de premier niveau.

const strings = {
  fr: {
    integrationUnavailable: "Aucun dépôt configuré ou intégration indisponible (GITLAB_BASE_URL/TOKEN/PROJECT_ID, GITHUB_TOKEN/GITHUB_REPOS).",
    noRepo: "Aucun dépôt disponible pour l'instant.",
    defaultBranch: 'Branche par défaut :',
    branchCount: (count: number) => `${count} branche(s)`,
    openChangeCount: (count: number) => `${count} MR/PR ouverte(s)`,
    lastActivity: 'Dernière activité :',
    lastCommit: 'Dernier commit :',
    latestRelease: 'Dernière release :',
    openRepo: 'Ouvrir le dépôt',
    closeDetail: 'Fermer le détail',
    detail: 'Détail',
    tabChanges: 'Merge/Pull requests',
    tabCommits: 'Commits récents',
    tabBranches: 'Branches',
    noChange: 'Aucune MR/PR.',
    noCommit: 'Aucun commit.',
    filter: 'Filtrer :',
    filterAll: 'Toutes',
    filterProtected: 'Protégées',
    filterStale: 'Obsolètes',
    filterUnmerged: 'Non fusionnées',
    noBranchForFilter: 'Aucune branche pour ce filtre.',
    badgeDefault: 'défaut',
    badgeProtected: 'protégée',
    badgeStale: 'obsolète',
    badgeUnmerged: 'non fusionnée',
    lastCommitOn: 'dernier commit',
  },
  en: {
    integrationUnavailable: 'No repository configured or integration unavailable (GITLAB_BASE_URL/TOKEN/PROJECT_ID, GITHUB_TOKEN/GITHUB_REPOS).',
    noRepo: 'No repository available yet.',
    defaultBranch: 'Default branch:',
    branchCount: (count: number) => `${count} branch(es)`,
    openChangeCount: (count: number) => `${count} open MR/PR`,
    lastActivity: 'Latest activity:',
    lastCommit: 'Last commit:',
    latestRelease: 'Latest release:',
    openRepo: 'Open repository',
    closeDetail: 'Close details',
    detail: 'Details',
    tabChanges: 'Merge/Pull requests',
    tabCommits: 'Recent commits',
    tabBranches: 'Branches',
    noChange: 'No MR/PR.',
    noCommit: 'No commits.',
    filter: 'Filter:',
    filterAll: 'All',
    filterProtected: 'Protected',
    filterStale: 'Stale',
    filterUnmerged: 'Unmerged',
    noBranchForFilter: 'No branch matches this filter.',
    badgeDefault: 'default',
    badgeProtected: 'protected',
    badgeStale: 'stale',
    badgeUnmerged: 'unmerged',
    lastCommitOn: 'last commit',
  },
} as const;

interface DevRepoSummary {
  key: string;
  provider: 'gitlab' | 'github';
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

interface DevRepoChange {
  id: number;
  title: string;
  state: string;
  sourceBranch: string;
  targetBranch: string;
  webUrl: string;
  author: string;
  updatedAt: string;
}

interface DevRepoCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

interface DevRepoDetail extends DevRepoSummary {
  recentCommits: DevRepoCommit[];
  changes: DevRepoChange[];
}

interface DevRepoBranch {
  name: string;
  default: boolean;
  protected: boolean;
  lastCommitDate: string | null;
  aheadBy: number | null;
  behindBy: number | null;
  merged: boolean | null;
  stale: boolean;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale);
}

export function DevReposPanel({ apiBase }: { apiBase: string }) {
  const s = useStrings(strings);
  const { language } = useLanguage();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const [repos, setRepos] = useState<DevRepoSummary[]>([]);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<DevRepoDetail | null>(null);
  const [branches, setBranches] = useState<DevRepoBranch[] | null>(null);
  const [tab, setTab] = useState<'changes' | 'commits' | 'branches'>('changes');
  const [branchFilter, setBranchFilter] = useState<'all' | 'protected' | 'stale' | 'unmerged'>('all');

  useEffect(() => {
    void fetch(`${apiBase}/api/extras/dev/repos`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setRepos(await response.json());
        setError('');
      })
      .catch(() => setError(s.integrationUnavailable));
  }, [apiBase]);

  useEffect(() => {
    if (!selectedKey) { setDetail(null); setBranches(null); return; }
    const repo = repos.find((r) => r.key === selectedKey);
    if (!repo) return;
    const encodedId = encodeURIComponent(repo.id);
    void fetch(`${apiBase}/api/extras/dev/repos/${repo.provider}/${encodedId}`)
      .then(async (response) => (response.ok ? setDetail(await response.json()) : setDetail(null)));
    void fetch(`${apiBase}/api/extras/dev/repos/${repo.provider}/${encodedId}/branches`)
      .then(async (response) => (response.ok ? setBranches(await response.json()) : setBranches(null)));
  }, [apiBase, selectedKey, repos]);

  const visibleBranches = (branches ?? []).filter((branch) => {
    if (branchFilter === 'protected') return branch.protected;
    if (branchFilter === 'stale') return branch.stale;
    if (branchFilter === 'unmerged') return branch.merged === false;
    return true;
  });

  return (
    <div className="items dev-repos-panel">
      {error && <p className="error" role="alert">{error}</p>}

      {!error && repos.length === 0 && <p className="empty">{s.noRepo}</p>}

      <div className="dev-repos-list">
        {repos.map((repo) => (
          <article className="item widget-card dev-repo-card" key={repo.key}>
            <span className="item-title">
              <strong>{repo.name}</strong>{' '}
              <span className={`type type-${repo.provider}`}>{repo.provider === 'gitlab' ? 'GitLab' : 'GitHub'}</span>{' '}
              {repo.pipeline && <span className={`status-badge status-badge-${repo.pipeline.status}`}>{repo.pipeline.status}</span>}
            </span>
            <p className="empty">
              {s.defaultBranch} <strong>{repo.defaultBranch ?? '—'}</strong> · {s.branchCount(repo.branchCount)} · {s.openChangeCount(repo.openChangeCount)}
            </p>
            <p className="empty">{s.lastActivity} {formatDate(repo.lastActivityAt, locale)}</p>
            {repo.lastCommit && <p className="empty">{s.lastCommit} <code>{repo.lastCommit.sha}</code> — {repo.lastCommit.message} ({repo.lastCommit.author})</p>}
            {repo.latestRelease && <p className="empty">{s.latestRelease} {repo.latestRelease.tag}</p>}
            <span className="item-actions">
              <a href={repo.webUrl} target="_blank" rel="noreferrer"><button type="button">{s.openRepo}</button></a>
              <button type="button" onClick={() => { setSelectedKey(selectedKey === repo.key ? null : repo.key); setTab('changes'); }}>
                {selectedKey === repo.key ? s.closeDetail : s.detail}
              </button>
            </span>

            {selectedKey === repo.key && (
              <div className="dev-repo-detail">
                <div className="dev-repo-tabs">
                  <button type="button" className={tab === 'changes' ? 'active' : ''} onClick={() => setTab('changes')}>{s.tabChanges}</button>
                  <button type="button" className={tab === 'commits' ? 'active' : ''} onClick={() => setTab('commits')}>{s.tabCommits}</button>
                  <button type="button" className={tab === 'branches' ? 'active' : ''} onClick={() => setTab('branches')}>{s.tabBranches}</button>
                </div>

                {tab === 'changes' && (
                  <ul className="dev-repo-changes">
                    {(detail?.changes ?? []).length === 0 && <li className="empty">{s.noChange}</li>}
                    {(detail?.changes ?? []).map((change) => (
                      <li key={change.id}>
                        <a href={change.webUrl} target="_blank" rel="noreferrer">#{change.id} {change.title}</a>{' '}
                        <span className="status-badge">{change.state}</span>{' '}
                        <span className="empty">{change.sourceBranch} → {change.targetBranch} ({change.author})</span>
                      </li>
                    ))}
                  </ul>
                )}

                {tab === 'commits' && (
                  <ul className="dev-repo-commits">
                    {(detail?.recentCommits ?? []).length === 0 && <li className="empty">{s.noCommit}</li>}
                    {(detail?.recentCommits ?? []).map((commit) => (
                      <li key={commit.sha}><code>{commit.sha}</code> {commit.message} — {commit.author} ({formatDate(commit.date, locale)})</li>
                    ))}
                  </ul>
                )}

                {tab === 'branches' && (
                  <div className="dev-repo-branches">
                    <label className="filter">
                      {s.filter}{' '}
                      <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value as typeof branchFilter)}>
                        <option value="all">{s.filterAll}</option>
                        <option value="protected">{s.filterProtected}</option>
                        <option value="stale">{s.filterStale}</option>
                        <option value="unmerged">{s.filterUnmerged}</option>
                      </select>
                    </label>
                    <ul>
                      {visibleBranches.length === 0 && <li className="empty">{s.noBranchForFilter}</li>}
                      {visibleBranches.map((branch) => (
                        <li key={branch.name}>
                          <strong>{branch.name}</strong>{' '}
                          {branch.default && <span className="status-badge status-badge-default">{s.badgeDefault}</span>}{' '}
                          {branch.protected && <span className="status-badge">{s.badgeProtected}</span>}{' '}
                          {branch.stale && <span className="status-badge status-badge-inactive">{s.badgeStale}</span>}{' '}
                          {branch.merged === false && <span className="status-badge">{s.badgeUnmerged}</span>}{' '}
                          <span className="empty">
                            {branch.aheadBy !== null ? `+${branch.aheadBy}` : '?'} / {branch.behindBy !== null ? `-${branch.behindBy}` : '?'} vs {detail?.defaultBranch ?? '—'} · {s.lastCommitOn} {formatDate(branch.lastCommitDate, locale)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
