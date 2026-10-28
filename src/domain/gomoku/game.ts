// Gomoku as a room game: the state two players share and the only ways it may change.
// Pure and synchronous, so the same reducer runs in the browser, in tests, and inside the
// backend's transaction. See src/domain/gomoku/ai.ts for the computer opponent.
import { GameRuleError, type GameContext, type GameDefinition } from '../types';
import { CELLS, emptyBoard, fiveThrough, isFull, type Board, type Player } from './board';

/** 0 while the game is on, 1 or 2 for a winner, 3 for a draw. */
export type Outcome = 0 | 1 | 2 | 3;

export interface GomokuState {
  board: Board;
  /** Cell indices in the order they were played, so the UI can mark the latest stone. */
  moves: number[];
  turn: Player;
  outcome: Outcome;
  /** The five cells that won it, for the UI to draw through. */
  winLine: number[];
  /** Who holds each colour. Null until a second player joins. */
  black: string | null;
  white: string | null;
  /** uids that have asked for a rematch. */
  rematch: string[];
  /** Games played in this room. Colours swap each round so black doesn't always start. */
  round: number;
  /** uid -> games won in this room. */
  wins: Record<string, number>;
}

export type GomokuAction =
  | { type: 'place'; cell: number }
  | { type: 'resign' }
  | { type: 'rematch' };

const newGame = (round: number): Pick<GomokuState, 'board' | 'moves' | 'turn' | 'outcome' | 'winLine' | 'rematch' | 'round'> => ({
  board: emptyBoard(),
  moves: [],
  turn: 1,
  outcome: 0,
  winLine: [],
  rematch: [],
  round,
});

function initial(): GomokuState {
  return { ...newGame(0), black: null, white: null, wins: {} };
}

/** The colour this uid plays, or null if they are only watching. */
export function seatOf(state: GomokuState, uid: string): Player | null {
  if (state.black === uid) return 1;
  if (state.white === uid) return 2;
  return null;
}

export const bothSeated = (state: GomokuState): boolean => state.black !== null && state.white !== null;

/**
 * Seats players as they arrive and frees the seat of anyone who has left. The two longest-standing
 * players in the room hold the colours; later arrivals watch until a seat opens up.
 */
function reseat(state: GomokuState, ctx: GameContext): GomokuState {
  const present = new Set(ctx.players.map((p) => p.uid));
  let black = state.black && present.has(state.black) ? state.black : null;
  let white = state.white && present.has(state.white) ? state.white : null;
  // Colours swap every round, so the owner isn't always black.
  const seats: ('black' | 'white')[] = state.round % 2 === 0 ? ['black', 'white'] : ['white', 'black'];
  for (const player of [...ctx.players].sort((a, b) => a.joinedAt - b.joinedAt)) {
    if (player.uid === black || player.uid === white) continue;
    const free = seats.find((s) => (s === 'black' ? black : white) === null);
    if (!free) break;
    if (free === 'black') black = player.uid;
    else white = player.uid;
  }
  return black === state.black && white === state.white ? state : { ...state, black, white };
}

function place(state: GomokuState, cell: number, ctx: GameContext): GomokuState {
  if (state.outcome !== 0) throw new GameRuleError('This game is over — ask for a rematch.');
  if (!bothSeated(state)) throw new GameRuleError('Waiting for a second player.');
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError('You are watching this game.');
  if (seat !== state.turn) throw new GameRuleError("It's not your turn.");
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) throw new GameRuleError('That is not a cell.');
  if (state.board[cell] !== 0) throw new GameRuleError('There is already a stone there.');

  const board = state.board.slice();
  board[cell] = seat;
  const five = fiveThrough(board, cell, seat);
  const draw = !five && isFull(board);
  const winnerUid = five ? ctx.actorUid : null;

  return {
    ...state,
    board,
    moves: [...state.moves, cell],
    turn: seat === 1 ? 2 : 1,
    outcome: five ? seat : draw ? 3 : 0,
    winLine: five ?? [],
    wins: winnerUid ? { ...state.wins, [winnerUid]: (state.wins[winnerUid] ?? 0) + 1 } : state.wins,
  };
}

function resign(state: GomokuState, ctx: GameContext): GomokuState {
  if (state.outcome !== 0) throw new GameRuleError('This game is already over.');
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError('You are watching this game.');
  const winner: Player = seat === 1 ? 2 : 1;
  const winnerUid = winner === 1 ? state.black : state.white;
  return {
    ...state,
    outcome: winner,
    winLine: [],
    wins: winnerUid ? { ...state.wins, [winnerUid]: (state.wins[winnerUid] ?? 0) + 1 } : state.wins,
  };
}

/** A rematch starts once every seated player has asked for one. */
function rematch(state: GomokuState, ctx: GameContext): GomokuState {
  if (state.outcome === 0) throw new GameRuleError('This game is still going.');
  if (seatOf(state, ctx.actorUid) === null) throw new GameRuleError('You are watching this game.');
  const votes = state.rematch.includes(ctx.actorUid) ? state.rematch : [...state.rematch, ctx.actorUid];
  const seated = [state.black, state.white].filter((uid): uid is string => uid !== null);
  if (!seated.every((uid) => votes.includes(uid))) return { ...state, rematch: votes };
  // Everyone agreed: swap colours and start over.
  return reseat(
    { ...state, ...newGame(state.round + 1), black: null, white: null },
    ctx,
  );
}

export const gomoku: GameDefinition<GomokuState, GomokuAction> = {
  id: 'gomoku',
  name: 'Gomoku',
  tagline: 'Five in a row. Play a friend, or take on the computer.',
  emoji: '⚫️',
  minPlayers: 1,
  maxPlayers: 2,
  solo: true,
  newState: initial,
  onPlayersChanged: reseat,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'place': return place(state, action.cell, ctx);
      case 'resign': return resign(state, ctx);
      case 'rematch': return rematch(state, ctx);
      default: throw new GameRuleError('Unknown move.');
    }
  },
};
