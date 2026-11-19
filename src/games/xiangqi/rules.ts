import { t } from '../../i18n';
import { m } from './messages';
/**
 * Chinese chess as a room game: the state two players share and the only ways it may change.
 *
 * The shape is Gomoku's — two seats that swap colours each round, a rematch vote, a takeback the
 * opponent has to approve — with the engine in `./engine` deciding what a legal move is. The
 * state stores the move list only; the position is replayed from the start whenever it is
 * needed, which keeps the document small and the rules a pure function of it.
 */
import { GameRuleError, type GameContext, type GameDefinition } from '../../types';
import { Position, STARTUP_FEN, WIN_VALUE } from './engine';

/** 1 red, 2 black. Red moves first, as in the original. */
export type Side = 1 | 2;
/** 0 while the game is on, 1 or 2 for a winner, 3 for a draw. */
export type Outcome = 0 | 1 | 2 | 3;

export interface XiangqiState {
  /** Engine-encoded moves (`src + (dst << 8)`), in order. The position is replayed from these. */
  moves: number[];
  outcome: Outcome;
  /** Why it ended, written for a player. Empty while the game is on. */
  reason: string;
  red: string | null;
  black: string | null;
  rematch: string[];
  takeback: { by: string; at: number } | null;
  round: number;
  wins: Record<string, number>;
}

export type XiangqiAction =
  | { type: 'move'; mv: number }
  | { type: 'resign' }
  | { type: 'rematch' }
  | { type: 'requestTakeback' }
  | { type: 'respondTakeback'; approve: boolean };

/** Plies without a capture after which the game is a draw, as the original's board counted it. */
const QUIET_PLIES_FOR_DRAW = 100;

const newGame = (round: number): Pick<XiangqiState, 'moves' | 'outcome' | 'reason' | 'rematch' | 'takeback' | 'round'> => ({
  moves: [], outcome: 0, reason: '', rematch: [], takeback: null, round,
});

function initial(): XiangqiState {
  return { ...newGame(0), red: null, black: null, wins: {} };
}

/** The position after the moves played so far. Replayed from the start every time. */
export function positionOf(moves: number[]): Position {
  const pos = Position.fromFen(STARTUP_FEN);
  for (const mv of moves) {
    if (!pos.makeMove(mv)) break;
  }
  return pos;
}

/** Whose move it is: red opens, turns strictly alternate. */
export const sideToMove = (moves: number[]): Side => (moves.length % 2 === 0 ? 1 : 2);
const sideOfMove = (i: number): Side => (i % 2 === 0 ? 1 : 2);

export function seatOf(state: XiangqiState, uid: string): Side | null {
  if (state.red === uid) return 1;
  if (state.black === uid) return 2;
  return null;
}

export const bothSeated = (state: XiangqiState): boolean => state.red !== null && state.black !== null;

export const uidOfSide = (state: XiangqiState, side: Side): string | null => (side === 1 ? state.red : state.black);

function lastMoveBy(state: XiangqiState, side: Side): number {
  for (let i = state.moves.length - 1; i >= 0; i -= 1) {
    if (sideOfMove(i) === side) return i;
  }
  return -1;
}

export function canRequestTakeback(state: XiangqiState, uid: string): boolean {
  if (state.outcome !== 0 || state.takeback) return false;
  const seat = seatOf(state, uid);
  return seat !== null && lastMoveBy(state, seat) >= 0;
}

function reseat(state: XiangqiState, ctx: GameContext): XiangqiState {
  const present = new Set(ctx.players.map((p) => p.uid));
  let red = state.red && present.has(state.red) ? state.red : null;
  let black = state.black && present.has(state.black) ? state.black : null;
  const seats: ('red' | 'black')[] = state.round % 2 === 0 ? ['red', 'black'] : ['black', 'red'];
  for (const player of [...ctx.players].sort((a, b) => a.joinedAt - b.joinedAt)) {
    if (player.uid === red || player.uid === black) continue;
    const free = seats.find((s) => (s === 'red' ? red : black) === null);
    if (!free) break;
    if (free === 'red') red = player.uid;
    else black = player.uid;
  }
  return red === state.red && black === state.black ? state : { ...state, red, black };
}

/**
 * How the game stands after the latest move, from the engine's point of view: the side that just
 * moved may have mated, a repetition may have decided or drawn it, or there may be nothing left
 * to mate with. Returns null while play goes on.
 */
export function settle(pos: Position, mover: Side): { outcome: Outcome; reason: string } | null {
  if (pos.isMate()) {
    return { outcome: mover, reason: pos.inCheck() ? 'Checkmate.' : 'No legal move left — that loses in xiangqi.' };
  }
  const rep = pos.repStatus(3);
  if (rep > 0) {
    const value = pos.repValue(rep);
    if (value > -WIN_VALUE && value < WIN_VALUE) return { outcome: 3, reason: 'Draw by repetition.' };
    // A negative value is bad for the side to move: the mover was chasing with perpetual checks.
    const checker: Side = value < 0 ? (mover === 1 ? 2 : 1) : mover;
    const loser = checker === 1 ? 'Red' : 'Black';
    return { outcome: checker === 1 ? 2 : 1, reason: `${loser} loses for perpetual check.` };
  }
  if (pos.captured()) {
    if (!pos.hasAttackingMaterial()) return { outcome: 3, reason: 'Draw — neither side can give mate.' };
  } else if (pos.pcList.length > QUIET_PLIES_FOR_DRAW) {
    let captured = false;
    for (let i = 2; i <= QUIET_PLIES_FOR_DRAW; i += 1) {
      if (pos.pcList[pos.pcList.length - i] > 0) { captured = true; break; }
    }
    if (!captured) return { outcome: 3, reason: `Draw — ${QUIET_PLIES_FOR_DRAW / 2} moves without a capture.` };
  }
  return null;
}

function credit(state: XiangqiState, winner: Side | null): Record<string, number> {
  const uid = winner ? uidOfSide(state, winner) : null;
  return uid ? { ...state.wins, [uid]: (state.wins[uid] ?? 0) + 1 } : state.wins;
}

function move(state: XiangqiState, mv: number, ctx: GameContext): XiangqiState {
  if (state.outcome !== 0) throw new GameRuleError(t.rules.overAskRematch);
  if (!bothSeated(state)) throw new GameRuleError(t.rules.waitingSecond);
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError(t.rules.watching);
  if (seat !== sideToMove(state.moves)) throw new GameRuleError(t.rules.notYourTurn);
  if (!Number.isInteger(mv) || mv < 0 || mv > 0xffff) throw new GameRuleError(m().errors.notAMove);

  const pos = positionOf(state.moves);
  if (!pos.legalMove(mv)) throw new GameRuleError(m().errors.cannotMove);
  if (!pos.makeMove(mv)) throw new GameRuleError(m().errors.inCheck);

  const ended = settle(pos, seat);
  return {
    ...state,
    moves: [...state.moves, mv],
    takeback: null,
    outcome: ended?.outcome ?? 0,
    reason: ended?.reason ?? '',
    wins: ended && (ended.outcome === 1 || ended.outcome === 2) ? credit(state, ended.outcome) : state.wins,
  };
}

function resign(state: XiangqiState, ctx: GameContext): XiangqiState {
  if (state.outcome !== 0) throw new GameRuleError(t.rules.alreadyOver);
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError(t.rules.watching);
  const winner: Side = seat === 1 ? 2 : 1;
  return { ...state, outcome: winner, reason: `${seat === 1 ? 'Red' : 'Black'} resigned.`, takeback: null, wins: credit(state, winner) };
}

function rematch(state: XiangqiState, ctx: GameContext): XiangqiState {
  if (state.outcome === 0) throw new GameRuleError(t.rules.stillGoing);
  if (seatOf(state, ctx.actorUid) === null) throw new GameRuleError(t.rules.watching);
  const votes = state.rematch.includes(ctx.actorUid) ? state.rematch : [...state.rematch, ctx.actorUid];
  const seated = [state.red, state.black].filter((uid): uid is string => uid !== null);
  if (!seated.every((uid) => votes.includes(uid))) return { ...state, rematch: votes };
  return reseat({ ...state, ...newGame(state.round + 1), red: null, black: null }, ctx);
}

function requestTakeback(state: XiangqiState, ctx: GameContext): XiangqiState {
  if (state.outcome !== 0) throw new GameRuleError(t.rules.overAskRematchInstead);
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError(t.rules.watching);
  if (state.takeback) throw new GameRuleError(t.rules.requestWaiting);
  if (lastMoveBy(state, seat) < 0) throw new GameRuleError(t.rules.notMovedYet);
  return { ...state, takeback: { by: ctx.actorUid, at: ctx.now } };
}

/** Approving unplays everything back to and including the asker's last move. */
function respondTakeback(state: XiangqiState, approve: boolean, ctx: GameContext): XiangqiState {
  const request = state.takeback;
  if (!request) return state;
  const seat = seatOf(state, ctx.actorUid);
  if (seat === null) throw new GameRuleError(t.rules.watching);
  if (ctx.actorUid === request.by && approve) throw new GameRuleError(t.rules.opponentAgree);
  if (!approve) return { ...state, takeback: null };
  const askerSeat = seatOf(state, request.by);
  const cut = askerSeat === null ? -1 : lastMoveBy(state, askerSeat);
  if (cut < 0) return { ...state, takeback: null };
  return { ...state, moves: state.moves.slice(0, cut), takeback: null };
}

export const xiangqi: GameDefinition<XiangqiState, XiangqiAction> = {
  id: 'xiangqi',
  get name() { return m().name; },
  get tagline() { return m().tagline; },
  emoji: '帥',
  minPlayers: 1,
  maxPlayers: 2,
  solo: true,
  multiplayer: true,
  get soloTitle() { return m().soloTitle; },
  get soloDescription() { return m().soloDescription; },
  newState: initial,
  onPlayersChanged: reseat,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'move': return move(state, action.mv, ctx);
      case 'resign': return resign(state, ctx);
      case 'rematch': return rematch(state, ctx);
      case 'requestTakeback': return requestTakeback(state, ctx);
      case 'respondTakeback': return respondTakeback(state, action.approve, ctx);
      default: throw new GameRuleError(t.rules.unknownMove);
    }
  },
};
