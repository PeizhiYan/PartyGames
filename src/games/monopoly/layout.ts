/**
 * How the spaces are arranged on screen.
 *
 * A real board is a hollow ring because the cards, the money and the tokens physically sit in the
 * middle. On a phone that hole is about sixty percent of the area doing nothing, while the spaces
 * themselves are squeezed to ~32px and cannot hold their own names.
 *
 * So the spaces fill the whole rectangle instead, in boustrophedon order — left to right, then
 * back right to left on the next row, the way an ox ploughs a field. Consecutive spaces stay
 * adjacent (that is the property the ring had and a plain grid would lose), and every tile is
 * three to four times the area, which is enough for a name and a price again.
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
