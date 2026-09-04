import { useEffect, useState, type FormEvent } from 'react';

type AuthType = 'none' | 'basic' | 'bearer' | 'apiKey';

interface SavedIntegration {
  name: string;
  config: { baseUrl: string; authType: AuthType };
}

interface TestResult {
  reachable: boolean;
  status?: number;
  detectedApiType: 'openapi' | 'rest-generic' | 'unknown';
  error?: string;
}

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function IntegrationsPanel() {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [authType, setAuthType] = useState<AuthType>('none');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedIntegration[]>([]);

  const credentials = () => {
    if (authType === 'basic') return { username, password };
    if (authType === 'bearer') return { token };
    if (authType === 'apiKey') return { apiKey, apiKeyHeader };
    return undefined;
  };

  const loadSaved = () => {
    void fetch(`${apiBase()}/api/integrations`)
      .then(async (response) => { if (response.ok) setSaved(await response.json()); })
      .catch(() => undefined);
  };

  useEffect(loadSaved, []);

  const testConnection = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setTestResult(null);
    setTesting(true);
    try {
      const response = await fetch(`${apiBase()}/api/integrations/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, authType, credentials: credentials() }),
      });
      if (response.status === 503) { setError('Le générateur d\'intégration n\'est pas configuré côté serveur.'); return; }
      setTestResult(await response.json());
    } catch {
      setError('Impossible de joindre le serveur.');
    } finally {
      setTesting(false);
    }
  };

  const saveIntegration = async () => {
    if (!name.trim() || !baseUrl.trim()) { setError('Nom et URL requis avant de sauvegarder.'); return; }
    setError('');
    try {
      const response = await fetch(`${apiBase()}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config: { baseUrl, authType, credentials: credentials() } }),
      });
      if (!response.ok) { setError('Échec de la sauvegarde.'); return; }
      setName('');
      loadSaved();
    } catch {
      setError('Impossible de joindre le serveur.');
    }
  };

  return (
    <div className="items integrations-panel">
      <p className="empty">
        Teste la connectivité d'une API via une URL + un mode d'authentification, avec détection best-effort
        OpenAPI/Swagger. Il ne s'agit pas d'une découverte magique universelle : au-delà d'un health check et
        d'une recherche de document OpenAPI standard, aucune donnée n'est inventée.
      </p>
      <form className="new-item integration-form" onSubmit={(event) => void testConnection(event)}>
        <input aria-label="Nom de l'intégration" placeholder="Nom (ex: grafana-secondaire)" value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="URL de base" placeholder="https://service.example.internal" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required />
        <select aria-label="Type d'authentification" value={authType} onChange={(event) => setAuthType(event.target.value as AuthType)}>
          <option value="none">Aucune</option>
          <option value="basic">Basic (utilisateur/mot de passe)</option>
          <option value="bearer">Bearer (token)</option>
          <option value="apiKey">Clé API (en-tête)</option>
        </select>
        {authType === 'basic' && (<>
          <input aria-label="Utilisateur" placeholder="Utilisateur" value={username} onChange={(event) => setUsername(event.target.value)} />
          <input aria-label="Mot de passe" type="password" placeholder="Mot de passe" value={password} onChange={(event) => setPassword(event.target.value)} />
        </>)}
        {authType === 'bearer' && (
          <input aria-label="Token" type="password" placeholder="Token" value={token} onChange={(event) => setToken(event.target.value)} />
        )}
        {authType === 'apiKey' && (<>
          <input aria-label="Nom de l'en-tête" placeholder="X-API-Key" value={apiKeyHeader} onChange={(event) => setApiKeyHeader(event.target.value)} />
          <input aria-label="Clé API" type="password" placeholder="Clé API" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
        </>)}
        <button type="submit" disabled={testing}>{testing ? 'Test en cours…' : 'Tester la connexion'}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {testResult && (
        <div className="widget-card integration-test-result">
          <h3>Résultat du test</h3>
          <p className="empty">Joignable : {testResult.reachable ? 'oui' : 'non'}{testResult.status ? ` (HTTP ${testResult.status})` : ''}</p>
          <p className="empty">Type d'API détecté : {testResult.detectedApiType}</p>
          {testResult.error && <p className="error" role="alert">{testResult.error}</p>}
          {testResult.reachable && <button type="button" onClick={() => void saveIntegration()}>Sauvegarder cette intégration</button>}
        </div>
      )}
      <section className="view-group">
        <h3>Intégrations enregistrées</h3>
        {saved.length === 0 && <p className="empty">Aucune intégration custom enregistrée.</p>}
        {saved.map((integration) => (
          <article className="item" key={integration.name}>
            <strong>{integration.name}</strong>
            <span className="integrations">{integration.config.baseUrl} · {integration.config.authType}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
