/**
 * The computer players' policies, played out the way `useComputerTurns` plays them — soonest move
 * first, each action as the computer making it — through the real reducers, with nobody but
 * computers at the table. A policy that ever proposes an illegal move, or stalls, fails here.
 */
import { describe, expect, it } from 'vitest';
import type { GameContext, GameDefinition, RoomPlayer } from '../types';
import type { ComputerPolicy } from './turns';
import { computerUid, localRoster } from './local';
import { rng } from './shuffle';
import { yahtzee } from './yahtzee/rules';
import { yahtzeeComputers } from './yahtzee/computers';
import { uno, type UnoState } from './uno/rules';
import { unoComputers, GRACE_MS } from './uno/computers';
import { mahjong } from './mahjong/rules';
import { mahjongComputers } from './mahjong/computers';

const host = { uid: 'host', name: 'Host' };

/** A table of nobody but computers; the first hosts it, as a person would. */
const computers = (n: number): RoomPlayer[] => Array.from({ length: n }, (_, i) => ({ uid: computerUid(i), name: `C${i}`, joinedAt: i }));

function playOut<S extends { phase: string }, A>(
  game: GameDefinition<S, A>, policy: ComputerPolicy<S, A>, players: RoomPlayer[], start: A, seed: number, limit = 5000,
): { state: S; steps: number } {
  const random = rng(seed);
  const ctx = (actorUid: string): GameContext => ({ actorUid, ownerUid: players[0].uid, players, now: 1 });
  let state = game.onPlayersChanged!(game.newState(ctx(players[0].uid)), ctx(players[0].uid));
  state = game.reduce(state, start, ctx(players[0].uid));
  let steps = 0;
  while (state.phase === 'playing' && steps < limit) {
    const moves = policy(state, random);
    expect(moves.length, 'a computer should always have a move while one is to play').toBeGreaterThan(0);
    const move = [...moves].sort((a, b) => a.delay - b.delay)[0];
    for (const action of move.actions) state = game.reduce(state, action, ctx(move.as));
    steps += 1;
  }
  return { state, steps };
}

describe('computer players, through the real rules', () => {
  it('Yahtzee: three computers fill every box', () => {
    for (const seed of [1, 2, 3]) {
      const { state } = playOut(yahtzee, yahtzeeComputers, computers(3), { type: 'start' }, seed);
      expect(state.phase).toBe('results');
      for (const seat of state.seats) expect(Object.keys(seat.card)).toHaveLength(13);
    }
  });

  it('UNO: computers play a round to the end', () => {
    for (const seed of [1, 7, 42]) {
      const { state } = playOut(uno, unoComputers, computers(4), { type: 'start', seed }, seed);
      expect(state.phase).toBe('results');
    }
  });

  it('UNO: a person on one card who has not called it is caught, after a grace, sometimes', () => {
    const roster = localRoster(host, [{ kind: 'computer', name: 'Dot' }]);
    const ctx = (actorUid: string): GameContext => ({ actorUid, ownerUid: 'host', players: roster, now: 1 });
    let s = uno.onPlayersChanged!(uno.newState(ctx('host')), ctx('host'));
    s = uno.reduce(s, { type: 'start', seed: 3 }, ctx('host'));
    const exposed: UnoState = { ...s, hands: { ...s.hands, host: [s.hands.host[0]] }, uno: {} };
    const catches = unoComputers(exposed, () => 0).filter((m) => m.actions[0] && (m.actions[0] as { type: string }).type === 'catch');
    expect(catches).toEqual([{ as: 'computer', actions: [{ type: 'catch', uid: 'host' }], delay: GRACE_MS, chance: expect.any(Number) }]);
    // Computers never catch each other: only people forget.
    const cpuExposed: UnoState = { ...s, hands: { ...s.hands, computer: [s.hands.computer[0]] }, uno: {} };
    expect(unoComputers(cpuExposed, () => 0).some((m) => (m.actions[0] as { type: string }).type === 'catch')).toBe(false);
  });

  it('Mahjong: four computers play hands out, answering every call', () => {
    for (const seed of [1, 5, 9]) {
      const { state } = playOut(mahjong, mahjongComputers, computers(4), { type: 'start', seed }, seed);
      expect(state.phase).toBe('results');
    }
  });

  it('do nothing while a person is to move', () => {
    const roster = localRoster(host, [{ kind: 'computer', name: 'Dot' }]);
    const ctx = (actorUid: string): GameContext => ({ actorUid, ownerUid: 'host', players: roster, now: 1 });
    let s = yahtzee.onPlayersChanged!(yahtzee.newState(ctx('host')), ctx('host'));
    s = yahtzee.reduce(s, { type: 'start' }, ctx('host'));
    expect(yahtzeeComputers(s, Math.random)).toEqual([]);
  });
});

describe('a table on one device', () => {
  it('numbers computers and people separately, in seat order', () => {
    const roster = localRoster(host, [
      { kind: 'person', name: 'Ann' }, { kind: 'computer', name: 'Dot' }, { kind: 'person', name: 'Ben' }, { kind: 'computer', name: 'Pip' },
    ]);
    expect(roster.map((p) => p.uid)).toEqual(['host', 'guest', 'computer', 'guest-2', 'computer-2']);
    expect(roster.map((p) => p.name)).toEqual(['Host', 'Ann', 'Dot', 'Ben', 'Pip']);
  });
});
