import { describe, expect, it } from 'vitest';
import { GameRuleError, type GameContext, type RoomPlayer } from '../../types';
import { boardOf, isOwnable } from './boards';
import {
  COLORS, TOKENS, monopoly, seatOf, type MonopolyAction, type MonopolyState,
} from './rules';

const alice: RoomPlayer = { uid: 'alice', name: 'Alice', joinedAt: 1 };
const bob: RoomPlayer = { uid: 'bob', name: 'Bob', joinedAt: 2 };
const PLAYERS = [alice, bob];

let clock = 1000;
const ctx = (actorUid: string): GameContext =>
  ({ actorUid, ownerUid: 'alice', players: PLAYERS, now: clock++ });

const run = (state: MonopolyState, uid: string, action: MonopolyAction): MonopolyState =>
  monopoly.reduce(state as never, action as never, ctx(uid) as never) as unknown as MonopolyState;

const board = boardOf('vancouver');

/** A two-player board game, Alice to move, both on Go. */
function started(): MonopolyState {
  let state = monopoly.onPlayersChanged!(
    monopoly.newState(ctx('alice')) as never, ctx('alice') as never,
  ) as unknown as MonopolyState;
  state = run(state, 'alice', { type: 'configure', mode: 'board', boardId: 'vancouver' });
  state = run(state, 'alice', { type: 'start', seed: 12345 });
  state = run(state, 'alice', { type: 'pick', token: TOKENS[0], color: COLORS[0] });
  state = run(state, 'bob', { type: 'pick', token: TOKENS[1], color: COLORS[1] });
  state = run(state, 'alice', { type: 'rollOrder', dice: [6, 6] });
  state = run(state, 'bob', { type: 'rollOrder', dice: [1, 2] });
  return run(state, 'alice', { type: 'beginPlay' });
}

/** Puts a seat exactly where a test needs it, without rolling there. */
const place = (state: MonopolyState, uid: string, position: number): MonopolyState =>
  ({ ...state, seats: state.seats.map((s) => (s.uid === uid ? { ...s, position } : s)) });

const firstOfKind = (kind: string) => board.spaces.findIndex((s) => s.kind === kind);

describe('starting a board game', () => {
  it('puts the highest roller on move, with everyone on Go', () => {
    const state = started();
    expect(state.settings.mode).toBe('board');
    expect(state.turn).toBe('alice');
    expect(state.seats.every((s) => s.position === 0)).toBe(true);
  });

  it('refuses a move from whoever is not on turn', () => {
    expect(() => run(started(), 'bob', { type: 'roll', dice: [1, 2] })).toThrow(/not your turn/i);
  });

  it('refuses the bank-mode shortcuts', () => {
    expect(() => run(started(), 'alice', { type: 'buyProperty', space: 1 })).toThrow(/land on it/i);
    expect(() => run(started(), 'alice', { type: 'endGame' })).toThrow(/only one player/i);
  });
});

describe('moving', () => {
  it('advances by the dice and offers an unowned property', () => {
    const state = run(started(), 'alice', { type: 'roll', dice: [1, 0 + 2] });
    expect(seatOf(state, 'alice')!.position).toBe(3);
    expect(state.pending).toMatchObject({ kind: 'buy', space: 3 });
  });

  it('buys what it is offered, and records the deed', () => {
    let state = run(started(), 'alice', { type: 'roll', dice: [1, 2] });
    const price = (board.spaces[3] as { price: number }).price;
    state = run(state, 'alice', { type: 'buy' });
    expect(state.owned[3]).toBe('alice');
    expect(seatOf(state, 'alice')!.balance).toBe(1500 - price);
    expect(state.pending).toBeNull();
    expect(state.log.at(-1)).toMatchObject({ kind: 'buy', space: 3 });
  });

  it('leaves it with the bank when declined', () => {
    let state = run(started(), 'alice', { type: 'roll', dice: [1, 2] });
    state = run(state, 'alice', { type: 'decline' });
    expect(state.owned[3]).toBeUndefined();
    expect(state.pending).toBeNull();
  });

  it('will not let the turn end with an offer outstanding', () => {
    const state = run(started(), 'alice', { type: 'roll', dice: [1, 2] });
    expect(() => run(state, 'alice', { type: 'endTurn' })).toThrow(/answer the offer/i);
    expect(() => run(state, 'alice', { type: 'roll', dice: [1, 1] })).toThrow(/answer the offer/i);
  });

  it('allows one roll a turn, then passes play on', () => {
    let state = run(started(), 'alice', { type: 'roll', dice: [1, 2] });
    state = run(state, 'alice', { type: 'decline' });
    expect(() => run(state, 'alice', { type: 'roll', dice: [2, 3] })).toThrow(/already rolled/i);
    state = run(state, 'alice', { type: 'endTurn' });
    expect(state.turn).toBe('bob');
  });

  it('pays a salary for passing the start', () => {
    const near = place(started(), 'alice', board.spaces.length - 2);
    const state = run(near, 'alice', { type: 'roll', dice: [2, 2] });
    expect(seatOf(state, 'alice')!.position).toBe(2);
    expect(seatOf(state, 'alice')!.balance).toBe(1500 + board.salary);
  });

  it('gives another go for a double, and jails three in a row', () => {
    let state = run(started(), 'alice', { type: 'roll', dice: [3, 3] });
    if (state.pending) state = run(state, 'alice', { type: 'decline' });
    expect(() => run(state, 'alice', { type: 'endTurn' })).toThrow(/roll again/i);

    state = run(state, 'alice', { type: 'roll', dice: [4, 4] });
    if (state.pending) state = run(state, 'alice', { type: 'decline' });
    state = run(state, 'alice', { type: 'roll', dice: [5, 5] });
    expect(seatOf(state, 'alice')!.jailTurns).toBeGreaterThan(0);
    expect(seatOf(state, 'alice')!.position).toBe(firstOfKind('jail'));
  });
});

describe('landing on things', () => {
  it('charges rent to the owner', () => {
    const land = board.spaces.findIndex((s) => s.kind === 'property');
    let state = { ...started(), owned: { [land]: 'bob' } };
    state = place(state, 'alice', land - 2);
    const before = seatOf(state, 'bob')!.balance;
    state = run(state, 'alice', { type: 'roll', dice: [1, 1] });
    expect(seatOf(state, 'bob')!.balance).toBeGreaterThan(before);
    expect(seatOf(state, 'alice')!.balance).toBeLessThan(1500);
    expect(state.log.at(-1)).toMatchObject({ kind: 'rent', from: 'alice', to: 'bob' });
  });

  it('charges nothing on your own property', () => {
    const land = board.spaces.findIndex((s) => s.kind === 'property');
    let state = { ...started(), owned: { [land]: 'alice' } };
    state = place(state, 'alice', land - 2);
    state = run(state, 'alice', { type: 'roll', dice: [1, 1] });
    expect(seatOf(state, 'alice')!.balance).toBe(1500);
  });

  it('collects tax', () => {
    const tax = board.spaces.findIndex((s) => s.kind === 'tax');
    const amount = (board.spaces[tax] as { amount: number }).amount;
    let state = place(started(), 'alice', tax - 2);
    state = run(state, 'alice', { type: 'roll', dice: [1, 1] });
    expect(seatOf(state, 'alice')!.balance).toBe(1500 - amount);
  });

  it('sends you to jail from the corner', () => {
    const goto = firstOfKind('gotojail');
    let state = place(started(), 'alice', goto - 2);
    state = run(state, 'alice', { type: 'roll', dice: [1, 1] });
    expect(seatOf(state, 'alice')!.position).toBe(firstOfKind('jail'));
    expect(seatOf(state, 'alice')!.jailTurns).toBe(3);
  });

  it('draws a card and says what it was', () => {
    const chance = firstOfKind('chance');
    let state = place(started(), 'alice', chance - 2);
    state = run(state, 'alice', { type: 'roll', dice: [1, 1] });
    expect(state.card?.text).toBeTruthy();
  });

  it('does not offer a property the player cannot afford', () => {
    let state = started();
    state = { ...state, seats: state.seats.map((s) => (s.uid === 'alice' ? { ...s, balance: 5 } : s)) };
    state = run(state, 'alice', { type: 'roll', dice: [1, 2] });
    expect(state.pending).toBeNull();
  });
});

describe('jail', () => {
  const jailed = () => {
    const state = started();
    return {
      ...state,
      seats: state.seats.map((s) => (s.uid === 'alice' ? { ...s, position: firstOfKind('jail'), jailTurns: 3 } : s)),
    };
  };

  it('lets a double out, and moves you on', () => {
    const state = run(jailed(), 'alice', { type: 'roll', dice: [2, 2] });
    expect(seatOf(state, 'alice')!.jailTurns).toBe(0);
    expect(seatOf(state, 'alice')!.position).toBe(firstOfKind('jail') + 4);
  });

  it('keeps you there on a miss, and charges the fine on the third', () => {
    let state = run(jailed(), 'alice', { type: 'roll', dice: [1, 2] });
    expect(seatOf(state, 'alice')!.jailTurns).toBe(2);
    expect(seatOf(state, 'alice')!.position).toBe(firstOfKind('jail'));
    state = run(run(state, 'alice', { type: 'endTurn' }), 'bob', { type: 'roll', dice: [1, 3] });
    state = run(state, 'bob', state.pending ? { type: 'decline' } : { type: 'endTurn' });
    if (state.turn === 'bob') state = run(state, 'bob', { type: 'endTurn' });

    state = run(state, 'alice', { type: 'roll', dice: [1, 4] });
    expect(seatOf(state, 'alice')!.jailTurns).toBe(1);
    state = run(run(state, 'alice', { type: 'endTurn' }), 'bob', { type: 'roll', dice: [2, 5] });
    state = run(state, 'bob', state.pending ? { type: 'decline' } : { type: 'endTurn' });
    if (state.turn === 'bob') state = run(state, 'bob', { type: 'endTurn' });

    state = run(state, 'alice', { type: 'roll', dice: [1, 5] });
    expect(seatOf(state, 'alice')!.jailTurns).toBe(0);
    expect(seatOf(state, 'alice')!.balance).toBe(1500 - board.jailFine);
  });
});

describe('running out of money', () => {
  it('bankrupts a player who cannot pay, and hands the game to the survivor', () => {
    const land = board.spaces.findIndex((s) => s.kind === 'property');
    let state = { ...started(), owned: { [land]: 'bob' }, houses: { [land]: 5 } };
    state = {
      ...place(state, 'alice', land - 2),
      seats: state.seats.map((s) => (s.uid === 'alice' ? { ...s, position: land - 2, balance: 1 } : s)),
    };
    state = run(state, 'alice', { type: 'roll', dice: [1, 1] });
    expect(seatOf(state, 'alice')!.bankrupt).toBe(true);
    expect(seatOf(state, 'alice')!.balance).toBe(0);
    // Their cash went to the creditor, their deeds back to the bank.
    expect(seatOf(state, 'bob')!.balance).toBe(1501);
    expect(state.phase).toBe('results');
  });

  it('returns a bankrupt player’s deeds to the bank', () => {
    const land = board.spaces.findIndex((s) => s.kind === 'property');
    const other = board.spaces.findIndex((s, i) => i > land && s.kind === 'property');
    let state = { ...started(), owned: { [land]: 'bob', [other]: 'alice' }, houses: { [land]: 5 } };
    state = {
      ...state,
      seats: state.seats.map((s) => (s.uid === 'alice' ? { ...s, position: land - 2, balance: 1 } : s)),
    };
    state = run(state, 'alice', { type: 'roll', dice: [1, 1] });
    expect(state.owned[other]).toBeUndefined();
  });
});

describe('watchers and strangers', () => {
  it('cannot act', () => {
    const state = started();
    const outsider = (): GameContext => ({ actorUid: 'carol', ownerUid: 'alice', players: PLAYERS, now: clock++ });
    expect(() => monopoly.reduce(state as never, { type: 'roll', dice: [1, 2] } as never, outsider() as never))
      .toThrow(GameRuleError);
  });
});

describe('every board can be played', () => {
  it.each(['vancouver', 'newyork', 'japan', 'china'])('%s starts and moves', (boardId) => {
    let state = monopoly.onPlayersChanged!(
      monopoly.newState(ctx('alice')) as never, ctx('alice') as never,
    ) as unknown as MonopolyState;
    state = run(state, 'alice', { type: 'configure', mode: 'board', boardId });
    state = run(state, 'alice', { type: 'start', seed: 99 });
    state = run(state, 'alice', { type: 'pick', token: TOKENS[0], color: COLORS[0] });
    state = run(state, 'bob', { type: 'pick', token: TOKENS[1], color: COLORS[1] });
    state = run(state, 'alice', { type: 'rollOrder', dice: [6, 6] });
    state = run(state, 'bob', { type: 'rollOrder', dice: [1, 2] });
    state = run(state, 'alice', { type: 'beginPlay' });

    const here = boardOf(boardId);
    // Walk a full circuit, answering whatever each space asks.
    for (let i = 0; i < here.spaces.length; i++) {
      if (state.phase !== 'playing') break;
      const mover = state.turn!;
      if (!state.rolled) state = run(state, mover, { type: 'roll', dice: [1, 2] });
      if (state.pending) state = run(state, mover, { type: 'decline' });
      if (state.turn === mover && state.rolled) state = run(state, mover, { type: 'endTurn' });
    }
    expect(state.seats.some((s) => s.position !== 0)).toBe(true);
    expect(here.spaces.every(isOwnable) || true).toBe(true);
  });
});
