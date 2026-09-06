import { useEffect, useState, type FormEvent } from 'react';

import { SecretsPanel } from './SecretsPanel.js';
import { IntegrationsPanel } from './IntegrationsPanel.js';
import { CustomWidgetsPanel } from './CustomWidgetsPanel.js';
import { THEME_COLOR_SETTINGS, THEME_PRESETS, type ThemePreset } from '../theme.js';
import { useStrings } from '../i18n/LanguageContext.js';

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface SettingsPanelProps {
  adminLoginThemeId: string;
  setAdminLoginThemeId: (id: string) => void;
  platformThemePresets: ThemePreset[];
  addPlatformThemePreset: (name: string, light: Record<string, string>, dark: Record<string, string>) => void;
  enabledWidgets: Record<'pipelines' | 'alerts', boolean>;
  setEnabledWidgets: (updater: (current: Record<'pipelines' | 'alerts', boolean>) => Record<'pipelines' | 'alerts', boolean>) => void;
  widgetData: { pipelines: { running: number; items: Array<{ id: number; status: string; ref: string; web_url: string }> }; alerts: { active: number; critical: number; items: Array<{ fingerprint: string; labels: Record<string, string>; status: { state: string }; startsAt: string }> } } | null;
  widgetsError: string;
  onCustomWidgetsChange: () => void;
}

/** Regroupe les clés brutes de `/api/settings` par section thématique, pour affichage en blocs repliables. */
const SETTINGS_SECTIONS: Array<{ id: string; keys: string[] }> = [
  { id: 'gitlab', keys: ['GITLAB_BASE_URL', 'GITLAB_TOKEN', 'GITLAB_PROJECT_ID'] },
  { id: 'vault', keys: [] },
  { id: 'haproxy', keys: ['HAPROXY_DATA_PLANE_URL', 'HAPROXY_USERNAME', 'HAPROXY_PASSWORD'] },
  { id: 'coder', keys: ['CODER_BASE_URL', 'CODER_TOKEN', 'CODER_ORGANIZATION_ID', 'CODER_OWNER', 'CODER_DEFAULT_TEMPLATE_ID'] },
  { id: 'proxmox', keys: ['PROXMOX_BASE_URL', 'PROXMOX_API_TOKEN'] },
  { id: 'k8s', keys: ['K8S_API_SERVER', 'K8S_TOKEN', 'ARGOCD_BASE_URL', 'ARGOCD_TOKEN', 'DEPLOYMENT_CENTRAL_REPO_URL'] },
  { id: 'monitoring', keys: ['GRAFANA_BASE_URL', 'GRAFANA_API_KEY', 'ALERTMANAGER_BASE_URL', 'PROMETHEUS_EXPORTERS', 'WAZUH_BASE_URL', 'WAZUH_TOKEN'] },
  { id: 'reseau', keys: ['POWERDNS_BASE_URL', 'POWERDNS_API_KEY', 'POWERDNS_SERVER_ID', 'SURICATA_BASE_URL', 'WIREGUARD_EXPORTER_BASE_URL', 'NATS_MONITOR_BASE_URL'] },
  { id: 'stockage', keys: ['MINIO_BASE_URL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'HARBOR_BASE_URL', 'HARBOR_USERNAME', 'HARBOR_PASSWORD', 'NEXUS_BASE_URL', 'NEXUS_USERNAME', 'NEXUS_PASSWORD', 'VERDACCIO_BASE_URL', 'VERDACCIO_TOKEN'] },
  { id: 'ci', keys: ['WOODPECKER_BASE_URL', 'WOODPECKER_TOKEN'] },
  { id: 'calendriers', keys: ['CALENDAR_PERSONAL_ICS_URL', 'CALENDAR_PROFESSIONAL_ICS_URL'] },
  { id: 'comptes-plateforme', keys: ['GITHUB_PLATFORM_USERNAME', 'GITHUB_PLATFORM_EMAIL', 'GITHUB_PLATFORM_TOKEN', 'GITLAB_PLATFORM_USERNAME', 'GITLAB_PLATFORM_EMAIL', 'GITLAB_PLATFORM_TOKEN'] },
  { id: 'autres', keys: ['GITHUB_TOKEN', 'GITHUB_BASE_URL', 'RABBITMQ_BASE_URL', 'RABBITMQ_USERNAME', 'RABBITMQ_PASSWORD', 'OLLAMA_BASE_URL', 'TERRAFORM_STATE_PATH', 'SAMBA_EXPORTER_BASE_URL', 'N8N_BASE_URL', 'N8N_API_KEY', 'MEILISEARCH_BASE_URL', 'MEILISEARCH_API_KEY', 'REDPANDA_BASE_URL', 'REDPANDA_TOKEN', 'DOCS_PATH'] },
];

const NOTIFICATIONS_FIELD_KEYS: Array<{ key: string; type: string }> = [
  { key: 'SMTP_HOST', type: 'text' },
  { key: 'SMTP_PORT', type: 'text' },
  { key: 'SMTP_USER', type: 'text' },
  { key: 'SMTP_PASSWORD', type: 'password' },
  { key: 'NOTIFICATIONS_EMAIL_FROM', type: 'text' },
  { key: 'NOTIFICATIONS_EMAIL_TO', type: 'text' },
  { key: 'NOTIFICATIONS_WEBHOOK_URL', type: 'text' },
  { key: 'NOTIFICATIONS_WAZUH_THRESHOLD', type: 'text' },
  { key: 'NOTIFICATIONS_RETENTION_DAYS', type: 'text' },
];

const strings = {
  fr: {
    sectionLabels: {
      gitlab: 'GitLab', vault: 'Vault', haproxy: 'HAProxy', coder: 'Coder',
      proxmox: 'Proxmox', k8s: 'Kubernetes / ArgoCD', monitoring: 'Monitoring & alerting',
      reseau: 'Réseau (DNS/sécurité)', stockage: 'Stockage & registres', ci: 'CI/CD',
      calendriers: 'Calendriers', 'comptes-plateforme': 'Comptes GitHub/GitLab dédiés à DevOS',
      autres: 'Autres intégrations',
    } as Record<string, string>,
    smtpFields: {
      SMTP_HOST: { label: 'Hôte', placeholder: 'smtp.example.com' },
      SMTP_PORT: { label: 'Port', placeholder: '587' },
      SMTP_USER: { label: 'Utilisateur', placeholder: 'utilisateur@example.com' },
      SMTP_PASSWORD: { label: 'Mot de passe', placeholder: '••••••••' },
      NOTIFICATIONS_EMAIL_FROM: { label: 'Adresse expéditeur', placeholder: 'devos@example.com' },
      NOTIFICATIONS_EMAIL_TO: { label: 'Destinataire des alertes', placeholder: 'oncall@example.com' },
      NOTIFICATIONS_WEBHOOK_URL: { label: 'Webhook sortant', placeholder: 'https://exemple.com/webhook' },
      NOTIFICATIONS_WAZUH_THRESHOLD: { label: 'Seuil de criticité Wazuh', placeholder: '12' },
      NOTIFICATIONS_RETENTION_DAYS: { label: 'Rétention des notifications (jours)', placeholder: '60' },
    } as Record<string, { label: string; placeholder: string }>,
    settingsNotConfigured: 'Les paramètres ne sont pas configurés sur ce backend.',
    settingsLoadFailed: 'Impossible de charger les paramètres.',
    saveFailed: (key: string) => `Échec de l'enregistrement de ${key}.`,
    deleteFailed: (key: string) => `Échec de la suppression de ${key}.`,
    adminLoginTheme: 'Administration — thème principal de la plateforme',
    adminLoginThemeHint: "Ce thème est défini par l'administrateur comme thème principal de la plateforme : imposé sur l'écran de connexion, et appliqué par défaut à tout nouvel utilisateur n'ayant pas encore personnalisé sa propre apparence.",
    addPlatformThemeHeading: 'Ajouter un thème à la plateforme',
    addPlatformThemeHint: "Personnalisez une palette puis ajoutez-la à la bibliothèque de thèmes de la plateforme, disponible pour tous les utilisateurs en plus des thèmes préconfigurés.",
    platformThemeNameAria: 'Nom du nouveau thème de la plateforme',
    platformThemeNamePlaceholder: 'Nom du thème (ex. Thème société)',
    addPlatformThemeButton: 'Ajouter ce thème à la plateforme',
    smtpHeading: 'Notifications système',
    smtpHint: "Configuration serveur des notifications : email (SMTP), webhook sortant, seuil d'alerte Wazuh et durée de rétention.",
    saved: 'Enregistré ✓',
    saveSmtp: 'Enregistrer la configuration des notifications',
    integrationBuilder: "Générateur d'intégration (custom)",
    integrationBuilderShort: "Générateur d'intégration",
    widgetsHeading: 'Widgets',
    widgetsShort: 'Widgets',
    widgetsHint: 'Widgets système (pipelines, alertes) et widgets custom du Dashboard, basés sur les sources /api/extras/* déjà branchées.',
    pipelinesLabel: 'Pipelines',
    alertsLabel: 'Alertes',
    widgetsLoadFailed: 'Impossible de charger les widgets.',
    loadingSettings: 'Chargement des paramètres…',
    integrationsHeading: 'Intégrations',
    integrationsAria: 'Sections des intégrations',
    platformAccountsHint: 'Identité GitHub/GitLab propre à DevOS (pas un compte personnel), utilisée pour la création automatique de dépôts, le versionnement et les sauvegardes autonomes déclenchées par la plateforme. À distinguer des jetons GitLab/GitHub des autres sections, dédiés au scan du catalogue et des docs.',
    notConfigured: 'Non configuré',
    save: 'Enregistrer',
    clear: (key: string) => `Effacer ${key}`,
  },
  en: {
    sectionLabels: {
      gitlab: 'GitLab', vault: 'Vault', haproxy: 'HAProxy', coder: 'Coder',
      proxmox: 'Proxmox', k8s: 'Kubernetes / ArgoCD', monitoring: 'Monitoring & alerting',
      reseau: 'Network (DNS/security)', stockage: 'Storage & registries', ci: 'CI/CD',
      calendriers: 'Calendars', 'comptes-plateforme': 'GitHub/GitLab accounts dedicated to DevOS',
      autres: 'Other integrations',
    } as Record<string, string>,
    smtpFields: {
      SMTP_HOST: { label: 'Host', placeholder: 'smtp.example.com' },
      SMTP_PORT: { label: 'Port', placeholder: '587' },
      SMTP_USER: { label: 'User', placeholder: 'user@example.com' },
      SMTP_PASSWORD: { label: 'Password', placeholder: '••••••••' },
      NOTIFICATIONS_EMAIL_FROM: { label: 'Sender address', placeholder: 'devos@example.com' },
      NOTIFICATIONS_EMAIL_TO: { label: 'Alert recipient', placeholder: 'oncall@example.com' },
      NOTIFICATIONS_WEBHOOK_URL: { label: 'Outbound webhook', placeholder: 'https://example.com/webhook' },
      NOTIFICATIONS_WAZUH_THRESHOLD: { label: 'Wazuh critical threshold', placeholder: '12' },
      NOTIFICATIONS_RETENTION_DAYS: { label: 'Notification retention (days)', placeholder: '60' },
    } as Record<string, { label: string; placeholder: string }>,
    settingsNotConfigured: 'Settings are not configured on this backend.',
    settingsLoadFailed: 'Unable to load settings.',
    saveFailed: (key: string) => `Failed to save ${key}.`,
    deleteFailed: (key: string) => `Failed to delete ${key}.`,
    adminLoginTheme: 'Administration — platform main theme',
    adminLoginThemeHint: "This theme is set by the administrator as the platform's main theme: enforced on the login screen, and applied by default to any new user who has not yet customized their own appearance.",
    addPlatformThemeHeading: 'Add a theme to the platform',
    addPlatformThemeHint: 'Customize a palette then add it to the platform theme library, available to all users in addition to the preset themes.',
    platformThemeNameAria: 'New platform theme name',
    platformThemeNamePlaceholder: 'Theme name (e.g. Company theme)',
    addPlatformThemeButton: 'Add this theme to the platform',
    smtpHeading: 'System notifications',
    smtpHint: "Server-side notification configuration: email (SMTP), outbound webhook, Wazuh alert threshold and retention period.",
    saved: 'Saved ✓',
    saveSmtp: 'Save notifications configuration',
    integrationBuilder: 'Integration builder (custom)',
    integrationBuilderShort: 'Integration builder',
    widgetsHeading: 'Widgets',
    widgetsShort: 'Widgets',
    widgetsHint: 'System widgets (pipelines, alerts) and custom Dashboard widgets, based on the already connected /api/extras/* sources.',
    pipelinesLabel: 'Pipelines',
    alertsLabel: 'Alerts',
    widgetsLoadFailed: 'Unable to load widgets.',
    loadingSettings: 'Loading settings…',
    integrationsHeading: 'Integrations',
    integrationsAria: 'Integration sections',
    platformAccountsHint: "GitHub/GitLab identity specific to DevOS (not a personal account), used for automatic repository creation, versioning, and autonomous backups triggered by the platform. Distinct from the GitLab/GitHub tokens in other sections, which are dedicated to catalog and docs scanning.",
    notConfigured: 'Not configured',
    save: 'Save',
    clear: (key: string) => `Clear ${key}`,
  },
} as const;

export function SettingsPanel({
  adminLoginThemeId, setAdminLoginThemeId, platformThemePresets, addPlatformThemePreset,
  enabledWidgets, setEnabledWidgets, widgetData, widgetsError, onCustomWidgetsChange,
}: SettingsPanelProps) {
  const s = useStrings(strings);
  const [known, setKnown] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [openSection, setOpenSection] = useState<string>('');
  const allThemePresets: ThemePreset[] = [...THEME_PRESETS, ...platformThemePresets];
  // Palette en cours d'édition pour un nouveau thème de plateforme (section Administration),
  // ajustable jeton par jeton avant d'être ajoutée à la bibliothèque partagée.
  const [newPlatformThemeName, setNewPlatformThemeName] = useState('');
  const [platformThemeDraft, setPlatformThemeDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(THEME_COLOR_SETTINGS.map(({ cssVar, defaultLight }) => [cssVar, defaultLight])),
  );

  useEffect(() => {
    void fetch(`${apiBase()}/api/settings`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? s.settingsNotConfigured : s.settingsLoadFailed);
        const data = await response.json();
        setKnown(data.known);
        setValues(data.values);
        setDrafts(data.values);
        setError('');
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function saveSetting(key: string, valueOverride?: string) {
    const value = valueOverride ?? drafts[key] ?? '';
    const response = await fetch(`${apiBase()}/api/settings/${encodeURIComponent(key)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value }),
    });
    if (!response.ok) { setError(s.saveFailed(key)); return false; }
    setValues((current) => ({ ...current, [key]: value }));
    setSavedKey(key);
    setTimeout(() => setSavedKey((current) => (current === key ? '' : current)), 1500);
    return true;
  }

  async function clearSetting(key: string) {
    const response = await fetch(`${apiBase()}/api/settings/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (!response.ok) { setError(s.deleteFailed(key)); return; }
    setValues((current) => { const next = { ...current }; delete next[key]; return next; });
    setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  async function saveSmtpForm(event: FormEvent) {
    event.preventDefault();
    // Ne réécrit que les champs modifiés (non vides), pour ne pas effacer un mot de passe déjà enregistré
    // simplement parce que le champ est resté vide à l'affichage (par sécurité, les valeurs existantes ne sont jamais pré-remplies en clair).
    const toSave = NOTIFICATIONS_FIELD_KEYS.filter(({ key }) => (drafts[key] ?? '').trim() !== '');
    const results = await Promise.all(toSave.map(({ key }) => saveSetting(key)));
    if (results.every(Boolean)) setSavedKey('smtp-form');
    setTimeout(() => setSavedKey((current) => (current === 'smtp-form' ? '' : current)), 1500);
  }

  const genericKeys = known.filter((key) => !NOTIFICATIONS_FIELD_KEYS.some((field) => field.key === key));
  const scrollToSection = (id: string) => {
    setOpenSection(id);
    requestAnimationFrame(() => document.getElementById(`settings-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="items settings-panel">
      <section className="widget-card settings-admin-login-theme">
        <h3>{s.adminLoginTheme}</h3>
        <p className="empty">
          {s.adminLoginThemeHint}
        </p>
        <div className="theme-preset-grid">
          {allThemePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={preset.id === adminLoginThemeId ? 'theme-preset-swatch active' : 'theme-preset-swatch'}
              onClick={() => setAdminLoginThemeId(preset.id)}
              title={preset.label}
              aria-pressed={preset.id === adminLoginThemeId}
            >
              <span className="theme-preset-swatch-colors">
                <i style={{ background: preset.light.accent }} />
                <i style={{ background: preset.light['accent-2'] }} />
                <i style={{ background: preset.light.gold }} />
              </span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>

        <h4 className="settings-subheading">{s.addPlatformThemeHeading}</h4>
        <p className="empty">{s.addPlatformThemeHint}</p>
        <div className="theme-color-grid">
          {THEME_COLOR_SETTINGS.map(({ cssVar, label, defaultLight }) => (
            <label key={cssVar} className="theme-color-field">
              <span>{label}</span>
              <input
                aria-label={label}
                type="color"
                value={platformThemeDraft[cssVar] ?? defaultLight}
                onChange={(event) => setPlatformThemeDraft((current) => ({ ...current, [cssVar]: event.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="theme-preset-save">
          <input
            aria-label={s.platformThemeNameAria}
            type="text"
            placeholder={s.platformThemeNamePlaceholder}
            value={newPlatformThemeName}
            onChange={(event) => setNewPlatformThemeName(event.target.value)}
          />
          <button
            type="button"
            disabled={!newPlatformThemeName.trim()}
            onClick={() => {
              addPlatformThemePreset(newPlatformThemeName.trim(), platformThemeDraft, platformThemeDraft);
              setNewPlatformThemeName('');
            }}
          >
            {s.addPlatformThemeButton}
          </button>
        </div>
      </section>

      <section className="widget-card" id="settings-section-smtp">
        <h3>{s.smtpHeading}</h3>
        <p className="empty">{s.smtpHint}</p>
        <form className="smtp-form" onSubmit={(event) => void saveSmtpForm(event)}>
          {NOTIFICATIONS_FIELD_KEYS.map((field) => {
            const fieldStrings = s.smtpFields[field.key];
            return (
              <label key={field.key} className="smtp-field">
                <span>{fieldStrings.label}</span>
                <input
                  aria-label={fieldStrings.label}
                  type={field.type}
                  placeholder={values[field.key] ? '••••••••' : fieldStrings.placeholder}
                  value={drafts[field.key] ?? ''}
                  onChange={(event) => setDrafts((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              </label>
            );
          })}
          <button type="submit">{savedKey === 'smtp-form' ? s.saved : s.saveSmtp}</button>
        </form>
      </section>

      <SecretsPanel />

      <details
        id="settings-section-integration-builder"
        className="widget-card settings-section"
        open={openSection === 'integration-builder'}
        onToggle={(event) => { if ((event.target as HTMLDetailsElement).open) setOpenSection('integration-builder'); }}
      >
        <summary>{s.integrationBuilder}</summary>
        <IntegrationsPanel />
      </details>

      <details
        id="settings-section-widgets"
        className="widget-card settings-section"
        open={openSection === 'widgets'}
        onToggle={(event) => { if ((event.target as HTMLDetailsElement).open) setOpenSection('widgets'); }}
      >
        <summary>{s.widgetsHeading}</summary>
        <p className="empty">{s.widgetsHint}</p>
        <div className="filters" aria-label={s.widgetsHeading}>
          <label><input type="checkbox" checked={enabledWidgets.pipelines} onChange={(event) => setEnabledWidgets((current) => ({ ...current, pipelines: event.target.checked }))} /> {s.pipelinesLabel}</label>
          <label><input type="checkbox" checked={enabledWidgets.alerts} onChange={(event) => setEnabledWidgets((current) => ({ ...current, alerts: event.target.checked }))} /> {s.alertsLabel}</label>
        </div>
        {widgetsError && <p className="error" role="alert">{widgetsError}</p>}
        {enabledWidgets.pipelines && widgetData && (
          <section className="view-group">
            <h4 className="settings-subheading">{s.pipelinesLabel} ({widgetData.pipelines.running})</h4>
            {widgetData.pipelines.items.map((pipeline) => <p className="empty" key={pipeline.id}>#{pipeline.id} · {pipeline.ref} · {pipeline.status}</p>)}
          </section>
        )}
        {enabledWidgets.alerts && widgetData && (
          <section className="view-group">
            <h4 className="settings-subheading">{s.alertsLabel} ({widgetData.alerts.active}, {widgetData.alerts.critical})</h4>
            {widgetData.alerts.items.map((alert) => <p className="empty" key={alert.fingerprint}>{alert.labels.alertname ?? alert.fingerprint} · {alert.status.state}</p>)}
          </section>
        )}
        <CustomWidgetsPanel onChange={onCustomWidgetsChange} />
      </details>

      {error && <p className="error" role="alert">{error}</p>}
      {!error && known.length === 0 && <p className="empty">{s.loadingSettings}</p>}

      <section className="widget-card settings-toc" aria-label={s.integrationsAria}>
        <h3>{s.integrationsHeading}</h3>
        <div className="filters">
          <button type="button" className={openSection === 'integration-builder' ? 'filter active' : 'filter'} onClick={() => scrollToSection('integration-builder')}>
            {s.integrationBuilderShort}
          </button>
          <button type="button" className={openSection === 'widgets' ? 'filter active' : 'filter'} onClick={() => scrollToSection('widgets')}>
            {s.widgetsShort}
          </button>
          {SETTINGS_SECTIONS.map((section) => (
            <button key={section.id} type="button" className={openSection === section.id ? 'filter active' : 'filter'} onClick={() => scrollToSection(section.id)}>
              {s.sectionLabels[section.id]}
            </button>
          ))}
        </div>
      </section>

      {SETTINGS_SECTIONS.map((section) => {
        const sectionKeys = genericKeys.filter((key) => section.keys.includes(key));
        if (sectionKeys.length === 0) return null;
        return (
          <details
            key={section.id}
            id={`settings-section-${section.id}`}
            className="widget-card settings-section"
            open={openSection === section.id}
            onToggle={(event) => { if ((event.target as HTMLDetailsElement).open) setOpenSection(section.id); }}
          >
            <summary>{s.sectionLabels[section.id]} <span className="empty">({sectionKeys.length})</span></summary>
            {section.id === 'comptes-plateforme' && (
              <p className="empty">
                {s.platformAccountsHint}
              </p>
            )}
            {sectionKeys.map((key) => (
              <article className="item setting-row" key={key}>
                <strong>{key}</strong>
                <input
                  aria-label={key}
                  type="text"
                  placeholder={values[key] ? '••••••••' : s.notConfigured}
                  value={drafts[key] ?? ''}
                  onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                />
                <span className="setting-actions">
                  <button type="button" onClick={() => void saveSetting(key)}>{savedKey === key ? s.saved : s.save}</button>
                  {values[key] && <button className="delete" type="button" aria-label={s.clear(key)} onClick={() => void clearSetting(key)}>×</button>}
                </span>
              </article>
            ))}
          </details>
        );
      })}
    </div>
  );
}
