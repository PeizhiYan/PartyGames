import { describe, expect, it } from 'vitest';
import { emptyBoard, fiveThrough, idx, isFull, type Board } from './board';

/** Puts stones on a board from [row, col] pairs. */
function withStones(cells: [number, number][], player: 1 | 2 = 1): Board {
  const board = emptyBoard();
  for (const [r, c] of cells) board[idx(r, c)] = player;
  return board;
}

describe('fiveThrough', () => {
  it('finds a horizontal five', () => {
    const board = withStones([[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]]);
    expect(fiveThrough(board, idx(7, 5), 1)).toHaveLength(5);
  });

  it('finds a vertical five', () => {
    const board = withStones([[2, 8], [3, 8], [4, 8], [5, 8], [6, 8]]);
    expect(fiveThrough(board, idx(2, 8), 1)).toHaveLength(5);
  });

  it('finds both diagonals', () => {
    const down = withStones([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]);
    expect(fiveThrough(down, idx(4, 4), 1)).toHaveLength(5);
    const up = withStones([[4, 0], [3, 1], [2, 2], [1, 3], [0, 4]]);
    expect(fiveThrough(up, idx(2, 2), 1)).toHaveLength(5);
  });

  it('does not count a four', () => {
    const board = withStones([[7, 3], [7, 4], [7, 5], [7, 6]]);
    expect(fiveThrough(board, idx(7, 4), 1)).toBeNull();
  });

  it('does not count a run broken by the opponent', () => {
    const board = withStones([[7, 3], [7, 4], [7, 6], [7, 7], [7, 8]]);
    board[idx(7, 5)] = 2;
    expect(fiveThrough(board, idx(7, 4), 1)).toBeNull();
  });

  it('does not wrap around a row edge', () => {
    // Row 7 ends at column 14; row 8 starts at column 0. These are not in a line.
    const board = withStones([[7, 12], [7, 13], [7, 14], [8, 0], [8, 1]]);
    expect(fiveThrough(board, idx(7, 14), 1)).toBeNull();
  });

  it('ignores the other player’s stones', () => {
    const board = withStones([[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]], 2);
    expect(fiveThrough(board, idx(7, 5), 1)).toBeNull();
    expect(fiveThrough(board, idx(7, 5), 2)).toHaveLength(5);
  });
});

describe('isFull', () => {
  it('is false for an empty board and true once every cell is taken', () => {
    expect(isFull(emptyBoard())).toBe(false);
    expect(isFull(emptyBoard().fill(1))).toBe(true);
  });
});
