import { useEffect, useState, type FormEvent } from 'react';

import { SecretsPanel } from './SecretsPanel.js';
import { IntegrationsPanel } from './IntegrationsPanel.js';
import { THEME_COLOR_SETTINGS, THEME_PRESETS, ANIMATED_BACKGROUNDS, type ThemeMode } from '../theme.js';

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
const SETTINGS_SECTIONS: Array<{ id: string; label: string; keys: string[] }> = [
  { id: 'gitlab', label: 'GitLab', keys: ['GITLAB_BASE_URL', 'GITLAB_TOKEN', 'GITLAB_PROJECT_ID'] },
  { id: 'webhooks', label: 'Webhooks', keys: ['NOTIFICATIONS_WEBHOOK_URL'] },
  { id: 'vault', label: 'Vault', keys: [] },
  { id: 'haproxy', label: 'HAProxy', keys: ['HAPROXY_DATA_PLANE_URL', 'HAPROXY_USERNAME', 'HAPROXY_PASSWORD'] },
  { id: 'coder', label: 'Coder', keys: ['CODER_BASE_URL', 'CODER_TOKEN', 'CODER_ORGANIZATION_ID', 'CODER_OWNER', 'CODER_DEFAULT_TEMPLATE_ID'] },
  { id: 'proxmox', label: 'Proxmox', keys: ['PROXMOX_BASE_URL', 'PROXMOX_API_TOKEN'] },
  { id: 'k8s', label: 'Kubernetes / ArgoCD', keys: ['K8S_API_SERVER', 'K8S_TOKEN', 'ARGOCD_BASE_URL', 'ARGOCD_TOKEN', 'DEPLOYMENT_CENTRAL_REPO_URL'] },
  { id: 'monitoring', label: 'Monitoring & alerting', keys: ['GRAFANA_BASE_URL', 'GRAFANA_API_KEY', 'ALERTMANAGER_BASE_URL', 'PROMETHEUS_EXPORTERS', 'WAZUH_BASE_URL', 'WAZUH_TOKEN'] },
  { id: 'reseau', label: 'Réseau (DNS/sécurité)', keys: ['POWERDNS_BASE_URL', 'POWERDNS_API_KEY', 'POWERDNS_SERVER_ID', 'SURICATA_BASE_URL', 'WIREGUARD_EXPORTER_BASE_URL', 'NATS_MONITOR_BASE_URL'] },
  { id: 'stockage', label: 'Stockage & registres', keys: ['MINIO_BASE_URL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'HARBOR_BASE_URL', 'HARBOR_USERNAME', 'HARBOR_PASSWORD', 'NEXUS_BASE_URL', 'NEXUS_USERNAME', 'NEXUS_PASSWORD', 'VERDACCIO_BASE_URL', 'VERDACCIO_TOKEN'] },
  { id: 'ci', label: 'CI/CD', keys: ['WOODPECKER_BASE_URL', 'WOODPECKER_TOKEN'] },
  { id: 'calendriers', label: 'Calendriers', keys: ['CALENDAR_PERSONAL_ICS_URL', 'CALENDAR_PROFESSIONAL_ICS_URL'] },
  { id: 'comptes-plateforme', label: 'Comptes GitHub/GitLab dédiés à DevOS', keys: ['GITHUB_PLATFORM_USERNAME', 'GITHUB_PLATFORM_EMAIL', 'GITHUB_PLATFORM_TOKEN', 'GITLAB_PLATFORM_USERNAME', 'GITLAB_PLATFORM_EMAIL', 'GITLAB_PLATFORM_TOKEN'] },
  { id: 'autres', label: 'Autres intégrations', keys: ['GITHUB_TOKEN', 'GITHUB_BASE_URL', 'RABBITMQ_BASE_URL', 'RABBITMQ_USERNAME', 'RABBITMQ_PASSWORD', 'OLLAMA_BASE_URL', 'TERRAFORM_STATE_PATH', 'SAMBA_EXPORTER_BASE_URL', 'N8N_BASE_URL', 'N8N_API_KEY', 'MEILISEARCH_BASE_URL', 'MEILISEARCH_API_KEY', 'REDPANDA_BASE_URL', 'REDPANDA_TOKEN', 'DOCS_PATH'] },
];

const SMTP_FIELDS: Array<{ key: string; label: string; type: string; placeholder: string }> = [
  { key: 'SMTP_HOST', label: 'Hôte', type: 'text', placeholder: 'smtp.example.com' },
  { key: 'SMTP_PORT', label: 'Port', type: 'text', placeholder: '587' },
  { key: 'SMTP_USER', label: 'Utilisateur', type: 'text', placeholder: 'utilisateur@example.com' },
  { key: 'SMTP_PASSWORD', label: 'Mot de passe', type: 'password', placeholder: '••••••••' },
  { key: 'NOTIFICATIONS_EMAIL_FROM', label: 'Adresse expéditeur', type: 'text', placeholder: 'devos@example.com' },
  { key: 'NOTIFICATIONS_EMAIL_TO', label: 'Destinataire des alertes', type: 'text', placeholder: 'oncall@example.com' },
];

export function SettingsPanel({
  navLayout, setNavLayout, themeMode, setThemeMode, themeColors, setThemeColors, setThemeColor,
  themeColorHistory, undoThemeColor, themeAutoStart, setThemeAutoStart, themeAutoEnd, setThemeAutoEnd,
  customThemePresets, saveCustomThemePreset, deleteCustomThemePreset, applyThemePreset,
  profileBackground, setProfileBackground, notificationPermission, onRequestNotificationPermission,
}: SettingsPanelProps) {
  const [known, setKnown] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [openSection, setOpenSection] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');

  useEffect(() => {
    void fetch(`${apiBase()}/api/settings`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? 'Les paramètres ne sont pas configurés sur ce backend.' : 'Impossible de charger les paramètres.');
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
    if (!response.ok) { setError(`Échec de l'enregistrement de ${key}.`); return false; }
    setValues((current) => ({ ...current, [key]: value }));
    setSavedKey(key);
    setTimeout(() => setSavedKey((current) => (current === key ? '' : current)), 1500);
    return true;
  }

  async function clearSetting(key: string) {
    const response = await fetch(`${apiBase()}/api/settings/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (!response.ok) { setError(`Échec de la suppression de ${key}.`); return; }
    setValues((current) => { const next = { ...current }; delete next[key]; return next; });
    setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  async function saveSmtpForm(event: FormEvent) {
    event.preventDefault();
    // Ne réécrit que les champs modifiés (non vides), pour ne pas effacer un mot de passe déjà enregistré
    // simplement parce que le champ est resté vide à l'affichage (par sécurité, les valeurs existantes ne sont jamais pré-remplies en clair).
    const toSave = SMTP_FIELDS.filter(({ key }) => (drafts[key] ?? '').trim() !== '');
    const results = await Promise.all(toSave.map(({ key }) => saveSetting(key)));
    if (results.every(Boolean)) setSavedKey('smtp-form');
    setTimeout(() => setSavedKey((current) => (current === 'smtp-form' ? '' : current)), 1500);
  }

  const genericKeys = known.filter((key) => !SMTP_FIELDS.some((field) => field.key === key));
  const scrollToSection = (id: string) => {
    setOpenSection(id);
    requestAnimationFrame(() => document.getElementById(`settings-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="items settings-panel">
      <section className="widget-card settings-appearance">
        <h3>Apparence</h3>

        <h4 className="settings-subheading">Disposition</h4>
        <div className="filters" aria-label="Disposition de navigation">
          <button className={navLayout === 'sidebar' ? 'filter active' : 'filter'} type="button" onClick={() => setNavLayout('sidebar')}>Barre latérale</button>
          <button className={navLayout === 'topbar' ? 'filter active' : 'filter'} type="button" onClick={() => setNavLayout('topbar')}>Barre du haut</button>
        </div>

        <h4 className="settings-subheading">Thème clair / sombre</h4>
        <div className="filters" aria-label="Thème clair/sombre">
          <button className={themeMode === 'light' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('light')}>Clair</button>
          <button className={themeMode === 'dark' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('dark')}>Sombre</button>
          <button className={themeMode === 'system' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('system')}>Système</button>
          <button className={themeMode === 'auto' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('auto')}>Automatique (horaire)</button>
        </div>
        {themeMode === 'auto' && (
          <div className="theme-auto-schedule">
            <label>
              <span>Début du mode sombre</span>
              <input aria-label="Début du mode sombre" type="time" value={themeAutoStart} onChange={(event) => setThemeAutoStart(event.target.value)} />
            </label>
            <label>
              <span>Fin du mode sombre</span>
              <input aria-label="Fin du mode sombre" type="time" value={themeAutoEnd} onChange={(event) => setThemeAutoEnd(event.target.value)} />
            </label>
          </div>
        )}

        <h4 className="settings-subheading">Couleurs personnalisées</h4>
        <p className="empty">Ajustez l'accent et les teintes de fond ; les changements s'appliquent immédiatement et sont mémorisés.</p>
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
          <button type="button" className="theme-reset" onClick={() => setThemeColors(() => ({}))}>Réinitialiser les couleurs</button>
          <button type="button" disabled={themeColorHistory.length === 0} onClick={undoThemeColor}>Annuler la dernière couleur</button>
        </div>
        <div className="theme-preset-save">
          <input aria-label="Nom du preset personnalisé" type="text" placeholder="Nom du preset (ex. Mon thème)" value={newPresetName} onChange={(event) => setNewPresetName(event.target.value)} />
          <button type="button" disabled={!newPresetName.trim()} onClick={() => { saveCustomThemePreset(newPresetName.trim()); setNewPresetName(''); }}>Sauvegarder ce preset</button>
        </div>
        {customThemePresets.length > 0 && (
          <ul className="theme-custom-preset-list">
            {customThemePresets.map((preset) => (
              <li key={preset.id}>
                <button type="button" className="filter" onClick={() => applyThemePreset(preset.light, preset.dark)}>{preset.name}</button>
                <button type="button" className="delete" aria-label={`Supprimer ${preset.name}`} onClick={() => deleteCustomThemePreset(preset.id)}>×</button>
              </li>
            ))}
          </ul>
        )}

        <h4 className="settings-subheading">Thèmes préconfigurés</h4>
        <p className="empty">Palettes prêtes à l'emploi, appliquées en un clic (remplace la personnalisation courante).</p>
        <div className="theme-preset-grid">
          {THEME_PRESETS.map((preset) => (
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

        <h4 className="settings-subheading">Fond animé</h4>
        <p className="empty">Fond décoratif en dégradés CSS animés (léger, sans image ni vidéo).</p>
        <div className="filters" aria-label="Fond d'écran animé">
          {ANIMATED_BACKGROUNDS.map((bg) => (
            <button key={bg.id} type="button" className={profileBackground === bg.id ? 'filter active' : 'filter'} onClick={() => setProfileBackground(bg.id)}>{bg.label}</button>
          ))}
        </div>
      </section>

      <section className="widget-card">
        <h3>Notifications</h3>
        <p className="empty">Notification navigateur locale sur échéance dépassée ou alerte critique (Wazuh, niveau ≥ {CRITICAL_WAZUH_LEVEL}).</p>
        {notificationPermission === 'granted' ? (
          <p className="empty">Notifications activées ✓</p>
        ) : notificationPermission === 'denied' ? (
          <p className="error" role="alert">Notifications bloquées par le navigateur.</p>
        ) : (
          <button type="button" onClick={onRequestNotificationPermission}>Activer les notifications navigateur</button>
        )}
      </section>

      <section className="widget-card" id="settings-section-smtp">
        <h3>Email / SMTP</h3>
        <p className="empty">Utilisé pour envoyer les notifications d'alerte par email (voir Paramètres → Notifications).</p>
        <form className="smtp-form" onSubmit={(event) => void saveSmtpForm(event)}>
          {SMTP_FIELDS.map((field) => (
            <label key={field.key} className="smtp-field">
              <span>{field.label}</span>
              <input
                aria-label={field.label}
                type={field.type}
                placeholder={values[field.key] ? '••••••••' : field.placeholder}
                value={drafts[field.key] ?? ''}
                onChange={(event) => setDrafts((current) => ({ ...current, [field.key]: event.target.value }))}
              />
            </label>
          ))}
          <button type="submit">{savedKey === 'smtp-form' ? 'Enregistré ✓' : 'Enregistrer la configuration SMTP'}</button>
        </form>
      </section>

      <SecretsPanel />

      <details
        id="settings-section-integration-builder"
        className="widget-card settings-section"
        open={openSection === 'integration-builder'}
        onToggle={(event) => { if ((event.target as HTMLDetailsElement).open) setOpenSection('integration-builder'); }}
      >
        <summary>Générateur d'intégration (custom)</summary>
        <IntegrationsPanel />
      </details>

      {error && <p className="error" role="alert">{error}</p>}
      {!error && known.length === 0 && <p className="empty">Chargement des paramètres…</p>}

      <section className="widget-card settings-toc" aria-label="Sections des intégrations">
        <h3>Intégrations</h3>
        <div className="filters">
          <button type="button" className={openSection === 'integration-builder' ? 'filter active' : 'filter'} onClick={() => scrollToSection('integration-builder')}>
            Générateur d'intégration
          </button>
          {SETTINGS_SECTIONS.map((section) => (
            <button key={section.id} type="button" className={openSection === section.id ? 'filter active' : 'filter'} onClick={() => scrollToSection(section.id)}>
              {section.label}
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
            <summary>{section.label} <span className="empty">({sectionKeys.length})</span></summary>
            {section.id === 'comptes-plateforme' && (
              <p className="empty">
                Identité GitHub/GitLab propre à DevOS (pas un compte personnel), utilisée pour la création
                automatique de dépôts, le versionnement et les sauvegardes autonomes déclenchées par la
                plateforme. À distinguer des jetons GitLab/GitHub des autres sections, dédiés au scan du
                catalogue et des docs.
              </p>
            )}
            {sectionKeys.map((key) => (
              <article className="item setting-row" key={key}>
                <strong>{key}</strong>
                <input
                  aria-label={key}
                  type="text"
                  placeholder={values[key] ? '••••••••' : 'Non configuré'}
                  value={drafts[key] ?? ''}
                  onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                />
                <span className="setting-actions">
                  <button type="button" onClick={() => void saveSetting(key)}>{savedKey === key ? 'Enregistré ✓' : 'Enregistrer'}</button>
                  {values[key] && <button className="delete" type="button" aria-label={`Effacer ${key}`} onClick={() => void clearSetting(key)}>×</button>}
                </span>
              </article>
            ))}
          </details>
        );
      })}
    </div>
  );
}
