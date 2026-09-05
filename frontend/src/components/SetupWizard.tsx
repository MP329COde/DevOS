import { useEffect, useState } from 'react';

import { Logo } from './Logo.js';
import { useStrings } from '../i18n/LanguageContext.js';

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const SETUP_STEP_STORAGE_KEY = 'devos-setup-wizard-step';

const STEPS = ['welcome', 'identity', 'admin', 'integrations', 'summary'] as const;
type Step = (typeof STEPS)[number];

/** Champs "coeur" proposés dès le setup — le reste des ~57 clés d'intégration reste dans Paramètres avancés. */
const CORE_INTEGRATION_FIELDS: Array<{ key: string; type: string; placeholder: string }> = [
  { key: 'GITLAB_BASE_URL', type: 'text', placeholder: 'https://gitlab.example.com/api/v4' },
  { key: 'GITLAB_TOKEN', type: 'password', placeholder: '••••••••' },
  { key: 'GITLAB_PROJECT_ID', type: 'text', placeholder: '42' },
  { key: 'ARGOCD_BASE_URL', type: 'text', placeholder: 'https://argocd.example.com' },
  { key: 'ARGOCD_TOKEN', type: 'password', placeholder: '••••••••' },
  { key: 'ARGOCD_APP_NAME', type: 'text', placeholder: 'devos' },
  { key: 'HAPROXY_DATA_PLANE_URL', type: 'text', placeholder: 'https://haproxy.example.com:5555' },
  { key: 'HAPROXY_USERNAME', type: 'text', placeholder: 'admin' },
  { key: 'HAPROXY_PASSWORD', type: 'password', placeholder: '••••••••' },
];

const strings = {
  fr: {
    stepLabels: { welcome: 'Bienvenue', identity: 'Identité', admin: 'Administrateur', integrations: 'Intégrations', summary: 'Récapitulatif' } as Record<Step, string>,
    welcomeTitle: 'Bienvenue sur DevOS',
    welcomeBody: "Cet assistant configure la plateforme en quelques étapes : identité (nom, logo), compte administrateur, puis connexion des intégrations principales. Vous pourrez tout modifier plus tard depuis Paramètres.",
    next: 'Suivant',
    back: 'Précédent',
    identityTitle: 'Identité de la plateforme',
    platformNameLabel: 'Nom de la plateforme',
    platformNamePlaceholder: 'DevOS',
    logoLabel: 'Logo (optionnel)',
    logoHint: 'PNG/SVG, remplace le logo par défaut partout dans la plateforme.',
    removeLogo: 'Retirer le logo personnalisé',
    adminTitle: 'Compte administrateur initial',
    adminHint: "Cette identité est affichée dans la plateforme (le compte de connexion réel reste géré par Keycloak, voir Paramètres → Kubernetes/ArgoCD pour le SSO).",
    adminNameLabel: 'Nom',
    adminEmailLabel: 'Email',
    integrationsTitle: 'Connecter les intégrations principales',
    integrationsHint: "Ces champs sont optionnels ici — le reste des intégrations (57 clés) reste disponible dans Paramètres → Intégrations.",
    save: 'Enregistrer',
    saved: 'Enregistré ✓',
    summaryTitle: 'Récapitulatif',
    summaryPlatformName: (name: string) => `Plateforme : ${name}`,
    summaryLogo: 'Logo personnalisé défini',
    summaryNoLogo: 'Logo par défaut',
    summaryIntegrations: (count: number) => `${count} intégration(s) principale(s) configurée(s)`,
    finish: 'Terminer la configuration',
    finishing: 'Finalisation…',
    error: "Une erreur est survenue lors de l'enregistrement.",
  },
  en: {
    stepLabels: { welcome: 'Welcome', identity: 'Identity', admin: 'Administrator', integrations: 'Integrations', summary: 'Summary' } as Record<Step, string>,
    welcomeTitle: 'Welcome to DevOS',
    welcomeBody: 'This wizard sets up the platform in a few steps: identity (name, logo), initial administrator account, then connecting the main integrations. Everything can be changed later from Settings.',
    next: 'Next',
    back: 'Back',
    identityTitle: 'Platform identity',
    platformNameLabel: 'Platform name',
    platformNamePlaceholder: 'DevOS',
    logoLabel: 'Logo (optional)',
    logoHint: 'PNG/SVG, replaces the default logo everywhere in the platform.',
    removeLogo: 'Remove custom logo',
    adminTitle: 'Initial administrator account',
    adminHint: 'This identity is displayed in the platform (actual login remains managed by Keycloak, see Settings → Kubernetes/ArgoCD for SSO).',
    adminNameLabel: 'Name',
    adminEmailLabel: 'Email',
    integrationsTitle: 'Connect the main integrations',
    integrationsHint: 'These fields are optional here — the rest of the integrations (57 keys) remain available in Settings → Integrations.',
    save: 'Save',
    saved: 'Saved ✓',
    summaryTitle: 'Summary',
    summaryPlatformName: (name: string) => `Platform: ${name}`,
    summaryLogo: 'Custom logo set',
    summaryNoLogo: 'Default logo',
    summaryIntegrations: (count: number) => `${count} core integration(s) configured`,
    finish: 'Finish setup',
    finishing: 'Finishing…',
    error: 'An error occurred while saving.',
  },
} as const;

async function fetchSettings(): Promise<Record<string, string>> {
  const response = await fetch(`${apiBase()}/api/settings`);
  if (!response.ok) return {};
  const data = await response.json();
  return data.values ?? {};
}

async function saveSetting(key: string, value: string): Promise<boolean> {
  const response = await fetch(`${apiBase()}/api/settings/${encodeURIComponent(key)}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value }),
  });
  return response.ok;
}

async function clearSetting(key: string): Promise<void> {
  await fetch(`${apiBase()}/api/settings/${encodeURIComponent(key)}`, { method: 'DELETE' });
}

interface SetupWizardProps {
  onComplete: (adminName?: string) => void;
  /** true when re-opened from Paramètres after the initial setup already completed (adds a way back out). */
  embedded?: boolean;
  onCancelEmbedded?: () => void;
}

/**
 * Assistant de configuration initiale bloquant (section demandée par l'utilisateur) : identité de
 * la plateforme, compte administrateur, intégrations coeur. L'état de chaque étape est persisté
 * immédiatement via /api/settings (platform.*), donc une interruption (fermeture d'onglet, refresh)
 * reprend là où elle s'était arrêtée plutôt que de perdre la progression.
 */
export function SetupWizard({ onComplete, embedded = false, onCancelEmbedded }: SetupWizardProps) {
  const s = useStrings(strings);
  const [step, setStep] = useState<Step>(() => {
    if (embedded) return 'welcome';
    const stored = window.localStorage.getItem(SETUP_STEP_STORAGE_KEY);
    return (STEPS as readonly string[]).includes(stored ?? '') ? (stored as Step) : 'welcome';
  });
  const [platformName, setPlatformName] = useState('DevOS');
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [integrationDrafts, setIntegrationDrafts] = useState<Record<string, string>>({});
  const [integrationSaved, setIntegrationSaved] = useState<Record<string, boolean>>({});
  const [existingValues, setExistingValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    void fetchSettings().then((values) => {
      setExistingValues(values);
      if (values['platform.name']) setPlatformName(values['platform.name']);
      if (values['platform.logo']) setLogoDataUrl(values['platform.logo']);
      if (values['platform.adminName']) setAdminName(values['platform.adminName']);
      if (values['platform.adminEmail']) setAdminEmail(values['platform.adminEmail']);
    });
  }, []);

  useEffect(() => {
    if (!embedded) window.localStorage.setItem(SETUP_STEP_STORAGE_KEY, step);
  }, [step, embedded]);

  const stepIndex = STEPS.indexOf(step);

  function goTo(next: Step) {
    setError('');
    setStep(next);
  }

  async function handleLogoFile(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setLogoDataUrl(dataUrl);
    await saveSetting('platform.logo', dataUrl);
  }

  async function saveIdentityAndContinue() {
    const ok = await saveSetting('platform.name', platformName.trim() || 'DevOS');
    if (!ok) { setError(s.error); return; }
    goTo('admin');
  }

  async function saveAdminAndContinue() {
    const results = await Promise.all([
      saveSetting('platform.adminName', adminName.trim()),
      saveSetting('platform.adminEmail', adminEmail.trim()),
    ]);
    if (!results.every(Boolean)) { setError(s.error); return; }
    goTo('integrations');
  }

  async function saveIntegrationField(key: string) {
    const value = (integrationDrafts[key] ?? '').trim();
    if (!value) return;
    const ok = await saveSetting(key, value);
    if (!ok) { setError(s.error); return; }
    setExistingValues((current) => ({ ...current, [key]: value }));
    setIntegrationSaved((current) => ({ ...current, [key]: true }));
    setTimeout(() => setIntegrationSaved((current) => ({ ...current, [key]: false })), 1500);
  }

  async function finishSetup() {
    setFinishing(true);
    const ok = await saveSetting('platform.initialized', 'true');
    setFinishing(false);
    if (!ok) { setError(s.error); return; }
    window.localStorage.removeItem(SETUP_STEP_STORAGE_KEY);
    onComplete(adminName.trim() || undefined);
  }

  const configuredIntegrationCount = CORE_INTEGRATION_FIELDS.filter((field) => existingValues[field.key]).length;

  return (
    <div className={embedded ? 'setup-wizard setup-wizard-embedded' : 'setup-wizard setup-wizard-fullscreen'}>
      <div className="setup-wizard-card">
        <header className="setup-wizard-header">
          <Logo size={40} src={logoDataUrl} />
          <ol className="setup-wizard-steps" aria-label="Étapes">
            {STEPS.map((id, index) => (
              <li key={id} className={index === stepIndex ? 'active' : index < stepIndex ? 'done' : ''}>{s.stepLabels[id]}</li>
            ))}
          </ol>
          {embedded && onCancelEmbedded && (
            <button type="button" className="delete" aria-label="Fermer" onClick={onCancelEmbedded}>×</button>
          )}
        </header>

        {step === 'welcome' && (
          <section>
            <h2>{s.welcomeTitle}</h2>
            <p>{s.welcomeBody}</p>
            <div className="setup-wizard-actions">
              <button type="button" onClick={() => goTo('identity')}>{s.next}</button>
            </div>
          </section>
        )}

        {step === 'identity' && (
          <section>
            <h2>{s.identityTitle}</h2>
            <label className="setup-wizard-field">
              <span>{s.platformNameLabel}</span>
              <input type="text" placeholder={s.platformNamePlaceholder} value={platformName} onChange={(event) => setPlatformName(event.target.value)} />
            </label>
            <label className="setup-wizard-field">
              <span>{s.logoLabel}</span>
              <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleLogoFile(file); }} />
            </label>
            <p className="empty">{s.logoHint}</p>
            {logoDataUrl && (
              <button type="button" className="delete" onClick={() => { setLogoDataUrl(undefined); void clearSetting('platform.logo'); }}>{s.removeLogo}</button>
            )}
            <div className="setup-wizard-actions">
              <button type="button" className="filter" onClick={() => goTo('welcome')}>{s.back}</button>
              <button type="button" onClick={() => void saveIdentityAndContinue()}>{s.next}</button>
            </div>
          </section>
        )}

        {step === 'admin' && (
          <section>
            <h2>{s.adminTitle}</h2>
            <p className="empty">{s.adminHint}</p>
            <label className="setup-wizard-field">
              <span>{s.adminNameLabel}</span>
              <input type="text" value={adminName} onChange={(event) => setAdminName(event.target.value)} />
            </label>
            <label className="setup-wizard-field">
              <span>{s.adminEmailLabel}</span>
              <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
            </label>
            <div className="setup-wizard-actions">
              <button type="button" className="filter" onClick={() => goTo('identity')}>{s.back}</button>
              <button type="button" onClick={() => void saveAdminAndContinue()}>{s.next}</button>
            </div>
          </section>
        )}

        {step === 'integrations' && (
          <section>
            <h2>{s.integrationsTitle}</h2>
            <p className="empty">{s.integrationsHint}</p>
            <div className="setup-wizard-integrations">
              {CORE_INTEGRATION_FIELDS.map((field) => (
                <article className="item setting-row" key={field.key}>
                  <strong>{field.key}</strong>
                  <input
                    aria-label={field.key}
                    type={field.type}
                    placeholder={existingValues[field.key] ? '••••••••' : field.placeholder}
                    value={integrationDrafts[field.key] ?? ''}
                    onChange={(event) => setIntegrationDrafts((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                  <button type="button" onClick={() => void saveIntegrationField(field.key)}>{integrationSaved[field.key] ? s.saved : s.save}</button>
                </article>
              ))}
            </div>
            <div className="setup-wizard-actions">
              <button type="button" className="filter" onClick={() => goTo('admin')}>{s.back}</button>
              <button type="button" onClick={() => goTo('summary')}>{s.next}</button>
            </div>
          </section>
        )}

        {step === 'summary' && (
          <section>
            <h2>{s.summaryTitle}</h2>
            <ul>
              <li>{s.summaryPlatformName(platformName || 'DevOS')}</li>
              <li>{logoDataUrl ? s.summaryLogo : s.summaryNoLogo}</li>
              <li>{s.summaryIntegrations(configuredIntegrationCount)}</li>
            </ul>
            <div className="setup-wizard-actions">
              <button type="button" className="filter" onClick={() => goTo('integrations')}>{s.back}</button>
              <button type="button" disabled={finishing} onClick={() => void finishSetup()}>{finishing ? s.finishing : s.finish}</button>
            </div>
          </section>
        )}

        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
