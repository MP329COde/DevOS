import { useEffect } from 'react';

/**
 * Reads the initial panel from the URL's path (`/work`, `/notes`, ...), falling back to
 * `fallback` when the path is empty (`/`) or doesn't match a known panel id. Meant to be used
 * as a `useState` lazy initializer so the very first render already reflects a deep link —
 * reading it later in an effect would race with the write-back effect below (both would run in
 * the same commit, before the state update from the read took effect, so the write effect would
 * clobber the freshly-read URL).
 */
export function readUrlPanel<Panel extends string>(validPanels: readonly Panel[], fallback: Panel): Panel {
  const segment = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  return segment && (validPanels as readonly string[]).includes(segment) ? (segment as Panel) : fallback;
}

/** Reads the initial items filter from the URL's `?filter=` query parameter. See {@link readUrlPanel}. */
export function readUrlFilter(fallback: string): string {
  return new URLSearchParams(window.location.search).get('filter') ?? fallback;
}

/**
 * Keeps the active panel and items filter in sync with the URL, so the browser back/forward
 * buttons, page reloads and shared links restore the right view instead of always dropping back
 * to the dashboard. Pair with {@link readUrlPanel}/{@link readUrlFilter} as the `useState`
 * initializers for `panel`/`filter` so the first render is already correct.
 *
 * The panel is encoded as a real path segment (`/work`, `/notes`, ... — `/` for the default
 * "home" panel) rather than a `?panel=` query parameter, so each page has its own real URL.
 * The items filter stays a `?filter=` query parameter on top of that path.
 *
 * - On every panel/filter change, pushes a new history entry — but only when it actually
 *   differs from what the URL already holds, so this is a no-op right after mount.
 * - On `popstate` (back/forward), restores panel/filter from the URL without pushing again.
 */
export function useUrlState<Panel extends string>(
  panel: Panel,
  setPanel: (panel: Panel) => void,
  validPanels: readonly Panel[],
  filter: string,
  setFilter: (filter: string) => void,
  homePanel: Panel,
): void {
  useEffect(() => {
    function onPopState() {
      setPanel(readUrlPanel(validPanels, panel));
      setFilter(readUrlFilter('all'));
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const currentSegment = window.location.pathname.replace(/^\/+/, '').split('/')[0];
    const currentPanel = currentSegment || homePanel;
    const params = new URLSearchParams(window.location.search);
    // `panel` est l'ancien schéma de routage (`?panel=...`) : un lien ou une entrée d'historique
    // pré-migration peut encore le porter (ex. `/work?panel=home`). Le chemin fait foi, donc on
    // le purge systématiquement plutôt que de le laisser traîner indéfiniment dans l'URL.
    const hadLegacyPanelParam = params.has('panel');
    params.delete('panel');
    const currentFilter = params.get('filter');
    const nextFilter = filter && filter !== 'all' ? filter : null;
    if (currentPanel === panel && currentFilter === nextFilter && !hadLegacyPanelParam) return;
    if (nextFilter) params.set('filter', nextFilter); else params.delete('filter');
    const query = params.toString();
    const path = panel === homePanel ? '/' : `/${panel}`;
    // Une simple purge du paramètre legacy (sans changement de page/filtre) ne mérite pas une
    // nouvelle entrée d'historique — sinon "précédent" ramènerait sur la même page avec `?panel=`.
    const isCleanupOnly = currentPanel === panel && currentFilter === nextFilter;
    if (isCleanupOnly) window.history.replaceState({}, '', `${path}${query ? `?${query}` : ''}`);
    else window.history.pushState({}, '', `${path}${query ? `?${query}` : ''}`);
  }, [panel, filter, homePanel]);
}
