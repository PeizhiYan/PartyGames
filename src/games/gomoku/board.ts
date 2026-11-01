// Board geometry and win detection. Pure, no React, no backend.

export const SIZE = 15;
export const CELLS = SIZE * SIZE;

/** 0 = empty, 1 = black (plays first), 2 = white. */
export type Stone = 0 | 1 | 2;
export type Player = 1 | 2;
/** A flat array of SIZE*SIZE cells, row-major: index = row * SIZE + col. */
export type Board = Stone[];

export const emptyBoard = (): Board => new Array<Stone>(CELLS).fill(0);
export const idx = (row: number, col: number): number => row * SIZE + col;
export const rowOf = (i: number): number => Math.floor(i / SIZE);
export const colOf = (i: number): number => i % SIZE;
export const other = (p: Player): Player => (p === 1 ? 2 : 1);
export const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < SIZE && col >= 0 && col < SIZE;

/** The four line directions, as [rowStep, colStep]. Their opposites are walked too. */
export const DIRECTIONS: readonly [number, number][] = [
  [0, 1],  // horizontal
  [1, 0],  // vertical
  [1, 1],  // down-right
  [1, -1], // down-left
];

/**
 * The five (or more) cells in a row through `at` that belong to `player`, or null if there is no
 * five. Only lines through `at` are checked, so this is the cheap test to run after every move.
 */
export function fiveThrough(board: Board, at: number, player: Player): number[] | null {
  const row = rowOf(at);
  const col = colOf(at);
  for (const [dr, dc] of DIRECTIONS) {
    const line = [at];
    for (const sign of [1, -1]) {
      for (let step = 1; step < 5; step++) {
        const r = row + dr * step * sign;
        const c = col + dc * step * sign;
        if (!inBounds(r, c) || board[idx(r, c)] !== player) break;
        line.push(idx(r, c));
      }
    }
    if (line.length >= 5) {
      // Sorting puts the cells in board order, which is what the UI wants for drawing the line.
      return line.sort((a, b) => a - b);
    }
  }
  return null;
}

export const isFull = (board: Board): boolean => board.every((s) => s !== 0);
