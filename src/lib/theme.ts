/**
 * The look of the app: a highlight colour, a light/dark choice and what moves along the bottom
 * of the screen — all per device.
 *
 * Applied as attributes on <html> (`data-accent`, `data-mode`, `data-backdrop`) which the CSS
 * turns into variable values and visibility — so changing theme repaints everything without
 * React re-rendering a thing.
 */

export const ACCENTS = [
  { id: 'sunset', label: 'Sunset', swatch: '#e2680c' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
  { id: 'violet', label: 'Violet', swatch: '#7c5cff' },
  { id: 'ocean', label: 'Ocean', swatch: '#0ea5e9' },
  { id: 'forest', label: 'Forest', swatch: '#16a34a' },
  { id: 'graphite', label: 'Graphite', swatch: '#64748b' },
] as const;

/**
 * What drifts along the bottom of every screen. All three are the accent colour and all three
 * are decoration only; see `src/shell/Backdrop.tsx`.
 */
export const BACKDROPS = [
  { id: 'waves', label: 'Waves' },
  { id: 'smoke', label: 'Smoke' },
  { id: 'particles', label: 'Particles' },
] as const;

export const MODES = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];
export type ModeId = (typeof MODES)[number]['id'];
export type BackdropId = (typeof BACKDROPS)[number]['id'];

export interface Theme {
  accent: AccentId;
  mode: ModeId;
  backdrop: BackdropId;
}

/** White background, orange highlight, waves, following the system for light and dark. */
export const DEFAULT_THEME: Theme = { accent: 'sunset', mode: 'system', backdrop: 'waves' };

const KEY = 'partygames:theme';

const isAccent = (v: unknown): v is AccentId => ACCENTS.some((a) => a.id === v);
const isMode = (v: unknown): v is ModeId => MODES.some((m) => m.id === v);
const isBackdrop = (v: unknown): v is BackdropId => BACKDROPS.some((b) => b.id === v);

export function loadTheme(): Theme {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Theme> | null;
    return {
      accent: isAccent(saved?.accent) ? saved.accent : DEFAULT_THEME.accent,
      mode: isMode(saved?.mode) ? saved.mode : DEFAULT_THEME.mode,
      // Added after the first release, so a theme saved before then has no backdrop in it.
      backdrop: isBackdrop(saved?.backdrop) ? saved.backdrop : DEFAULT_THEME.backdrop,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: Theme): void {
  try { localStorage.setItem(KEY, JSON.stringify(theme)); } catch { /* storage unavailable */ }
}

/**
 * Puts the theme on <html> and points the browser's own chrome (the iOS status bar, the Android
 * toolbar) at whatever the page background ended up being.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.accent = theme.accent;
  root.dataset.backdrop = theme.backdrop;
  // "system" is the absence of the attribute, which is what the CSS keys off.
  if (theme.mode === 'system') delete root.dataset.mode;
  else root.dataset.mode = theme.mode;

  // Read it back rather than duplicating the colours here, so the CSS stays the one source.
  // It has to come from a real computed background: --bg is a color-mix(), and a custom property
  // reads back as the literal text it was written as, which is not a colour a browser accepts.
  const bg = document.body && getComputedStyle(document.body).backgroundColor;
  if (!bg || bg === 'rgba(0, 0, 0, 0)') return;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = bg;
  document.head.appendChild(meta);
}

// Applied at import, before React renders, so the first paint is already the right colour.
applyTheme(loadTheme());
