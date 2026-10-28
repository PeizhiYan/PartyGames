import { describe, expect, it } from 'vitest';
import { boardValue, cellValue, chooseMove, heatMap } from './ai';
import { emptyBoard, idx, type Board } from './board';

function withStones(cells: [number, number][], player: 1 | 2 = 1, board = emptyBoard()): Board {
  for (const [r, c] of cells) board[idx(r, c)] = player;
  return board;
}

describe('boardValue', () => {
  it('rates an open three above a three blocked at one end', () => {
    const open = withStones([[7, 5], [7, 6], [7, 7]]);
    const half = withStones([[7, 5], [7, 6], [7, 7]]);
    half[idx(7, 4)] = 2;
    expect(boardValue(open, 1)).toBeGreaterThan(boardValue(half, 1));
  });

  it('scores a three walled in at both ends as nothing', () => {
    const dead = withStones([[7, 5], [7, 6], [7, 7]]);
    dead[idx(7, 4)] = 2;
    dead[idx(7, 8)] = 2;
    expect(boardValue(dead, 1)).toBe(0);
  });

  it('rates runs in the right order: two < three < four < five', () => {
    const run = (n: number) => boardValue(withStones(
      Array.from({ length: n }, (_, i) => [7, 4 + i] as [number, number]),
    ), 1);
    expect(run(2)).toBeLessThan(run(3));
    expect(run(3)).toBeLessThan(run(4));
    expect(run(4)).toBeLessThan(run(5));
  });

  it('counts each run once, whichever way the line runs', () => {
    const across = boardValue(withStones([[7, 5], [7, 6], [7, 7]]), 1);
    const down = boardValue(withStones([[5, 7], [6, 7], [7, 7]]), 1);
    const downRight = boardValue(withStones([[5, 5], [6, 6], [7, 7]]), 1);
    const downLeft = boardValue(withStones([[5, 7], [6, 6], [7, 5]]), 1);
    expect(down).toBe(across);
    expect(downRight).toBe(across);
    // The down-left diagonal is the one a one-directional scan double-counts.
    expect(downLeft).toBe(across);
  });

  it('ignores the opponent’s stones', () => {
    const theirs = withStones([[7, 5], [7, 6], [7, 7]], 2);
    expect(boardValue(theirs, 1)).toBe(0);
    expect(boardValue(theirs, 2)).toBeGreaterThan(0);
  });
});

describe('cellValue', () => {
  it('leaves the board as it found it', () => {
    const board = withStones([[7, 5], [7, 6]]);
    const before = board.slice();
    cellValue(board, idx(7, 7), 1);
    expect(board).toEqual(before);
  });

  it('rates completing a five highest of all', () => {
    const board = withStones([[7, 3], [7, 4], [7, 5], [7, 6]]);
    expect(cellValue(board, idx(7, 7), 1)).toBeGreaterThan(cellValue(board, idx(9, 9), 1));
  });

  it('is -1 for a cell that already has a stone', () => {
    const board = withStones([[7, 7]]);
    expect(cellValue(board, idx(7, 7), 1)).toBe(-1);
  });
});

describe('chooseMove', () => {
  it('takes the win when it has one', () => {
    // White has four in a row with both ends open.
    const board = withStones([[7, 3], [7, 4], [7, 5], [7, 6]], 2);
    const move = chooseMove(board, 2, 'normal');
    expect([idx(7, 2), idx(7, 7)]).toContain(move);
  });

  it('blocks the player’s open four rather than building its own three', () => {
    const board = withStones([[7, 3], [7, 4], [7, 5], [7, 6]], 1);
    withStones([[10, 10], [10, 11], [10, 12]], 2, board);
    const move = chooseMove(board, 2, 'hard');
    expect([idx(7, 2), idx(7, 7)]).toContain(move);
  });

  it('answers an open three instead of ignoring it', () => {
    const board = withStones([[7, 5], [7, 6], [7, 7]], 1);
    const move = chooseMove(board, 2, 'normal');
    // Either end, or one of the cells that would extend the three, has to be addressed.
    expect([idx(7, 4), idx(7, 8), idx(7, 3), idx(7, 9)]).toContain(move);
  });

  it('opens in the middle on an empty board', () => {
    expect(chooseMove(emptyBoard(), 1, 'normal')).toBe(idx(7, 7));
  });

  it('plays somewhere legal at every difficulty, and nowhere on a full board', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const board = withStones([[7, 7]], 1);
      const move = chooseMove(board, 2, level);
      expect(move).not.toBeNull();
      expect(board[move!]).toBe(0);
    }
    expect(chooseMove(emptyBoard().fill(1), 2, 'normal')).toBeNull();
  });
});

describe('heatMap', () => {
  it('is zero on taken cells and highest where the player should play', () => {
    const board = withStones([[7, 5], [7, 6], [7, 7]], 1);
    const heat = heatMap(board, 1);
    expect(heat[idx(7, 7)]).toBe(0);
    const peak = Math.max(...heat);
    expect(peak).toBe(Math.max(heat[idx(7, 4)], heat[idx(7, 8)]));
  });
});
