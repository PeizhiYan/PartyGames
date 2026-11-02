/**
 * How the spaces are arranged on screen — two ways, because the right answer differs by width.
 *
 * **Wide: the ring.** A hollow square with the spaces around the edge, the way a real board is
 * printed. It is what the game looks like, and above ~620px there is room for it.
 *
 * **Narrow: a spiral.** A real board is hollow because the cards, the money and the tokens
 * physically sit in the middle. On a phone that hole is about sixty percent of the area doing
 * nothing while the spaces around it are squeezed to ~32px and cannot hold their own names. So
 * the spaces fill the whole rectangle instead, winding inward from the top-left corner. It is
 * still a ring — just one that keeps going rather than closing — so it reads as a board rather
 * than as a list, consecutive spaces stay adjacent, and every tile is three to four times the
 * area of a ring cell.
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

/**
 * Every cell of a cols x rows grid in spiral order, starting top-left and winding inward:
 * right along the top, down the right, back along the bottom, up the left, then in one band and
 * round again. 1-indexed, ready for CSS grid.
 *
 * A spiral is a path, so consecutive cells always touch — the property that makes it readable as
 * a route rather than as a reading order.
 */
export function spiralOrder(cols: number, rows: number): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  let top = 0;
  let bottom = rows - 1;
  let left = 0;
  let right = cols - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) out.push({ row: top + 1, col: c + 1 });
    top++;
    for (let r = top; r <= bottom; r++) out.push({ row: r + 1, col: right + 1 });
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) out.push({ row: bottom + 1, col: c + 1 });
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) out.push({ row: r + 1, col: left + 1 });
      left++;
    }
  }
  return out;
}

/** Built once per board shape; the order never changes for a given grid. */
const spirals = new Map<string, { row: number; col: number }[]>();

/** Where a space sits in the spiral, 1-indexed for CSS grid. */
export function spiralPosition(index: number, cols: number, rows: number): { row: number; col: number } {
  const key = `${cols}x${rows}`;
  let order = spirals.get(key);
  if (!order) {
    order = spiralOrder(cols, rows);
    spirals.set(key, order);
  }
  return order[index] ?? { row: 1, col: 1 };
}

/**
 * How many coils deep a cell sits, counting in from the edge — 0 is the outer lap. Cells with
 * the same coil number are the same lap of the spiral.
 */
export function coilOf(
  { row, col }: { row: number; col: number },
  cols: number,
  rows: number,
): number {
  return Math.min(row - 1, col - 1, rows - row, cols - col);
}

/** How many laps the spiral makes on a grid of this shape. */
export const coilCount = (cols: number, rows: number): number => Math.ceil(Math.min(cols, rows) / 2);

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
