import { useEffect, useState } from 'react';

// Sous-vue "Dépôts" du module Développement (AM.4) — montée comme onglet de DevelopmentPanel
// (voir DEV_TABS), pas comme entrée de nav de premier niveau.

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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR');
}

export function DevReposPanel({ apiBase }: { apiBase: string }) {
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
      .catch(() => setError("Aucun dépôt configuré ou intégration indisponible (GITLAB_BASE_URL/TOKEN/PROJECT_ID, GITHUB_TOKEN/GITHUB_REPOS)."));
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
      <p className="empty">Vue dépôt unifiée GitHub/GitLab (section AM.4) : fournisseur, branche par défaut, dernière activité, pipeline, branches, MR/PR.</p>

      {error && <p className="error" role="alert">{error}</p>}

      {!error && repos.length === 0 && <p className="empty">Aucun dépôt disponible pour l'instant.</p>}

      <div className="dev-repos-list">
        {repos.map((repo) => (
          <article className="item widget-card dev-repo-card" key={repo.key}>
            <span className="item-title">
              <strong>{repo.name}</strong>{' '}
              <span className={`type type-${repo.provider}`}>{repo.provider === 'gitlab' ? 'GitLab' : 'GitHub'}</span>{' '}
              {repo.pipeline && <span className={`status-badge status-badge-${repo.pipeline.status}`}>{repo.pipeline.status}</span>}
            </span>
            <p className="empty">
              Branche par défaut : <strong>{repo.defaultBranch ?? '—'}</strong> · {repo.branchCount} branche(s) · {repo.openChangeCount} MR/PR ouverte(s)
            </p>
            <p className="empty">Dernière activité : {formatDate(repo.lastActivityAt)}</p>
            {repo.lastCommit && <p className="empty">Dernier commit : <code>{repo.lastCommit.sha}</code> — {repo.lastCommit.message} ({repo.lastCommit.author})</p>}
            {repo.latestRelease && <p className="empty">Dernière release : {repo.latestRelease.tag}</p>}
            <span className="item-actions">
              <a href={repo.webUrl} target="_blank" rel="noreferrer"><button type="button">Ouvrir le dépôt</button></a>
              <button type="button" onClick={() => { setSelectedKey(selectedKey === repo.key ? null : repo.key); setTab('changes'); }}>
                {selectedKey === repo.key ? 'Fermer le détail' : 'Détail'}
              </button>
            </span>

            {selectedKey === repo.key && (
              <div className="dev-repo-detail">
                <div className="dev-repo-tabs">
                  <button type="button" className={tab === 'changes' ? 'active' : ''} onClick={() => setTab('changes')}>Merge/Pull requests</button>
                  <button type="button" className={tab === 'commits' ? 'active' : ''} onClick={() => setTab('commits')}>Commits récents</button>
                  <button type="button" className={tab === 'branches' ? 'active' : ''} onClick={() => setTab('branches')}>Branches</button>
                </div>

                {tab === 'changes' && (
                  <ul className="dev-repo-changes">
                    {(detail?.changes ?? []).length === 0 && <li className="empty">Aucune MR/PR.</li>}
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
                    {(detail?.recentCommits ?? []).length === 0 && <li className="empty">Aucun commit.</li>}
                    {(detail?.recentCommits ?? []).map((commit) => (
                      <li key={commit.sha}><code>{commit.sha}</code> {commit.message} — {commit.author} ({formatDate(commit.date)})</li>
                    ))}
                  </ul>
                )}

                {tab === 'branches' && (
                  <div className="dev-repo-branches">
                    <label className="filter">
                      Filtrer :{' '}
                      <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value as typeof branchFilter)}>
                        <option value="all">Toutes</option>
                        <option value="protected">Protégées</option>
                        <option value="stale">Obsolètes</option>
                        <option value="unmerged">Non fusionnées</option>
                      </select>
                    </label>
                    <ul>
                      {visibleBranches.length === 0 && <li className="empty">Aucune branche pour ce filtre.</li>}
                      {visibleBranches.map((branch) => (
                        <li key={branch.name}>
                          <strong>{branch.name}</strong>{' '}
                          {branch.default && <span className="status-badge status-badge-default">défaut</span>}{' '}
                          {branch.protected && <span className="status-badge">protégée</span>}{' '}
                          {branch.stale && <span className="status-badge status-badge-inactive">obsolète</span>}{' '}
                          {branch.merged === false && <span className="status-badge">non fusionnée</span>}{' '}
                          <span className="empty">
                            {branch.aheadBy !== null ? `+${branch.aheadBy}` : '?'} / {branch.behindBy !== null ? `-${branch.behindBy}` : '?'} vs {detail?.defaultBranch ?? '—'} · dernier commit {formatDate(branch.lastCommitDate)}
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
