import { describe, expect, it } from 'vitest';
import { BOARDS } from './boards';
import { boardLayout, ringPosition, ringSide, spacesPerSide, spiralOrder, spiralPosition } from './layout';

describe('boardLayout', () => {
  it.each(BOARDS.map((b) => [b.name, b.spaces.length] as const))(
    '%s (%i spaces) fills its grid exactly', (_name, count) => {
      const { cols, rows } = boardLayout(count);
      expect(cols * rows).toBe(count);
    },
  );

  it('picks wide tiles over tall ones', () => {
    expect(boardLayout(40)).toEqual({ cols: 5, rows: 8 });
    expect(boardLayout(36)).toEqual({ cols: 6, rows: 6 });
    expect(boardLayout(32)).toEqual({ cols: 4, rows: 8 });
  });

  it('copes with a count that has no good factors', () => {
    const { cols, rows } = boardLayout(37); // prime
    expect(cols * rows).toBe(37);
  });
});

describe('spiralPosition', () => {
  it('fills every cell of every board exactly once', () => {
    for (const board of BOARDS) {
      const { cols, rows } = boardLayout(board.spaces.length);
      const seen = new Set<string>();
      for (let i = 0; i < board.spaces.length; i++) {
        const { row, col } = spiralPosition(i, cols, rows);
        expect(row).toBeGreaterThanOrEqual(1);
        expect(row).toBeLessThanOrEqual(rows);
        expect(col).toBeGreaterThanOrEqual(1);
        expect(col).toBeLessThanOrEqual(cols);
        seen.add(`${row}:${col}`);
      }
      expect(seen.size).toBe(board.spaces.length);
    }
  });

  it('keeps consecutive spaces touching, which is what makes it followable', () => {
    for (const [cols, rows] of [[5, 8], [6, 6], [4, 8], [3, 3], [1, 6], [7, 2]] as const) {
      const order = spiralOrder(cols, rows);
      expect(order).toHaveLength(cols * rows);
      for (let i = 1; i < order.length; i++) {
        const steps = Math.abs(order[i].row - order[i - 1].row) + Math.abs(order[i].col - order[i - 1].col);
        expect(steps, `${cols}x${rows} step ${i}`).toBe(1);
      }
    }
  });

  it('starts in the top-left corner and runs right', () => {
    const order = spiralOrder(5, 8);
    expect(order[0]).toEqual({ row: 1, col: 1 });
    expect(order[1]).toEqual({ row: 1, col: 2 });
    expect(order[4]).toEqual({ row: 1, col: 5 });
    expect(order[5]).toEqual({ row: 2, col: 5 });  // turns down the right-hand side
  });

  it('ends somewhere in the middle, not on an edge', () => {
    const order = spiralOrder(5, 8);
    const last = order[order.length - 1];
    expect(last.row).toBeGreaterThan(1);
    expect(last.row).toBeLessThan(8);
    expect(last.col).toBeGreaterThan(1);
    expect(last.col).toBeLessThan(5);
  });
});

describe('ringPosition', () => {
  it('puts the four corners where a printed board has them', () => {
    for (const board of BOARDS) {
      const n = board.spaces.length;
      const side = spacesPerSide(n);
      const edge = ringSide(n);
      expect(ringPosition(0, n)).toEqual({ row: edge, col: edge });              // Go, bottom-right
      expect(ringPosition(side + 1, n)).toEqual({ row: edge, col: 1 });          // Jail, bottom-left
      expect(ringPosition(2 * side + 2, n)).toEqual({ row: 1, col: 1 });         // Parking, top-left
      expect(ringPosition(3 * side + 3, n)).toEqual({ row: 1, col: edge });      // Go to jail, top-right
    }
  });

  it('uses every edge cell exactly once and never the middle', () => {
    for (const board of BOARDS) {
      const n = board.spaces.length;
      const edge = ringSide(n);
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) {
        const { row, col } = ringPosition(i, n);
        const onEdge = row === 1 || row === edge || col === 1 || col === edge;
        expect(onEdge, `space ${i} of ${board.id} is not on the edge`).toBe(true);
        seen.add(`${row}:${col}`);
      }
      expect(seen.size).toBe(n);
    }
  });

  it('keeps consecutive spaces touching, all the way round', () => {
    const n = 40;
    for (let i = 1; i < n; i++) {
      const a = ringPosition(i - 1, n);
      const b = ringPosition(i, n);
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
    // And the last space wraps back to Go.
    const last = ringPosition(n - 1, n);
    const go = ringPosition(0, n);
    expect(Math.abs(last.row - go.row) + Math.abs(last.col - go.col)).toBe(1);
  });
});
