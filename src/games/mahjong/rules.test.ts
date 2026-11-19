import { describe, expect, it } from 'vitest';
import type { GameContext, RoomPlayer } from '../../types';
import { chooseClaim, chooseTurn } from './ai';
import { DEAD_WALL, HAND_SIZE, claimOptions, currentSeat, handOf, mahjong, meldsOf, myClaimOptions, selfOptions, type MahjongState } from './rules';
import { TILE_COUNT, kindOf } from './tiles';
import type { Meld } from './hand';
import { E, G, N, R, S, W, Wh, b, c, d, fresh } from './testTiles';

const people: RoomPlayer[] = ['a', 'b', 'c', 'd'].map((uid, i) => ({ uid, name: uid.toUpperCase(), joinedAt: i }));
const ctx = (actorUid: string, players = people): GameContext => ({ actorUid, ownerUid: 'a', players, now: 1 });

function dealt(seed = 1): MahjongState {
  const s = mahjong.onPlayersChanged!(mahjong.newState(ctx('a')), ctx('a'));
  return mahjong.reduce(s, { type: 'start', seed }, ctx('a'));
}

/** Every tile is in exactly one place: the wall, a hand, a meld or a discard pile. */
function accounted(s: MahjongState): boolean {
  const all = [...s.wall, ...Object.values(s.hands).flat(), ...Object.values(s.discards).flat(),
    ...Object.values(s.melds).flat().flatMap((m) => m.tiles)];
  if (s.phase === 'results' && s.result?.winner && s.result.from) {
    // On a discard win the tile is in the winner's hand and gone from the discard pile.
  }
  const sorted = [...all].sort((x, y) => x - y);
  return sorted.length === TILE_COUNT && sorted.every((t, i) => t === i);
}

/** Plays one step for whoever must act, using the computer for everyone. */
function step(s: MahjongState): MahjongState {
  if (s.stage === 'claims' && s.claim) {
    const pending = Object.entries(s.claim.responses).find(([, r]) => r === null)![0];
    const answer = chooseClaim(s, pending);
    return mahjong.reduce(s, answer === 'pass' ? { type: 'pass' } : { type: 'claim', claim: answer }, ctx(pending));
  }
  const uid = currentSeat(s)!.uid;
  return mahjong.reduce(s, chooseTurn(s, uid), ctx(uid));
}

describe('mahjong deal and turn', () => {
  it('deals thirteen each, the dealer draws a fourteenth, and loses no tile', () => {
    const s = dealt(7);
    expect(handOf(s, 'a')).toHaveLength(HAND_SIZE + 1);
    for (const u of ['b', 'c', 'd']) expect(handOf(s, u)).toHaveLength(HAND_SIZE);
    expect(currentSeat(s)?.uid).toBe('a');
    expect(s.stage).toBe('discard');
    expect(s.justDrew).toBe(true);
    expect(accounted(s)).toBe(true);
    expect(dealt(7)).toEqual(s);
  });

  it('needs exactly four players', () => {
    const three = people.slice(0, 3);
    const s = mahjong.onPlayersChanged!(mahjong.newState(ctx('a', three)), ctx('a', three));
    expect(() => mahjong.reduce(s, { type: 'start', seed: 1 }, ctx('a', three))).toThrow(/four/);
  });

  it('a discard nobody can use passes straight to the next player, who draws', () => {
    let s = dealt(3);
    // Find a discard that nobody can claim, if the deal has one.
    const hand = handOf(s, 'a');
    const quiet = hand.find((t) => ['b', 'c', 'd'].every((u) => claimOptions(s, u, t, 'a').length === 0));
    if (quiet === undefined) return;
    s = mahjong.reduce(s, { type: 'discard', tile: quiet }, ctx('a'));
    expect(currentSeat(s)?.uid).toBe('b');
    expect(s.stage).toBe('discard');
    expect(handOf(s, 'b')).toHaveLength(HAND_SIZE + 1);
    expect(s.discards.a).toEqual([quiet]);
  });

  it('refuses out-of-turn discards, tiles not held, and answering a claim twice', () => {
    const s = dealt(5);
    expect(() => mahjong.reduce(s, { type: 'discard', tile: handOf(s, 'b')[0] }, ctx('b'))).toThrow(/not your turn/);
    expect(() => mahjong.reduce(s, { type: 'discard', tile: handOf(s, 'b')[0] }, ctx('a'))).toThrow(/not in your hand/);
    expect(() => mahjong.reduce(s, { type: 'pass' }, ctx('b'))).toThrow(/nothing to claim/);
  });

  it('a pong takes the tile into a meld and the claimer discards next', () => {
    // Build a state by hand: b holds a pair of a's discard.
    const base = dealt(11);
    const tile = handOf(base, 'a')[0];
    const k = kindOf(tile);
    // Hand b two more of that kind, taken from wherever they are, swapped with b's own tiles.
    const others = Array.from({ length: 4 }, (_, i) => k * 4 + i).filter((t) => t !== tile).slice(0, 2);
    const swap = (s: MahjongState, t: number, into: string): MahjongState => {
      const hands = { ...s.hands };
      let wall = s.wall.slice();
      const giveBack = hands[into][0];
      for (const u of Object.keys(hands)) if (hands[u].includes(t)) hands[u] = hands[u].map((x) => (x === t ? giveBack : x));
      if (wall.includes(t)) wall = wall.map((x) => (x === t ? giveBack : x));
      hands[into] = [t, ...hands[into].slice(1)];
      return { ...s, hands, wall };
    };
    let s = swap(swap(base, others[0], 'b'), others[1], 'b');
    expect(accounted(s)).toBe(true);
    s = mahjong.reduce(s, { type: 'discard', tile }, ctx('a'));
    expect(s.stage).toBe('claims');
    expect(myClaimOptions(s, 'b').map((o) => o.kind)).toContain('pong');
    // Everyone else passes; b pongs.
    for (const u of ['c', 'd']) if (s.claim?.responses[u] === null) s = mahjong.reduce(s, { type: 'pass' }, ctx(u));
    s = mahjong.reduce(s, { type: 'claim', claim: { kind: 'pong' } }, ctx('b'));
    expect(meldsOf(s, 'b')).toHaveLength(1);
    expect(meldsOf(s, 'b')[0].kind).toBe('pong');
    expect(currentSeat(s)?.uid).toBe('b');
    expect(s.stage).toBe('discard');
    expect(s.justDrew).toBe(false);
    expect(selfOptions(s, 'b').win).toBe(false);
    expect(s.discards.a).toEqual([]);
    expect(accounted(s)).toBe(true);
  });
});

describe('mahjong played out by computers', () => {
  it('finishes fifty seeded hands, legally, with every tile accounted for after every action', () => {
    let wins = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      let s = dealt(seed);
      let actions = 0;
      while (s.phase === 'playing' && actions < 2000) {
        s = step(s);
        expect(accounted(s)).toBe(true);
        actions += 1;
      }
      expect(s.phase).toBe('results');
      if (s.result?.winner) {
        wins += 1;
        const total = Object.values(s.result.payments).reduce((t, v) => t + v, 0);
        expect(total).toBe(0);
        expect(s.seats.reduce((t, x) => t + x.score, 0)).toBe(0);
      } else {
        expect(s.wall.length).toBeLessThanOrEqual(DEAD_WALL);
      }
    }
    // The computers are not great, but they should finish a fair share of hands.
    expect(wins).toBeGreaterThan(10);
  });

  it('carries scores into the next hand and rotates the dealer', () => {
    let s = dealt(2);
    while (s.phase === 'playing') s = step(s);
    const scores = s.seats.map((x) => x.score);
    s = mahjong.reduce(s, { type: 'again', seed: 3 }, ctx('a'));
    expect(s.phase).toBe('playing');
    expect(s.dealer).toBe(1);
    expect(currentSeat(s)?.uid).toBe('b');
    expect(s.seats.map((x) => x.score)).toEqual(scores);
  });
});

describe('calling on the tile that completes your hand', () => {
  /**
   * The position from a real game: b has two pongs down and holds a pair of 9 bamboo, a run and
   * another pair, so a's 9 bamboo completes four sets and a pair. b tapped Pong rather than
   * Mahjong, and was left holding a complete hand that the rules then made them break up.
   */
  function waitingOnNineBamboo(): { s: MahjongState; tile: number } {
    fresh();
    const melds: Meld[] = [
      { kind: 'pong', tiles: [d(9), d(9), d(9)], from: 'c' },
      { kind: 'pong', tiles: [d(3), d(3), d(3)], from: 'd' },
    ];
    const handB = [b(9), b(9), c(2), c(3), c(4), E(), E()];
    const tile = b(9);
    const s: MahjongState = {
      phase: 'playing',
      seats: people.map((p) => ({ uid: p.uid, name: p.name, score: 0 })),
      wall: [c(7), c(7), c(8), c(8), c(9), c(9), d(1), d(1), d(2), d(2), d(4), d(4), d(5), d(5), d(6), d(6), b(1), b(1)],
      hands: { a: [], b: handB, c: [N(), W(), S(), Wh()], d: [G(), G(), R(), R()] },
      melds: { a: [], b: melds, c: [], d: [] },
      discards: { a: [tile], b: [], c: [], d: [] },
      turn: 0, dealer: 0, stage: 'claims', justDrew: false,
      claim: { tile, by: 'a', responses: { b: null, c: 'pass', d: 'pass' } },
      seed: 1, handNumber: 0, result: null, last: '',
    };
    return { s, tile };
  }

  it('offers the win alongside the pong', () => {
    const { s } = waitingOnNineBamboo();
    expect(myClaimOptions(s, 'b').map((o) => o.kind)).toEqual(['win', 'pong']);
  });

  it('takes a pong on that tile as the win, paid by the discarder', () => {
    const { s, tile } = waitingOnNineBamboo();
    const after = mahjong.reduce(s, { type: 'claim', claim: { kind: 'pong' } }, ctx('b'));
    expect(after.phase).toBe('results');
    expect(after.result?.winner).toBe('b');
    expect(after.result?.from).toBe('a');
    expect(after.result?.hand).toContain(tile);
    expect(after.discards.a).toEqual([]);
    expect(after.seats.find((x) => x.uid === 'a')!.score).toBeLessThan(0);
  });

  it('still lets a pong that does not complete the hand stay a pong', () => {
    const { s } = waitingOnNineBamboo();
    // Without the run, the 9 bamboo makes a pong but not a winning hand.
    const hands = { ...s.hands, b: [s.hands.b[0], s.hands.b[1], c(6), c(9), S(), E(), E()] };
    const after = mahjong.reduce({ ...s, hands }, { type: 'claim', claim: { kind: 'pong' } }, ctx('b'));
    expect(after.phase).toBe('playing');
    expect(meldsOf(after, 'b')).toHaveLength(3);
    expect(after.stage).toBe('discard');
  });
});
