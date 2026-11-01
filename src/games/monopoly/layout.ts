/**
 * How the spaces are arranged on screen — two ways, because the right answer differs by width.
 *
 * **Wide: the ring.** A hollow square with the spaces around the edge, the way a real board is
 * printed. It is what the game looks like, and above ~620px there is room for it.
 *
 * **Narrow: rows.** A real board is hollow because the cards, the money and the tokens
 * physically sit in the middle. On a phone that hole is about sixty percent of the area doing
 * nothing while the spaces around it are squeezed to ~32px and cannot hold their own names. So
 * the spaces fill the whole rectangle instead, in boustrophedon order — left to right, then back
 * right to left on the next row, the way an ox ploughs a field. Consecutive spaces stay adjacent
 * (the one property the ring has that a plain grid would lose) and every tile is three to four
 * times the area.
 *
 * Both positions are computed for every space and handed to CSS as custom properties, so the
 * switch is a media query rather than a resize listener.
 */

/** Roughly how much taller than wide we would like a tile *not* to be: tiles read better wide. */
const TARGET_ROWS_PER_COL = 1.4;

/**
 * Columns and rows for `count` spaces: the factor pair whose shape is closest to the target, so
 * the grid is always exactly full — no gaps, no half rows.
 */
export function boardLayout(count: number): { cols: number; rows: number } {
  let best = { cols: count, rows: 1 };
  let bestMiss = Infinity;
  for (let cols = 2; cols <= count; cols++) {
    if (count % cols !== 0) continue;
    const rows = count / cols;
    const miss = Math.abs(rows / cols - TARGET_ROWS_PER_COL);
    if (miss < bestMiss) {
      bestMiss = miss;
      best = { cols, rows };
    }
  }
  return best;
}

/** Where a space sits, 1-indexed for CSS grid. Odd rows run backwards. */
export function gridPosition(index: number, cols: number): { row: number; col: number } {
  const row = Math.floor(index / cols);
  const within = index % cols;
  return { row: row + 1, col: (row % 2 === 0 ? within : cols - 1 - within) + 1 };
}

/* ── The ring, for wide screens ───────────────────────────────────────────── */

/** Spaces along one edge of the ring, between two corners. */
export const spacesPerSide = (count: number): number => (count - 4) / 4;

/** The ring is a square of this many cells on a side, corners included. */
export const ringSide = (count: number): number => spacesPerSide(count) + 2;

/**
 * Where a space sits on the ring, 1-indexed for CSS grid. Go is the bottom-right corner and play
 * runs anticlockwise — left along the bottom, up the left side, right along the top, down the
 * right — which is how a board is printed.
 */
export function ringPosition(index: number, count: number): { row: number; col: number } {
  const side = spacesPerSide(count);
  const n = side + 2;
  if (index === 0) return { row: n, col: n };
  if (index <= side) return { row: n, col: n - index };
  if (index === side + 1) return { row: n, col: 1 };
  if (index <= 2 * side + 1) return { row: n - (index - side - 1), col: 1 };
  if (index === 2 * side + 2) return { row: 1, col: 1 };
  if (index <= 3 * side + 2) return { row: 1, col: index - (2 * side + 2) + 1 };
  if (index === 3 * side + 3) return { row: 1, col: n };
  return { row: index - (3 * side + 3) + 1, col: n };
}
