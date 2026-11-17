import { describe, expect, it } from 'vitest';
import { chooseMove } from './ai';
import { Board, START_FEN, makeMoveCode, square } from './engine';

const sq = (name: string) => square(name.charCodeAt(0) - 97, name.charCodeAt(1) - 49);

describe('chess computer', () => {
  it('plays a legal opening move at every strength', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const b = Board.fromFen(START_FEN);
      expect(b.legalMoves()).toContain(chooseMove(b, level, () => 0.5));
    }
  });

  it('finds a mate in one', () => {
    // White: Qh5xf7 is mate (the scholar's-mate position).
    const b = Board.fromFen('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1');
    expect(chooseMove(b, 'normal', () => 0.5)).toBe(makeMoveCode(sq('h5'), sq('f7')));
  });

  it('takes a free queen rather than a pawn', () => {
    const b = Board.fromFen('4k3/8/8/3q4/2P1P3/8/8/4K3 w - - 0 1');
    const mv = chooseMove(b, 'normal', () => 0.5);
    expect([makeMoveCode(sq('c4'), sq('d5')), makeMoveCode(sq('e4'), sq('d5'))]).toContain(mv);
  });
});
