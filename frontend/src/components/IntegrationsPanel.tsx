import { useEffect, useState, type FormEvent } from 'react';
import { useStrings } from '../i18n/LanguageContext.js';

type AuthType = 'none' | 'basic' | 'bearer' | 'apiKey';

const strings = {
  fr: {
    nameLabel: "Nom de l'intégration",
    namePlaceholder: 'Nom (ex: grafana-secondaire)',
    baseUrlLabel: 'URL de base',
    authTypeLabel: "Type d'authentification",
    authNone: 'Aucune',
    authBasic: 'Basic (utilisateur/mot de passe)',
    authBearer: 'Bearer (token)',
    authApiKey: 'Clé API (en-tête)',
    usernameLabel: 'Utilisateur',
    usernamePlaceholder: 'Utilisateur',
    passwordLabel: 'Mot de passe',
    passwordPlaceholder: 'Mot de passe',
    tokenLabel: 'Token',
    tokenPlaceholder: 'Token',
    headerNameLabel: "Nom de l'en-tête",
    apiKeyLabel: 'Clé API',
    apiKeyPlaceholder: 'Clé API',
    testing: 'Test en cours…',
    testButton: 'Tester la connexion',
    generatorNotConfigured: "Le générateur d'intégration n'est pas configuré côté serveur.",
    unreachable: 'Impossible de joindre le serveur.',
    nameAndUrlRequired: 'Nom et URL requis avant de sauvegarder.',
    saveFailed: 'Échec de la sauvegarde.',
    resultTitle: 'Résultat du test',
    reachable: (reachable: boolean, status?: number) => `Joignable : ${reachable ? 'oui' : 'non'}${status ? ` (HTTP ${status})` : ''}`,
    detectedApiType: (type: string) => `Type d'API détecté : ${type}`,
    saveThisIntegration: 'Sauvegarder cette intégration',
    savedTitle: 'Intégrations enregistrées',
    noSaved: 'Aucune intégration custom enregistrée.',
  },
  en: {
    nameLabel: 'Integration name',
    namePlaceholder: 'Name (e.g. grafana-secondary)',
    baseUrlLabel: 'Base URL',
    authTypeLabel: 'Authentication type',
    authNone: 'None',
    authBasic: 'Basic (username/password)',
    authBearer: 'Bearer (token)',
    authApiKey: 'API key (header)',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password',
    tokenLabel: 'Token',
    tokenPlaceholder: 'Token',
    headerNameLabel: 'Header name',
    apiKeyLabel: 'API key',
    apiKeyPlaceholder: 'API key',
    testing: 'Testing…',
    testButton: 'Test connection',
    generatorNotConfigured: 'The integration generator is not configured on the server side.',
    unreachable: 'Could not reach the server.',
    nameAndUrlRequired: 'Name and URL are required before saving.',
    saveFailed: 'Failed to save.',
    resultTitle: 'Test result',
    reachable: (reachable: boolean, status?: number) => `Reachable: ${reachable ? 'yes' : 'no'}${status ? ` (HTTP ${status})` : ''}`,
    detectedApiType: (type: string) => `Detected API type: ${type}`,
    saveThisIntegration: 'Save this integration',
    savedTitle: 'Saved integrations',
    noSaved: 'No custom integration saved.',
  },
} as const;

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
  const s = useStrings(strings);
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
        credentials: 'include',
        body: JSON.stringify({ baseUrl, authType, credentials: credentials() }),
      });
      if (response.status === 503) { setError(s.generatorNotConfigured); return; }
      setTestResult(await response.json());
    } catch {
      setError(s.unreachable);
    } finally {
      setTesting(false);
    }
  };

  const saveIntegration = async () => {
    if (!name.trim() || !baseUrl.trim()) { setError(s.nameAndUrlRequired); return; }
    setError('');
    try {
      const response = await fetch(`${apiBase()}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, config: { baseUrl, authType, credentials: credentials() } }),
      });
      if (!response.ok) { setError(s.saveFailed); return; }
      setName('');
      loadSaved();
    } catch {
      setError(s.unreachable);
    }
  };

  return (
    <div className="items integrations-panel">
      <form className="new-item integration-form" onSubmit={(event) => void testConnection(event)}>
        <input aria-label={s.nameLabel} placeholder={s.namePlaceholder} value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label={s.baseUrlLabel} placeholder="https://service.example.internal" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required />
        <select aria-label={s.authTypeLabel} value={authType} onChange={(event) => setAuthType(event.target.value as AuthType)}>
          <option value="none">{s.authNone}</option>
          <option value="basic">{s.authBasic}</option>
          <option value="bearer">{s.authBearer}</option>
          <option value="apiKey">{s.authApiKey}</option>
        </select>
        {authType === 'basic' && (<>
          <input aria-label={s.usernameLabel} placeholder={s.usernamePlaceholder} value={username} onChange={(event) => setUsername(event.target.value)} />
          <input aria-label={s.passwordLabel} type="password" placeholder={s.passwordPlaceholder} value={password} onChange={(event) => setPassword(event.target.value)} />
        </>)}
        {authType === 'bearer' && (
          <input aria-label={s.tokenLabel} type="password" placeholder={s.tokenPlaceholder} value={token} onChange={(event) => setToken(event.target.value)} />
        )}
        {authType === 'apiKey' && (<>
          <input aria-label={s.headerNameLabel} placeholder="X-API-Key" value={apiKeyHeader} onChange={(event) => setApiKeyHeader(event.target.value)} />
          <input aria-label={s.apiKeyLabel} type="password" placeholder={s.apiKeyPlaceholder} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
        </>)}
        <button type="submit" disabled={testing}>{testing ? s.testing : s.testButton}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {testResult && (
        <div className="widget-card integration-test-result">
          <h3>{s.resultTitle}</h3>
          <p className="empty">{s.reachable(testResult.reachable, testResult.status)}</p>
          <p className="empty">{s.detectedApiType(testResult.detectedApiType)}</p>
          {testResult.error && <p className="error" role="alert">{testResult.error}</p>}
          {testResult.reachable && <button type="button" onClick={() => void saveIntegration()}>{s.saveThisIntegration}</button>}
        </div>
      )}
      <section className="view-group">
        <h3>{s.savedTitle}</h3>
        {saved.length === 0 && <p className="empty">{s.noSaved}</p>}
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
