import { describe, expect, it } from 'vitest';
import { gomoku, seatOf, type GomokuState } from './rules';
import { idx } from './board';
import { GameRuleError, type GameContext, type RoomPlayer } from '../../types';

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

describe('taking a move back', () => {
  /** Alice and Bob alternate from the top-left, so each has stones on the board. */
  function played(count: number): GomokuState {
    let state = seated();
    for (let i = 0; i < count; i++) {
      state = place(state, i % 2 === 0 ? 'alice' : 'bob', idx(i, 0));
    }
    return state;
  }

  const ask = (state: GomokuState, uid: string) =>
    gomoku.reduce(state as never, { type: 'requestTakeback' } as never, ctx(uid) as never) as unknown as GomokuState;
  const answer = (state: GomokuState, uid: string, approve: boolean) =>
    gomoku.reduce(state as never, { type: 'respondTakeback', approve } as never, ctx(uid) as never) as unknown as GomokuState;

  it('records who is asking', () => {
    const state = ask(played(1), 'alice');
    expect(state.takeback).toMatchObject({ by: 'alice' });
    // Nothing moves until the opponent answers.
    expect(state.moves).toHaveLength(1);
  });

  it('refuses a request from someone with no stones, or while one is waiting', () => {
    expect(() => ask(seated(), 'alice')).toThrow(/not played/i);
    const waiting = ask(played(1), 'alice');
    expect(() => ask(waiting, 'alice')).toThrow(/already a request/i);
  });

  it('will not let the asker approve their own', () => {
    const waiting = ask(played(1), 'alice');
    expect(() => answer(waiting, 'alice', true)).toThrow(/has to agree/i);
  });

  it('lets the asker withdraw it', () => {
    const withdrawn = answer(ask(played(1), 'alice'), 'alice', false);
    expect(withdrawn.takeback).toBeNull();
    expect(withdrawn.moves).toHaveLength(1);
  });

  it('leaves the board alone when the opponent refuses', () => {
    const refused = answer(ask(played(1), 'alice'), 'bob', false);
    expect(refused.takeback).toBeNull();
    expect(refused.moves).toHaveLength(1);
    expect(refused.turn).toBe(2);
  });

  it('unplays one stone when the opponent has not replied', () => {
    const done = answer(ask(played(1), 'alice'), 'bob', true);
    expect(done.moves).toEqual([]);
    expect(done.board[idx(0, 0)]).toBe(0);
    expect(done.turn).toBe(1); // back to Alice
    expect(done.takeback).toBeNull();
  });

  it('unplays the reply too when the opponent has already moved', () => {
    // Alice, Bob, Alice — then Alice asks, so her third stone and nothing else is hers to lose.
    const before = played(3);
    const done = answer(ask(before, 'alice'), 'bob', true);
    expect(done.moves).toHaveLength(2);
    expect(done.turn).toBe(1);

    // Now Bob asks after Alice has replied: both his stone and her reply come off.
    const four = played(4);
    const bobs = answer(ask(four, 'bob'), 'alice', true);
    expect(bobs.moves).toHaveLength(3);
    expect(bobs.turn).toBe(2);
  });

  it('rebuilds the board rather than trusting it', () => {
    const done = answer(ask(played(3), 'alice'), 'bob', true);
    expect(done.board.filter((s) => s !== 0)).toHaveLength(2);
    expect(done.board[idx(0, 0)]).toBe(1);
    expect(done.board[idx(1, 0)]).toBe(2);
    expect(done.board[idx(2, 0)]).toBe(0);
  });

  it('is dropped when the asker plays on instead', () => {
    const waiting = ask(played(2), 'alice'); // Bob has replied, so it is Alice's turn again
    const moved = place(waiting, 'alice', idx(9, 9));
    expect(moved.takeback).toBeNull();
  });

  it('is refused once the game is over', () => {
    const over = gomoku.reduce(seated() as never, { type: 'resign' } as never, ctx('alice') as never) as unknown as GomokuState;
    expect(() => ask(over, 'bob')).toThrow(/over/i);
  });

  it('is not something a watcher can start or settle', () => {
    const three = [alice, bob, carol];
    const watching = gomoku.onPlayersChanged!(played(1) as never, ctx('carol', three) as never) as unknown as GomokuState;
    expect(() => gomoku.reduce(watching as never, { type: 'requestTakeback' } as never, ctx('carol', three) as never))
      .toThrow(/watching/i);
    const waiting = ask(watching, 'alice');
    expect(() => gomoku.reduce(waiting as never, { type: 'respondTakeback', approve: true } as never, ctx('carol', three) as never))
      .toThrow(/watching/i);
  });
});
