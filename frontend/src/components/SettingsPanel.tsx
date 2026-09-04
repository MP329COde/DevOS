import { useEffect, useState, type FormEvent } from 'react';

import { SecretsPanel } from './SecretsPanel.js';
import { IntegrationsPanel } from './IntegrationsPanel.js';
import { THEME_COLOR_SETTINGS } from '../theme.js';

const apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const CRITICAL_WAZUH_LEVEL = 12;

interface SettingsPanelProps {
  navLayout: 'sidebar' | 'topbar';
  setNavLayout: (layout: 'sidebar' | 'topbar') => void;
  themeMode: 'light' | 'dark' | 'system';
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  themeColors: Record<string, string>;
  setThemeColors: (updater: (current: Record<string, string>) => Record<string, string>) => void;
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
  { id: 'k8s', label: 'Kubernetes / ArgoCD', keys: ['K8S_API_SERVER', 'K8S_TOKEN', 'ARGOCD_BASE_URL', 'ARGOCD_TOKEN'] },
  { id: 'monitoring', label: 'Monitoring & alerting', keys: ['GRAFANA_BASE_URL', 'GRAFANA_API_KEY', 'ALERTMANAGER_BASE_URL', 'PROMETHEUS_EXPORTERS', 'WAZUH_BASE_URL', 'WAZUH_TOKEN'] },
  { id: 'reseau', label: 'Réseau (DNS/sécurité)', keys: ['POWERDNS_BASE_URL', 'POWERDNS_API_KEY', 'POWERDNS_SERVER_ID', 'SURICATA_BASE_URL', 'WIREGUARD_EXPORTER_BASE_URL', 'NATS_MONITOR_BASE_URL'] },
  { id: 'stockage', label: 'Stockage & registres', keys: ['MINIO_BASE_URL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'HARBOR_BASE_URL', 'HARBOR_USERNAME', 'HARBOR_PASSWORD', 'NEXUS_BASE_URL', 'NEXUS_USERNAME', 'NEXUS_PASSWORD', 'VERDACCIO_BASE_URL', 'VERDACCIO_TOKEN'] },
  { id: 'ci', label: 'CI/CD', keys: ['WOODPECKER_BASE_URL', 'WOODPECKER_TOKEN'] },
  { id: 'calendriers', label: 'Calendriers', keys: ['CALENDAR_PERSONAL_ICS_URL', 'CALENDAR_PROFESSIONAL_ICS_URL'] },
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

export function SettingsPanel({ navLayout, setNavLayout, themeMode, setThemeMode, themeColors, setThemeColors, notificationPermission, onRequestNotificationPermission }: SettingsPanelProps) {
  const [known, setKnown] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [openSection, setOpenSection] = useState<string>('');

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
      <section className="widget-card">
        <h3>Apparence</h3>
        <div className="filters" aria-label="Disposition de navigation">
          <button className={navLayout === 'sidebar' ? 'filter active' : 'filter'} type="button" onClick={() => setNavLayout('sidebar')}>Barre latérale</button>
          <button className={navLayout === 'topbar' ? 'filter active' : 'filter'} type="button" onClick={() => setNavLayout('topbar')}>Barre du haut</button>
        </div>

        <h4 className="settings-subheading">Thème</h4>
        <div className="filters" aria-label="Thème clair/sombre">
          <button className={themeMode === 'light' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('light')}>Clair</button>
          <button className={themeMode === 'dark' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('dark')}>Sombre</button>
          <button className={themeMode === 'system' ? 'filter active' : 'filter'} type="button" onClick={() => setThemeMode('system')}>Système</button>
        </div>

        <h4 className="settings-subheading">Personnalisation des couleurs</h4>
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
                  onChange={(event) => setThemeColors((current) => ({ ...current, [cssVar]: event.target.value }))}
                />
              </label>
            );
          })}
        </div>
        <button type="button" className="theme-reset" onClick={() => setThemeColors(() => ({}))}>Réinitialiser les couleurs</button>
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
