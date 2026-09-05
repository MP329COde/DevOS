import { useState } from 'react';
import { THEME_COLOR_SETTINGS, ANIMATED_BACKGROUNDS, type ThemeMode } from '../theme.js';
import { useStrings } from '../i18n/LanguageContext.js';

const CRITICAL_WAZUH_LEVEL = 12;

interface CustomThemePreset { id: string; name: string; light: Record<string, string>; dark: Record<string, string> }

interface ProfileSettingsPanelProps {
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
}

const strings = {
  fr: {
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
  },
  en: {
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
  },
} as const;

/** Paramètres propres à l'utilisateur connecté : apparence, thème perso, notifications. Accessible depuis "Profil". */
export function ProfileSettingsPanel({
  navLayout, setNavLayout, themeMode, setThemeMode, themeColors, setThemeColors, setThemeColor,
  themeColorHistory, undoThemeColor, themeAutoStart, setThemeAutoStart, themeAutoEnd, setThemeAutoEnd,
  allThemePresets, customThemePresets, saveCustomThemePreset, deleteCustomThemePreset, applyThemePreset,
  profileBackground, setProfileBackground, notificationPermission, onRequestNotificationPermission,
}: ProfileSettingsPanelProps) {
  const s = useStrings(strings);
  const [newPresetName, setNewPresetName] = useState('');

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
    </div>
  );
}
