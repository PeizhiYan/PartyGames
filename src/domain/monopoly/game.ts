/**
 * MonopolyBuddy as a room game: the bank for a physical Monopoly board, so nobody has to count
 * paper money. Ported from the Socket.io server in ../MonopolyBuddy (backend/server.js).
 *
 * The original kept the whole game in one server's memory and identified players by a session
 * token. Here the state lives in the room document and players are identified by their signed-in
 * uid, so a refresh (or a new phone) picks up where they left off. The phase machine, the
 * all-others-must-approve bank requests, and the end-game vote are the original's.
 *
 * Dice rolls arrive in the action rather than being generated here, so this reducer stays pure and
 * testable; it checks they are two numbers from 1 to 6. In a group of friends sharing a board that
 * is enough — nothing of value rides on a roll the app can't verify.
 */
import { GameRuleError, type GameContext, type GameDefinition, type RoomPlayer } from '../types';

export type Phase =
  /** The owner sets the starting balance and waits for everyone to arrive. */
  | 'lobby'
  /** Everyone picks a token and a colour. */
  | 'pick'
  /** Everyone rolls to decide who goes first. */
  | 'roll'
  /** The roll is in: the play order is shown before the game starts. */
  | 'order'
  | 'playing'
  /** Someone asked to end the game; everyone else has to agree. */
  | 'endVote'
  /** Everyone types in what their property and houses are worth. */
  | 'assets'
  | 'results';

export const TOKENS = ['🎩', '🚂', '🐕', '🏎️', '⛵️', '👢', '🐈', '🎀'] as const;
export const COLORS = [
  '#dc2626', '#2563eb', '#16a34a', '#ca8a04',
  '#7c3aed', '#ea580c', '#db2777', '#0d9488',
] as const;
export const PAY_REASONS = ['Buy land', 'Buy house(s)', 'Rent', 'Pay fine', 'Tax', 'Other'] as const;

export const MIN_BALANCE = 100;
export const MAX_BALANCE = 100_000;
export const DEFAULT_BALANCE = 1500;
/** The log is capped so a long game can't outgrow the room document. */
const MAX_LOG = 300;

export interface Seat {
  uid: string;
  name: string;
  photoURL?: string;
  token: string | null;
  color: string | null;
  balance: number;
  ready: boolean;
  /** The two dice from the play-order roll, and their total. */
  dice: [number, number] | null;
  /** What this player says their property is worth, at the end. */
  assets: number | null;
}

export type Entry =
  | { id: string; at: number; kind: 'transfer'; from: string; to: string; amount: number; note: string }
  | { id: string; at: number; kind: 'payBank'; from: string; amount: number; note: string }
  | { id: string; at: number; kind: 'fromBank'; to: string; amount: number; note: string };

export interface BankRequest {
  id: string;
  uid: string;
  amount: number;
  reason: string;
  /** Who has approved so far. Every other player has to, before the money appears. */
  approvedBy: string[];
  at: number;
}

export interface MonopolyState {
  phase: Phase;
  settings: { startingBalance: number; showBalances: boolean };
  seats: Seat[];
  /** uids, highest opening roll first. Informational: the app doesn't enforce turns. */
  order: string[];
  requests: BankRequest[];
  log: Entry[];
  /** uid -> balance over time, for the chart on the results screen. */
  history: Record<string, { t: number; b: number }[]>;
  lastRoll: { uid: string; dice: [number, number]; total: number; at: number } | null;
  endVote: { by: string; approvedBy: string[] } | null;
}

export type MonopolyAction =
  | { type: 'configure'; startingBalance?: number; showBalances?: boolean }
  | { type: 'start' }
  | { type: 'pick'; token: string; color: string }
  | { type: 'rollOrder'; dice: [number, number] }
  | { type: 'beginPlay' }
  | { type: 'roll'; dice: [number, number] }
  | { type: 'send'; to: string; amount: number; note: string }
  | { type: 'payBank'; amount: number; reason: string }
  | { type: 'requestBank'; amount: number; reason: string }
  | { type: 'respondBank'; id: string; approve: boolean }
  | { type: 'endGame' }
  | { type: 'respondEnd'; approve: boolean }
  | { type: 'submitAssets'; value: number }
  | { type: 'newGame' };

function initial(): MonopolyState {
  return {
    phase: 'lobby',
    settings: { startingBalance: DEFAULT_BALANCE, showBalances: true },
    seats: [],
    order: [],
    requests: [],
    log: [],
    history: {},
    lastRoll: null,
    endVote: null,
  };
}

export const seatOf = (state: MonopolyState, uid: string): Seat | undefined =>
  state.seats.find((s) => s.uid === uid);

export const totalWealth = (seat: Seat): number => seat.balance + (seat.assets ?? 0);

/** Players ranked by cash plus what they say their property is worth. */
export const ranking = (state: MonopolyState): Seat[] =>
  [...state.seats].sort((a, b) => totalWealth(b) - totalWealth(a));

/** Ids are built from the clock plus the actor, so the reducer needs no randomness. */
const makeId = (ctx: GameContext, tag: string) => `${tag}-${ctx.now.toString(36)}-${ctx.actorUid.slice(0, 6)}`;

function requireSeat(state: MonopolyState, ctx: GameContext): Seat {
  const seat = seatOf(state, ctx.actorUid);
  if (!seat) throw new GameRuleError('You are not in this game.');
  return seat;
}

function requireOwner(ctx: GameContext): void {
  if (ctx.actorUid !== ctx.ownerUid) throw new GameRuleError('Only the host can do that.');
}

function requirePhase(state: MonopolyState, phase: Phase): void {
  if (state.phase !== phase) throw new GameRuleError('That is not possible right now.');
}

function wholeAmount(amount: unknown, what = 'amount'): number {
  const value = Math.floor(Number(amount));
  if (!Number.isFinite(value) || value <= 0) throw new GameRuleError(`Enter an ${what} above zero.`);
  if (value > 10_000_000) throw new GameRuleError('That is more money than this game holds.');
  return value;
}

function checkDice(dice: [number, number]): [number, number] {
  const ok = Array.isArray(dice) && dice.length === 2
    && dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6);
  if (!ok) throw new GameRuleError('Those are not two dice.');
  return [dice[0], dice[1]];
}

function note(text: unknown, fallback = ''): string {
  return String(text ?? '').trim().slice(0, 60) || fallback;
}

function record(state: MonopolyState, uid: string, balance: number, now: number): MonopolyState['history'] {
  const previous = state.history[uid] ?? [];
  return { ...state.history, [uid]: [...previous, { t: now, b: balance }] };
}

function append(log: Entry[], entry: Entry): Entry[] {
  const next = [...log, entry];
  return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next;
}

function withSeat(state: MonopolyState, uid: string, patch: Partial<Seat>): Seat[] {
  return state.seats.map((s) => (s.uid === uid ? { ...s, ...patch } : s));
}

/**
 * Keeps the seats in step with who is in the room. Before the game starts, arrivals get a seat and
 * leavers lose theirs. Once play is under way a seat is kept even while its player is away, so
 * their money survives a closed tab — the host starts a new game to clear them out.
 */
function syncSeats(state: MonopolyState, ctx: GameContext): MonopolyState {
  const before: Phase[] = ['lobby', 'pick'];
  if (!before.includes(state.phase)) return state;
  const present = new Map(ctx.players.map((p: RoomPlayer) => [p.uid, p]));
  const kept = state.seats
    .filter((s) => present.has(s.uid))
    .map((s) => ({ ...s, name: present.get(s.uid)!.name, photoURL: present.get(s.uid)!.photoURL }));
  const known = new Set(kept.map((s) => s.uid));
  const added: Seat[] = ctx.players
    .filter((p) => !known.has(p.uid))
    .map((p) => ({
      uid: p.uid,
      name: p.name,
      photoURL: p.photoURL,
      token: null,
      color: null,
      balance: state.settings.startingBalance,
      ready: false,
      dice: null,
      assets: null,
    }));
  if (added.length === 0 && kept.length === state.seats.length) return state;
  return { ...state, seats: [...kept, ...added] };
}

function configure(state: MonopolyState, action: Extract<MonopolyAction, { type: 'configure' }>, ctx: GameContext): MonopolyState {
  requireOwner(ctx);
  requirePhase(state, 'lobby');
  const settings = { ...state.settings };
  if (action.startingBalance !== undefined) {
    const value = Math.floor(Number(action.startingBalance));
    if (!Number.isFinite(value) || value < MIN_BALANCE || value > MAX_BALANCE) {
      throw new GameRuleError(`Starting balance must be between ${MIN_BALANCE} and ${MAX_BALANCE}.`);
    }
    settings.startingBalance = value;
  }
  if (action.showBalances !== undefined) settings.showBalances = !!action.showBalances;
  // Nobody has spent anything yet, so everyone's balance follows the new setting.
  return { ...state, settings, seats: state.seats.map((s) => ({ ...s, balance: settings.startingBalance })) };
}

function start(state: MonopolyState, ctx: GameContext): MonopolyState {
  requireOwner(ctx);
  requirePhase(state, 'lobby');
  if (state.seats.length < 2) throw new GameRuleError('You need at least two players.');
  return { ...state, phase: 'pick' };
}

function pick(state: MonopolyState, action: Extract<MonopolyAction, { type: 'pick' }>, ctx: GameContext): MonopolyState {
  requirePhase(state, 'pick');
  requireSeat(state, ctx);
  if (!TOKENS.includes(action.token as (typeof TOKENS)[number])) throw new GameRuleError('Pick one of the tokens.');
  if (!COLORS.includes(action.color as (typeof COLORS)[number])) throw new GameRuleError('Pick one of the colours.');
  const taken = state.seats.some((s) => s.uid !== ctx.actorUid && s.ready && s.token === action.token);
  if (taken) throw new GameRuleError('Someone already took that token.');

  const seats = withSeat(state, ctx.actorUid, { token: action.token, color: action.color, ready: true });
  if (!seats.every((s) => s.ready)) return { ...state, seats };
  // Everyone is ready: hand out the starting money and roll for who goes first.
  const paid = seats.map((s) => ({ ...s, balance: state.settings.startingBalance }));
  let history = state.history;
  for (const seat of paid) history = { ...history, [seat.uid]: [{ t: ctx.now, b: seat.balance }] };
  return { ...state, seats: paid, history, phase: 'roll' };
}

function rollOrder(state: MonopolyState, dice: [number, number], ctx: GameContext): MonopolyState {
  requirePhase(state, 'roll');
  const seat = requireSeat(state, ctx);
  if (seat.dice) throw new GameRuleError('You have already rolled.');
  const seats = withSeat(state, ctx.actorUid, { dice: checkDice(dice) });
  if (!seats.every((s) => s.dice)) return { ...state, seats };
  // Highest total goes first; a tie goes to whoever joined the room first.
  const byUid = new Map(ctx.players.map((p) => [p.uid, p.joinedAt]));
  const order = [...seats]
    .sort((a, b) => {
      const diff = (b.dice![0] + b.dice![1]) - (a.dice![0] + a.dice![1]);
      return diff !== 0 ? diff : (byUid.get(a.uid) ?? 0) - (byUid.get(b.uid) ?? 0);
    })
    .map((s) => s.uid);
  return { ...state, seats, order, phase: 'order' };
}

function send(state: MonopolyState, action: Extract<MonopolyAction, { type: 'send' }>, ctx: GameContext): MonopolyState {
  requirePhase(state, 'playing');
  const from = requireSeat(state, ctx);
  const to = seatOf(state, action.to);
  if (!to || to.uid === from.uid) throw new GameRuleError('Pick someone else to pay.');
  const amount = wholeAmount(action.amount);
  if (from.balance < amount) throw new GameRuleError('You do not have that much.');

  let next: MonopolyState = {
    ...state,
    seats: state.seats.map((s) => {
      if (s.uid === from.uid) return { ...s, balance: s.balance - amount };
      if (s.uid === to.uid) return { ...s, balance: s.balance + amount };
      return s;
    }),
    log: append(state.log, {
      id: makeId(ctx, 'tx'), at: ctx.now, kind: 'transfer',
      from: from.uid, to: to.uid, amount, note: note(action.note),
    }),
  };
  next = { ...next, history: record(next, from.uid, from.balance - amount, ctx.now) };
  next = { ...next, history: record(next, to.uid, to.balance + amount, ctx.now) };
  return next;
}

function payBank(state: MonopolyState, action: Extract<MonopolyAction, { type: 'payBank' }>, ctx: GameContext): MonopolyState {
  requirePhase(state, 'playing');
  const seat = requireSeat(state, ctx);
  const amount = wholeAmount(action.amount);
  if (seat.balance < amount) throw new GameRuleError('You do not have that much.');
  const balance = seat.balance - amount;
  const next: MonopolyState = {
    ...state,
    seats: withSeat(state, seat.uid, { balance }),
    log: append(state.log, {
      id: makeId(ctx, 'tx'), at: ctx.now, kind: 'payBank',
      from: seat.uid, amount, note: note(action.reason, 'Other'),
    }),
  };
  return { ...next, history: record(next, seat.uid, balance, ctx.now) };
}

function requestBank(state: MonopolyState, action: Extract<MonopolyAction, { type: 'requestBank' }>, ctx: GameContext): MonopolyState {
  requirePhase(state, 'playing');
  const seat = requireSeat(state, ctx);
  const amount = wholeAmount(action.amount);
  if (state.requests.some((r) => r.uid === seat.uid)) throw new GameRuleError('Your last request is still waiting.');
  const request: BankRequest = {
    id: makeId(ctx, 'req'), uid: seat.uid, amount,
    reason: note(action.reason), approvedBy: [], at: ctx.now,
  };
  return settleRequest({ ...state, requests: [...state.requests, request] }, request.id, ctx);
}

function respondBank(state: MonopolyState, action: Extract<MonopolyAction, { type: 'respondBank' }>, ctx: GameContext): MonopolyState {
  requirePhase(state, 'playing');
  requireSeat(state, ctx);
  const request = state.requests.find((r) => r.id === action.id);
  if (!request) return state; // already settled by someone else
  if (request.uid === ctx.actorUid) throw new GameRuleError('You cannot approve your own request.');
  if (!action.approve) {
    // One "no" is enough: the request is dropped.
    return { ...state, requests: state.requests.filter((r) => r.id !== request.id) };
  }
  const approvedBy = request.approvedBy.includes(ctx.actorUid)
    ? request.approvedBy
    : [...request.approvedBy, ctx.actorUid];
  const requests = state.requests.map((r) => (r.id === request.id ? { ...r, approvedBy } : r));
  return settleRequest({ ...state, requests }, request.id, ctx);
}

/** Pays out a bank request once everyone except the asker has approved it. */
function settleRequest(state: MonopolyState, id: string, ctx: GameContext): MonopolyState {
  const request = state.requests.find((r) => r.id === id);
  if (!request) return state;
  const others = state.seats.filter((s) => s.uid !== request.uid);
  if (!others.every((s) => request.approvedBy.includes(s.uid))) return state;

  const seat = seatOf(state, request.uid);
  const requests = state.requests.filter((r) => r.id !== id);
  if (!seat) return { ...state, requests };
  const balance = seat.balance + request.amount;
  const next: MonopolyState = {
    ...state,
    requests,
    seats: withSeat(state, seat.uid, { balance }),
    log: append(state.log, {
      id: makeId(ctx, 'tx'), at: ctx.now, kind: 'fromBank',
      to: seat.uid, amount: request.amount, note: request.reason,
    }),
  };
  return { ...next, history: record(next, seat.uid, balance, ctx.now) };
}

function respondEnd(state: MonopolyState, approve: boolean, ctx: GameContext): MonopolyState {
  requirePhase(state, 'endVote');
  requireSeat(state, ctx);
  if (!state.endVote) return { ...state, phase: 'playing' };
  // One "no" puts everyone back in the game, as in the original.
  if (!approve) return { ...state, phase: 'playing', endVote: null };
  const approvedBy = state.endVote.approvedBy.includes(ctx.actorUid)
    ? state.endVote.approvedBy
    : [...state.endVote.approvedBy, ctx.actorUid];
  if (!state.seats.every((s) => approvedBy.includes(s.uid))) {
    return { ...state, endVote: { ...state.endVote, approvedBy } };
  }
  return { ...state, phase: 'assets', endVote: null };
}

function submitAssets(state: MonopolyState, value: number, ctx: GameContext): MonopolyState {
  requirePhase(state, 'assets');
  const seat = requireSeat(state, ctx);
  if (seat.assets !== null) throw new GameRuleError('You already sent your total.');
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount < 0) throw new GameRuleError('Enter 0 or more.');
  const seats = withSeat(state, seat.uid, { assets: amount });
  const done = seats.every((s) => s.assets !== null);
  return { ...state, seats, phase: done ? 'results' : 'assets' };
}

function newGame(state: MonopolyState, ctx: GameContext): MonopolyState {
  requireOwner(ctx);
  if (state.phase !== 'results') throw new GameRuleError('Finish this game first.');
  // Keep the settings and who is sitting here; everything else starts fresh. Tokens and colours
  // are kept too, so a quick rematch doesn't make everyone pick again.
  return {
    ...initial(),
    settings: state.settings,
    seats: state.seats.map((s) => ({
      ...s, balance: state.settings.startingBalance, ready: false, dice: null, assets: null,
    })),
  };
}

export const monopoly: GameDefinition<MonopolyState, MonopolyAction> = {
  id: 'monopoly',
  name: 'MonopolyBuddy',
  tagline: 'The bank for your Monopoly board. No paper money, no banker.',
  emoji: '🎲',
  minPlayers: 2,
  maxPlayers: 8,
  solo: false,
  newState: initial,
  onPlayersChanged: syncSeats,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'configure': return configure(state, action, ctx);
      case 'start': return start(state, ctx);
      case 'pick': return pick(state, action, ctx);
      case 'rollOrder': return rollOrder(state, action.dice, ctx);
      case 'beginPlay':
        requirePhase(state, 'order');
        requireSeat(state, ctx);
        return { ...state, phase: 'playing' };
      case 'roll':
        requirePhase(state, 'playing');
        requireSeat(state, ctx);
        return {
          ...state,
          lastRoll: {
            uid: ctx.actorUid, dice: checkDice(action.dice),
            total: action.dice[0] + action.dice[1], at: ctx.now,
          },
        };
      case 'send': return send(state, action, ctx);
      case 'payBank': return payBank(state, action, ctx);
      case 'requestBank': return requestBank(state, action, ctx);
      case 'respondBank': return respondBank(state, action, ctx);
      case 'endGame':
        requirePhase(state, 'playing');
        requireSeat(state, ctx);
        // Whoever calls it is counted as agreeing already.
        return { ...state, phase: 'endVote', endVote: { by: ctx.actorUid, approvedBy: [ctx.actorUid] } };
      case 'respondEnd': return respondEnd(state, action.approve, ctx);
      case 'submitAssets': return submitAssets(state, action.value, ctx);
      case 'newGame': return newGame(state, ctx);
      default: throw new GameRuleError('Unknown move.');
    }
  },
};

/** Two dice, for the caller to put in a `roll` action. */
export const throwDice = (): [number, number] => [
  1 + Math.floor(Math.random() * 6),
  1 + Math.floor(Math.random() * 6),
];
