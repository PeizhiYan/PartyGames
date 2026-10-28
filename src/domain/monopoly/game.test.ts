import { describe, expect, it } from 'vitest';
import { COLORS, TOKENS, monopoly, ranking, seatOf, totalWealth, type MonopolyState } from './game';
import { GameRuleError, type GameContext, type RoomPlayer } from '../types';

const alice: RoomPlayer = { uid: 'alice', name: 'Alice', joinedAt: 1 };
const bob: RoomPlayer = { uid: 'bob', name: 'Bob', joinedAt: 2 };
const carol: RoomPlayer = { uid: 'carol', name: 'Carol', joinedAt: 3 };

let clock = 1000;
const ctx = (actorUid: string, players: RoomPlayer[] = [alice, bob]): GameContext =>
  ({ actorUid, ownerUid: 'alice', players, now: clock++ });

const run = (state: MonopolyState, uid: string, action: unknown, players?: RoomPlayer[]): MonopolyState =>
  monopoly.reduce(state as never, action as never, ctx(uid, players) as never) as unknown as MonopolyState;

const sync = (state: MonopolyState, players: RoomPlayer[]): MonopolyState =>
  monopoly.onPlayersChanged!(state as never, ctx('alice', players) as never) as unknown as MonopolyState;

/** A two-player game taken all the way to the playing phase. */
function playing(players: RoomPlayer[] = [alice, bob]): MonopolyState {
  let state = sync(monopoly.newState(ctx('alice', players)) as unknown as MonopolyState, players);
  state = run(state, 'alice', { type: 'start' }, players);
  for (const [i, p] of players.entries()) {
    state = run(state, p.uid, { type: 'pick', token: TOKENS[i], color: COLORS[i] }, players);
  }
  for (const [i, p] of players.entries()) {
    state = run(state, p.uid, { type: 'rollOrder', dice: [6 - i, 1] }, players);
  }
  return run(state, 'alice', { type: 'beginPlay' }, players);
}

describe('getting started', () => {
  it('seats whoever is in the room and drops whoever leaves', () => {
    let state = sync(monopoly.newState(ctx('alice')) as unknown as MonopolyState, [alice, bob]);
    expect(state.seats.map((s) => s.uid)).toEqual(['alice', 'bob']);
    state = sync(state, [alice, bob, carol]);
    expect(state.seats).toHaveLength(3);
    state = sync(state, [alice, carol]);
    expect(state.seats.map((s) => s.uid)).toEqual(['alice', 'carol']);
  });

  it('only lets the host configure and start', () => {
    const state = sync(monopoly.newState(ctx('alice')) as unknown as MonopolyState, [alice, bob]);
    expect(() => run(state, 'bob', { type: 'configure', startingBalance: 2000 })).toThrow(/host/i);
    expect(() => run(state, 'bob', { type: 'start' })).toThrow(/host/i);
  });

  it('refuses a silly starting balance', () => {
    const state = sync(monopoly.newState(ctx('alice')) as unknown as MonopolyState, [alice, bob]);
    expect(() => run(state, 'alice', { type: 'configure', startingBalance: 1 })).toThrow(GameRuleError);
    expect(() => run(state, 'alice', { type: 'configure', startingBalance: 10_000_000 })).toThrow(GameRuleError);
    expect(run(state, 'alice', { type: 'configure', startingBalance: 2500 }).settings.startingBalance).toBe(2500);
  });

  it('will not start with one player', () => {
    const alone = sync(monopoly.newState(ctx('alice', [alice])) as unknown as MonopolyState, [alice]);
    expect(() => run(alone, 'alice', { type: 'start' }, [alice])).toThrow(/two players/i);
  });

  it('hands out the starting money once everyone has picked', () => {
    let state = sync(monopoly.newState(ctx('alice')) as unknown as MonopolyState, [alice, bob]);
    state = run(state, 'alice', { type: 'configure', startingBalance: 2000 });
    state = run(state, 'alice', { type: 'start' });
    state = run(state, 'alice', { type: 'pick', token: TOKENS[0], color: COLORS[0] });
    expect(state.phase).toBe('pick');
    state = run(state, 'bob', { type: 'pick', token: TOKENS[1], color: COLORS[1] });
    expect(state.phase).toBe('roll');
    expect(state.seats.every((s) => s.balance === 2000)).toBe(true);
  });

  it('refuses a token someone else already locked in', () => {
    let state = sync(monopoly.newState(ctx('alice')) as unknown as MonopolyState, [alice, bob]);
    state = run(state, 'alice', { type: 'start' });
    state = run(state, 'alice', { type: 'pick', token: TOKENS[0], color: COLORS[0] });
    expect(() => run(state, 'bob', { type: 'pick', token: TOKENS[0], color: COLORS[1] })).toThrow(/already took/i);
  });

  it('refuses anything that is not two real dice', () => {
    let state = sync(monopoly.newState(ctx('alice')) as unknown as MonopolyState, [alice, bob]);
    state = run(state, 'alice', { type: 'start' });
    state = run(state, 'alice', { type: 'pick', token: TOKENS[0], color: COLORS[0] });
    state = run(state, 'bob', { type: 'pick', token: TOKENS[1], color: COLORS[1] });
    expect(() => run(state, 'alice', { type: 'rollOrder', dice: [7, 1] })).toThrow(/two dice/i);
    expect(() => run(state, 'alice', { type: 'rollOrder', dice: [0, 3] })).toThrow(/two dice/i);
    expect(() => run(state, 'alice', { type: 'rollOrder', dice: [3] })).toThrow(/two dice/i);
  });

  it('puts the highest roll first', () => {
    const state = playing();
    expect(state.order[0]).toBe('alice'); // alice rolled 6+1, bob 5+1
    expect(state.phase).toBe('playing');
  });
});

describe('moving money', () => {
  it('moves cash between players and logs it', () => {
    const state = run(playing(), 'alice', { type: 'send', to: 'bob', amount: 300, note: 'Rent' });
    expect(seatOf(state, 'alice')!.balance).toBe(1200);
    expect(seatOf(state, 'bob')!.balance).toBe(1800);
    expect(state.log.at(-1)).toMatchObject({ kind: 'transfer', from: 'alice', to: 'bob', amount: 300, note: 'Rent' });
    expect(state.history.alice).toHaveLength(2);
  });

  it('refuses more than the payer has, and anything at or below zero', () => {
    const state = playing();
    expect(() => run(state, 'alice', { type: 'send', to: 'bob', amount: 5000, note: '' })).toThrow(/that much/i);
    expect(() => run(state, 'alice', { type: 'send', to: 'bob', amount: 0, note: '' })).toThrow(GameRuleError);
    expect(() => run(state, 'alice', { type: 'send', to: 'bob', amount: -50, note: '' })).toThrow(GameRuleError);
  });

  it('refuses paying yourself or a stranger', () => {
    const state = playing();
    expect(() => run(state, 'alice', { type: 'send', to: 'alice', amount: 50, note: '' })).toThrow(/someone else/i);
    expect(() => run(state, 'alice', { type: 'send', to: 'nobody', amount: 50, note: '' })).toThrow(/someone else/i);
  });

  it('rounds a fractional amount down to whole money', () => {
    const state = run(playing(), 'alice', { type: 'send', to: 'bob', amount: 10.9, note: '' });
    expect(seatOf(state, 'alice')!.balance).toBe(1490);
  });

  it('pays the bank', () => {
    const state = run(playing(), 'alice', { type: 'payBank', amount: 200, reason: 'Buy land' });
    expect(seatOf(state, 'alice')!.balance).toBe(1300);
    expect(state.log.at(-1)).toMatchObject({ kind: 'payBank', amount: 200, note: 'Buy land' });
  });

  it('keeps a player from acting if they are not in the game', () => {
    expect(() => run(playing(), 'carol', { type: 'payBank', amount: 10, reason: '' }, [alice, bob, carol]))
      .toThrow(/not in this game/i);
  });
});

describe('bank requests', () => {
  it('pays out as soon as the only other player approves', () => {
    let state = run(playing(), 'bob', { type: 'requestBank', amount: 200, reason: 'Passed Go' });
    expect(state.requests).toHaveLength(1);
    expect(seatOf(state, 'bob')!.balance).toBe(1500);
    state = run(state, 'alice', { type: 'respondBank', id: state.requests[0].id, approve: true });
    expect(state.requests).toHaveLength(0);
    expect(seatOf(state, 'bob')!.balance).toBe(1700);
    expect(state.log.at(-1)).toMatchObject({ kind: 'fromBank', to: 'bob', amount: 200 });
  });

  it('waits for every other player in a three-way game', () => {
    const three = [alice, bob, carol];
    let state = playing(three);
    state = run(state, 'carol', { type: 'requestBank', amount: 100, reason: '' }, three);
    state = run(state, 'alice', { type: 'respondBank', id: state.requests[0].id, approve: true }, three);
    expect(state.requests).toHaveLength(1);
    expect(seatOf(state, 'carol')!.balance).toBe(1500);
    state = run(state, 'bob', { type: 'respondBank', id: state.requests[0].id, approve: true }, three);
    expect(seatOf(state, 'carol')!.balance).toBe(1600);
  });

  it('drops the request on a single rejection', () => {
    const three = [alice, bob, carol];
    let state = playing(three);
    state = run(state, 'carol', { type: 'requestBank', amount: 100, reason: '' }, three);
    state = run(state, 'alice', { type: 'respondBank', id: state.requests[0].id, approve: true }, three);
    state = run(state, 'bob', { type: 'respondBank', id: state.requests[0].id, approve: false }, three);
    expect(state.requests).toHaveLength(0);
    expect(seatOf(state, 'carol')!.balance).toBe(1500);
  });

  it('will not let you approve your own request, or queue two at once', () => {
    const state = run(playing(), 'bob', { type: 'requestBank', amount: 200, reason: '' });
    expect(() => run(state, 'bob', { type: 'respondBank', id: state.requests[0].id, approve: true }))
      .toThrow(/your own/i);
    expect(() => run(state, 'bob', { type: 'requestBank', amount: 50, reason: '' })).toThrow(/still waiting/i);
  });

  it('counts one approval once, however many times it is sent', () => {
    const three = [alice, bob, carol];
    let state = playing(three);
    state = run(state, 'carol', { type: 'requestBank', amount: 100, reason: '' }, three);
    const id = state.requests[0].id;
    state = run(state, 'alice', { type: 'respondBank', id, approve: true }, three);
    state = run(state, 'alice', { type: 'respondBank', id, approve: true }, three);
    expect(state.requests[0].approvedBy).toEqual(['alice']);
  });
});

describe('finishing', () => {
  it('needs everyone to agree, and one no puts them back in the game', () => {
    let state = run(playing(), 'alice', { type: 'endGame' });
    expect(state.phase).toBe('endVote');
    expect(state.endVote!.approvedBy).toEqual(['alice']);
    state = run(state, 'bob', { type: 'respondEnd', approve: false });
    expect(state.phase).toBe('playing');
    expect(state.endVote).toBeNull();

    state = run(state, 'bob', { type: 'endGame' });
    state = run(state, 'alice', { type: 'respondEnd', approve: true });
    expect(state.phase).toBe('assets');
  });

  it('ranks everyone by cash plus property', () => {
    let state = run(playing(), 'alice', { type: 'send', to: 'bob', amount: 500, note: '' });
    state = run(state, 'alice', { type: 'endGame' });
    state = run(state, 'bob', { type: 'respondEnd', approve: true });
    state = run(state, 'alice', { type: 'submitAssets', value: 2000 });
    expect(state.phase).toBe('assets');
    state = run(state, 'bob', { type: 'submitAssets', value: 100 });
    expect(state.phase).toBe('results');

    const [first, second] = ranking(state);
    expect(first.uid).toBe('alice'); // 1000 cash + 2000 property
    expect(totalWealth(first)).toBe(3000);
    expect(second.uid).toBe('bob'); // 2000 cash + 100 property
    expect(totalWealth(second)).toBe(2100);
  });

  it('refuses a second asset total and a negative one', () => {
    let state = run(playing(), 'alice', { type: 'endGame' });
    state = run(state, 'bob', { type: 'respondEnd', approve: true });
    expect(() => run(state, 'alice', { type: 'submitAssets', value: -5 })).toThrow(/0 or more/i);
    state = run(state, 'alice', { type: 'submitAssets', value: 10 });
    expect(() => run(state, 'alice', { type: 'submitAssets', value: 20 })).toThrow(/already sent/i);
  });

  it('starts another game with the same settings and seats', () => {
    let state = run(playing(), 'alice', { type: 'endGame' });
    state = run(state, 'bob', { type: 'respondEnd', approve: true });
    state = run(state, 'alice', { type: 'submitAssets', value: 10 });
    state = run(state, 'bob', { type: 'submitAssets', value: 20 });
    expect(() => run(state, 'bob', { type: 'newGame' })).toThrow(/host/i);

    const fresh = run(state, 'alice', { type: 'newGame' });
    expect(fresh.phase).toBe('lobby');
    expect(fresh.seats.map((s) => s.uid)).toEqual(['alice', 'bob']);
    expect(fresh.seats.every((s) => s.balance === 1500 && s.assets === null && !s.ready)).toBe(true);
    expect(fresh.seats[0].token).toBe(TOKENS[0]); // tokens are kept for a quick rematch
    expect(fresh.log).toEqual([]);
  });
});

describe('actions out of phase', () => {
  it('are refused', () => {
    const lobby = sync(monopoly.newState(ctx('alice')) as unknown as MonopolyState, [alice, bob]);
    expect(() => run(lobby, 'alice', { type: 'send', to: 'bob', amount: 1, note: '' })).toThrow(GameRuleError);
    expect(() => run(lobby, 'alice', { type: 'roll', dice: [1, 1] })).toThrow(GameRuleError);
    expect(() => run(playing(), 'alice', { type: 'start' })).toThrow(GameRuleError);
    expect(() => run(playing(), 'alice', { type: 'unknown' })).toThrow(/unknown move/i);
  });
});
