import { describe, expect, it } from 'vitest';
import { BOARDS } from './boards';
import { boardLayout, gridPosition } from './layout';

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

describe('gridPosition', () => {
  it('fills every cell exactly once', () => {
    for (const board of BOARDS) {
      const { cols, rows } = boardLayout(board.spaces.length);
      const seen = new Set<string>();
      for (let i = 0; i < board.spaces.length; i++) {
        const { row, col } = gridPosition(i, cols);
        expect(row).toBeGreaterThanOrEqual(1);
        expect(row).toBeLessThanOrEqual(rows);
        expect(col).toBeGreaterThanOrEqual(1);
        expect(col).toBeLessThanOrEqual(cols);
        seen.add(`${row}:${col}`);
      }
      expect(seen.size).toBe(board.spaces.length);
    }
  });

  it('runs back the other way on every second row, so steps stay adjacent', () => {
    const cols = 5;
    expect(gridPosition(0, cols)).toEqual({ row: 1, col: 1 });
    expect(gridPosition(4, cols)).toEqual({ row: 1, col: 5 });
    // Stepping from the end of row 1 to the start of row 2 moves down, not back across.
    expect(gridPosition(5, cols)).toEqual({ row: 2, col: 5 });
    expect(gridPosition(9, cols)).toEqual({ row: 2, col: 1 });
    expect(gridPosition(10, cols)).toEqual({ row: 3, col: 1 });
  });

  it('keeps consecutive spaces touching', () => {
    const cols = 5;
    for (let i = 1; i < 40; i++) {
      const a = gridPosition(i - 1, cols);
      const b = gridPosition(i, cols);
      const steps = Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
      expect(steps).toBe(1);
    }
  });
});
