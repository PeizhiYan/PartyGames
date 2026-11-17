/**
 * Chess as a room game. Same shape as Chinese Chess: two seats that swap colours each round, a
 * rematch both have to ask for, an opponent-approved takeback, and a state that is nothing but
 * the move list, replayed from the start whenever the board is needed.
 */
import { GameRuleError, type GameContext, type GameDefinition } from '../../types';
import { Board, START_FEN } from './engine';

/** 1 white, 2 black. White moves first. */
export type Side = 1 | 2;
export type Outcome = 0 | 1 | 2 | 3;

export interface ChessState {
  /** `from | (to << 6) | (promotion << 12)`, in order. */
  moves: number[];
  outcome: Outcome;
  reason: string;
  white: string | null;
  black: string | null;
  rematch: string[];
  takeback: { by: string; at: number } | null;
  round: number;
  wins: Record<string, number>;
}

export type ChessAction =
  | { type: 'move'; mv: number }
  | { type: 'resign' }
  | { type: 'rematch' }
  | { type: 'requestTakeback' }
  | { type: 'respondTakeback'; approve: boolean };

const newGame = (round: number): Pick<ChessState, 'moves' | 'outcome' | 'reason' | 'rematch' | 'takeback' | 'round'> => ({
  moves: [], outcome: 0, reason: '', rematch: [], takeback: null, round,
});

function initial(): ChessState {
  return { ...newGame(0), white: null, black: null, wins: {} };
}

/** The board after the moves so far, plus every position key seen on the way (for threefold). */
export function replay(moves: number[]): { board: Board; keys: string[] } {
  const board = Board.fromFen(START_FEN);
  const keys = [board.key()];
  for (const mv of moves) {
    if (!board.make(mv)) break;
    keys.push(board.key());
  }
  return { board, keys };
}

export const boardOf = (moves: number[]): Board => replay(moves).board;

export const sideToMove = (moves: number[]): Side => (moves.length % 2 === 0 ? 1 : 2);
const sideOfMove = (i: number): Side => (i % 2 === 0 ? 1 : 2);

export function seatOf(state: ChessState, uid: string): Side | null {
  if (state.white === uid) return 1;
  if (state.black === uid) return 2;
  return null;
}

export const bothSeated = (state: ChessState): boolean => state.white !== null && state.black !== null;
export const uidOfSide = (state: ChessState, side: Side): string | null => (side === 1 ? state.white : state.black);

function lastMoveBy(state: ChessState, side: Side): number {
  for (let i = state.moves.length - 1; i >= 0; i -= 1) if (sideOfMove(i) === side) return i;
  return -1;
}

export function canRequestTakeback(state: ChessState, uid: string): boolean {
  if (state.outcome !== 0 || state.takeback) return false;
  const seat = seatOf(state, uid);
  return seat !== null && lastMoveBy(state, seat) >= 0;
}

function reseat(state: ChessState, ctx: GameContext): ChessState {
  const present = new Set(ctx.players.map((p) => p.uid));
  let white = state.white && present.has(state.white) ? state.white : null;
  let black = state.black && present.has(state.black) ? state.black : null;
  const seats: ('white' | 'black')[] = state.round % 2 === 0 ? ['white', 'black'] : ['black', 'white'];
  for (const player of [...ctx.players].sort((a, b) => a.joinedAt - b.joinedAt)) {
    if (player.uid === white || player.uid === black) continue;
    const free = seats.find((s) => (s === 'white' ? white : black) === null);
    if (!free) break;
    if (free === 'white') white = player.uid;
    else black = player.uid;
  }
  return white === state.white && black === state.black ? state : { ...state, white, black };
}

/** How the game stands after the latest move. Null while it goes on. */
export function settle(board: Board, keys: string[], mover: Side): { outcome: Outcome; reason: string } | null {
  if (board.legalMoves().length === 0) {
    return board.inCheck()
      ? { outcome: mover, reason: 'Checkmate.' }
      : { outcome: 3, reason: 'Stalemate.' };
  }
  if (board.insufficientMaterial()) return { outcome: 3, reason: 'Draw — not enough material to mate.' };
  if (board.halfmove >= 100) return { outcome: 3, reason: 'Draw — fifty moves without a capture or pawn move.' };
  const last = keys[keys.length - 1];
  let seen = 0;
  for (const k of keys) if (k === last) seen += 1;
  if (seen >= 3) return { outcome: 3, reason: 'Draw by threefold repetition.' };
  return null;
}

function credit(state: ChessState, winner: Side): Record<string, number> {
  const uid = uidOfSide(state, winner);
  return uid ? { ...state.wins, [uid]: (state.wins[uid] ?? 0) + 1 } : state.wins;
}

function move(state: ChessState, mv: number, ctx: GameContext): ChessState {
  if (state.outcome !== 0) throw new GameRuleError('This game is over — ask for a rematch.');
  if (!bothSeated(state)) throw new GameRuleError('Waiting for a second player.');
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError('You are watching this game.');
  if (seat !== sideToMove(state.moves)) throw new GameRuleError("It's not your turn.");
  if (!Number.isInteger(mv) || mv < 0 || mv > 0x7fff) throw new GameRuleError('That is not a move.');

  const { board, keys } = replay(state.moves);
  if (!board.isLegal(mv)) throw new GameRuleError('That move is not allowed.');
  board.make(mv);
  keys.push(board.key());
  const ended = settle(board, keys, seat);
  return {
    ...state,
    moves: [...state.moves, mv],
    takeback: null,
    outcome: ended?.outcome ?? 0,
    reason: ended?.reason ?? '',
    wins: ended && (ended.outcome === 1 || ended.outcome === 2) ? credit(state, ended.outcome) : state.wins,
  };
}

function resign(state: ChessState, ctx: GameContext): ChessState {
  if (state.outcome !== 0) throw new GameRuleError('This game is already over.');
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError('You are watching this game.');
  const winner: Side = seat === 1 ? 2 : 1;
  return { ...state, outcome: winner, reason: `${seat === 1 ? 'White' : 'Black'} resigned.`, takeback: null, wins: credit(state, winner) };
}

function rematch(state: ChessState, ctx: GameContext): ChessState {
  if (state.outcome === 0) throw new GameRuleError('This game is still going.');
  if (seatOf(state, ctx.actorUid) === null) throw new GameRuleError('You are watching this game.');
  const votes = state.rematch.includes(ctx.actorUid) ? state.rematch : [...state.rematch, ctx.actorUid];
  const seated = [state.white, state.black].filter((uid): uid is string => uid !== null);
  if (!seated.every((uid) => votes.includes(uid))) return { ...state, rematch: votes };
  return reseat({ ...state, ...newGame(state.round + 1), white: null, black: null }, ctx);
}

function requestTakeback(state: ChessState, ctx: GameContext): ChessState {
  if (state.outcome !== 0) throw new GameRuleError('This game is over — ask for a rematch instead.');
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError('You are watching this game.');
  if (state.takeback) throw new GameRuleError('There is already a request waiting.');
  if (lastMoveBy(state, seat) < 0) throw new GameRuleError('You have not moved yet.');
  return { ...state, takeback: { by: ctx.actorUid, at: ctx.now } };
}

function respondTakeback(state: ChessState, approve: boolean, ctx: GameContext): ChessState {
  const request = state.takeback;
  if (!request) return state;
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError('You are watching this game.');
  if (ctx.actorUid === request.by && approve) throw new GameRuleError('Your opponent has to agree.');
  if (!approve) return { ...state, takeback: null };
  const askerSeat = seatOf(state, request.by);
  const cut = askerSeat === null ? -1 : lastMoveBy(state, askerSeat);
  if (cut < 0) return { ...state, takeback: null };
  return { ...state, moves: state.moves.slice(0, cut), takeback: null };
}

export const chess: GameDefinition<ChessState, ChessAction> = {
  id: 'chess',
  name: 'Chess',
  tagline: 'The classic. Play a friend, or the computer at three strengths.',
  emoji: '♞',
  minPlayers: 1,
  maxPlayers: 2,
  solo: true,
  multiplayer: true,
  soloTitle: 'Play on this device',
  soloDescription: 'The computer at three strengths, or a friend on the same screen.',
  newState: initial,
  onPlayersChanged: reseat,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'move': return move(state, action.mv, ctx);
      case 'resign': return resign(state, ctx);
      case 'rematch': return rematch(state, ctx);
      case 'requestTakeback': return requestTakeback(state, ctx);
      case 'respondTakeback': return respondTakeback(state, action.approve, ctx);
      default: throw new GameRuleError('Unknown move.');
    }
  },
};
