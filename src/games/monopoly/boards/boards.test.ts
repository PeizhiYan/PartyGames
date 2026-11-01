import { describe, expect, it } from 'vitest';
import { BOARDS, boardOf, checkBoard, isOwnable, rentLadder, spacesPerSide } from './index';

describe('every board', () => {
  it.each(BOARDS.map((b) => [b.name, b] as const))('%s is a well-formed square', (_name, board) => {
    expect(checkBoard(board)).toEqual([]);
    expect(Number.isInteger(spacesPerSide(board))).toBe(true);
  });

  it.each(BOARDS.map((b) => [b.name, b] as const))('%s has usable groups', (_name, board) => {
    const sizes = new Map<string, number>();
    for (const s of board.spaces) {
      if (s.kind === 'property') sizes.set(s.group, (sizes.get(s.group) ?? 0) + 1);
    }
    // Every declared group is actually on the board, and a set is reachable.
    for (const id of Object.keys(board.groups)) {
      expect(sizes.get(id), `${board.id}: group ${id}`).toBeGreaterThanOrEqual(2);
    }
    expect(sizes.size).toBe(Object.keys(board.groups).length);
  });

  it.each(BOARDS.map((b) => [b.name, b] as const))('%s names everything ownable, uniquely', (_name, board) => {
    const names = board.spaces.filter(isOwnable).map((s) => s.name);
    expect(names.every((n) => n.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('rentLadder', () => {
  it('only ever goes up', () => {
    for (const price of [60, 200, 600, 3500]) {
      const ladder = rentLadder(price);
      for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
    }
  });

  it('charges something even for the cheapest possible property', () => {
    expect(rentLadder(1)[0]).toBeGreaterThan(0);
  });
});

describe('boardOf', () => {
  it('falls back rather than stranding a room on an id it does not know', () => {
    expect(boardOf('atlantis').id).toBe('vancouver');
    expect(boardOf(undefined).id).toBe('vancouver');
    expect(boardOf('japan').id).toBe('japan');
  });
});
