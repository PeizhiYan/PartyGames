/**
 * Yahtzee as a room game: up to six scorecards, one set of dice, three rolls a turn.
 *
 * The dice come in on the `roll` action — thrown on the device, like Monopoly's — so the reducer
 * stays a pure function. It replaces only the dice that are not held, which is also what keeps a
 * client from sending a hand-picked five: a roll can only change what the rules say may change.
 */
import { GameRuleError, type GameContext, type GameDefinition, type GameId, type RoomPlayer } from '../../types';

export const CATEGORIES = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance',
] as const;
export type Category = (typeof CATEGORIES)[number];
export const UPPER: Category[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER: Category[] = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'];

export const CATEGORY_LABEL: Record<Category, string> = {
  ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  threeKind: '3 of a kind', fourKind: '4 of a kind', fullHouse: 'Full house',
  smallStraight: 'Small straight', largeStraight: 'Large straight', yahtzee: 'Yahtzee', chance: 'Chance',
};

export const UPPER_BONUS_AT = 63;
export const UPPER_BONUS = 35;
export const YAHTZEE_BONUS = 100;
export const ROLLS_PER_TURN = 3;

export type Dice = [number, number, number, number, number];

export interface Seat {
  uid: string;
  name: string;
  photoURL?: string;
  /** Category → score once used. Absent means still open. */
  card: Partial<Record<Category, number>>;
  /** Extra Yahtzees after the first, 100 each. */
  yahtzeeBonuses: number;
}

export type Phase = 'lobby' | 'playing' | 'results';

export interface YahtzeeState {
  phase: Phase;
  seats: Seat[];
  /** Index into `seats` of whose turn it is. */
  turn: number;
  dice: Dice;
  held: [boolean, boolean, boolean, boolean, boolean];
  /** Rolls taken this turn, 0-3. The dice mean nothing until the first. */
  rolls: number;
  round: number;
}

export type YahtzeeAction =
  | { type: 'start' }
  | { type: 'roll'; dice: number[] }
  | { type: 'hold'; index: number; held: boolean }
  | { type: 'score'; category: Category }
  | { type: 'again' };

const NO_HOLDS: YahtzeeState['held'] = [false, false, false, false, false];

function initial(): YahtzeeState {
  return { phase: 'lobby', seats: [], turn: 0, dice: [1, 1, 1, 1, 1], held: NO_HOLDS, rolls: 0, round: 0 };
}

/* ── Scoring ──────────────────────────────────────────────────────────────── */

const counts = (dice: Dice): number[] => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d] += 1;
  return c;
};
const sum = (dice: Dice): number => dice.reduce((a, b) => a + b, 0);
const isYahtzee = (dice: Dice): boolean => dice.every((d) => d === dice[0]);

/** Whether the dice hold a run of `length` consecutive faces. */
function straightOf(dice: Dice, length: number): boolean {
  const have = new Set(dice);
  for (let start = 1; start + length - 1 <= 6; start += 1) {
    let ok = true;
    for (let k = 0; k < length; k += 1) if (!have.has(start + k)) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

/**
 * What `dice` would score in `category`. `joker` is the Yahtzee joker rule: a second Yahtzee may
 * fill a full house or a straight for its full value even though the dice are not one.
 */
export function scoreFor(category: Category, dice: Dice, joker = false): number {
  const c = counts(dice);
  switch (category) {
    case 'ones': return c[1] * 1;
    case 'twos': return c[2] * 2;
    case 'threes': return c[3] * 3;
    case 'fours': return c[4] * 4;
    case 'fives': return c[5] * 5;
    case 'sixes': return c[6] * 6;
    case 'threeKind': return c.some((n) => n >= 3) ? sum(dice) : 0;
    case 'fourKind': return c.some((n) => n >= 4) ? sum(dice) : 0;
    case 'fullHouse': return joker || (c.includes(3) && c.includes(2)) ? 25 : 0;
    case 'smallStraight': return joker || straightOf(dice, 4) ? 30 : 0;
    case 'largeStraight': return joker || straightOf(dice, 5) ? 40 : 0;
    case 'yahtzee': return isYahtzee(dice) ? 50 : 0;
    case 'chance': return sum(dice);
    default: return 0;
  }
}

export const upperTotal = (seat: Seat): number => UPPER.reduce((t, c) => t + (seat.card[c] ?? 0), 0);
export const upperBonus = (seat: Seat): number => (upperTotal(seat) >= UPPER_BONUS_AT ? UPPER_BONUS : 0);
export const lowerTotal = (seat: Seat): number => LOWER.reduce((t, c) => t + (seat.card[c] ?? 0), 0);
export const grandTotal = (seat: Seat): number =>
  upperTotal(seat) + upperBonus(seat) + lowerTotal(seat) + seat.yahtzeeBonuses * YAHTZEE_BONUS;
export const openCategories = (seat: Seat): Category[] => CATEGORIES.filter((c) => seat.card[c] === undefined);
export const cardComplete = (seat: Seat): boolean => openCategories(seat).length === 0;

/**
 * Whether the joker applies for this seat and these dice: a Yahtzee rolled when the Yahtzee box
 * is already filled. (With a 50 in it a bonus is also paid; with a 0, only the joker.) Under the
 * joker, the matching upper box must be used if it is open; otherwise any lower box may be.
 */
export function jokerState(seat: Seat, dice: Dice): { joker: boolean; mustUse: Category | null } {
  if (!isYahtzee(dice) || seat.card.yahtzee === undefined) return { joker: false, mustUse: null };
  const upper = UPPER[dice[0] - 1];
  return { joker: true, mustUse: seat.card[upper] === undefined ? upper : null };
}

/** The categories this seat may score these dice in right now, and what each would give. */
export function choices(seat: Seat, dice: Dice): { category: Category; score: number }[] {
  const { joker, mustUse } = jokerState(seat, dice);
  const open = openCategories(seat);
  // Under the joker with the matching upper box filled, any open box may be used: a lower box
  // for its full value, an upper one for whatever the dice happen to score there.
  const allowed = mustUse ? [mustUse] : open;
  return allowed.map((category) => ({ category, score: scoreFor(category, dice, joker && LOWER.includes(category)) }));
}

/* ── Seats ────────────────────────────────────────────────────────────────── */

function syncSeats(state: YahtzeeState, ctx: GameContext): YahtzeeState {
  if (state.phase !== 'lobby') return state;
  const present = new Map(ctx.players.map((p: RoomPlayer) => [p.uid, p]));
  const kept = state.seats.filter((s) => present.has(s.uid))
    .map((s) => ({ ...s, name: present.get(s.uid)!.name, photoURL: present.get(s.uid)!.photoURL }));
  const known = new Set(kept.map((s) => s.uid));
  const added: Seat[] = ctx.players.filter((p) => !known.has(p.uid))
    .map((p) => ({ uid: p.uid, name: p.name, photoURL: p.photoURL, card: {}, yahtzeeBonuses: 0 }));
  if (added.length === 0 && kept.length === state.seats.length) return state;
  return { ...state, seats: [...kept, ...added] };
}

export const seatOf = (state: YahtzeeState, uid: string): Seat | undefined => state.seats.find((s) => s.uid === uid);
export const currentSeat = (state: YahtzeeState): Seat | undefined => state.seats[state.turn];
export const isMyTurn = (state: YahtzeeState, uid: string): boolean =>
  state.phase === 'playing' && currentSeat(state)?.uid === uid;

/* ── Actions ──────────────────────────────────────────────────────────────── */

function requireOwner(ctx: GameContext): void {
  if (ctx.actorUid !== ctx.ownerUid) throw new GameRuleError('Only the host can do that.');
}

function start(state: YahtzeeState, ctx: GameContext): YahtzeeState {
  requireOwner(ctx);
  if (state.phase !== 'lobby') throw new GameRuleError('The game has already started.');
  if (state.seats.length < 1) throw new GameRuleError('Nobody is seated.');
  return { ...state, phase: 'playing', turn: 0, rolls: 0, held: NO_HOLDS, dice: [1, 1, 1, 1, 1] };
}

function requireTurn(state: YahtzeeState, ctx: GameContext): Seat {
  if (state.phase !== 'playing') throw new GameRuleError('The game is not under way.');
  const seat = currentSeat(state);
  if (!seat || seat.uid !== ctx.actorUid) throw new GameRuleError("It's not your turn.");
  return seat;
}

const validDie = (d: unknown): d is number => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 6;

function roll(state: YahtzeeState, thrown: number[], ctx: GameContext): YahtzeeState {
  requireTurn(state, ctx);
  if (state.rolls >= ROLLS_PER_TURN) throw new GameRuleError('No rolls left — pick a box to score.');
  if (!Array.isArray(thrown) || thrown.length !== 5 || !thrown.every(validDie)) throw new GameRuleError('That is not a throw of five dice.');
  // Holds only mean something once there are dice on the table.
  const held = state.rolls === 0 ? NO_HOLDS : state.held;
  const dice = state.dice.map((d, i) => (held[i] ? d : thrown[i])) as Dice;
  return { ...state, dice, held, rolls: state.rolls + 1 };
}

function hold(state: YahtzeeState, index: number, held: boolean, ctx: GameContext): YahtzeeState {
  requireTurn(state, ctx);
  if (state.rolls === 0) throw new GameRuleError('Roll first.');
  if (state.rolls >= ROLLS_PER_TURN) throw new GameRuleError('No rolls left — holding changes nothing now.');
  if (!Number.isInteger(index) || index < 0 || index > 4) throw new GameRuleError('That is not a die.');
  const next = [...state.held] as YahtzeeState['held'];
  next[index] = !!held;
  return { ...state, held: next };
}

function score(state: YahtzeeState, category: Category, ctx: GameContext): YahtzeeState {
  const seat = requireTurn(state, ctx);
  if (state.rolls === 0) throw new GameRuleError('Roll first.');
  if (!CATEGORIES.includes(category)) throw new GameRuleError('That is not a box on the card.');
  if (seat.card[category] !== undefined) throw new GameRuleError('That box is already filled.');
  const option = choices(seat, state.dice).find((c) => c.category === category);
  if (!option) throw new GameRuleError('A Yahtzee has to go in its matching upper box when that box is open.');
  const { joker } = jokerState(seat, state.dice);
  const bonus = joker && seat.card.yahtzee === 50 ? 1 : 0;
  const filled: Seat = { ...seat, card: { ...seat.card, [category]: option.score }, yahtzeeBonuses: seat.yahtzeeBonuses + bonus };
  const seats = state.seats.map((s) => (s.uid === seat.uid ? filled : s));
  const everyoneDone = seats.every(cardComplete);
  const nextTurn = (state.turn + 1) % seats.length;
  return {
    ...state,
    seats,
    phase: everyoneDone ? 'results' : 'playing',
    turn: everyoneDone ? state.turn : nextTurn,
    round: nextTurn === 0 ? state.round + 1 : state.round,
    rolls: 0,
    held: NO_HOLDS,
  };
}

function again(state: YahtzeeState, ctx: GameContext): YahtzeeState {
  requireOwner(ctx);
  if (state.phase !== 'results') throw new GameRuleError('Finish this game first.');
  return syncSeats({ ...initial(), seats: state.seats.map((s) => ({ ...s, card: {}, yahtzeeBonuses: 0 })) }, ctx);
}

/** Final order, best first. */
export const ranking = (state: YahtzeeState): Seat[] => [...state.seats].sort((a, b) => grandTotal(b) - grandTotal(a));

/** Five dice from the device. Passed in on the action, never rolled inside the reducer. */
export const throwFive = (): number[] => Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 6));

export const yahtzee: GameDefinition<YahtzeeState, YahtzeeAction> = {
  // TODO(yahtzee): plain literal once 'yahtzee' joins the GameId union, when the screens land.
  id: 'yahtzee' as GameId,
  name: 'Yahtzee',
  tagline: 'Five dice, three rolls, thirteen boxes. Up to six players, or the computer.',
  emoji: '🎲',
  minPlayers: 1,
  maxPlayers: 6,
  solo: true,
  multiplayer: true,
  soloTitle: 'Play the computer',
  soloDescription: 'No room needed. One to three computer players.',
  newState: initial,
  onPlayersChanged: syncSeats,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'start': return start(state, ctx);
      case 'roll': return roll(state, action.dice, ctx);
      case 'hold': return hold(state, action.index, action.held, ctx);
      case 'score': return score(state, action.category, ctx);
      case 'again': return again(state, ctx);
      default: throw new GameRuleError('Unknown move.');
    }
  },
};
