/**
 * The shape of a Monopoly game, and the small readings the UI and the rules both need.
 *
 * Two modes share almost all of this. **Bank** is the original: players have a real board on the
 * table and the app only moves money, but it still knows which properties exist, so buying one
 * records *what* was bought and the final total adds itself up. **Board** plays the whole game
 * here — tokens, rent, cards, jail — and needs the extra per-player fields at the bottom.
 */
import { boardOf, isOwnable, rentLadder, railRent, utilityMultiplier, MONOPOLY_MULTIPLIER,
  type BoardDef, type OwnableSpace } from './boards';

export type Mode = 'bank' | 'board';

export type Phase =
  /** The host sets the board, the mode and the starting balance. */
  | 'lobby'
  /** Everyone picks a token and a colour. */
  | 'pick'
  /** Everyone rolls to decide who goes first. */
  | 'roll'
  /** The order is in, and shown before play starts. */
  | 'order'
  | 'playing'
  /** Someone asked to end a bank game; everyone else has to agree. */
  | 'endVote'
  | 'results';

export interface Seat {
  uid: string;
  name: string;
  photoURL?: string;
  token: string | null;
  color: string | null;
  balance: number;
  ready: boolean;
  dice: [number, number] | null;
  /** Board mode: where the token stands, as a space index. */
  position: number;
  /** Board mode: turns left to sit out, or 0 when free. */
  jailTurns: number;
  /** Board mode: out of the game, their deeds back with the bank. */
  bankrupt: boolean;
}

export type Entry =
  | { id: string; at: number; kind: 'transfer'; from: string; to: string; amount: number; note: string }
  | { id: string; at: number; kind: 'payBank'; from: string; amount: number; note: string }
  | { id: string; at: number; kind: 'fromBank'; to: string; amount: number; note: string }
  /** Buying a deed. `space` is what makes the end-of-game total addable. */
  | { id: string; at: number; kind: 'buy'; from: string; amount: number; note: string; space: number }
  | { id: string; at: number; kind: 'build'; from: string; amount: number; note: string; space: number }
  | { id: string; at: number; kind: 'rent'; from: string; to: string; amount: number; note: string; space: number };

/**
 * A log entry before it is given an id and a timestamp.
 *
 * Distributive on purpose: a plain `Omit<Entry, …>` over a union keeps only the keys every member
 * shares, which quietly loses `from`, `to` and `space`.
 */
export type DraftEntry<T = Entry> = T extends Entry ? Omit<T, 'id' | 'at'> : never;

export interface BankRequest {
  id: string;
  uid: string;
  amount: number;
  reason: string;
  approvedBy: string[];
  at: number;
}

/** Board mode: something the player whose turn it is has to answer before anything else happens. */
export type Pending = { kind: 'buy'; space: number; price: number };

export interface MonopolyState {
  phase: Phase;
  settings: {
    startingBalance: number;
    showBalances: boolean;
    mode: Mode;
    boardId: string;
  };
  seats: Seat[];
  /** uids, highest opening roll first. */
  order: string[];
  requests: BankRequest[];
  log: Entry[];
  history: Record<string, { t: number; b: number }[]>;
  lastRoll: { uid: string; dice: [number, number]; total: number; at: number } | null;
  endVote: { by: string; approvedBy: string[] } | null;
  /** Space index → the uid holding its deed. Both modes. */
  owned: Record<number, string>;
  /** Space index → houses built, 1-4, or 5 for a hotel. Both modes. */
  houses: Record<number, number>;
  /** Board mode: whose turn it is. */
  turn: string | null;
  /** Board mode: a decision blocking the turn. */
  pending: Pending | null;
  /** Board mode: doubles rolled in a row this turn. Three sends you to jail. */
  doubles: number;
  /** Board mode: this player has moved and may only build or end their turn. */
  rolled: boolean;
  /** Board mode: the card just drawn, kept so everyone can read it. */
  card: { text: string; at: number } | null;
  /** Board mode: how many cards have been drawn, which is what picks the next one. */
  draws: number;
  /** Board mode: set once at the start, so card draws are varied but still a pure function. */
  seed: number;
}

export const seatOf = (state: MonopolyState, uid: string): Seat | undefined =>
  state.seats.find((s) => s.uid === uid);

export const boardFor = (state: MonopolyState): BoardDef => boardOf(state.settings.boardId);

export const isBoardMode = (state: MonopolyState): boolean => state.settings.mode === 'board';

/** Every space this player holds the deed to. */
export function deedsOf(state: MonopolyState, uid: string): number[] {
  return Object.entries(state.owned)
    .filter(([, owner]) => owner === uid)
    .map(([index]) => Number(index))
    .sort((a, b) => a - b);
}

/**
 * What a player's property is worth: what they paid for each deed, plus what they paid to build.
 *
 * This is why buying records the space. The old bank mode asked everyone to type a number at the
 * end, which was slow and — since nobody recounts their deeds carefully — wrong as often as not.
 */
export function propertyValue(state: MonopolyState, uid: string): number {
  const board = boardFor(state);
  let total = 0;
  for (const index of deedsOf(state, uid)) {
    const space = board.spaces[index];
    if (space && isOwnable(space)) total += space.price;
    const built = state.houses[index] ?? 0;
    if (space?.kind === 'property' && built > 0) {
      total += built * (board.groups[space.group]?.houseCost ?? 0);
    }
  }
  return total;
}

export const totalWealth = (state: MonopolyState, seat: Seat): number =>
  seat.balance + propertyValue(state, seat.uid);

/** Players ranked by cash plus property. Bankrupt players sort last whatever they hold. */
export const ranking = (state: MonopolyState): Seat[] =>
  [...state.seats].sort((a, b) => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    return totalWealth(state, b) - totalWealth(state, a);
  });

export const activeSeats = (state: MonopolyState): Seat[] => state.seats.filter((s) => !s.bankrupt);

/** Every space in the same colour group, including this one. */
export function groupSpaces(board: BoardDef, group: string): number[] {
  return board.spaces
    .map((s, i) => (s.kind === 'property' && s.group === group ? i : -1))
    .filter((i) => i >= 0);
}

/** Whether one player holds every property in a group, which is what lets them build. */
export function hasMonopoly(state: MonopolyState, uid: string, group: string): boolean {
  const spaces = groupSpaces(boardFor(state), group);
  return spaces.length > 0 && spaces.every((i) => state.owned[i] === uid);
}

/** How many of the given kind this player holds, for railway and utility rent. */
function countOwned(state: MonopolyState, uid: string, kind: OwnableSpace['kind']): number {
  const board = boardFor(state);
  return deedsOf(state, uid).filter((i) => board.spaces[i]?.kind === kind).length;
}

/** What landing on `index` costs, given the dice that got you there. Zero if nobody charges. */
export function rentFor(state: MonopolyState, index: number, diceTotal: number): number {
  const board = boardFor(state);
  const space = board.spaces[index];
  const owner = state.owned[index];
  if (!space || !isOwnable(space) || !owner) return 0;
  const ownerSeat = seatOf(state, owner);
  if (!ownerSeat || ownerSeat.bankrupt) return 0;

  if (space.kind === 'rail') return railRent(space.price, countOwned(state, owner, 'rail'));
  if (space.kind === 'utility') return diceTotal * utilityMultiplier(countOwned(state, owner, 'utility'));

  const built = state.houses[index] ?? 0;
  const ladder = rentLadder(space.price);
  if (built > 0) return ladder[Math.min(built, 5)];
  // A bare property in a complete set charges double.
  return ladder[0] * (hasMonopoly(state, owner, space.group) ? MONOPOLY_MULTIPLIER : 1);
}
