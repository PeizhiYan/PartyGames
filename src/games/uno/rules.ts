import { t } from '../../i18n';
import { m } from './messages';
/**
 * UNO as a room game, 2-10 players.
 *
 * Hidden information runs on the trusted-client model (see "Everything in a room is public" in
 * CLAUDE.md): `hands` and `deck` are top-level keys of the room document, the UI shows only the
 * viewer's own hand, and nothing else in the state names a card someone is holding.
 *
 * The deal is a pure function of the `seed` on the `start` action. Every later draw takes from
 * the end of `deck`; when the deck runs dry the discard pile (minus its top card) is reshuffled
 * with `seed + reshuffles`, so a whole game replays exactly from its actions.
 *
 * House-rule choices, written down so nobody has to guess:
 * - The first card turned up is always a number card: action cards are tucked under the deck
 *   and the next one turned, rather than applying their effect to the first player.
 * - Draw cards stack only on their own kind: +2 on +2, +4 on +4. The next player either stacks or
 *   draws the lot and loses the turn.
 * - A wild draw-four may always be played; there is no challenge.
 * - Having drawn a single card, you may play it straight away if it fits; if it does not, your
 *   turn passes on its own.
 * - Anyone holding two cards or fewer may call UNO at any time. A player on one card who has not
 *   called it can be caught by anyone, and draws two.
 * - A player who leaves mid-round keeps their seat and hand and is skipped; seats only follow the
 *   room between rounds.
 */
import { GameRuleError, type GameContext, type GameDefinition, type RoomPlayer } from '../../types';
import { shuffle } from '../shuffle';
import { DECK_SIZE, cardOf, isColor, isNumber, isWild, points, type Color } from './cards';

export const HAND_SIZE = 7;
/** The score at which the table is told someone has won the match. Play may carry on. */
export const TARGET = 500;
export const MAX_PLAYERS = 10;

export interface Seat {
  uid: string;
  name: string;
  photoURL?: string;
  score: number;
  /** Left the room mid-round: their turn is skipped until the round ends. */
  absent?: boolean;
}

export type Phase = 'lobby' | 'playing' | 'results';

/** What just happened, as data. `who` and `target` are uids; `card` is a card id. */
export type UnoNote =
  | { k: 'start'; card: number; who: string }
  | { k: 'played'; who: string; card: number; color?: Color }
  | { k: 'out'; who: string; points: number }
  | { k: 'drewPenalty'; who: string; n: number }
  | { k: 'nothing'; who: string }
  | { k: 'drew'; who: string }
  | { k: 'drewPasses'; who: string }
  | { k: 'passes'; who: string }
  | { k: 'uno'; who: string }
  | { k: 'caught'; who: string; target: string };

export interface UnoState {
  phase: Phase;
  seats: Seat[];
  /** uid → card ids. PRIVATE: the UI reads only the viewer's own, and others' `.length`. */
  hands: Record<string, number[]>;
  /** Card ids, drawn from the end. PRIVATE. */
  deck: number[];
  /** Card ids, top last. Public. */
  discard: number[];
  turn: number;
  direction: 1 | -1;
  /** The colour to match: the top card's, or the one named with a wild. */
  activeColor: Color;
  /** Cards stacked by +2/+4 that the player to move must take, unless they stack. */
  pendingDraw: number;
  /** The card the player to move just drew and may now play. Null otherwise. */
  drawn: number | null;
  /** uid → has called UNO. Only means something while that player holds one or two cards. */
  uno: Record<string, boolean>;
  /**
   * What just happened, for the table to say out loud. Stored as data, not a sentence: everyone
   * in the room reads the same state, and each screen words it in its own language.
   */
  last: UnoNote | null;
  seed: number;
  reshuffles: number;
  round: number;
  winner: string | null;
}

export type UnoAction =
  | { type: 'start'; seed: number }
  | { type: 'play'; card: number; color?: Color }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'callUno' }
  | { type: 'catch'; uid: string }
  | { type: 'again'; seed: number };

function initial(): UnoState {
  return {
    phase: 'lobby', seats: [], hands: {}, deck: [], discard: [], turn: 0, direction: 1,
    activeColor: 'red', pendingDraw: 0, drawn: null, uno: {}, last: null, seed: 0, reshuffles: 0, round: 0, winner: null,
  };
}

/* ── Readings ─────────────────────────────────────────────────────────────── */

export const topCard = (state: UnoState): number => state.discard[state.discard.length - 1];
export const currentSeat = (state: UnoState): Seat | undefined => state.seats[state.turn];
export const isMyTurn = (state: UnoState, uid: string): boolean =>
  state.phase === 'playing' && currentSeat(state)?.uid === uid;
export const handOf = (state: UnoState, uid: string): number[] => state.hands[uid] ?? [];

/** Whether `card` may go on the pile right now for the player to move. */
export function canPlay(state: UnoState, card: number): boolean {
  if (state.drawn !== null && card !== state.drawn) return false;
  const top = cardOf(topCard(state));
  const c = cardOf(card);
  if (state.pendingDraw > 0) {
    return (top.kind === 'draw2' && c.kind === 'draw2') || (top.kind === 'wild4' && c.kind === 'wild4');
  }
  if (isWild(card)) return true;
  return c.color === state.activeColor || c.kind === top.kind;
}

export const playableCards = (state: UnoState, uid: string): number[] =>
  isMyTurn(state, uid) ? handOf(state, uid).filter((id) => canPlay(state, id)) : [];

/** Whether this player could be caught for not calling UNO. */
export const catchable = (state: UnoState, uid: string): boolean =>
  state.phase === 'playing' && handOf(state, uid).length === 1 && !state.uno[uid];

/** The seat index `steps` places on in the current direction, skipping anyone who has left. */
function stepFrom(state: UnoState, from: number, steps: number): number {
  const n = state.seats.length;
  let i = from;
  let moved = 0;
  // Bounded so a table where everyone left cannot spin forever.
  for (let guard = 0; guard < n * (steps + 1) && moved < steps; guard += 1) {
    i = (i + state.direction + n) % n;
    if (!state.seats[i].absent) moved += 1;
  }
  return i;
}

export const nextSeatIndex = (state: UnoState): number => stepFrom(state, state.turn, 1);
const activeCount = (state: UnoState): number => state.seats.filter((s) => !s.absent).length;

/* ── Drawing ──────────────────────────────────────────────────────────────── */

/**
 * Takes `n` cards off the deck for `uid`, reshuffling the discard pile under the top card when
 * the deck runs out. Draws fewer if every card is already in someone's hand.
 */
function drawCards(state: UnoState, uid: string, n: number): { state: UnoState; got: number[] } {
  let deck = state.deck.slice();
  let discard = state.discard;
  let reshuffles = state.reshuffles;
  const got: number[] = [];
  for (let k = 0; k < n; k += 1) {
    if (deck.length === 0 && discard.length > 1) {
      reshuffles += 1;
      deck = shuffle(discard.slice(0, -1), state.seed + reshuffles);
      discard = discard.slice(-1);
    }
    const id = deck.pop();
    if (id === undefined) break;
    got.push(id);
  }
  const hand = [...handOf(state, uid), ...got];
  return {
    state: {
      ...state, deck, discard, reshuffles,
      hands: { ...state.hands, [uid]: hand },
      // Anyone back above two cards has to call it again.
      uno: hand.length > 2 ? { ...state.uno, [uid]: false } : state.uno,
    },
    got,
  };
}

/* ── Seats ────────────────────────────────────────────────────────────────── */

function syncSeats(state: UnoState, ctx: GameContext): UnoState {
  const present = new Map(ctx.players.map((p: RoomPlayer) => [p.uid, p]));
  if (state.phase === 'playing') {
    // Mid-round, seats are fixed: someone who left is skipped, someone who came back plays on.
    const seats = state.seats.map((s) => ({ ...s, absent: !present.has(s.uid) }));
    if (seats.every((s, i) => !!s.absent === !!state.seats[i].absent)) return state;
    let next = { ...state, seats };
    if (next.seats[next.turn]?.absent && activeCount(next) > 0) next = { ...next, turn: stepFrom(next, next.turn, 1), drawn: null };
    return next;
  }
  const kept = state.seats.filter((s) => present.has(s.uid))
    .map((s) => ({ ...s, absent: false, name: present.get(s.uid)!.name, photoURL: present.get(s.uid)!.photoURL }));
  const known = new Set(kept.map((s) => s.uid));
  const added: Seat[] = ctx.players.filter((p) => !known.has(p.uid))
    .map((p) => ({ uid: p.uid, name: p.name, photoURL: p.photoURL, score: 0 }));
  if (added.length === 0 && kept.length === state.seats.length) return state;
  return { ...state, seats: [...kept, ...added].slice(0, MAX_PLAYERS) };
}

/* ── Actions ──────────────────────────────────────────────────────────────── */

function requireOwner(ctx: GameContext): void {
  if (ctx.actorUid !== ctx.ownerUid) throw new GameRuleError(t.rules.hostOnly);
}

function requireTurn(state: UnoState, ctx: GameContext): void {
  if (state.phase !== 'playing') throw new GameRuleError(m().errors.notUnderWay);
  if (currentSeat(state)?.uid !== ctx.actorUid) throw new GameRuleError(t.rules.notYourTurn);
}

/** Shuffles, deals seven each, and turns up a number card to start the pile. */
function deal(state: UnoState, seed: number, round: number): UnoState {
  const value = Math.floor(Number(seed));
  const s = Number.isFinite(value) ? Math.abs(value) : 1;
  const deck = shuffle(Array.from({ length: DECK_SIZE }, (_, i) => i), s);
  const hands: Record<string, number[]> = {};
  for (const seat of state.seats) hands[seat.uid] = [];
  for (let k = 0; k < HAND_SIZE; k += 1) {
    for (const seat of state.seats) hands[seat.uid].push(deck.pop()!);
  }
  // Tuck action cards under the deck until a number card turns up.
  let first = deck.pop()!;
  while (!isNumber(first)) {
    deck.unshift(first);
    first = deck.pop()!;
  }
  const starter = round % state.seats.length;
  return {
    ...state,
    phase: 'playing',
    seats: state.seats.map((x) => ({ ...x, absent: false })),
    hands, deck, discard: [first],
    turn: starter, direction: 1,
    activeColor: cardOf(first).color as Color,
    pendingDraw: 0, drawn: null, uno: {}, seed: s, reshuffles: 0, round, winner: null,
    last: { k: 'start', card: first, who: state.seats[starter].uid },
  };
}

function start(state: UnoState, seed: number, ctx: GameContext): UnoState {
  requireOwner(ctx);
  if (state.phase !== 'lobby') throw new GameRuleError(t.rules.alreadyStarted);
  if (state.seats.length < 2) throw new GameRuleError(m().errors.needTwo);
  return deal(state, seed, state.round);
}

function play(state: UnoState, card: number, color: Color | undefined, ctx: GameContext): UnoState {
  requireTurn(state, ctx);
  const uid = ctx.actorUid;
  const hand = handOf(state, uid);
  if (!hand.includes(card)) throw new GameRuleError(m().errors.notInHand);
  if (!canPlay(state, card)) {
    throw new GameRuleError(state.pendingDraw > 0
      ? m().errors.stackOrDraw(state.pendingDraw)
      : state.drawn !== null ? m().errors.onlyDrawn : m().errors.noMatch);
  }
  if (isWild(card) && !isColor(color)) throw new GameRuleError(m().errors.nameColour);

  const rest = hand.filter((id) => id !== card);
  const c = cardOf(card);
  let next: UnoState = {
    ...state,
    hands: { ...state.hands, [uid]: rest },
    discard: [...state.discard, card],
    activeColor: isWild(card) ? color! : (c.color as Color),
    drawn: null,
    uno: rest.length > 2 ? { ...state.uno, [uid]: false } : state.uno,
    last: isWild(card) ? { k: 'played', who: uid, card, color: color! } : { k: 'played', who: uid, card },
  };

  if (rest.length === 0) {
    // Round over: the winner scores what everyone else is left holding.
    let gained = 0;
    for (const seat of state.seats) if (seat.uid !== uid) gained += handOf(state, seat.uid).reduce((t, id) => t + points(id), 0);
    return {
      ...next,
      phase: 'results',
      winner: uid,
      pendingDraw: 0,
      seats: next.seats.map((s) => (s.uid === uid ? { ...s, score: s.score + gained } : s)),
      last: { k: 'out', who: uid, points: gained },
    };
  }

  if (c.kind === 'skip') {
    next = { ...next, turn: stepFrom(next, next.turn, 2) };
  } else if (c.kind === 'reverse') {
    next = { ...next, direction: (next.direction === 1 ? -1 : 1) as 1 | -1 };
    // With two players a reverse works as a skip: it comes straight back to you.
    next = { ...next, turn: activeCount(next) === 2 ? next.turn : stepFrom(next, next.turn, 1) };
  } else if (c.kind === 'draw2' || c.kind === 'wild4') {
    next = { ...next, pendingDraw: next.pendingDraw + (c.kind === 'draw2' ? 2 : 4), turn: stepFrom(next, next.turn, 1) };
  } else {
    next = { ...next, turn: stepFrom(next, next.turn, 1) };
  }
  return next;
}

function draw(state: UnoState, ctx: GameContext): UnoState {
  requireTurn(state, ctx);
  if (state.drawn !== null) throw new GameRuleError(m().errors.alreadyDrew);
  const uid = ctx.actorUid;
  if (state.pendingDraw > 0) {
    const owed = state.pendingDraw;
    const { state: after, got } = drawCards(state, uid, owed);
    return { ...after, pendingDraw: 0, turn: stepFrom(after, after.turn, 1), last: { k: 'drewPenalty', who: uid, n: got.length } };
  }
  const { state: after, got } = drawCards(state, uid, 1);
  const card = got[0];
  if (card === undefined) {
    return { ...after, turn: stepFrom(after, after.turn, 1), last: { k: 'nothing', who: uid } };
  }
  const withDrawn = { ...after, drawn: card };
  if (canPlay(withDrawn, card)) return { ...withDrawn, last: { k: 'drew', who: uid } };
  return { ...after, drawn: null, turn: stepFrom(after, after.turn, 1), last: { k: 'drewPasses', who: uid } };
}

function pass(state: UnoState, ctx: GameContext): UnoState {
  requireTurn(state, ctx);
  if (state.drawn === null) throw new GameRuleError(m().errors.drawFirst);
  return { ...state, drawn: null, turn: stepFrom(state, state.turn, 1), last: { k: 'passes', who: ctx.actorUid } };
}

function callUno(state: UnoState, ctx: GameContext): UnoState {
  if (state.phase !== 'playing') throw new GameRuleError(m().errors.notUnderWay);
  const n = handOf(state, ctx.actorUid).length;
  if (n === 0 || n > 2) throw new GameRuleError(m().errors.unoCards);
  if (state.uno[ctx.actorUid]) return state;
  return { ...state, uno: { ...state.uno, [ctx.actorUid]: true }, last: { k: 'uno', who: ctx.actorUid } };
}

function catchPlayer(state: UnoState, target: string, ctx: GameContext): UnoState {
  if (state.phase !== 'playing') throw new GameRuleError(m().errors.notUnderWay);
  if (!state.seats.some((s) => s.uid === ctx.actorUid)) throw new GameRuleError(m().errors.notInRound);
  if (target === ctx.actorUid) throw new GameRuleError(m().errors.callInstead);
  if (!catchable(state, target)) throw new GameRuleError(m().errors.tooLate);
  const { state: after } = drawCards(state, target, 2);
  return { ...after, last: { k: 'caught', who: ctx.actorUid, target } };
}

function again(state: UnoState, seed: number, ctx: GameContext): UnoState {
  requireOwner(ctx);
  if (state.phase !== 'results') throw new GameRuleError(m().errors.finishRound);
  // Between rounds the seats follow the room again.
  const resynced = syncSeats({ ...state, phase: 'lobby' }, ctx);
  if (resynced.seats.length < 2) return { ...resynced, phase: 'lobby' };
  return deal(resynced, seed, state.round + 1);
}

/** Best score first. */
export const ranking = (state: UnoState): Seat[] => [...state.seats].sort((a, b) => b.score - a.score);
export const matchWinner = (state: UnoState): Seat | undefined => ranking(state).find((s) => s.score >= TARGET);

export const uno: GameDefinition<UnoState, UnoAction> = {
  id: 'uno',
  get name() { return m().name; },
  get tagline() { return m().tagline; },
  emoji: '🃏',
  minPlayers: 2,
  maxPlayers: MAX_PLAYERS,
  solo: true,
  multiplayer: true,
  computerPlayers: true,
  get soloTitle() { return m().soloTitle; },
  get soloDescription() { return m().soloDescription; },
  newState: initial,
  onPlayersChanged: syncSeats,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'start': return start(state, action.seed, ctx);
      case 'play': return play(state, action.card, action.color, ctx);
      case 'draw': return draw(state, ctx);
      case 'pass': return pass(state, ctx);
      case 'callUno': return callUno(state, ctx);
      case 'catch': return catchPlayer(state, action.uid, ctx);
      case 'again': return again(state, action.seed, ctx);
      default: throw new GameRuleError(t.rules.unknownMove);
    }
  },
};
