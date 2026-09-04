import { useEffect } from 'react';

/**
 * Reads the initial panel from the URL's `?panel=` query parameter, falling back to `fallback`
 * when absent or not a recognized panel id. Meant to be used as a `useState` lazy initializer
 * so the very first render already reflects a deep link — reading it later in an effect would
 * race with the write-back effect below (both would run in the same commit, before the state
 * update from the read took effect, so the write effect would clobber the freshly-read URL).
 */
export function readUrlPanel<Panel extends string>(validPanels: readonly Panel[], fallback: Panel): Panel {
  const urlPanel = new URLSearchParams(window.location.search).get('panel');
  return urlPanel && (validPanels as readonly string[]).includes(urlPanel) ? (urlPanel as Panel) : fallback;
}

/** Reads the initial items filter from the URL's `?filter=` query parameter. See {@link readUrlPanel}. */
export function readUrlFilter(fallback: string): string {
  return new URLSearchParams(window.location.search).get('filter') ?? fallback;
}

/**
 * Keeps the active panel and items filter in sync with the URL query string, so the browser
 * back/forward buttons, page reloads and shared links restore the right view instead of always
 * dropping back to the dashboard. Pair with {@link readUrlPanel}/{@link readUrlFilter} as the
 * `useState` initializers for `panel`/`filter` so the first render is already correct.
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
    const params = new URLSearchParams(window.location.search);
    const currentPanel = params.get('panel');
    const currentFilter = params.get('filter');
    const nextFilter = filter && filter !== 'all' ? filter : null;
    if (currentPanel === panel && currentFilter === nextFilter) return;
    params.set('panel', panel);
    if (nextFilter) params.set('filter', nextFilter); else params.delete('filter');
    const query = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [panel, filter]);
}
