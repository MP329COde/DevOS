import { useEffect, useState, type FormEvent } from 'react';

import { SecretsPanel } from './SecretsPanel.js';
import { IntegrationsPanel } from './IntegrationsPanel.js';
import { THEME_COLOR_SETTINGS, THEME_PRESETS, ANIMATED_BACKGROUNDS, type ThemeMode, type ThemePreset } from '../theme.js';
import { useStrings } from '../i18n/LanguageContext.js';

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const CRITICAL_WAZUH_LEVEL = 12;

interface CustomThemePreset { id: string; name: string; light: Record<string, string>; dark: Record<string, string> }

interface SettingsPanelProps {
  navLayout: 'sidebar' | 'topbar';
  setNavLayout: (layout: 'sidebar' | 'topbar') => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  themeColors: Record<string, string>;
  setThemeColors: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  setThemeColor: (cssVar: string, value: string) => void;
  themeColorHistory: Array<{ cssVar: string; previous: string | undefined }>;
  undoThemeColor: () => void;
  themeAutoStart: string;
  setThemeAutoStart: (value: string) => void;
  themeAutoEnd: string;
  setThemeAutoEnd: (value: string) => void;
  adminLoginThemeId: string;
  setAdminLoginThemeId: (id: string) => void;
  platformThemePresets: ThemePreset[];
  addPlatformThemePreset: (name: string, light: Record<string, string>, dark: Record<string, string>) => void;
  customThemePresets: CustomThemePreset[];
  saveCustomThemePreset: (name: string) => void;
  deleteCustomThemePreset: (id: string) => void;
  applyThemePreset: (light: Record<string, string>, dark: Record<string, string>) => void;
  profileBackground: string;
  setProfileBackground: (id: string) => void;
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => void;
}

/** Regroupe les clés brutes de `/api/settings` par section thématique, pour affichage en blocs repliables. */
const SETTINGS_SECTIONS: Array<{ id: string; keys: string[] }> = [
  { id: 'gitlab', keys: ['GITLAB_BASE_URL', 'GITLAB_TOKEN', 'GITLAB_PROJECT_ID'] },
  { id: 'webhooks', keys: ['NOTIFICATIONS_WEBHOOK_URL'] },
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

const SMTP_FIELD_KEYS: Array<{ key: string; type: string }> = [
  { key: 'SMTP_HOST', type: 'text' },
  { key: 'SMTP_PORT', type: 'text' },
  { key: 'SMTP_USER', type: 'text' },
  { key: 'SMTP_PASSWORD', type: 'password' },
  { key: 'NOTIFICATIONS_EMAIL_FROM', type: 'text' },
  { key: 'NOTIFICATIONS_EMAIL_TO', type: 'text' },
];

const strings = {
  fr: {
    sectionLabels: {
      gitlab: 'GitLab', webhooks: 'Webhooks', vault: 'Vault', haproxy: 'HAProxy', coder: 'Coder',
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
    } as Record<string, { label: string; placeholder: string }>,
    settingsNotConfigured: 'Les paramètres ne sont pas configurés sur ce backend.',
    settingsLoadFailed: 'Impossible de charger les paramètres.',
    saveFailed: (key: string) => `Échec de l'enregistrement de ${key}.`,
    deleteFailed: (key: string) => `Échec de la suppression de ${key}.`,
    appearance: 'Apparence',
    layout: 'Disposition',
    layoutAria: 'Disposition de navigation',
    sidebar: 'Barre latérale',
    topbar: 'Barre du haut',
    themeModeHeading: 'Thème clair / sombre',
    themeModeAria: 'Thème clair/sombre',
    light: 'Clair',
    dark: 'Sombre',
    system: 'Système',
    auto: 'Automatique (horaire)',
    darkStart: 'Début du mode sombre',
    darkEnd: 'Fin du mode sombre',
    customColors: 'Couleurs personnalisées',
    customColorsHint: "Ajustez l'accent et les teintes de fond ; les changements s'appliquent immédiatement et sont mémorisés.",
    resetColors: 'Réinitialiser les couleurs',
    undoLastColor: 'Annuler la dernière couleur',
    presetNameAria: 'Nom du preset personnalisé',
    presetNamePlaceholder: 'Nom du preset (ex. Mon thème)',
    savePreset: 'Sauvegarder ce preset',
    deletePreset: (name: string) => `Supprimer ${name}`,
    presetsHeading: 'Thèmes préconfigurés',
    presetsHint: "Palettes prêtes à l'emploi, appliquées en un clic (remplace la personnalisation courante).",
    animatedBgHeading: 'Fond animé',
    animatedBgHint: 'Fond décoratif en dégradés CSS animés (léger, sans image ni vidéo).',
    animatedBgAria: "Fond d'écran animé",
    adminLoginTheme: 'Administration — thème principal de la plateforme',
    adminLoginThemeHint: "Ce thème est défini par l'administrateur comme thème principal de la plateforme : imposé sur l'écran de connexion, et appliqué par défaut à tout nouvel utilisateur n'ayant pas encore personnalisé sa propre apparence.",
    addPlatformThemeHeading: 'Ajouter un thème à la plateforme',
    addPlatformThemeHint: "Personnalisez une palette puis ajoutez-la à la bibliothèque de thèmes de la plateforme, disponible pour tous les utilisateurs en plus des thèmes préconfigurés.",
    platformThemeNameAria: 'Nom du nouveau thème de la plateforme',
    platformThemeNamePlaceholder: 'Nom du thème (ex. Thème société)',
    addPlatformThemeButton: 'Ajouter ce thème à la plateforme',
    notifications: 'Notifications',
    notificationsHint: (level: number) => `Notification navigateur locale sur échéance dépassée ou alerte critique (Wazuh, niveau ≥ ${level}).`,
    notificationsEnabled: 'Notifications activées ✓',
    notificationsBlocked: 'Notifications bloquées par le navigateur.',
    enableNotifications: 'Activer les notifications navigateur',
    smtpHeading: 'Email / SMTP',
    smtpHint: "Utilisé pour envoyer les notifications d'alerte par email (voir Paramètres → Notifications).",
    saved: 'Enregistré ✓',
    saveSmtp: 'Enregistrer la configuration SMTP',
    integrationBuilder: "Générateur d'intégration (custom)",
    integrationBuilderShort: "Générateur d'intégration",
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
      gitlab: 'GitLab', webhooks: 'Webhooks', vault: 'Vault', haproxy: 'HAProxy', coder: 'Coder',
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
    } as Record<string, { label: string; placeholder: string }>,
    settingsNotConfigured: 'Settings are not configured on this backend.',
    settingsLoadFailed: 'Unable to load settings.',
    saveFailed: (key: string) => `Failed to save ${key}.`,
    deleteFailed: (key: string) => `Failed to delete ${key}.`,
    appearance: 'Appearance',
    layout: 'Layout',
    layoutAria: 'Navigation layout',
    sidebar: 'Sidebar',
    topbar: 'Top bar',
    themeModeHeading: 'Light / dark theme',
    themeModeAria: 'Light/dark theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    auto: 'Automatic (schedule)',
    darkStart: 'Dark mode start',
    darkEnd: 'Dark mode end',
    customColors: 'Custom colors',
    customColorsHint: 'Adjust the accent and background hues; changes apply immediately and are remembered.',
    resetColors: 'Reset colors',
    undoLastColor: 'Undo last color',
    presetNameAria: 'Custom preset name',
    presetNamePlaceholder: 'Preset name (e.g. My theme)',
    savePreset: 'Save this preset',
    deletePreset: (name: string) => `Delete ${name}`,
    presetsHeading: 'Preset themes',
    presetsHint: 'Ready-to-use palettes, applied in one click (replaces the current customization).',
    animatedBgHeading: 'Animated background',
    animatedBgHint: 'Decorative background with animated CSS gradients (lightweight, no image or video).',
    animatedBgAria: 'Animated wallpaper',
    adminLoginTheme: 'Administration — platform main theme',
    adminLoginThemeHint: "This theme is set by the administrator as the platform's main theme: enforced on the login screen, and applied by default to any new user who has not yet customized their own appearance.",
    addPlatformThemeHeading: 'Add a theme to the platform',
    addPlatformThemeHint: 'Customize a palette then add it to the platform theme library, available to all users in addition to the preset themes.',
    platformThemeNameAria: 'New platform theme name',
    platformThemeNamePlaceholder: 'Theme name (e.g. Company theme)',
    addPlatformThemeButton: 'Add this theme to the platform',
    notifications: 'Notifications',
    notificationsHint: (level: number) => `Local browser notification on overdue deadline or critical alert (Wazuh, level ≥ ${level}).`,
    notificationsEnabled: 'Notifications enabled ✓',
    notificationsBlocked: 'Notifications blocked by the browser.',
    enableNotifications: 'Enable browser notifications',
    smtpHeading: 'Email / SMTP',
    smtpHint: 'Used to send alert notifications by email (see Settings → Notifications).',
    saved: 'Saved ✓',
    saveSmtp: 'Save SMTP configuration',
    integrationBuilder: 'Integration builder (custom)',
    integrationBuilderShort: 'Integration builder',
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
  navLayout, setNavLayout, themeMode, setThemeMode, themeColors, setThemeColors, setThemeColor,
  themeColorHistory, undoThemeColor, themeAutoStart, setThemeAutoStart, themeAutoEnd, setThemeAutoEnd,
  adminLoginThemeId, setAdminLoginThemeId, platformThemePresets, addPlatformThemePreset,
  customThemePresets, saveCustomThemePreset, deleteCustomThemePreset, applyThemePreset,
  profileBackground, setProfileBackground, notificationPermission, onRequestNotificationPermission,
}: SettingsPanelProps) {
  const s = useStrings(strings);
  const [known, setKnown] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [openSection, setOpenSection] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
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
    const toSave = SMTP_FIELD_KEYS.filter(({ key }) => (drafts[key] ?? '').trim() !== '');
    const results = await Promise.all(toSave.map(({ key }) => saveSetting(key)));
    if (results.every(Boolean)) setSavedKey('smtp-form');
    setTimeout(() => setSavedKey((current) => (current === 'smtp-form' ? '' : current)), 1500);
  }

  const genericKeys = known.filter((key) => !SMTP_FIELD_KEYS.some((field) => field.key === key));
  const scrollToSection = (id: string) => {
    setOpenSection(id);
    requestAnimationFrame(() => document.getElementById(`settings-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="items settings-panel">
      <section className="widget-card settings-appearance">
        <h3>{s.appearance}</h3>

        <h4 className="settings-subheading">{s.layout}</h4>
        <div className="filters" aria-label={s.layoutAria}>
          <button className={navLayout === 'sidebar' ? 'filter active' : 'filter'} type="button" onClick={() => setNavLayout('sidebar')}>{s.sidebar}</button>
          <button className={navLayout === 'topbar' ? 'filter active' : 'filter'} type="button" onClick={() => setNavLayout('topbar')}>{s.topbar}</button>
        </div>

        <h4 className="settings-subheading">{s.themeModeHeading}</h4>
        <div className="filters" aria-label={s.themeModeAria}>
          <button className={themeMode === 'light' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('light')}>{s.light}</button>
          <button className={themeMode === 'dark' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('dark')}>{s.dark}</button>
          <button className={themeMode === 'system' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('system')}>{s.system}</button>
          <button className={themeMode === 'auto' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('auto')}>{s.auto}</button>
        </div>
        {themeMode === 'auto' && (
          <div className="theme-auto-schedule">
            <label>
              <span>{s.darkStart}</span>
              <input aria-label={s.darkStart} type="time" value={themeAutoStart} onChange={(event) => setThemeAutoStart(event.target.value)} />
            </label>
            <label>
              <span>{s.darkEnd}</span>
              <input aria-label={s.darkEnd} type="time" value={themeAutoEnd} onChange={(event) => setThemeAutoEnd(event.target.value)} />
            </label>
          </div>
        )}

        <h4 className="settings-subheading">{s.customColors}</h4>
        <p className="empty">{s.customColorsHint}</p>
        <div className="theme-color-grid">
          {THEME_COLOR_SETTINGS.map(({ cssVar, label, defaultLight, defaultDark }) => {
            const fallback = themeMode === 'dark' ? defaultDark : defaultLight;
            return (
              <label key={cssVar} className="theme-color-field">
                <span>{label}</span>
                <input
                  aria-label={label}
                  type="color"
                  value={themeColors[cssVar] ?? fallback}
                  onChange={(event) => setThemeColor(cssVar, event.target.value)}
                />
              </label>
            );
          })}
        </div>
        <div className="filters">
          <button type="button" className="theme-reset" onClick={() => setThemeColors(() => ({}))}>{s.resetColors}</button>
          <button type="button" disabled={themeColorHistory.length === 0} onClick={undoThemeColor}>{s.undoLastColor}</button>
        </div>
        <div className="theme-preset-save">
          <input aria-label={s.presetNameAria} type="text" placeholder={s.presetNamePlaceholder} value={newPresetName} onChange={(event) => setNewPresetName(event.target.value)} />
          <button type="button" disabled={!newPresetName.trim()} onClick={() => { saveCustomThemePreset(newPresetName.trim()); setNewPresetName(''); }}>{s.savePreset}</button>
        </div>
        {customThemePresets.length > 0 && (
          <ul className="theme-custom-preset-list">
            {customThemePresets.map((preset) => (
              <li key={preset.id}>
                <button type="button" className="filter" onClick={() => applyThemePreset(preset.light, preset.dark)}>{preset.name}</button>
                <button type="button" className="delete" aria-label={s.deletePreset(preset.name)} onClick={() => deleteCustomThemePreset(preset.id)}>×</button>
              </li>
            ))}
          </ul>
        )}

        <h4 className="settings-subheading">{s.presetsHeading}</h4>
        <p className="empty">{s.presetsHint}</p>
        <div className="theme-preset-grid">
          {allThemePresets.map((preset) => (
            <button key={preset.id} type="button" className="theme-preset-swatch" onClick={() => applyThemePreset(preset.light, preset.dark)} title={preset.label}>
              <span className="theme-preset-swatch-colors">
                <i style={{ background: preset.light.accent }} />
                <i style={{ background: preset.light['accent-2'] }} />
                <i style={{ background: preset.light.gold }} />
              </span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>

        <h4 className="settings-subheading">{s.animatedBgHeading}</h4>
        <p className="empty">{s.animatedBgHint}</p>
        <div className="filters" aria-label={s.animatedBgAria}>
          {ANIMATED_BACKGROUNDS.map((bg) => (
            <button key={bg.id} type="button" className={profileBackground === bg.id ? 'filter active' : 'filter'} onClick={() => setProfileBackground(bg.id)}>{bg.label}</button>
          ))}
        </div>
      </section>

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

      <section className="widget-card">
        <h3>{s.notifications}</h3>
        <p className="empty">{s.notificationsHint(CRITICAL_WAZUH_LEVEL)}</p>
        {notificationPermission === 'granted' ? (
          <p className="empty">{s.notificationsEnabled}</p>
        ) : notificationPermission === 'denied' ? (
          <p className="error" role="alert">{s.notificationsBlocked}</p>
        ) : (
          <button type="button" onClick={onRequestNotificationPermission}>{s.enableNotifications}</button>
        )}
      </section>

      <section className="widget-card" id="settings-section-smtp">
        <h3>{s.smtpHeading}</h3>
        <p className="empty">{s.smtpHint}</p>
        <form className="smtp-form" onSubmit={(event) => void saveSmtpForm(event)}>
          {SMTP_FIELD_KEYS.map((field) => {
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

      {error && <p className="error" role="alert">{error}</p>}
      {!error && known.length === 0 && <p className="empty">{s.loadingSettings}</p>}

      <section className="widget-card settings-toc" aria-label={s.integrationsAria}>
        <h3>{s.integrationsHeading}</h3>
        <div className="filters">
          <button type="button" className={openSection === 'integration-builder' ? 'filter active' : 'filter'} onClick={() => scrollToSection('integration-builder')}>
            {s.integrationBuilderShort}
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
