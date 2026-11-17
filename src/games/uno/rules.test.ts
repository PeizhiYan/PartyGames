import { describe, expect, it } from 'vitest';
import type { GameContext, RoomPlayer } from '../../types';
import { DECK, DECK_SIZE, cardOf, isNumber } from './cards';
import { chooseAction } from './ai';
import { canPlay, catchable, currentSeat, handOf, topCard, uno, type UnoState } from './rules';

const people = (n: number): RoomPlayer[] => Array.from({ length: n }, (_, i) => ({ uid: `p${i}`, name: `P${i}`, joinedAt: i }));
const ctxFor = (players: RoomPlayer[]) => (actorUid: string): GameContext => ({ actorUid, ownerUid: 'p0', players, now: 1 });

function dealt(n: number, seed = 1): { s: UnoState; ctx: (u: string) => GameContext } {
  const players = people(n);
  const ctx = ctxFor(players);
  const s = uno.onPlayersChanged!(uno.newState(ctx('p0')), ctx('p0'));
  return { s: uno.reduce(s, { type: 'start', seed }, ctx('p0')), ctx };
}

/** Every card is in exactly one place. */
function accounted(s: UnoState): boolean {
  const all = [...s.deck, ...s.discard, ...Object.values(s.hands).flat()].sort((a, b) => a - b);
  return all.length === DECK_SIZE && all.every((id, i) => id === i);
}

/** Hand-builds a state for one rule, with cards chosen by face. */
function find(kind: string, color: string, skip = 0): number {
  return DECK.filter((c) => c.kind === kind && c.color === color)[skip].id;
}

describe('uno deck and deal', () => {
  it('has 108 cards in the right mix', () => {
    expect(DECK_SIZE).toBe(108);
    expect(DECK.filter((c) => c.kind === '0')).toHaveLength(4);
    expect(DECK.filter((c) => c.kind === '7')).toHaveLength(8);
    expect(DECK.filter((c) => c.kind === 'wild4')).toHaveLength(4);
    expect(DECK.filter((c) => c.color === 'red')).toHaveLength(25);
  });

  it('deals seven each from a seed, starts on a number card, and loses no card', () => {
    const { s } = dealt(4, 99);
    expect(Object.values(s.hands).every((h) => h.length === 7)).toBe(true);
    expect(isNumber(topCard(s))).toBe(true);
    expect(s.activeColor).toBe(cardOf(topCard(s)).color);
    expect(accounted(s)).toBe(true);
    expect(dealt(4, 99).s).toEqual(s);
    expect(dealt(4, 100).s.hands).not.toEqual(s.hands);
  });

  it('needs two players and the host', () => {
    const players = people(2);
    const ctx = ctxFor(players);
    const s = uno.onPlayersChanged!(uno.newState(ctx('p0')), ctx('p0'));
    expect(() => uno.reduce(s, { type: 'start', seed: 1 }, ctx('p1'))).toThrow(/host/);
    const lone = ctxFor(people(1));
    expect(() => uno.reduce(uno.onPlayersChanged!(uno.newState(lone('p0')), lone('p0')), { type: 'start', seed: 1 }, lone('p0'))).toThrow(/two/);
  });
});

describe('uno play', () => {
  /** A three-player table with chosen hands and a chosen top card. */
  function table(top: number, hands: number[][]): { s: UnoState; ctx: (u: string) => GameContext } {
    const { s, ctx } = dealt(3);
    const used = new Set([top, ...hands.flat()]);
    const deck = Array.from({ length: DECK_SIZE }, (_, i) => i).filter((i) => !used.has(i));
    return {
      s: { ...s, turn: 0, direction: 1, discard: [top], deck, hands: { p0: hands[0], p1: hands[1], p2: hands[2] },
        activeColor: cardOf(top).color as 'red', pendingDraw: 0, drawn: null, uno: {} },
      ctx,
    };
  }

  it('must match colour or face; a wild names the colour', () => {
    const { s, ctx } = table(find('5', 'red'), [[find('7', 'blue'), find('5', 'green'), find('wild', 'wild'), find('1', 'red')], [find('1', 'blue')], [find('2', 'blue')]]);
    expect(() => uno.reduce(s, { type: 'play', card: find('7', 'blue') }, ctx('p0'))).toThrow(/does not match/);
    expect(() => uno.reduce(s, { type: 'play', card: find('wild', 'wild') }, ctx('p0'))).toThrow(/colour/);
    const w = uno.reduce(s, { type: 'play', card: find('wild', 'wild'), color: 'blue' }, ctx('p0'));
    expect(w.activeColor).toBe('blue');
    expect(currentSeat(w)?.uid).toBe('p1');
    expect(() => uno.reduce(s, { type: 'play', card: find('5', 'green') }, ctx('p1'))).toThrow(/not your turn/);
  });

  it('skip skips, reverse reverses, draw-two makes the next player take two', () => {
    const base = [[find('skip', 'red'), find('reverse', 'red'), find('draw2', 'red'), find('9', 'red')], [find('1', 'blue'), find('3', 'blue')], [find('2', 'blue'), find('4', 'blue')]];
    let t = table(find('5', 'red'), base);
    expect(currentSeat(uno.reduce(t.s, { type: 'play', card: find('skip', 'red') }, t.ctx('p0')))?.uid).toBe('p2');
    t = table(find('5', 'red'), base);
    const r = uno.reduce(t.s, { type: 'play', card: find('reverse', 'red') }, t.ctx('p0'));
    expect(r.direction).toBe(-1);
    expect(currentSeat(r)?.uid).toBe('p2');
    t = table(find('5', 'red'), base);
    const d = uno.reduce(t.s, { type: 'play', card: find('draw2', 'red') }, t.ctx('p0'));
    expect(d.pendingDraw).toBe(2);
    expect(canPlay(d, find('1', 'blue'))).toBe(false);
    const took = uno.reduce(d, { type: 'draw' }, t.ctx('p1'));
    expect(handOf(took, 'p1')).toHaveLength(4);
    expect(took.pendingDraw).toBe(0);
    expect(currentSeat(took)?.uid).toBe('p2');
  });

  it('draw cards stack on their own kind', () => {
    const { s, ctx } = table(find('5', 'red'), [[find('draw2', 'red'), find('9', 'red')], [find('draw2', 'blue'), find('3', 'blue')], [find('2', 'blue'), find('4', 'blue')]]);
    let x = uno.reduce(s, { type: 'play', card: find('draw2', 'red') }, ctx('p0'));
    x = uno.reduce(x, { type: 'play', card: find('draw2', 'blue') }, ctx('p1'));
    expect(x.pendingDraw).toBe(4);
    x = uno.reduce(x, { type: 'draw' }, ctx('p2'));
    expect(handOf(x, 'p2')).toHaveLength(6);
  });

  it('a reverse with two players comes straight back', () => {
    const { s, ctx } = dealt(2);
    const red5 = find('5', 'red');
    const rev = find('reverse', 'red');
    const used = new Set([red5, rev, find('1', 'blue'), find('2', 'red')]);
    const state: UnoState = { ...s, turn: 0, discard: [red5], activeColor: 'red', hands: { p0: [rev, find('2', 'red')], p1: [find('1', 'blue')] },
      deck: Array.from({ length: DECK_SIZE }, (_, i) => i).filter((i) => !used.has(i)) };
    expect(currentSeat(uno.reduce(state, { type: 'play', card: rev }, ctx('p0')))?.uid).toBe('p0');
  });

  it('a drawn card may be played at once; otherwise the turn passes on its own', () => {
    const { s, ctx } = table(find('5', 'red'), [[find('7', 'blue')], [find('1', 'blue')], [find('2', 'blue')]]);
    const playableNext = { ...s, deck: [...s.deck.filter((i) => i !== find('8', 'red')), find('8', 'red')] };
    const drew = uno.reduce(playableNext, { type: 'draw' }, ctx('p0'));
    expect(drew.drawn).toBe(find('8', 'red'));
    expect(() => uno.reduce(drew, { type: 'play', card: find('7', 'blue') }, ctx('p0'))).toThrow(/just drew/);
    expect(currentSeat(uno.reduce(drew, { type: 'pass' }, ctx('p0')))?.uid).toBe('p1');
    const dud = { ...s, deck: [...s.deck.filter((i) => i !== find('8', 'green')), find('8', 'green')] };
    const passed = uno.reduce(dud, { type: 'draw' }, ctx('p0'));
    expect(passed.drawn).toBeNull();
    expect(currentSeat(passed)?.uid).toBe('p1');
  });

  it('UNO can be called on two cards; anyone can catch a player on one who did not', () => {
    const { s, ctx } = table(find('5', 'red'), [[find('7', 'red'), find('9', 'blue')], [find('1', 'blue')], [find('2', 'blue'), find('3', 'blue')]]);
    const out = uno.reduce(s, { type: 'play', card: find('7', 'red') }, ctx('p0'));
    expect(catchable(out, 'p0')).toBe(true);
    const caught = uno.reduce(out, { type: 'catch', uid: 'p0' }, ctx('p2'));
    expect(handOf(caught, 'p0')).toHaveLength(3);
    const called = uno.reduce(uno.reduce(s, { type: 'callUno' }, ctx('p0')), { type: 'play', card: find('7', 'red') }, ctx('p0'));
    expect(() => uno.reduce(called, { type: 'catch', uid: 'p0' }, ctx('p2'))).toThrow(/covered/);
    expect(() => uno.reduce(s, { type: 'callUno' }, ctx('p2'))).not.toThrow();
  });

  it('going out ends the round and scores the other hands', () => {
    const { s, ctx } = table(find('5', 'red'), [[find('7', 'red')], [find('9', 'blue'), find('skip', 'blue')], [find('wild', 'wild')]]);
    const done = uno.reduce(s, { type: 'play', card: find('7', 'red') }, ctx('p0'));
    expect(done.phase).toBe('results');
    expect(done.winner).toBe('p0');
    expect(done.seats.find((x) => x.uid === 'p0')?.score).toBe(9 + 20 + 50);
    const next = uno.reduce(done, { type: 'again', seed: 5 }, ctx('p0'));
    expect(next.phase).toBe('playing');
    expect(next.round).toBe(1);
    expect(next.seats.find((x) => x.uid === 'p0')?.score).toBe(79);
  });

  it('reshuffles the pile under its top card when the deck runs out', () => {
    const { s, ctx } = table(find('5', 'red'), [[find('7', 'blue')], [find('1', 'blue')], [find('2', 'blue')]]);
    const pile = [find('3', 'green'), find('4', 'green'), find('5', 'red')];
    const dry: UnoState = { ...s, deck: [], discard: pile };
    const after = uno.reduce(dry, { type: 'draw' }, ctx('p0'));
    expect(after.discard).toEqual([find('5', 'red')]);
    expect(after.reshuffles).toBe(1);
    expect(handOf(after, 'p0').length + after.deck.length).toBe(1 + 2);
  });

  it('skips a player who left mid-round', () => {
    const { s, ctx } = dealt(3);
    const two = [{ uid: 'p0', name: 'P0', joinedAt: 0 }, { uid: 'p2', name: 'P2', joinedAt: 2 }];
    const left = uno.onPlayersChanged!({ ...s, turn: 1 }, { ...ctx('p0'), players: two });
    expect(left.seats[1].absent).toBe(true);
    expect(currentSeat(left)?.uid).toBe('p2');
  });
});

describe('uno played out by computers', () => {
  it('finishes fifty seeded games, legally, without losing a card', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const n = 2 + (seed % 4);
      let { s } = dealt(n, seed);
      const { ctx } = dealt(n, seed);
      let moves = 0;
      while (s.phase === 'playing' && moves < 3000) {
        const uid = currentSeat(s)!.uid;
        if (handOf(s, uid).length <= 2 && !s.uno[uid]) s = uno.reduce(s, { type: 'callUno' }, ctx(uid));
        s = uno.reduce(s, chooseAction(s, uid), ctx(uid));
        expect(accounted(s)).toBe(true);
        moves += 1;
      }
      expect(s.phase).toBe('results');
      expect(s.winner).not.toBeNull();
    }
  });

  it('refuses a card it does not hold', () => {
    const { s, ctx } = dealt(2);
    const me = currentSeat(s)!.uid;
    const other = me === 'p0' ? 'p1' : 'p0';
    expect(() => uno.reduce(s, { type: 'play', card: s.hands[other][0] }, ctx(me))).toThrow(/not in your hand/);
  });
});
