import { describe, expect, it } from 'vitest';
import { COORD_XY, MOVE, Position, STARTUP_FEN, Search } from './engine';

describe('xiangqi engine', () => {
  it('finds the 44 legal opening moves for red', () => {
    const pos = Position.fromFen(STARTUP_FEN);
    expect(pos.legalMoves()).toHaveLength(44);
    expect(pos.sdPlayer).toBe(0);
  });

  it('round-trips the start position through FEN', () => {
    const pos = Position.fromFen(STARTUP_FEN);
    expect(pos.toFen()).toBe(STARTUP_FEN);
  });

  it('refuses a move that leaves the king in check, and undoes cleanly', () => {
    // Red king faces black king with nothing between after the red cannon moves away — illegal.
    const pos = Position.fromFen('4k4/9/9/9/9/9/9/4C4/9/4K4 w');
    const before = pos.toFen();
    const cannon = COORD_XY(7, 10);
    expect(pos.makeMove(MOVE(cannon, cannon - 1))).toBe(false);
    expect(pos.toFen()).toBe(before);
    expect(pos.makeMove(MOVE(cannon, cannon - 16))).toBe(true);
  });

  it('sees a mate', () => {
    // Black king boxed in by two red rooks: black to move has nothing.
    const pos = Position.fromFen('3k5/4R4/3R5/9/9/9/9/9/9/4K4 b');
    expect(pos.isMate()).toBe(true);
  });

  it('search returns a legal move, deterministically with a fixed random source', () => {
    const pos = Position.fromFen(STARTUP_FEN);
    const search = new Search(pos, 10, () => 0.5);
    const mv = search.searchMain(4, 10000);
    expect(pos.legalMoves()).toContain(mv);
    const again = new Search(Position.fromFen(STARTUP_FEN), 10, () => 0.5).searchMain(4, 10000);
    expect(again).toBe(mv);
  });
});
