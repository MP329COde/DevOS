import { createServer } from 'node:http';

// Serveur de démonstration : fournit des réponses fictives mais cohérentes entre elles
// (mêmes noms de machines/services partout) pour les intégrations DevOS, afin de visualiser
// le rendu des pages sans avoir de vraie infra Proxmox/Wazuh/HAProxy/etc. branchée.
// Ne jamais utiliser en production — aucune authentification n'est vérifiée.

const PORT = Number(process.env.MOCK_PORT ?? 4600);

const NODES = ['pve-01', 'pve-02'];

const VMS = {
  'pve-01': [
    { vmid: 101, name: 'gitlab-mpc', status: 'running' },
    { vmid: 102, name: 'coder-workspaces', status: 'running' },
    { vmid: 103, name: 'db-postgres', status: 'running' },
  ],
  'pve-02': [
    { vmid: 201, name: 'haproxy-edge', status: 'running' },
    { vmid: 202, name: 'monitoring-stack', status: 'stopped' },
  ],
};

const DNS_ZONE = 'homelab.duckdns.org.';
const DNS_RECORDS = [
  { name: 'gitlab.homelab.duckdns.org.', type: 'A', content: '10.0.0.11' },
  { name: 'coder.homelab.duckdns.org.', type: 'A', content: '10.0.0.12' },
  { name: 'db.homelab.duckdns.org.', type: 'A', content: '10.0.0.13' },
  { name: 'edge.homelab.duckdns.org.', type: 'A', content: '10.0.0.21' },
  { name: 'grafana.homelab.duckdns.org.', type: 'A', content: '10.0.0.22' },
];

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function text(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain' });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  // --- Proxmox ---
  if (path === '/api2/json/nodes') {
    return json(res, 200, { data: NODES.map((node) => ({ node, status: 'online', cpu: node === 'pve-01' ? 0.34 : 0.18, mem: node === 'pve-01' ? 0.61 : 0.42 })) });
  }
  let m = path.match(/^\/api2\/json\/nodes\/([^/]+)\/qemu$/);
  if (m) return json(res, 200, { data: VMS[m[1]] ?? [] });
  m = path.match(/^\/api2\/json\/nodes\/([^/]+)\/lxc$/);
  if (m) return json(res, 200, { data: [] });
  m = path.match(/^\/api2\/json\/nodes\/([^/]+)\/qemu\/(\d+)\/status\/(start|stop|shutdown|reboot)$/);
  if (m) return json(res, 200, { data: null });

  // --- PowerDNS ---
  if (path === `/api/v1/servers/localhost/zones`) {
    return json(res, 200, [{ id: DNS_ZONE, name: DNS_ZONE, kind: 'Native' }]);
  }
  if (path === `/api/v1/servers/localhost/zones/${encodeURIComponent(DNS_ZONE)}`) {
    return json(res, 200, {
      name: DNS_ZONE,
      rrsets: DNS_RECORDS.map((r) => ({ name: r.name, type: r.type, records: [{ content: r.content }] })),
    });
  }

  // --- Wazuh ---
  if (path === '/security/alerts') {
    return json(res, 200, {
      data: {
        affected_items: [
          { id: 'w-1042', rule: { description: 'Tentative de connexion SSH échouée répétée', level: 10 }, timestamp: new Date(Date.now() - 3600_000).toISOString() },
          { id: 'w-1043', rule: { description: "Modification suspecte d'un fichier système", level: 13 }, timestamp: new Date(Date.now() - 900_000).toISOString() },
        ],
      },
    });
  }

  // --- HAProxy Data Plane API v3 ---
  if (path === '/v3/services/haproxy/configuration/version') return text(res, 200, '4');
  if (path === '/v3/services/haproxy/configuration/backends') {
    return json(res, 200, [{ name: 'be_gitlab' }, { name: 'be_coder' }, { name: 'be_grafana' }]);
  }
  if (path === '/v3/services/haproxy/configuration/frontends') {
    return json(res, 200, [{ name: 'fe_https', mode: 'http', bind: '*:443' }]);
  }
  if (path.startsWith('/v3/services/haproxy/configuration/servers')) {
    if (req.method === 'GET') return json(res, 200, [{ name: 'srv1', address: '10.0.0.11', port: 443, check: 'enabled' }]);
    return json(res, 200, { data: null });
  }
  if (path.startsWith('/v3/services/haproxy/configuration/acl')) {
    if (req.method === 'GET') return json(res, 200, [{ index: 0, acl_name: 'is_gitlab', criterion: 'hdr(host)', value: 'gitlab.homelab.duckdns.org' }]);
    return json(res, 200, { data: null });
  }
  if (path === '/v3/services/haproxy/storage/ssl_certificates') {
    return json(res, 200, [{ storage_name: 'wildcard-homelab.pem', description: 'Let\'s Encrypt *.homelab.duckdns.org' }]);
  }
  if (path === '/v3/services/haproxy/reloads') return json(res, 200, { data: null });

  // --- ArgoCD ---
  if (path === '/api/v1/applications') {
    return json(res, 200, {
      items: [
        { metadata: { name: 'devos' }, status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } } },
        { metadata: { name: 'gitlab' }, status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } } },
      ],
    });
  }
  m = path.match(/^\/api\/v1\/applications\/([^/]+)$/);
  if (m) return json(res, 200, { status: { history: [{ id: 1, revision: 'abc1234', deployedAt: new Date().toISOString() }] } });

  // --- Kubernetes ---
  if (path === '/api/v1/pods') return json(res, 200, { items: [{ metadata: { name: 'devos-backend-7d9', namespace: 'devos' }, spec: { nodeName: 'pve-01' }, status: { phase: 'Running' } }] });
  if (path === '/apis/apps/v1/deployments') return json(res, 200, { items: [{ metadata: { name: 'devos-backend', namespace: 'devos' }, spec: { replicas: 2 }, status: { readyReplicas: 2 } }] });
  if (path === '/api/v1/nodes') return json(res, 200, { items: NODES.map((node) => ({ metadata: { name: node }, status: { conditions: [{ type: 'Ready', status: 'True' }] } })) });

  // --- Harbor ---
  if (path === '/api/v2.0/projects') return json(res, 200, [{ project_id: 1, name: 'devos', repo_count: 3 }]);

  // --- Alertmanager ---
  if (path === '/api/v2/alerts') {
    return json(res, 200, [
      { fingerprint: 'a1b2c3', labels: { alertname: 'DiskSpaceLow', severity: 'warning', instance: 'pve-02' }, status: { state: 'active' }, startsAt: new Date(Date.now() - 1800_000).toISOString() },
      { fingerprint: 'd4e5f6', labels: { alertname: 'ServiceDown', severity: 'critical', instance: 'monitoring-stack' }, status: { state: 'active' }, startsAt: new Date(Date.now() - 600_000).toISOString() },
    ]);
  }

  // --- GitLab (pipelines widget + vue dépôt unifiée AM.4) ---
  m = path.match(/^\/projects\/([^/]+)$/);
  if (m) {
    return json(res, 200, {
      id: Number(m[1]) || 1,
      path_with_namespace: 'root/devos',
      default_branch: 'main',
      web_url: 'https://mpc-gitlab.duckdns.org/root/devos',
      last_activity_at: new Date(Date.now() - 3600_000).toISOString(),
    });
  }
  m = path.match(/^\/projects\/[^/]+\/repository\/branches$/);
  if (m) {
    return json(res, 200, [
      { name: 'main', protected: true, default: true, merged: false, commit: { id: 'a1b2c3d', short_id: 'a1b2c3d', title: 'chore: mise à jour dépendances', author_name: 'Matthew', committed_date: new Date(Date.now() - 3600_000).toISOString() } },
      { name: 'feature/vue-depot', protected: false, default: false, merged: false, commit: { id: 'b2c3d4e', short_id: 'b2c3d4e', title: 'feat: vue dépôt unifiée', author_name: 'Matthew', committed_date: new Date(Date.now() - 86_400_000).toISOString() } },
      { name: 'fix/legacy-cleanup', protected: false, default: false, merged: false, commit: { id: 'c3d4e5f', short_id: 'c3d4e5f', title: 'fix: nettoyage ancien code', author_name: 'Matthew', committed_date: new Date(Date.now() - 200 * 86_400_000).toISOString() } },
    ]);
  }
  m = path.match(/^\/projects\/[^/]+\/merge_requests$/);
  if (m) {
    return json(res, 200, [
      { id: 1, iid: 42, title: 'feat: vue dépôt unifiée', state: 'opened', source_branch: 'feature/vue-depot', target_branch: 'main', web_url: 'https://mpc-gitlab.duckdns.org/root/devos/-/merge_requests/42', author: { name: 'Matthew' }, updated_at: new Date(Date.now() - 3600_000).toISOString() },
      { id: 2, iid: 41, title: 'fix: correctif topologie réseau', state: 'merged', source_branch: 'fix/network', target_branch: 'main', web_url: 'https://mpc-gitlab.duckdns.org/root/devos/-/merge_requests/41', author: { name: 'Matthew' }, updated_at: new Date(Date.now() - 5 * 86_400_000).toISOString() },
    ]);
  }
  m = path.match(/^\/projects\/[^/]+\/repository\/commits$/);
  if (m) {
    return json(res, 200, [
      { id: 'a1b2c3d', short_id: 'a1b2c3d', title: 'chore: mise à jour dépendances', author_name: 'Matthew', committed_date: new Date(Date.now() - 3600_000).toISOString() },
      { id: 'd4e5f6a', short_id: 'd4e5f6a', title: 'feat: widgets dashboard', author_name: 'Matthew', committed_date: new Date(Date.now() - 2 * 3600_000).toISOString() },
      { id: 'e5f6a7b', short_id: 'e5f6a7b', title: 'fix: correctif topologie réseau', author_name: 'Matthew', committed_date: new Date(Date.now() - 5 * 86_400_000).toISOString() },
    ]);
  }
  m = path.match(/^\/projects\/[^/]+\/releases$/);
  if (m) return json(res, 200, [{ tag_name: 'v0.9.0', name: 'v0.9.0', released_at: new Date(Date.now() - 10 * 86_400_000).toISOString() }]);
  m = path.match(/^\/projects\/[^/]+\/repository\/compare$/);
  if (m) {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (to === 'feature/vue-depot' || from === 'feature/vue-depot') return json(res, 200, { commits: [{ id: 'b2c3d4e' }] });
    return json(res, 200, { commits: [] });
  }
  m = path.match(/^\/projects\/[^/]+\/pipelines$/);
  if (m) return json(res, 200, [{ id: 4821, status: 'running', ref: 'main', web_url: 'https://mpc-gitlab.duckdns.org/root/devos/-/pipelines/4821', updated_at: new Date().toISOString() }]);

  // --- Prometheus exporters (text format) ---
  m = path.match(/^\/exporters\/([^/]+)\/metrics$/);
  if (m) {
    if (m[1] === 'system') {
      return text(res, 200, `node_cpu_usage_ratio 0.27\nnode_memory_usage_ratio 0.58\nnode_filesystem_usage_ratio 0.41\n`);
    }
    return text(res, 200, `pg_up 1\npg_stat_database_numbackends 12\n`);
  }

  return json(res, 404, { error: 'Not found (mock)' });
});

server.listen(PORT, () => {
  console.log(`Mock integrations server listening on http://localhost:${PORT}`);
});
