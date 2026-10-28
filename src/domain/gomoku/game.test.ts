import { describe, expect, it } from 'vitest';
import { gomoku, seatOf, type GomokuState } from './game';
import { idx } from './board';
import { GameRuleError, type GameContext, type RoomPlayer } from '../types';

const alice: RoomPlayer = { uid: 'alice', name: 'Alice', joinedAt: 1 };
const bob: RoomPlayer = { uid: 'bob', name: 'Bob', joinedAt: 2 };
const carol: RoomPlayer = { uid: 'carol', name: 'Carol', joinedAt: 3 };

const ctx = (actorUid: string, players: RoomPlayer[] = [alice, bob]): GameContext =>
  ({ actorUid, ownerUid: 'alice', players, now: 1000 });

/** A game with both seats taken, ready to play. */
function seated(): GomokuState {
  const fresh = gomoku.newState(ctx('alice')) as unknown as GomokuState;
  return gomoku.onPlayersChanged!(fresh as never, ctx('alice') as never) as unknown as GomokuState;
}

const place = (state: GomokuState, uid: string, cell: number) =>
  gomoku.reduce(state as never, { type: 'place', cell } as never, ctx(uid) as never) as unknown as GomokuState;

describe('seating', () => {
  it('gives the colours to the two longest-standing players', () => {
    const state = seated();
    expect(state.black).toBe('alice');
    expect(state.white).toBe('bob');
    expect(seatOf(state, 'carol')).toBeNull();
  });

  it('frees a seat when its player leaves, and the watcher takes it', () => {
    const state = seated();
    const after = gomoku.onPlayersChanged!(state as never, ctx('alice', [alice, carol]) as never) as unknown as GomokuState;
    expect(after.white).toBe('carol');
  });

  it('waits for a second player before anyone can move', () => {
    const alone = gomoku.onPlayersChanged!(
      gomoku.newState(ctx('alice', [alice])) as never, ctx('alice', [alice]) as never,
    ) as unknown as GomokuState;
    expect(() => place(alone, 'alice', idx(7, 7))).toThrow(GameRuleError);
  });
});

describe('placing stones', () => {
  it('black moves first and the turn passes', () => {
    const state = place(seated(), 'alice', idx(7, 7));
    expect(state.board[idx(7, 7)]).toBe(1);
    expect(state.turn).toBe(2);
    expect(state.moves).toEqual([idx(7, 7)]);
  });

  it('refuses a move out of turn', () => {
    expect(() => place(seated(), 'bob', idx(7, 7))).toThrow(/not your turn/i);
  });

  it('refuses a cell that is taken', () => {
    const state = place(seated(), 'alice', idx(7, 7));
    expect(() => place(state, 'bob', idx(7, 7))).toThrow(/already a stone/i);
  });

  it('refuses a cell off the board', () => {
    expect(() => place(seated(), 'alice', 225)).toThrow(GameRuleError);
    expect(() => place(seated(), 'alice', -1)).toThrow(GameRuleError);
  });

  it('refuses a move from someone who is only watching', () => {
    const state = gomoku.onPlayersChanged!(seated() as never, ctx('carol', [alice, bob, carol]) as never) as unknown as GomokuState;
    expect(() => gomoku.reduce(
      state as never, { type: 'place', cell: idx(1, 1) } as never, ctx('carol', [alice, bob, carol]) as never,
    )).toThrow(/watching/i);
  });

  it('ends the game on five in a row and counts the win', () => {
    let state = seated();
    // Alice builds a row on row 7; Bob answers far away on row 0.
    for (let i = 0; i < 4; i++) {
      state = place(state, 'alice', idx(7, 3 + i));
      state = place(state, 'bob', idx(0, i));
    }
    state = place(state, 'alice', idx(7, 7));
    expect(state.outcome).toBe(1);
    expect(state.winLine).toHaveLength(5);
    expect(state.wins.alice).toBe(1);
  });

  it('refuses moves once the game is over', () => {
    let state = seated();
    for (let i = 0; i < 4; i++) {
      state = place(state, 'alice', idx(7, 3 + i));
      state = place(state, 'bob', idx(0, i));
    }
    state = place(state, 'alice', idx(7, 7));
    expect(() => place(state, 'bob', idx(9, 9))).toThrow(/over/i);
  });
});

describe('resigning and rematches', () => {
  it('hands the win to the other player', () => {
    const state = place(seated(), 'alice', idx(7, 7));
    const after = gomoku.reduce(state as never, { type: 'resign' } as never, ctx('bob') as never) as unknown as GomokuState;
    expect(after.outcome).toBe(1);
    expect(after.wins.alice).toBe(1);
  });

  it('needs both players before a rematch starts, and swaps the colours', () => {
    const over = gomoku.reduce(seated() as never, { type: 'resign' } as never, ctx('alice') as never) as unknown as GomokuState;
    const one = gomoku.reduce(over as never, { type: 'rematch' } as never, ctx('alice') as never) as unknown as GomokuState;
    expect(one.outcome).not.toBe(0);
    expect(one.rematch).toEqual(['alice']);

    const both = gomoku.reduce(one as never, { type: 'rematch' } as never, ctx('bob') as never) as unknown as GomokuState;
    expect(both.outcome).toBe(0);
    expect(both.moves).toEqual([]);
    expect(both.round).toBe(1);
    // Bob had white in round 0, so he starts as black in round 1.
    expect(both.black).toBe('bob');
    expect(both.white).toBe('alice');
    // The running score survives the rematch.
    expect(both.wins.bob).toBe(1);
  });

  it('refuses a rematch while the game is still on', () => {
    expect(() => gomoku.reduce(seated() as never, { type: 'rematch' } as never, ctx('alice') as never))
      .toThrow(/still going/i);
  });
});
