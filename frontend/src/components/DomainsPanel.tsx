import { useEffect, useState, type FormEvent } from 'react';

import { useStrings } from '../i18n/LanguageContext.js';

const strings = {
  fr: {
    notConfigured: "La gestion des domaines n'est pas configurée (Vault requis).",
    loadError: 'Impossible de charger les domaines.',
    serverUnreachable: 'Impossible de joindre le serveur.',
    saveError: "Échec de l'enregistrement du domaine.",
    deleteError: 'Échec de la suppression.',
    checkError: 'Échec de la vérification du domaine.',
    issueError: "Échec de l'émission du certificat.",
    title: 'Domaines',
    loading: 'Chargement des domaines…',
    empty: 'Aucun domaine enregistré.',
    namePlaceholder: 'Nom de domaine (ex: app.example.duckdns.org)',
    targetPlaceholder: 'Cible (IP)',
    add: 'Ajouter',
    check: 'Vérifier',
    delete: 'Supprimer',
    dnsProviderNone: 'Aucun compte DNS',
    stateLabel: 'État',
    certificateLabel: 'Certificat',
    noCertificate: 'Aucun certificat',
    issueCertificate: 'Émettre un certificat',
    haproxyLink: 'Chaîne HAProxy',
    haproxyNone: 'Aucun lien HAProxy détecté',
    dnsAccountsTitle: 'Comptes DNS dynamiques',
    dnsAccountNamePlaceholder: 'Nom du compte',
    dnsAccountTokenPlaceholder: 'Token / clé API',
    acmeAccountsTitle: 'Comptes ACME',
    acmeAccountNamePlaceholder: 'Nom du compte',
    acmeDirectoryPlaceholder: 'URL du directory ACME',
    acmeEmailPlaceholder: 'Email de contact',
    selectAcmeAccount: 'Choisir un compte ACME',
    expiresAt: (date: string) => `Expire le ${date}`,
  },
  en: {
    notConfigured: 'Domain management is not configured (Vault required).',
    loadError: 'Could not load domains.',
    serverUnreachable: 'Could not reach the server.',
    saveError: 'Failed to save the domain.',
    deleteError: 'Failed to delete.',
    checkError: 'Failed to check the domain.',
    issueError: 'Failed to issue the certificate.',
    title: 'Domains',
    loading: 'Loading domains…',
    empty: 'No domains saved.',
    namePlaceholder: 'Domain name (e.g.: app.example.duckdns.org)',
    targetPlaceholder: 'Target (IP)',
    add: 'Add',
    check: 'Check',
    delete: 'Delete',
    dnsProviderNone: 'No DNS account',
    stateLabel: 'State',
    certificateLabel: 'Certificate',
    noCertificate: 'No certificate',
    issueCertificate: 'Issue certificate',
    haproxyLink: 'HAProxy chain',
    haproxyNone: 'No HAProxy link detected',
    dnsAccountsTitle: 'Dynamic DNS accounts',
    dnsAccountNamePlaceholder: 'Account name',
    dnsAccountTokenPlaceholder: 'Token / API key',
    acmeAccountsTitle: 'ACME accounts',
    acmeAccountNamePlaceholder: 'Account name',
    acmeDirectoryPlaceholder: 'ACME directory URL',
    acmeEmailPlaceholder: 'Contact email',
    selectAcmeAccount: 'Choose an ACME account',
    expiresAt: (date: string) => `Expires on ${date}`,
  },
} as const;

interface DomainDto {
  id: string;
  name: string;
  target: string | null;
  state: string;
  dnsProviderId: string | null;
  haproxyFrontend: string | null;
  lastError: string | null;
}

interface DnsProviderAccountDto {
  id: string;
  name: string;
  kind: string;
}

interface AcmeAccountDto {
  id: string;
  name: string;
}

interface CertificateDto {
  id: string;
  domainId: string;
  state: string;
  expiresAt: string | null;
}

interface HAProxyLinkDto {
  frontend?: { name: string };
  acl?: { aclName: string };
  backend?: { name: string };
  servers: { name: string; address: string; port: number }[];
}

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function DomainsPanel() {
  const s = useStrings(strings);
  const [domains, setDomains] = useState<DomainDto[] | null>(null);
  const [dnsAccounts, setDnsAccounts] = useState<DnsProviderAccountDto[]>([]);
  const [acmeAccounts, setAcmeAccounts] = useState<AcmeAccountDto[]>([]);
  const [certificatesByDomain, setCertificatesByDomain] = useState<Record<string, CertificateDto[]>>({});
  const [links, setLinks] = useState<Record<string, HAProxyLinkDto>>({});
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newDnsAccountName, setNewDnsAccountName] = useState('');
  const [newDnsAccountKind, setNewDnsAccountKind] = useState('duckdns');
  const [newDnsAccountToken, setNewDnsAccountToken] = useState('');
  const [newAcmeName, setNewAcmeName] = useState('');
  const [newAcmeDirectory, setNewAcmeDirectory] = useState('https://acme-v02.api.letsencrypt.org/directory');
  const [newAcmeEmail, setNewAcmeEmail] = useState('');
  const [selectedAcmeAccount, setSelectedAcmeAccount] = useState<Record<string, string>>({});

  const load = () => {
    void fetch(`${apiBase()}/api/domains`, { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 503) { setError(s.notConfigured); setDomains([]); return; }
        if (!response.ok) { setError(s.loadError); return; }
        setDomains(await response.json());
      })
      .catch(() => setError(s.serverUnreachable));

    void fetch(`${apiBase()}/api/domains/dns-provider-accounts`, { credentials: 'include' })
      .then(async (response) => { if (response.ok) setDnsAccounts(await response.json()); })
      .catch(() => undefined);

    void fetch(`${apiBase()}/api/domains/acme-accounts`, { credentials: 'include' })
      .then(async (response) => { if (response.ok) setAcmeAccounts(await response.json()); })
      .catch(() => undefined);
  };

  useEffect(load, []);

  const loadCertificates = async (domainId: string) => {
    const response = await fetch(`${apiBase()}/api/domains/${encodeURIComponent(domainId)}/certificates`, { credentials: 'include' });
    if (response.ok) {
      const body = await response.json();
      setCertificatesByDomain((current) => ({ ...current, [domainId]: body }));
    }
  };

  const loadHaproxyLink = async (domainId: string) => {
    const response = await fetch(`${apiBase()}/api/domains/${encodeURIComponent(domainId)}/haproxy-link`, { credentials: 'include' });
    if (response.ok) {
      const body = await response.json();
      setLinks((current) => ({ ...current, [domainId]: body }));
    }
  };

  useEffect(() => {
    if (!domains) return;
    for (const domain of domains) {
      void loadCertificates(domain.id);
      void loadHaproxyLink(domain.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setError('');
    try {
      const response = await fetch(`${apiBase()}/api/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName, target: newTarget || undefined }),
      });
      if (!response.ok) { setError(s.saveError); return; }
      setNewName('');
      setNewTarget('');
      load();
    } catch {
      setError(s.serverUnreachable);
    }
  };

  const remove = async (id: string) => {
    try {
      const response = await fetch(`${apiBase()}/api/domains/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) { setError(s.deleteError); return; }
      load();
    } catch {
      setError(s.serverUnreachable);
    }
  };

  const check = async (id: string) => {
    try {
      const response = await fetch(`${apiBase()}/api/domains/${encodeURIComponent(id)}/check`, { method: 'POST', credentials: 'include' });
      if (!response.ok) { setError(s.checkError); return; }
      load();
    } catch {
      setError(s.serverUnreachable);
    }
  };

  const issueCertificate = async (domainId: string) => {
    const acmeAccountId = selectedAcmeAccount[domainId];
    if (!acmeAccountId) return;
    try {
      const response = await fetch(`${apiBase()}/api/domains/${encodeURIComponent(domainId)}/certificates/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acmeAccountId }),
      });
      if (!response.ok) { setError(s.issueError); return; }
      void loadCertificates(domainId);
    } catch {
      setError(s.serverUnreachable);
    }
  };

  const createDnsAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!newDnsAccountName.trim() || !newDnsAccountToken) return;
    try {
      const response = await fetch(`${apiBase()}/api/domains/dns-provider-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newDnsAccountName, kind: newDnsAccountKind, token: newDnsAccountToken }),
      });
      if (!response.ok) { setError(s.saveError); return; }
      setNewDnsAccountName('');
      setNewDnsAccountToken('');
      load();
    } catch {
      setError(s.serverUnreachable);
    }
  };

  const removeDnsAccount = async (id: string) => {
    await fetch(`${apiBase()}/api/domains/dns-provider-accounts/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  const createAcmeAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!newAcmeName.trim() || !newAcmeDirectory || !newAcmeEmail) return;
    try {
      const response = await fetch(`${apiBase()}/api/domains/acme-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newAcmeName, directoryUrl: newAcmeDirectory, contactEmail: newAcmeEmail }),
      });
      if (!response.ok) { setError(s.saveError); return; }
      setNewAcmeName('');
      setNewAcmeEmail('');
      load();
    } catch {
      setError(s.serverUnreachable);
    }
  };

  const removeAcmeAccount = async (id: string) => {
    await fetch(`${apiBase()}/api/domains/acme-accounts/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  return (
    <section className="widget-card domains-panel">
      <h3>{s.title}</h3>
      {error && <p className="error" role="alert">{error}</p>}
      {domains === null && !error && <p className="empty">{s.loading}</p>}
      {domains !== null && domains.length === 0 && !error && <p className="empty">{s.empty}</p>}

      {domains?.map((domain) => {
        const certificates = certificatesByDomain[domain.id] ?? [];
        const latestCertificate = certificates[0];
        const link = links[domain.id];
        return (
          <article className="item domain-row" key={domain.id}>
            <div className="domain-row-header">
              <strong>{domain.name}</strong>
              <span className={`badge state-${domain.state}`}>{domain.state}</span>
            </div>
            <p className="domain-target">{domain.target ?? '—'}</p>
            {domain.lastError && <p className="error">{domain.lastError}</p>}

            <p>
              <strong>{s.certificateLabel}:</strong>{' '}
              {latestCertificate
                ? `${latestCertificate.state}${latestCertificate.expiresAt ? ` — ${s.expiresAt(new Date(latestCertificate.expiresAt).toLocaleDateString())}` : ''}`
                : s.noCertificate}
            </p>
            <div className="setting-actions">
              <select value={selectedAcmeAccount[domain.id] ?? ''} onChange={(event) => setSelectedAcmeAccount((current) => ({ ...current, [domain.id]: event.target.value }))}>
                <option value="">{s.selectAcmeAccount}</option>
                {acmeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
              <button type="button" disabled={!selectedAcmeAccount[domain.id]} onClick={() => void issueCertificate(domain.id)}>{s.issueCertificate}</button>
            </div>

            <p><strong>{s.haproxyLink}:</strong> {link?.frontend ? `${link.frontend.name} → ${link.acl?.aclName ?? '?'} → ${link.backend?.name ?? '?'} → ${link.servers.map((server) => `${server.address}:${server.port}`).join(', ') || '?'}` : s.haproxyNone}</p>

            <span className="setting-actions">
              <button type="button" onClick={() => void check(domain.id)}>{s.check}</button>
              <button className="delete" type="button" onClick={() => void remove(domain.id)}>{s.delete}</button>
            </span>
          </article>
        );
      })}

      <form className="new-item domain-form" onSubmit={(event) => void create(event)}>
        <input aria-label={s.namePlaceholder} placeholder={s.namePlaceholder} value={newName} onChange={(event) => setNewName(event.target.value)} />
        <input aria-label={s.targetPlaceholder} placeholder={s.targetPlaceholder} value={newTarget} onChange={(event) => setNewTarget(event.target.value)} />
        <button type="submit">{s.add}</button>
      </form>

      <h4>{s.dnsAccountsTitle}</h4>
      {dnsAccounts.map((account) => (
        <article className="item" key={account.id}>
          <strong>{account.name}</strong> <span className="badge">{account.kind}</span>
          <button className="delete" type="button" onClick={() => void removeDnsAccount(account.id)}>×</button>
        </article>
      ))}
      {dnsAccounts.length === 0 && <p className="empty">{s.dnsProviderNone}</p>}
      <form className="new-item" onSubmit={(event) => void createDnsAccount(event)}>
        <input aria-label={s.dnsAccountNamePlaceholder} placeholder={s.dnsAccountNamePlaceholder} value={newDnsAccountName} onChange={(event) => setNewDnsAccountName(event.target.value)} />
        <select value={newDnsAccountKind} onChange={(event) => setNewDnsAccountKind(event.target.value)}>
          <option value="duckdns">DuckDNS</option>
          <option value="cloudflare">Cloudflare</option>
          <option value="ovh">OVH</option>
          <option value="manual">Manuel</option>
        </select>
        <input aria-label={s.dnsAccountTokenPlaceholder} type="password" placeholder={s.dnsAccountTokenPlaceholder} value={newDnsAccountToken} onChange={(event) => setNewDnsAccountToken(event.target.value)} />
        <button type="submit">{s.add}</button>
      </form>

      <h4>{s.acmeAccountsTitle}</h4>
      {acmeAccounts.map((account) => (
        <article className="item" key={account.id}>
          <strong>{account.name}</strong>
          <button className="delete" type="button" onClick={() => void removeAcmeAccount(account.id)}>×</button>
        </article>
      ))}
      <form className="new-item" onSubmit={(event) => void createAcmeAccount(event)}>
        <input aria-label={s.acmeAccountNamePlaceholder} placeholder={s.acmeAccountNamePlaceholder} value={newAcmeName} onChange={(event) => setNewAcmeName(event.target.value)} />
        <input aria-label={s.acmeDirectoryPlaceholder} placeholder={s.acmeDirectoryPlaceholder} value={newAcmeDirectory} onChange={(event) => setNewAcmeDirectory(event.target.value)} />
        <input aria-label={s.acmeEmailPlaceholder} placeholder={s.acmeEmailPlaceholder} value={newAcmeEmail} onChange={(event) => setNewAcmeEmail(event.target.value)} />
        <button type="submit">{s.add}</button>
      </form>
    </section>
  );
}
