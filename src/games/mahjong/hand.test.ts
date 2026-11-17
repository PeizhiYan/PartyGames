import { beforeEach, describe, expect, it } from 'vitest';
import { concealedAllPongs, isSevenPairs, isStandardWin, isThirteenOrphans, isWinningHand, type Meld } from './hand';
import { E, G, N, R, S, W, Wh, b, c, d, fresh } from './testTiles';

beforeEach(fresh);

describe('winning hands', () => {
  it('four sets and a pair', () => {
    expect(isStandardWin([b(1), b(2), b(3), c(4), c(5), c(6), d(7), d(8), d(9), E(), E(), E(), R(), R()])).toBe(true);
  });

  it('needs the lowest tile to start a set — a chain of overlapping chows', () => {
    // 1-1-2-2-3-3 is two chows; with 4-4 as the pair and 5-6-7 + 7-8-9 of dots.
    expect(isStandardWin([b(1), b(1), b(2), b(2), b(3), b(3), b(4), b(4), d(5), d(6), d(7), d(7), d(8), d(9)])).toBe(true);
  });

  it('counts melds already laid down as sets', () => {
    const melds: Meld[] = [{ kind: 'pong', tiles: [R(), R(), R()] }, { kind: 'chow', tiles: [b(1), b(2), b(3)] }];
    expect(isStandardWin([c(1), c(2), c(3), d(5), d(5), d(5), N(), N()], melds)).toBe(true);
    fresh();
    // One tile too many for two sets and a pair.
    expect(isStandardWin([c(1), c(2), c(3), d(5), d(5), d(5), N(), N(), W()], melds)).toBe(false);
  });

  it('near misses are not wins', () => {
    expect(isStandardWin([b(1), b(2), b(4), c(4), c(5), c(6), d(7), d(8), d(9), E(), E(), E(), R(), R()])).toBe(false);
    fresh();
    // Honours cannot chow.
    expect(isStandardWin([E(), S(), W(), c(4), c(5), c(6), d(7), d(8), d(9), b(5), b(5), b(5), R(), R()])).toBe(false);
    fresh();
    // A chow cannot wrap 8-9-1.
    expect(isStandardWin([b(8), b(9), c(1), c(4), c(5), c(6), d(7), d(8), d(9), E(), E(), E(), R(), R()])).toBe(false);
  });

  it('seven pairs, all different', () => {
    expect(isSevenPairs([b(1), b(1), b(5), b(5), c(2), c(2), d(9), d(9), E(), E(), R(), R(), Wh(), Wh()])).toBe(true);
    fresh();
    expect(isSevenPairs([b(1), b(1), b(1), b(1), c(2), c(2), d(9), d(9), E(), E(), R(), R(), Wh(), Wh()])).toBe(false);
  });

  it('thirteen orphans', () => {
    const hand = [b(1), b(9), c(1), c(9), d(1), d(9), E(), S(), W(), N(), R(), G(), Wh(), Wh()];
    expect(isThirteenOrphans(hand)).toBe(true);
    expect(isWinningHand(hand)).toBe(true);
    fresh();
    expect(isThirteenOrphans([b(1), b(9), c(1), c(9), d(1), d(9), E(), S(), W(), N(), R(), G(), b(2), Wh()])).toBe(false);
  });

  it('reads all-pongs only when no chow is needed', () => {
    expect(concealedAllPongs([b(2), b(2), b(2), c(7), c(7), c(7), E(), E()])).toBe(true);
    fresh();
    expect(concealedAllPongs([b(1), b(2), b(3), c(7), c(7), c(7), E(), E()])).toBe(false);
  });
});
