/**
 * Drawn marks for the board, in place of emoji.
 *
 * Emoji are a different typeface on every platform, they carry a colour nobody chose, and at the
 * size a board tile allows they turn to mush. These are plain filled paths on a 24x24 grid that
 * take `currentColor`, so a space icon inherits the tile's colour and a token inherits its
 * player's.
 */
import type { CSSProperties } from 'react';
import type { Space } from './boards';

const box = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const;

/* ── The spaces that have no name of their own ────────────────────────────── */

const SPACE_PATHS: Partial<Record<Space['kind'], string>> = {
  // A question mark, drawn rather than typed so it keeps its weight when it is 10px tall.
  chance: 'M12 2a10 10 0 100 20 10 10 0 000-20zm.1 15.6a1.3 1.3 0 110 2.6 1.3 1.3 0 010-2.6zm'
    + '.15-11.3c2.1 0 3.75 1.4 3.75 3.3 0 1.3-.6 2-1.7 2.8-.9.65-1.2 1-1.2 1.85v.4h-2.1v-.6c0-1.4.5'
    + '-2.2 1.6-3 .85-.6 1.1-.95 1.1-1.5 0-.7-.6-1.2-1.5-1.2s-1.55.5-1.7 1.4H8.3c.15-2 1.8-3.45 3.95-3.45z',
  // A chest with a lid band and a lock.
  chest: 'M3 9h18v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm8 2v3h2v-3h-2zM4 4h16a1 1 0 011 1v3H3V5a1 1 0 011-1z',
  // A banknote.
  tax: 'M2 6h20v12H2V6zm10 2.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5 8.5a1.5 1.5 0 01-1.5 1.5v4A1.5 1.5'
    + ' 0 015 15.5h14a1.5 1.5 0 011.5-1.5v-4A1.5 1.5 0 0119 8.5H5z',
  // A locomotive, seen from the side.
  rail: 'M7 3h10a3 3 0 013 3v7a3 3 0 01-3 3H7a3 3 0 01-3-3V6a3 3 0 013-3zm1 3v4h8V6H8zm-1 12a2 2 0 110'
    + ' 4 2 2 0 010-4zm10 0a2 2 0 110 4 2 2 0 010-4z',
  // A bulb: the utilities are power and water, and a bulb reads as "services" at this size.
  utility: 'M12 2a7 7 0 00-4 12.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26A7 7 0 0012 2zM9.5 19h5a.5.5 0 010'
    + ' 1h-5a.5.5 0 010-1zm.5 2h4a2 2 0 01-4 0z',
  // An arrow, for the start.
  go: 'M4 10.5h9.2L9.3 6.6 11 5l6.5 6.5L11 18l-1.7-1.6 3.9-3.9H4v-2z',
  // Bars.
  jail: 'M4 3h2v18H4V3zm4.7 0h2v18h-2V3zm4.6 0h2v18h-2V3zM18 3h2v18h-2V3zM3 10.5h18v2H3v-2z',
  // A P, for free parking.
  parking: 'M4 3h7.5a5.5 5.5 0 010 11H8v7H4V3zm4 3.6v3.8h3.2a1.9 1.9 0 000-3.8H8z',
  // An arrow going into the bars.
  gotojail: 'M14 3h2v18h-2V3zm4.5 0h2v18h-2V3zM2 10.5h6.2L5.3 7.6 7 6l5 5-5 5-1.7-1.6 2.9-2.9H2v-2z',
};

/** The mark for a space that is not a named property. Nothing for the ones that have a name. */
export function SpaceIcon({ kind, size = 14 }: { kind: Space['kind']; size?: number }) {
  const path = SPACE_PATHS[kind];
  if (!path) return null;
  return <svg {...box} width={size} height={size} className="mono-icon"><path d={path} /></svg>;
}

/* ── Player tokens ────────────────────────────────────────────────────────── */

/**
 * The eight tokens. Ids are names rather than emoji so the state does not depend on a font, and
 * so a token can be redrawn without rewriting every room. (Rooms are deleted once empty, so
 * there was never any stored history to migrate.)
 */
export const TOKEN_ART: Record<string, { label: string; path: string }> = {
  hat: { label: 'Top hat', path: 'M8 3h8v10H8V3zM3 13.5h18a1.5 1.5 0 010 3H3a1.5 1.5 0 010-3z' },
  // Seen from the side, with the wheels proud of the body: a flat slab reads as furniture.
  car: {
    label: 'Car',
    path: 'M3 17.1v-3.4a2 2 0 011.35-1.9l1.3-.45 1.85-3.5A2.6 2.6 0 019.8 6.4h4.9c.78 0 1.52.35 2.02.96'
      + 'l2.6 3.15 1.45.5A2 2 0 0122 12.85v4.25h-2.3a2.7 2.7 0 00-5.4 0H9.7a2.7 2.7 0 00-5.4 0H3z'
      + 'M6.7 14.8a2.7 2.7 0 110 5.4 2.7 2.7 0 010-5.4zM17.3 14.8a2.7 2.7 0 110 5.4 2.7 2.7 0 010-5.4z',
  },
  // Ears hanging down the sides, against the cat's pointed ones — two heads with triangles on
  // top are the same picture at 13px.
  dog: {
    label: 'Dog',
    path: 'M12 4.2c2.6 0 4.8 1.3 6 3.35l1-.95c1.3-1.2 3-.3 3 1.4v2.75c0 2.3-1.2 4-3.1 4.75-.9 2.3-3.3'
      + ' 3.9-6.9 3.9s-6-1.6-6.9-3.9C3.2 14.75 2 13 2 10.75V8c0-1.7 1.7-2.6 3-1.4l1 .95C7.2 5.5 9.4'
      + ' 4.2 12 4.2zM9.5 10.3a1.15 1.15 0 100 2.3 1.15 1.15 0 000-2.3zm5 0a1.15 1.15 0 100 2.3 1.15'
      + ' 1.15 0 000-2.3zM12 14.4l1.9 1.7h-3.8l1.9-1.7z',
  },
  ship: {
    label: 'Ship',
    path: 'M11 2h2v9h-2V2zM13.6 3.4L19 8l-5.4 2.2V3.4zM3 13h18l-2.6 6.4a2 2 0 01-1.85 1.25H7.45A2 2 0'
      + ' 015.6 19.4L3 13z',
  },
  // The sole is what makes it a boot rather than the letter L.
  boot: {
    label: 'Boot',
    path: 'M6.4 2.4h5v7.5c0 1.3.7 2.2 2 2.7l3.9 1.6a3.8 3.8 0 012.4 3.5v.7H6.4V2.4z'
      + 'M4.4 19.2h15.8a1.4 1.4 0 010 2.8H4.4a1.4 1.4 0 010-2.8z',
  },
  cat: {
    label: 'Cat',
    path: 'M4.5 3.2l3.8 3.1h7.4l3.8-3.1.9 6.2a8.4 8.4 0 01-16.8 0l.9-6.2zM9 11.4a1.2 1.2 0 100 2.4'
      + ' 1.2 1.2 0 000-2.4zm6 0a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zm-3 3.4l1.6 1.4h-3.2L12 14.8z',
  },
  bow: {
    label: 'Bow',
    path: 'M2 5.5l7.6 6.5L2 18.5v-13zM22 5.5v13L14.4 12 22 5.5zM12 9.2a2.8 2.8 0 110 5.6 2.8 2.8 0 010-5.6z',
  },
  train: {
    label: 'Train',
    path: 'M6 3h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3zm1.5 3v4.5h9V6h-9zM6.5 18.5a2'
      + ' 2 0 110 4 2 2 0 010-4zm11 0a2 2 0 110 4 2 2 0 010-4z',
  },
};

export const TOKEN_IDS = Object.keys(TOKEN_ART);

/**
 * A player's token: their colour as a disc, their mark cut out of it in white.
 *
 * A disc rather than a bare glyph because colour is what tells two players apart at a glance, and
 * on a board tile the token has to survive being the smallest thing on screen.
 */
export function Token({ token, color, size = 22, ring }: {
  token: string | null;
  color?: string | null;
  size?: number;
  /** Draw an outline round it, for "this one is you". */
  ring?: boolean;
}) {
  const art = token ? TOKEN_ART[token] : undefined;
  return (
    <span
      className={`token-mark${ring ? ' is-me' : ''}`}
      // A custom property rather than width/height, so a media query can scale it up where the
      // tiles are bigger without the component having to know how wide the window is.
      style={{ '--tk': `${size}px`, background: color ?? 'var(--text-muted)' } as CSSProperties}
      title={art?.label}
    >
      {art && <svg viewBox="0 0 24 24" fill="#fff" aria-hidden><path d={art.path} /></svg>}
    </span>
  );
}
