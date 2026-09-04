/** Personnalisation du thème (section K de TODO-refonte-ux.md).
 * Jetons de couleur ajustables par l'utilisateur (Paramètres → Apparence), appliqués comme
 * surcharges inline des variables CSS de thème définies dans styles.css (clair et sombre). */
export const THEME_COLOR_SETTINGS: Array<{ cssVar: string; label: string; defaultLight: string; defaultDark: string }> = [
  { cssVar: 'accent', label: 'Accent (vert)', defaultLight: '#49634c', defaultDark: '#7ea583' },
  { cssVar: 'accent-2', label: 'Accent secondaire (terracotta)', defaultLight: '#a34f31', defaultDark: '#d98a63' },
  { cssVar: 'bg-1', label: 'Fond — teinte 1', defaultLight: '#dbe8dc', defaultDark: '#17211b' },
  { cssVar: 'bg-2', label: 'Fond — teinte 2', defaultLight: '#f1dfc2', defaultDark: '#1f2a20' },
  { cssVar: 'gold', label: 'Accent doré', defaultLight: '#7a632d', defaultDark: '#c9a55a' },
  { cssVar: 'border', label: 'Bordures', defaultLight: '#a8b5a7', defaultDark: '#3a473c' },
];
