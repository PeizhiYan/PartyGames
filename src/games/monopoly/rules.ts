/**
 * Monopoly, in two modes.
 *
 * **Bank** is for a real board on the table: the app only moves money, but it knows which board
 * you are playing, so buying a property records *which* one and the final standings add
 * themselves up. **Board** plays the whole game here — tokens, rent, cards, jail — and is in
 * `./play`.
 *
 * Ported from the Socket.io app in ../MonopolyBuddy, whose phase machine, all-others-must-approve
 * bank requests and unanimous end-game vote survive intact. Players are identified by their
 * signed-in uid rather than a session token, so a refresh picks up where they left off.
 *
 * Dice and the card seed arrive in the action rather than being generated here, so the reducer
 * stays pure and testable; it checks dice are two numbers from 1 to 6. Among friends sharing a
 * table that is enough — nothing of value rides on a roll the app cannot verify.
 */
import { GameRuleError, type GameContext, type GameDefinition, type RoomPlayer } from '../../types';
import { boardOf, isOwnable, DEFAULT_BOARD_ID } from './boards';
import {
  build, buyPending, canBuild, endTurn, rollAndMove, rollsAgain, settleIfOver,
} from './play';
import {
  activeSeats, boardFor, isBoardMode, propertyValue, ranking, seatOf, totalWealth,
  type DraftEntry, type Entry, type Mode, type MonopolyState, type Phase, type Seat,
} from './state';

export * from './state';
export { canBuild, rollsAgain } from './play';
export { BOARDS, boardOf, spacesPerSide } from './boards';

export const TOKENS = ['🎩', '🚂', '🐕', '🏎️', '⛵️', '👢', '🐈', '🎀'] as const;
export const COLORS = [
  '#dc2626', '#2563eb', '#16a34a', '#ca8a04',
  '#7c3aed', '#ea580c', '#db2777', '#0d9488',
] as const;
/** Reasons for a hand-entered payment in bank mode. Buying is its own action, so it isn't here. */
export const PAY_REASONS = ['Rent', 'Pay fine', 'Tax', 'Other'] as const;

export const MIN_BALANCE = 100;
export const MAX_BALANCE = 1_000_000;
export const DEFAULT_BALANCE = 1500;
const MAX_LOG = 300;

export type MonopolyAction =
  | { type: 'configure'; startingBalance?: number; showBalances?: boolean; mode?: Mode; boardId?: string }
  | { type: 'start'; seed: number }
  | { type: 'pick'; token: string; color: string }
  | { type: 'rollOrder'; dice: [number, number] }
  | { type: 'beginPlay' }
  | { type: 'roll'; dice: [number, number] }
  /** Board mode: answer the offer to buy the space you landed on. */
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'endTurn' }
  /** Bank mode: take a named property off the board and pay the bank for it. */
  | { type: 'buyProperty'; space: number }
  | { type: 'build'; space: number }
  | { type: 'send'; to: string; amount: number; note: string }
  | { type: 'payBank'; amount: number; reason: string }
  | { type: 'requestBank'; amount: number; reason: string }
  | { type: 'respondBank'; id: string; approve: boolean }
  | { type: 'endGame' }
  | { type: 'respondEnd'; approve: boolean }
  | { type: 'newGame' };

function initial(): MonopolyState {
  return {
    phase: 'lobby',
    settings: { startingBalance: DEFAULT_BALANCE, showBalances: true, mode: 'bank', boardId: DEFAULT_BOARD_ID },
    seats: [],
    order: [],
    requests: [],
    log: [],
    history: {},
    lastRoll: null,
    endVote: null,
    owned: {},
    houses: {},
    turn: null,
    pending: null,
    doubles: 0,
    rolled: false,
    card: null,
    draws: 0,
    seed: 0,
  };
}

/* ── Shared plumbing ──────────────────────────────────────────────────────── */

const makeId = (ctx: GameContext, tag: string) => `${tag}-${ctx.now.toString(36)}-${ctx.actorUid.slice(0, 6)}`;

function append(log: Entry[], entry: Entry): Entry[] {
  const next = [...log, entry];
  return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next;
}

const record = (state: MonopolyState, uid: string, balance: number, now: number) => ({
  ...state.history,
  [uid]: [...(state.history[uid] ?? []), { t: now, b: balance }],
});

const withSeat = (state: MonopolyState, uid: string, patch: Partial<Seat>): Seat[] =>
  state.seats.map((s) => (s.uid === uid ? { ...s, ...patch } : s));

function requireSeat(state: MonopolyState, ctx: GameContext): Seat {
  const seat = seatOf(state, ctx.actorUid);
  if (!seat) throw new GameRuleError('You are not in this game.');
  if (seat.bankrupt) throw new GameRuleError('You are out of this game.');
  return seat;
}

function requireOwner(ctx: GameContext): void {
  if (ctx.actorUid !== ctx.ownerUid) throw new GameRuleError('Only the host can do that.');
}

function requirePhase(state: MonopolyState, phase: Phase): void {
  if (state.phase !== phase) throw new GameRuleError('That is not possible right now.');
}

/** Board mode only: refuse anything out of turn, or while a decision is outstanding. */
function requireTurn(state: MonopolyState, ctx: GameContext): Seat {
  const seat = requireSeat(state, ctx);
  if (isBoardMode(state) && state.turn !== ctx.actorUid) throw new GameRuleError("It is not your turn.");
  return seat;
}

function wholeAmount(amount: unknown): number {
  const value = Math.floor(Number(amount));
  if (!Number.isFinite(value) || value <= 0) throw new GameRuleError('Enter an amount above zero.');
  if (value > 100_000_000) throw new GameRuleError('That is more money than this game holds.');
  return value;
}

function checkDice(dice: [number, number]): [number, number] {
  const ok = Array.isArray(dice) && dice.length === 2
    && dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6);
  if (!ok) throw new GameRuleError('Those are not two dice.');
  return [dice[0], dice[1]];
}

const note = (text: unknown, fallback = ''): string => String(text ?? '').trim().slice(0, 60) || fallback;

const logged = (state: MonopolyState, ctx: GameContext, entry: DraftEntry): Entry[] =>
  append(state.log, { ...entry, id: makeId(ctx, 'tx'), at: ctx.now } as Entry);

/**
 * Keeps the seats in step with the room. Before the game starts, arrivals get a seat and leavers
 * lose theirs; once play is under way a seat is kept even while its player is away, so their
 * money and deeds survive a closed tab.
 */
function syncSeats(state: MonopolyState, ctx: GameContext): MonopolyState {
  if (state.phase !== 'lobby' && state.phase !== 'pick') return state;
  const present = new Map(ctx.players.map((p: RoomPlayer) => [p.uid, p]));
  const kept = state.seats
    .filter((s) => present.has(s.uid))
    .map((s) => ({ ...s, name: present.get(s.uid)!.name, photoURL: present.get(s.uid)!.photoURL }));
  const known = new Set(kept.map((s) => s.uid));
  const added: Seat[] = ctx.players.filter((p) => !known.has(p.uid)).map((p) => ({
    uid: p.uid,
    name: p.name,
    photoURL: p.photoURL,
    token: null,
    color: null,
    balance: state.settings.startingBalance,
    ready: false,
    dice: null,
    position: 0,
    jailTurns: 0,
    bankrupt: false,
  }));
  if (added.length === 0 && kept.length === state.seats.length) return state;
  return { ...state, seats: [...kept, ...added] };
}

/* ── Setting up ───────────────────────────────────────────────────────────── */

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
  if (action.mode !== undefined) {
    if (action.mode !== 'bank' && action.mode !== 'board') throw new GameRuleError('Pick one of the two modes.');
    settings.mode = action.mode;
  }
  if (action.boardId !== undefined) {
    if (!boardOf(action.boardId) || boardOf(action.boardId).id !== action.boardId) {
      throw new GameRuleError('There is no such board.');
    }
    settings.boardId = action.boardId;
  }
  // Nobody has spent anything yet, so everyone's balance follows the setting.
  return { ...state, settings, seats: state.seats.map((s) => ({ ...s, balance: settings.startingBalance })) };
}

function start(state: MonopolyState, seed: number, ctx: GameContext): MonopolyState {
  requireOwner(ctx);
  requirePhase(state, 'lobby');
  if (state.seats.length < 2) throw new GameRuleError('You need at least two players.');
  const value = Math.floor(Number(seed));
  return { ...state, phase: 'pick', seed: Number.isFinite(value) ? Math.abs(value) : 1 };
}

function pick(state: MonopolyState, action: Extract<MonopolyAction, { type: 'pick' }>, ctx: GameContext): MonopolyState {
  requirePhase(state, 'pick');
  requireSeat(state, ctx);
  if (!TOKENS.includes(action.token as (typeof TOKENS)[number])) throw new GameRuleError('Pick one of the tokens.');
  if (!COLORS.includes(action.color as (typeof COLORS)[number])) throw new GameRuleError('Pick one of the colours.');
  if (state.seats.some((s) => s.uid !== ctx.actorUid && s.ready && s.token === action.token)) {
    throw new GameRuleError('Someone already took that token.');
  }
  const seats = withSeat(state, ctx.actorUid, { token: action.token, color: action.color, ready: true });
  if (!seats.every((s) => s.ready)) return { ...state, seats };

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
  const joined = new Map(ctx.players.map((p) => [p.uid, p.joinedAt]));
  const order = [...seats]
    .sort((a, b) => {
      const diff = (b.dice![0] + b.dice![1]) - (a.dice![0] + a.dice![1]);
      return diff !== 0 ? diff : (joined.get(a.uid) ?? 0) - (joined.get(b.uid) ?? 0);
    })
    .map((s) => s.uid);
  return { ...state, seats, order, phase: 'order' };
}

/* ── Money, by hand (bank mode) ───────────────────────────────────────────── */

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
    log: logged(state, ctx, { kind: 'transfer', from: from.uid, to: to.uid, amount, note: note(action.note) }),
  };
  next = { ...next, history: record(next, from.uid, from.balance - amount, ctx.now) };
  return { ...next, history: record(next, to.uid, to.balance + amount, ctx.now) };
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
    log: logged(state, ctx, { kind: 'payBank', from: seat.uid, amount, note: note(action.reason, 'Other') }),
  };
  return { ...next, history: record(next, seat.uid, balance, ctx.now) };
}

/**
 * Bank mode's buy: take a named space off this room's board and pay the bank its printed price.
 *
 * This is the whole reason the board data exists in bank mode. Recording *which* space was bought
 * is what lets the results screen add up what everyone owns instead of asking them to count it.
 */
function buyProperty(state: MonopolyState, index: number, ctx: GameContext): MonopolyState {
  requirePhase(state, 'playing');
  const seat = requireSeat(state, ctx);
  const space = boardFor(state).spaces[index];
  if (!space || !isOwnable(space)) throw new GameRuleError('That space is not for sale.');
  if (state.owned[index]) throw new GameRuleError('Somebody already owns that.');
  if (seat.balance < space.price) throw new GameRuleError('You do not have that much.');

  const balance = seat.balance - space.price;
  const next: MonopolyState = {
    ...state,
    owned: { ...state.owned, [index]: seat.uid },
    seats: withSeat(state, seat.uid, { balance }),
    log: logged(state, ctx, {
      kind: 'buy', from: seat.uid, amount: space.price, note: space.name, space: index,
    }),
  };
  return { ...next, history: record(next, seat.uid, balance, ctx.now) };
}

function requestBank(state: MonopolyState, action: Extract<MonopolyAction, { type: 'requestBank' }>, ctx: GameContext): MonopolyState {
  requirePhase(state, 'playing');
  const seat = requireSeat(state, ctx);
  const amount = wholeAmount(action.amount);
  if (state.requests.some((r) => r.uid === seat.uid)) throw new GameRuleError('Your last request is still waiting.');
  const request = {
    id: makeId(ctx, 'req'), uid: seat.uid, amount, reason: note(action.reason), approvedBy: [], at: ctx.now,
  };
  return settleRequest({ ...state, requests: [...state.requests, request] }, request.id, ctx);
}

function respondBank(state: MonopolyState, action: Extract<MonopolyAction, { type: 'respondBank' }>, ctx: GameContext): MonopolyState {
  requirePhase(state, 'playing');
  requireSeat(state, ctx);
  const request = state.requests.find((r) => r.id === action.id);
  if (!request) return state;
  if (request.uid === ctx.actorUid) throw new GameRuleError('You cannot approve your own request.');
  if (!action.approve) return { ...state, requests: state.requests.filter((r) => r.id !== request.id) };
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
  const others = activeSeats(state).filter((s) => s.uid !== request.uid);
  if (!others.every((s) => request.approvedBy.includes(s.uid))) return state;

  const seat = seatOf(state, request.uid);
  const requests = state.requests.filter((r) => r.id !== id);
  if (!seat) return { ...state, requests };
  const balance = seat.balance + request.amount;
  const next: MonopolyState = {
    ...state,
    requests,
    seats: withSeat(state, seat.uid, { balance }),
    log: logged(state, ctx, { kind: 'fromBank', to: seat.uid, amount: request.amount, note: request.reason }),
  };
  return { ...next, history: record(next, seat.uid, balance, ctx.now) };
}

/* ── Finishing ────────────────────────────────────────────────────────────── */

function respondEnd(state: MonopolyState, approve: boolean, ctx: GameContext): MonopolyState {
  requirePhase(state, 'endVote');
  requireSeat(state, ctx);
  if (!state.endVote) return { ...state, phase: 'playing' };
  if (!approve) return { ...state, phase: 'playing', endVote: null };
  const approvedBy = state.endVote.approvedBy.includes(ctx.actorUid)
    ? state.endVote.approvedBy
    : [...state.endVote.approvedBy, ctx.actorUid];
  if (!activeSeats(state).every((s) => approvedBy.includes(s.uid))) {
    return { ...state, endVote: { ...state.endVote, approvedBy } };
  }
  // No asset-entry step any more: everything anyone bought is already recorded.
  return { ...state, phase: 'results', endVote: null };
}

function newGame(state: MonopolyState, ctx: GameContext): MonopolyState {
  requireOwner(ctx);
  if (state.phase !== 'results') throw new GameRuleError('Finish this game first.');
  // Keep the settings and who is sitting here, and their tokens, so a rematch is quick.
  return {
    ...initial(),
    settings: state.settings,
    seed: state.seed,
    seats: state.seats.map((s) => ({
      ...s,
      balance: state.settings.startingBalance,
      ready: false,
      dice: null,
      position: 0,
      jailTurns: 0,
      bankrupt: false,
    })),
  };
}

/* ── The reducer ──────────────────────────────────────────────────────────── */

function reduce(state: MonopolyState, action: MonopolyAction, ctx: GameContext): MonopolyState {
  switch (action.type) {
    case 'configure': return configure(state, action, ctx);
    case 'start': return start(state, action.seed, ctx);
    case 'pick': return pick(state, action, ctx);
    case 'rollOrder': return rollOrder(state, action.dice, ctx);

    case 'beginPlay': {
      requirePhase(state, 'order');
      requireSeat(state, ctx);
      // Board mode needs somebody to be on move; bank mode never enforces turns.
      return { ...state, phase: 'playing', turn: isBoardMode(state) ? state.order[0] ?? null : null };
    }

    case 'roll': {
      requirePhase(state, 'playing');
      const dice = checkDice(action.dice);
      if (!isBoardMode(state)) {
        requireSeat(state, ctx);
        // Bank mode: the dice are just announced, because the board is on the table.
        return { ...state, lastRoll: { uid: ctx.actorUid, dice, total: dice[0] + dice[1], at: ctx.now } };
      }
      requireTurn(state, ctx);
      if (state.pending) throw new GameRuleError('Answer the offer first.');
      if (state.rolled) throw new GameRuleError('You have already rolled — end your turn.');
      const moved = rollAndMove(state, ctx.actorUid, dice, ctx.now);
      // A double buys another go; anything else ends the moving part of the turn.
      return settleIfOver({ ...moved, rolled: !rollsAgain(moved, ctx.actorUid) });
    }

    case 'buy': {
      requirePhase(state, 'playing');
      requireTurn(state, ctx);
      if (!state.pending) throw new GameRuleError('There is nothing to buy.');
      return settleIfOver(buyPending(state, ctx.actorUid, ctx.now));
    }

    case 'decline': {
      requirePhase(state, 'playing');
      requireTurn(state, ctx);
      // The bank keeps it. No auction — see the note at the top of ./play.
      return { ...state, pending: null };
    }

    case 'endTurn': {
      requirePhase(state, 'playing');
      requireTurn(state, ctx);
      if (state.pending) throw new GameRuleError('Answer the offer first.');
      if (rollsAgain(state, ctx.actorUid)) throw new GameRuleError('You rolled a double — roll again.');
      return endTurn(state);
    }

    case 'buyProperty': {
      if (isBoardMode(state)) throw new GameRuleError('Land on it first.');
      return buyProperty(state, action.space, ctx);
    }

    case 'build': {
      requirePhase(state, 'playing');
      const seat = isBoardMode(state) ? requireTurn(state, ctx) : requireSeat(state, ctx);
      if (!canBuild(state, seat.uid, action.space)) {
        throw new GameRuleError('You cannot build there — you need the whole set, built up evenly, and the money.');
      }
      return build(state, seat.uid, action.space, ctx.now);
    }

    case 'send': return send(state, action, ctx);
    case 'payBank': return payBank(state, action, ctx);
    case 'requestBank': return requestBank(state, action, ctx);
    case 'respondBank': return respondBank(state, action, ctx);

    case 'endGame': {
      requirePhase(state, 'playing');
      requireSeat(state, ctx);
      if (isBoardMode(state)) {
        throw new GameRuleError('A board game ends when only one player is left.');
      }
      return { ...state, phase: 'endVote', endVote: { by: ctx.actorUid, approvedBy: [ctx.actorUid] } };
    }

    case 'respondEnd': return respondEnd(state, action.approve, ctx);
    case 'newGame': return newGame(state, ctx);
    default: throw new GameRuleError('Unknown move.');
  }
}

export const monopoly: GameDefinition<MonopolyState, MonopolyAction> = {
  id: 'monopoly',
  name: 'Monopoly',
  tagline: 'Play the whole board online, or just be the bank for the one on your table.',
  emoji: '🎲',
  minPlayers: 2,
  maxPlayers: 8,
  solo: false,
  newState: initial,
  onPlayersChanged: syncSeats,
  reduce,
};

export { propertyValue, ranking, totalWealth };

/** Two dice, for the caller to put in a `roll` action. */
export const throwDice = (): [number, number] => [
  1 + Math.floor(Math.random() * 6),
  1 + Math.floor(Math.random() * 6),
];

/** A seed for the card order, for the caller to put in the `start` action. */
export const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
