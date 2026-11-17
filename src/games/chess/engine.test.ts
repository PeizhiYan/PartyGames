import { describe, expect, it } from 'vitest';
import { Board, START_FEN, perft } from './engine';

/** Node counts from the Chess Programming Wiki. Getting these right means every rule is right. */
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const POSITION_3 = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
const POSITION_4 = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';

describe('chess move generation (perft)', () => {
  it('start position: 20, 400, 8902', () => {
    const b = Board.fromFen(START_FEN);
    expect(perft(b, 1)).toBe(20);
    expect(perft(b, 2)).toBe(400);
    expect(perft(b, 3)).toBe(8902);
    expect(b.toFen()).toBe(START_FEN);
  });

  it('kiwipete (castling, en passant, promotions, checks): 48, 2039', () => {
    const b = Board.fromFen(KIWIPETE);
    expect(perft(b, 1)).toBe(48);
    expect(perft(b, 2)).toBe(2039);
  });

  it('position 3 (en passant pins and discovered checks): 14, 191, 2812', () => {
    const b = Board.fromFen(POSITION_3);
    expect(perft(b, 1)).toBe(14);
    expect(perft(b, 2)).toBe(191);
    expect(perft(b, 3)).toBe(2812);
  });

  it('position 4 (promotions with captures, castling rights lost): 6, 264, 9467', () => {
    const b = Board.fromFen(POSITION_4);
    expect(perft(b, 1)).toBe(6);
    expect(perft(b, 2)).toBe(264);
    expect(perft(b, 3)).toBe(9467);
  });

  it('knows insufficient material', () => {
    expect(Board.fromFen('8/8/8/4k3/8/8/8/4K3 w - - 0 1').insufficientMaterial()).toBe(true);
    expect(Board.fromFen('8/8/8/4k3/8/8/8/4KB2 w - - 0 1').insufficientMaterial()).toBe(true);
    expect(Board.fromFen('8/8/8/2b1k3/8/8/8/4KB2 w - - 0 1').insufficientMaterial()).toBe(false); // opposite shades
    expect(Board.fromFen('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1').insufficientMaterial()).toBe(false);
  });
});
