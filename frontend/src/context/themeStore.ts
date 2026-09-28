/**
 * Light/dark toggle, external to React (same pattern as authStore.ts).
 * Defaults to 'light' unconditionally — see the comment in tokens.css for
 * why this deliberately does NOT follow `prefers-color-scheme`: the Figma
 * file only has light-mode screens, so auto-following a dark system theme
 * made the app diverge from the design by default. Dark is opt-in only.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'smena.theme';

function loadInitial(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

let theme: Theme = loadInitial();
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  return theme;
}

export function setTheme(next: Theme) {
  theme = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
  }
  listeners.forEach((l) => l());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', theme);
}
