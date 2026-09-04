/** Personnalisation du thème (section K de TODO-refonte-ux.md, approfondie en section AB de
 * TODO-refonte-2.md). Jetons de couleur ajustables par l'utilisateur (Paramètres → Apparence),
 * appliqués comme surcharges inline des variables CSS de thème définies dans styles.css (clair et sombre). */
export const THEME_COLOR_SETTINGS: Array<{ cssVar: string; label: string; defaultLight: string; defaultDark: string }> = [
  { cssVar: 'accent', label: 'Accent (vert)', defaultLight: '#49634c', defaultDark: '#7ea583' },
  { cssVar: 'accent-2', label: 'Accent secondaire (terracotta)', defaultLight: '#a34f31', defaultDark: '#d98a63' },
  { cssVar: 'bg-1', label: 'Fond — teinte 1', defaultLight: '#dbe8dc', defaultDark: '#17211b' },
  { cssVar: 'bg-2', label: 'Fond — teinte 2', defaultLight: '#f1dfc2', defaultDark: '#1f2a20' },
  { cssVar: 'gold', label: 'Accent doré', defaultLight: '#7a632d', defaultDark: '#c9a55a' },
  { cssVar: 'border', label: 'Bordures', defaultLight: '#a8b5a7', defaultDark: '#3a473c' },
];

/** Un thème préconfiguré fournit une paire de palettes (clair/sombre) cohérentes pour les 6 jetons
 * ci-dessus. Sélectionnable en un clic depuis Paramètres → Apparence (section AB). */
export interface ThemePreset {
  id: string;
  label: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    label: 'Vert & terracotta (par défaut)',
    light: { accent: '#49634c', 'accent-2': '#a34f31', 'bg-1': '#dbe8dc', 'bg-2': '#f1dfc2', gold: '#7a632d', border: '#a8b5a7' },
    dark: { accent: '#7ea583', 'accent-2': '#d98a63', 'bg-1': '#17211b', 'bg-2': '#1f2a20', gold: '#c9a55a', border: '#3a473c' },
  },
  {
    id: 'ocean',
    label: 'Bleu océan',
    light: { accent: '#2f5f7a', 'accent-2': '#2c8c8c', 'bg-1': '#dceaf1', 'bg-2': '#e6f2ee', gold: '#4f7fa0', border: '#a7c1cf' },
    dark: { accent: '#6fa9c8', 'accent-2': '#5bbcbc', 'bg-1': '#141f26', 'bg-2': '#182a28', gold: '#7fb2d6', border: '#33474f' },
  },
  {
    id: 'violet',
    label: 'Violet nocturne',
    light: { accent: '#5e4b8a', 'accent-2': '#a34f8f', 'bg-1': '#e6e0f1', 'bg-2': '#f2e3ec', gold: '#8a6a9e', border: '#c1b2d6' },
    dark: { accent: '#a58cd6', 'accent-2': '#d68fc0', 'bg-1': '#1b1626', 'bg-2': '#231a29', gold: '#b79ad9', border: '#3d3350' },
  },
  {
    id: 'sunset',
    label: 'Coucher de soleil',
    light: { accent: '#c1622b', 'accent-2': '#d94f4f', 'bg-1': '#f6e3d0', 'bg-2': '#fbe8d8', gold: '#c98a2c', border: '#e0b895' },
    dark: { accent: '#e59563', 'accent-2': '#e57e7e', 'bg-1': '#25190f', 'bg-2': '#2b1c12', gold: '#e0ab5c', border: '#4a3521' },
  },
  {
    id: 'forest',
    label: 'Forêt profonde',
    light: { accent: '#2e5c3a', 'accent-2': '#6a7f2e', 'bg-1': '#dce8d5', 'bg-2': '#eaf0dd', gold: '#7a8a2d', border: '#a9c19c' },
    dark: { accent: '#6fae7f', 'accent-2': '#a3bf5f', 'bg-1': '#121f16', 'bg-2': '#17241a', gold: '#a9be5e', border: '#334a38' },
  },
  {
    id: 'mono',
    label: 'Monochrome graphite',
    light: { accent: '#464646', 'accent-2': '#7a6a55', 'bg-1': '#e6e4e0', 'bg-2': '#efece6', gold: '#8a7a52', border: '#bcb8b0' },
    dark: { accent: '#b7b3ac', 'accent-2': '#c9ad82', 'bg-1': '#18181a', 'bg-2': '#1e1e20', gold: '#d3b880', border: '#3c3b38' },
  },
];

/** Fonds d'écran animés au choix (CSS pur : gradients/formes flottantes, pas d'image/vidéo), section AB.
 * Appliqués via `data-bg` sur `<html>` ; les classes correspondantes sont définies dans styles.css. */
export const ANIMATED_BACKGROUNDS: Array<{ id: string; label: string }> = [
  { id: 'none', label: 'Aucun' },
  { id: 'aurora', label: 'Aurore' },
  { id: 'drift', label: 'Dérive douce' },
  { id: 'bubbles', label: 'Bulles flottantes' },
  { id: 'waves', label: 'Vagues' },
  { id: 'grid-pulse', label: 'Grille pulsée' },
  { id: 'confetti-glow', label: 'Lueur diffuse' },
  { id: 'nebula', label: 'Nébuleuse' },
];

export type ThemeMode = 'light' | 'dark' | 'system' | 'auto';
