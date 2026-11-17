import { beforeEach, describe, expect, it } from 'vitest';
import type { Meld } from './hand';
import { payments, scoreHand } from './scoring';
import { E, G, N, R, S, W, Wh, b, c, d, fresh } from './testTiles';

beforeEach(fresh);
const labels = (r: { lines: { label: string }[] }) => r.lines.map((l) => l.label);

describe('fan', () => {
  it('a plain win is 1 fan; self-drawn adds 1', () => {
    const hand = [b(1), b(2), b(3), c(4), c(5), c(6), d(7), d(8), d(9), b(5), b(6), b(7), d(2), d(2)];
    expect(scoreHand(hand, [], false)).toEqual({ fan: 1, lines: [{ label: 'Win', fan: 1 }] });
    expect(scoreHand(hand, [], true).fan).toBe(2);
  });

  it('all pongs +1', () => {
    expect(labels(scoreHand([b(2), b(2), b(2), c(7), c(7), c(7), d(1), d(1), d(1), E(), E(), E(), S(), S()], [], false))).toContain('All pongs');
  });

  it('half flush +1, full flush +3, all honours +3', () => {
    expect(labels(scoreHand([b(1), b(2), b(3), b(4), b(5), b(6), b(7), b(8), b(9), E(), E(), E(), N(), N()], [], false))).toContain('Half flush');
    fresh();
    const full = scoreHand([b(1), b(2), b(3), b(4), b(5), b(6), b(7), b(8), b(9), b(2), b(3), b(4), b(9), b(9)], [], false);
    expect(labels(full)).toEqual(['Win', 'Full flush']);
    expect(full.fan).toBe(4);
    fresh();
    expect(labels(scoreHand([E(), E(), E(), S(), S(), S(), W(), W(), W(), N(), N(), N(), Wh(), Wh()], [], false))).toContain('All honours');
  });

  it('each dragon pong +1, whether laid down or held', () => {
    const melds: Meld[] = [{ kind: 'pong', tiles: [R(), R(), R()] }];
    const r = scoreHand([G(), G(), G(), b(1), b(2), b(3), c(4), c(5), c(6), d(9), d(9)], melds, false);
    expect(labels(r).filter((l) => l === 'Dragon pong')).toHaveLength(2);
  });

  it('each kong +1', () => {
    const melds: Meld[] = [{ kind: 'kong', tiles: [b(5), b(5), b(5), b(5)], concealed: true }, { kind: 'kong', tiles: [c(3), c(3), c(3), c(3)] }];
    const r = scoreHand([d(1), d(2), d(3), d(4), d(5), d(6), d(9), d(9)], melds, false);
    expect(labels(r)).toEqual(expect.arrayContaining(['Concealed kong', 'Kong']));
  });

  it('seven pairs is 2; thirteen orphans is 8 and nothing else', () => {
    expect(scoreHand([b(1), b(1), b(5), b(5), c(2), c(2), d(9), d(9), d(4), d(4), b(7), b(7), c(8), c(8)], [], false)).toEqual({ fan: 2, lines: [{ label: 'Seven pairs', fan: 2 }] });
    fresh();
    expect(scoreHand([b(1), b(9), c(1), c(9), d(1), d(9), E(), S(), W(), N(), R(), G(), Wh(), Wh()], [], true).fan).toBe(8);
  });

  it('caps at 8', () => {
    // All honours + all pongs + three dragon pongs + self-drawn would be well over 8.
    expect(scoreHand([R(), R(), R(), G(), G(), G(), Wh(), Wh(), Wh(), E(), E(), E(), N(), N()], [], true).fan).toBe(8);
  });
});

describe('payments', () => {
  const seats = ['a', 'b', 'c', 'd'];
  it('a self-draw: everyone pays, the dealer double', () => {
    expect(payments(seats, 'b', null, 'a', 2)).toEqual({ a: -8, c: -4, d: -4, b: 16 });
  });
  it('a discard: the discarder pays three shares, doubled only if the dealer is involved', () => {
    expect(payments(seats, 'b', 'c', 'a', 2)).toEqual({ c: -12, b: 12 });
    expect(payments(seats, 'b', 'a', 'a', 2)).toEqual({ a: -24, b: 24 });
  });
});
