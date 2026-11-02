// Gomoku as a room game: the state two players share and the only ways it may change.
// Pure and synchronous, so the same reducer runs in the browser, in tests, and inside the
// backend's transaction. See src/domain/gomoku/ai.ts for the computer opponent.
import { GameRuleError, type GameContext, type GameDefinition } from '../../types';
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
  /**
   * A player asking to unplay their last move. The opponent has to agree, because a stone is
   * already on their board — there is no window in which a move is private.
   */
  takeback: { by: string; at: number } | null;
  /** Games played in this room. Colours swap each round so black doesn't always start. */
  round: number;
  /** uid -> games won in this room. */
  wins: Record<string, number>;
}

export type GomokuAction =
  | { type: 'place'; cell: number }
  | { type: 'resign' }
  | { type: 'rematch' }
  | { type: 'requestTakeback' }
  /** `approve` from the opponent decides it; from the asker it withdraws the request. */
  | { type: 'respondTakeback'; approve: boolean };

const newGame = (round: number): Pick<GomokuState,
  'board' | 'moves' | 'turn' | 'outcome' | 'winLine' | 'rematch' | 'takeback' | 'round'> => ({
  board: emptyBoard(),
  moves: [],
  turn: 1,
  outcome: 0,
  winLine: [],
  rematch: [],
  takeback: null,
  round,
});

function initial(): GomokuState {
  return { ...newGame(0), black: null, white: null, wins: {} };
}

/** The colour that played the move at index `i`. Black opens, and turns strictly alternate. */
const playerOfMove = (i: number): Player => (i % 2 === 0 ? 1 : 2);

/** The index of `seat`'s most recent move, or -1 if they have not played yet. */
function lastMoveBy(state: GomokuState, seat: Player): number {
  for (let i = state.moves.length - 1; i >= 0; i--) {
    if (playerOfMove(i) === seat) return i;
  }
  return -1;
}

/**
 * Whether this player could ask to take a move back right now. The reducer enforces the same
 * conditions; this is so the button can be disabled rather than failing when pressed.
 */
export function canRequestTakeback(state: GomokuState, uid: string): boolean {
  if (state.outcome !== 0 || state.takeback) return false;
  const seat = seatOf(state, uid);
  return seat !== null && lastMoveBy(state, seat) >= 0;
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
    // Playing on supersedes an outstanding request: it was about a position that no longer exists.
    takeback: null,
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
    takeback: null,
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

/**
 * Asks the opponent to unplay this player's last move.
 *
 * There is no private window in which a move can be withdrawn unilaterally — the stone is on the
 * other person's board the moment it is played — so taking one back is a request, not an action.
 */
function requestTakeback(state: GomokuState, ctx: GameContext): GomokuState {
  if (state.outcome !== 0) throw new GameRuleError('This game is over — ask for a rematch instead.');
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError('You are watching this game.');
  if (state.takeback) throw new GameRuleError('There is already a request waiting.');
  if (lastMoveBy(state, seat) < 0) throw new GameRuleError('You have not played a stone yet.');
  return { ...state, takeback: { by: ctx.actorUid, at: ctx.now } };
}

/**
 * Settles a request. The opponent approves or refuses; the asker can also withdraw their own.
 *
 * Approving unplays everything back to and including the asker's last move — which is one stone
 * if the opponent has not replied yet, and two if they have. Either way it ends with the board as
 * the asker last saw it and the turn back with them.
 */
function respondTakeback(state: GomokuState, approve: boolean, ctx: GameContext): GomokuState {
  const request = state.takeback;
  if (!request) return state; // already settled by the other player
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError('You are watching this game.');
  // The asker can only withdraw; approving your own request would make it unilateral.
  if (ctx.actorUid === request.by && approve) throw new GameRuleError('Your opponent has to agree.');
  if (!approve) return { ...state, takeback: null };

  const askerSeat = seatOf(state, request.by);
  const cut = askerSeat === null ? -1 : lastMoveBy(state, askerSeat);
  if (cut < 0) return { ...state, takeback: null };

  const moves = state.moves.slice(0, cut);
  const board = emptyBoard();
  moves.forEach((cell, i) => { board[cell] = playerOfMove(i); });
  return {
    ...state,
    board,
    moves,
    turn: askerSeat!,
    outcome: 0,
    winLine: [],
    takeback: null,
  };
}

export const gomoku: GameDefinition<GomokuState, GomokuAction> = {
  id: 'gomoku',
  name: 'Gomoku',
  tagline: 'Five in a row. Play a friend, or take on the computer.',
  emoji: '⚫️',
  minPlayers: 1,
  maxPlayers: 2,
  solo: true,
  multiplayer: true,
  soloTitle: 'Play the computer',
  soloDescription: 'No room needed. Three difficulties.',
  newState: initial,
  onPlayersChanged: reseat,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'place': return place(state, action.cell, ctx);
      case 'resign': return resign(state, ctx);
      case 'rematch': return rematch(state, ctx);
      case 'requestTakeback': return requestTakeback(state, ctx);
      case 'respondTakeback': return respondTakeback(state, action.approve, ctx);
      default: throw new GameRuleError('Unknown move.');
    }
  },
};
