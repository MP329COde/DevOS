import { useRef, useState } from 'react';
import { THEME_COLOR_SETTINGS, ANIMATED_BACKGROUNDS, type ThemeMode } from '../theme.js';
import { useStrings } from '../i18n/LanguageContext.js';

export type NotificationFrequency = 'immediate' | 'daily' | 'weekly';

export interface NotificationPreferences {
  types: string[];
  frequency: NotificationFrequency;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  types: ['deadline', 'wazuh', 'deployment'],
  frequency: 'immediate',
};

const NOTIFICATION_TYPES = ['deadline', 'wazuh', 'deployment'] as const;

interface CustomThemePreset { id: string; name: string; light: Record<string, string>; dark: Record<string, string> }

export type AvailabilityStatus = 'available' | 'busy' | 'away' | 'do_not_disturb' | 'vacation' | 'offline';

const AVAILABILITY_VALUES: AvailabilityStatus[] = ['available', 'busy', 'away', 'do_not_disturb', 'vacation', 'offline'];

interface ProfileSettingsPanelProps {
  displayName: string;
  setDisplayName: (value: string) => void;
  shortName: string;
  setShortName: (value: string) => void;
  profileAvatarUrl: string;
  avatarUploading: boolean;
  onAvatarFile: (file: File) => void;
  onRemoveAvatar: () => void;
  statusEmoji: string;
  setStatusEmoji: (value: string) => void;
  statusMessage: string;
  setStatusMessage: (value: string) => void;
  availability: AvailabilityStatus;
  setAvailability: (value: AvailabilityStatus) => void;
  availabilityFrom: string;
  setAvailabilityFrom: (value: string) => void;
  availabilityUntil: string;
  setAvailabilityUntil: (value: string) => void;
  availabilityScheduleStart: string;
  setAvailabilityScheduleStart: (value: string) => void;
  availabilityScheduleEnd: string;
  setAvailabilityScheduleEnd: (value: string) => void;
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
  allThemePresets: Array<{ id: string; label: string; light: Record<string, string>; dark: Record<string, string> }>;
  customThemePresets: CustomThemePreset[];
  saveCustomThemePreset: (name: string) => void;
  deleteCustomThemePreset: (id: string) => void;
  applyThemePreset: (light: Record<string, string>, dark: Record<string, string>) => void;
  profileBackground: string;
  setProfileBackground: (id: string) => void;
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => void;
  wazuhThreshold: number;
  notificationPreferences: NotificationPreferences;
  setNotificationPreferences: (updater: (current: NotificationPreferences) => NotificationPreferences) => void;
}

const AVAILABILITY_LABELS = {
  fr: {
    available: 'Disponible',
    busy: 'Occupé',
    away: 'Absent',
    do_not_disturb: 'Ne pas déranger',
    vacation: 'En congé',
    offline: 'Hors ligne',
  } as Record<AvailabilityStatus, string>,
  en: {
    available: 'Available',
    busy: 'Busy',
    away: 'Away',
    do_not_disturb: 'Do not disturb',
    vacation: 'On vacation',
    offline: 'Offline',
  } as Record<AvailabilityStatus, string>,
};

const strings = {
  fr: {
    identity: 'Identité',
    photo: 'Photo de profil',
    changePhoto: 'Changer la photo',
    uploadingPhoto: 'Envoi...',
    removePhoto: 'Supprimer la photo',
    displayNameLabel: 'Nom affiché',
    displayNameAria: 'Nom affiché',
    shortNameLabel: 'Nom court',
    shortNameAria: 'Nom court',
    shortNameHint: "Utilisé pour les initiales et les affichages compacts (ex. en-tête, mentions).",
    status: 'Statut',
    availabilityAria: 'Disponibilité',
    statusMessageLabel: 'Message de statut',
    statusMessageAria: 'Message de statut',
    statusEmojiLabel: 'Emoji de statut',
    statusEmojiAria: 'Emoji de statut',
    scheduleHeading: 'Horaires de disponibilité',
    scheduleStart: 'Début',
    scheduleEnd: 'Fin',
    absenceHeading: "Dates d'absence",
    absenceFrom: 'Début',
    absenceUntil: 'Fin',
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
    notifications: 'Notifications',
    notificationsHint: (level: number) => `Notification navigateur locale sur échéance dépassée ou alerte critique (Wazuh, niveau ≥ ${level}).`,
    notificationsEnabled: 'Notifications activées ✓',
    notificationsBlocked: 'Notifications bloquées par le navigateur.',
    enableNotifications: 'Activer les notifications navigateur',
    notificationTypesHeading: 'Types souhaités',
    notificationTypesAria: 'Types de notifications souhaités',
    notificationTypeLabels: {
      deadline: 'Échéances',
      wazuh: 'Alertes de sécurité (Wazuh)',
      deployment: 'Déploiements',
    } as Record<string, string>,
    notificationFrequencyHeading: 'Fréquence',
    notificationFrequencyAria: 'Fréquence des notifications',
    frequencyImmediate: 'Immédiat',
    frequencyDaily: 'Résumé quotidien',
    frequencyWeekly: 'Résumé hebdomadaire',
  },
  en: {
    identity: 'Identity',
    photo: 'Profile photo',
    changePhoto: 'Change photo',
    uploadingPhoto: 'Uploading...',
    removePhoto: 'Remove photo',
    displayNameLabel: 'Display name',
    displayNameAria: 'Display name',
    shortNameLabel: 'Short name',
    shortNameAria: 'Short name',
    shortNameHint: 'Used for initials and compact displays (e.g. header, mentions).',
    status: 'Status',
    availabilityAria: 'Availability',
    statusMessageLabel: 'Status message',
    statusMessageAria: 'Status message',
    statusEmojiLabel: 'Status emoji',
    statusEmojiAria: 'Status emoji',
    scheduleHeading: 'Availability hours',
    scheduleStart: 'Start',
    scheduleEnd: 'End',
    absenceHeading: 'Absence dates',
    absenceFrom: 'Start',
    absenceUntil: 'End',
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
    notifications: 'Notifications',
    notificationsHint: (level: number) => `Local browser notification on overdue deadline or critical alert (Wazuh, level ≥ ${level}).`,
    notificationsEnabled: 'Notifications enabled ✓',
    notificationsBlocked: 'Notifications blocked by the browser.',
    enableNotifications: 'Enable browser notifications',
    notificationTypesHeading: 'Desired types',
    notificationTypesAria: 'Desired notification types',
    notificationTypeLabels: {
      deadline: 'Deadlines',
      wazuh: 'Security alerts (Wazuh)',
      deployment: 'Deployments',
    } as Record<string, string>,
    notificationFrequencyHeading: 'Frequency',
    notificationFrequencyAria: 'Notification frequency',
    frequencyImmediate: 'Immediate',
    frequencyDaily: 'Daily digest',
    frequencyWeekly: 'Weekly digest',
  },
} as const;

/** Paramètres propres à l'utilisateur connecté : apparence, thème perso, notifications. Accessible depuis "Profil". */
export function ProfileSettingsPanel({
  displayName, setDisplayName, shortName, setShortName, profileAvatarUrl, avatarUploading,
  onAvatarFile, onRemoveAvatar, statusEmoji, setStatusEmoji, statusMessage, setStatusMessage,
  availability, setAvailability, availabilityFrom, setAvailabilityFrom, availabilityUntil, setAvailabilityUntil,
  availabilityScheduleStart, setAvailabilityScheduleStart, availabilityScheduleEnd, setAvailabilityScheduleEnd,
  navLayout, setNavLayout, themeMode, setThemeMode, themeColors, setThemeColors, setThemeColor,
  themeColorHistory, undoThemeColor, themeAutoStart, setThemeAutoStart, themeAutoEnd, setThemeAutoEnd,
  allThemePresets, customThemePresets, saveCustomThemePreset, deleteCustomThemePreset, applyThemePreset,
  profileBackground, setProfileBackground, notificationPermission, onRequestNotificationPermission,
  wazuhThreshold, notificationPreferences, setNotificationPreferences,
}: ProfileSettingsPanelProps) {
  const s = useStrings(strings);
  const availabilityLabels = useStrings(AVAILABILITY_LABELS);
  const [newPresetName, setNewPresetName] = useState('');
  const avatarFileInput = useRef<HTMLInputElement>(null);
  const initials = (shortName || displayName) ? (shortName || displayName).slice(0, 2).toUpperCase() : '??';
  const showAbsenceDates = availability === 'vacation' || availability === 'away';

  return (
    <div className="items settings-panel">
      <section className="widget-card">
        <h3>{s.identity}</h3>
        <div className="profile-identity-photo">
          <span className="profile-identity-avatar">
            {profileAvatarUrl ? <img src={profileAvatarUrl} alt="" /> : initials}
          </span>
          <input
            ref={avatarFileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(event) => { const file = event.target.files?.[0]; if (file) onAvatarFile(file); event.target.value = ''; }}
          />
          <div className="filters">
            <button type="button" onClick={() => avatarFileInput.current?.click()} disabled={avatarUploading}>
              {avatarUploading ? s.uploadingPhoto : s.changePhoto}
            </button>
            <button type="button" className="delete" onClick={onRemoveAvatar} disabled={!profileAvatarUrl}>{s.removePhoto}</button>
          </div>
        </div>
        <label className="profile-identity-field">
          <span>{s.displayNameLabel}</span>
          <input aria-label={s.displayNameAria} type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="profile-identity-field">
          <span>{s.shortNameLabel}</span>
          <input aria-label={s.shortNameAria} type="text" maxLength={40} value={shortName} onChange={(event) => setShortName(event.target.value)} />
        </label>
        <p className="empty">{s.shortNameHint}</p>
      </section>

      <section className="widget-card">
        <h3>{s.status}</h3>
        <div className="filters" aria-label={s.availabilityAria}>
          {AVAILABILITY_VALUES.map((value) => (
            <button key={value} type="button" className={availability === value ? 'filter active' : 'filter'} onClick={() => setAvailability(value)}>
              {availabilityLabels[value]}
            </button>
          ))}
        </div>
        <label className="profile-identity-field">
          <span>{s.statusEmojiLabel}</span>
          <input aria-label={s.statusEmojiAria} type="text" maxLength={4} value={statusEmoji} onChange={(event) => setStatusEmoji(event.target.value)} />
        </label>
        <label className="profile-identity-field">
          <span>{s.statusMessageLabel}</span>
          <input aria-label={s.statusMessageAria} type="text" maxLength={200} value={statusMessage} onChange={(event) => setStatusMessage(event.target.value)} />
        </label>

        <h4 className="settings-subheading">{s.scheduleHeading}</h4>
        <div className="theme-auto-schedule">
          <label>
            <span>{s.scheduleStart}</span>
            <input aria-label={s.scheduleStart} type="time" value={availabilityScheduleStart} onChange={(event) => setAvailabilityScheduleStart(event.target.value)} />
          </label>
          <label>
            <span>{s.scheduleEnd}</span>
            <input aria-label={s.scheduleEnd} type="time" value={availabilityScheduleEnd} onChange={(event) => setAvailabilityScheduleEnd(event.target.value)} />
          </label>
        </div>

        {showAbsenceDates && (
          <>
            <h4 className="settings-subheading">{s.absenceHeading}</h4>
            <div className="theme-auto-schedule">
              <label>
                <span>{s.absenceFrom}</span>
                <input aria-label={s.absenceFrom} type="date" value={availabilityFrom} onChange={(event) => setAvailabilityFrom(event.target.value)} />
              </label>
              <label>
                <span>{s.absenceUntil}</span>
                <input aria-label={s.absenceUntil} type="date" value={availabilityUntil} onChange={(event) => setAvailabilityUntil(event.target.value)} />
              </label>
            </div>
          </>
        )}
      </section>

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

      <section className="widget-card">
        <h3>{s.notifications}</h3>
        <p className="empty">{s.notificationsHint(wazuhThreshold)}</p>
        {notificationPermission === 'granted' ? (
          <p className="empty">{s.notificationsEnabled}</p>
        ) : notificationPermission === 'denied' ? (
          <p className="error" role="alert">{s.notificationsBlocked}</p>
        ) : (
          <button type="button" onClick={onRequestNotificationPermission}>{s.enableNotifications}</button>
        )}

        <h4 className="settings-subheading">{s.notificationTypesHeading}</h4>
        <div className="filters" aria-label={s.notificationTypesAria}>
          {NOTIFICATION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={notificationPreferences.types.includes(type) ? 'filter active' : 'filter'}
              aria-pressed={notificationPreferences.types.includes(type)}
              onClick={() => setNotificationPreferences((current) => ({
                ...current,
                types: current.types.includes(type)
                  ? current.types.filter((t) => t !== type)
                  : [...current.types, type],
              }))}
            >
              {s.notificationTypeLabels[type]}
            </button>
          ))}
        </div>

        <h4 className="settings-subheading">{s.notificationFrequencyHeading}</h4>
        <div className="filters" aria-label={s.notificationFrequencyAria}>
          {(['immediate', 'daily', 'weekly'] as const).map((frequency) => (
            <button
              key={frequency}
              type="button"
              className={notificationPreferences.frequency === frequency ? 'filter active' : 'filter'}
              onClick={() => setNotificationPreferences((current) => ({ ...current, frequency }))}
            >
              {frequency === 'immediate' ? s.frequencyImmediate : frequency === 'daily' ? s.frequencyDaily : s.frequencyWeekly}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
