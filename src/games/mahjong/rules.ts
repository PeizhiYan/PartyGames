/**
 * Chinese mahjong as a room game: four seats, 136 tiles, simplified Guangdong-style scoring
 * (`./scoring`).
 *
 * Hidden information runs on the trusted-client model (CLAUDE.md, "Everything in a room is
 * public"): `hands` and `wall` are top-level keys, the UI reads only the viewer's own hand and
 * everyone else's `.length`, and nothing else in the state names a tile someone is holding.
 * A hand's newest tile is always last in its array, so "the tile just drawn" needs no field of
 * its own.
 *
 * The turn loop, which the reducer drives as far as it can on its own:
 *   draw (automatic) → the player to move may declare a win or a kong, then discards →
 *   a claim window opens for anyone who could use the tile → when every eligible player has
 *   answered, the best claim wins (win > kong/pong > chow), or the next player draws.
 *
 * Choices made, written down so nobody has to guess:
 * - Chow only from the player on your left (the one before you); pong, kong and win from anyone.
 * - Players with no possible claim on a discard are passed automatically, so a room is not asked
 *   to tap "pass" thirty times a hand. The table can tell that someone is thinking about it.
 * - Two players claiming a win: the first after the discarder takes it.
 * - No robbing a kong; no flowers; no dead-wall subtlety beyond keeping the last 14 tiles back.
 *   When only those are left, the hand is a draw.
 * - The dealer rotates every hand, win or lose.
 * - A player who leaves mid-hand has their claims passed for them, and the host can play their
 *   turn for them (`cover`), which discards the tile they just drew.
 */
import { GameRuleError, type GameContext, type GameDefinition, type RoomPlayer } from '../../types';
import { shuffle } from '../shuffle';
import { isWinningHand, type Meld } from './hand';
import { payments, scoreHand, type FanLine } from './scoring';
import { TILE_COUNT, countKinds, isSuitKind, kindOf, tileName } from './tiles';

export const SEATS = 4;
export const HAND_SIZE = 13;
/** Tiles kept back at the end of the wall. When only these remain, the hand is drawn. */
export const DEAD_WALL = 14;
export const WIND_NAMES = ['East', 'South', 'West', 'North'];

export interface Seat {
  uid: string;
  name: string;
  photoURL?: string;
  score: number;
  absent?: boolean;
}

export type Claim =
  | { kind: 'win' }
  | { kind: 'kong' }
  | { kind: 'pong' }
  | { kind: 'chow'; tiles: number[] };

export interface ClaimWindow {
  tile: number;
  by: string;
  /** uid → their answer; null while they are still deciding. */
  responses: Record<string, Claim | 'pass' | null>;
}

export interface Result {
  winner: string | null;
  /** The discarder who paid, or null for a self-draw or a drawn hand. */
  from: string | null;
  selfDraw: boolean;
  /** The winning hand, shown to everyone once the hand is over. */
  hand: number[];
  melds: Meld[];
  fan: number;
  lines: FanLine[];
  payments: Record<string, number>;
}

export interface MahjongState {
  phase: 'lobby' | 'playing' | 'results';
  seats: Seat[];
  /** PRIVATE. Draw from the end; kong replacements from the front. */
  wall: number[];
  /** uid → concealed tiles, newest last. PRIVATE. */
  hands: Record<string, number[]>;
  melds: Record<string, Meld[]>;
  /** uid → their discards still on the table (a claimed tile leaves its pile). */
  discards: Record<string, number[]>;
  turn: number;
  dealer: number;
  /** 'discard': the player to move holds 14 and must discard (or declare). 'claims': a discard is up for grabs. */
  stage: 'discard' | 'claims';
  /** The player to move got their 14th tile by drawing (so may win by self-draw), not by claiming. */
  justDrew: boolean;
  claim: ClaimWindow | null;
  seed: number;
  handNumber: number;
  result: Result | null;
  last: string;
}

export type MahjongAction =
  | { type: 'start'; seed: number }
  | { type: 'discard'; tile: number }
  | { type: 'declareWin' }
  | { type: 'declareKong'; tile: number }
  | { type: 'claim'; claim: Claim }
  | { type: 'pass' }
  | { type: 'cover' }
  | { type: 'again'; seed: number };

function initial(): MahjongState {
  return {
    phase: 'lobby', seats: [], wall: [], hands: {}, melds: {}, discards: {}, turn: 0, dealer: 0,
    stage: 'discard', justDrew: false, claim: null, seed: 0, handNumber: 0, result: null, last: '',
  };
}

/* ── Readings ─────────────────────────────────────────────────────────────── */

export const handOf = (state: MahjongState, uid: string): number[] => state.hands[uid] ?? [];
export const meldsOf = (state: MahjongState, uid: string): Meld[] => state.melds[uid] ?? [];
export const currentSeat = (state: MahjongState): Seat | undefined => state.seats[state.turn];
export const seatIndex = (state: MahjongState, uid: string): number => state.seats.findIndex((s) => s.uid === uid);
const nameOf = (state: MahjongState, uid: string): string => state.seats.find((s) => s.uid === uid)?.name.split(' ')[0] ?? 'Someone';
/** The seat after `i` in turn order (anticlockwise at a real table; here simply the next index). */
const after = (i: number): number => (i + 1) % SEATS;
/** A seat's wind this hand: the dealer is East. */
export const windOf = (state: MahjongState, i: number): string => WIND_NAMES[(i - state.dealer + SEATS) % SEATS];

/** What `uid` could claim on `tile`, discarded by `by`. */
export function claimOptions(state: MahjongState, uid: string, tile: number, by: string): Claim[] {
  if (uid === by) return [];
  const hand = handOf(state, uid);
  const melds = meldsOf(state, uid);
  const k = kindOf(tile);
  const c = countKinds(hand);
  const out: Claim[] = [];
  if (isWinningHand([...hand, tile], melds)) out.push({ kind: 'win' });
  if (c[k] >= 3 && state.wall.length > DEAD_WALL) out.push({ kind: 'kong' });
  if (c[k] >= 2) out.push({ kind: 'pong' });
  // Chow: only the next player after the discarder, and only in a suit.
  if (seatIndex(state, uid) === after(seatIndex(state, by)) && isSuitKind(k)) {
    const rank = k % 9;
    for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
      if (rank + a < 0 || rank + b > 8) continue;
      const ta = hand.find((t) => kindOf(t) === k + a);
      const tb = hand.find((t) => kindOf(t) === k + b);
      if (ta !== undefined && tb !== undefined) out.push({ kind: 'chow', tiles: [ta, tb] });
    }
  }
  return out;
}

/** The claims still to be answered by this viewer, or [] if none. */
export function myClaimOptions(state: MahjongState, uid: string): Claim[] {
  const w = state.claim;
  if (state.phase !== 'playing' || state.stage !== 'claims' || !w || w.responses[uid] !== null) return [];
  return claimOptions(state, uid, w.tile, w.by);
}

/** What the player to move may declare instead of (before) discarding. */
export function selfOptions(state: MahjongState, uid: string): { win: boolean; kongs: number[] } {
  if (state.phase !== 'playing' || state.stage !== 'discard' || currentSeat(state)?.uid !== uid) return { win: false, kongs: [] };
  const hand = handOf(state, uid);
  const melds = meldsOf(state, uid);
  const win = state.justDrew && isWinningHand(hand, melds);
  const kongs: number[] = [];
  if (state.wall.length > DEAD_WALL) {
    const c = countKinds(hand);
    const seen = new Set<number>();
    for (const t of hand) {
      const k = kindOf(t);
      if (seen.has(k)) continue;
      seen.add(k);
      const addsToPong = melds.some((m) => m.kind === 'pong' && kindOf(m.tiles[0]) === k);
      if (c[k] === 4 || addsToPong) kongs.push(t);
    }
  }
  return { win, kongs };
}

/* ── The loop ─────────────────────────────────────────────────────────────── */

/** Ends the hand with nobody winning. */
function drawnHand(state: MahjongState): MahjongState {
  return {
    ...state, phase: 'results', claim: null,
    result: { winner: null, from: null, selfDraw: false, hand: [], melds: [], fan: 0, lines: [], payments: {} },
    last: 'The wall is down to its last tiles — this hand is a draw.',
  };
}

/** Seat `i` draws (from the end, or the front for a kong replacement) and must then discard. */
function drawFor(state: MahjongState, i: number, replacement = false): MahjongState {
  if (state.wall.length <= DEAD_WALL) return drawnHand(state);
  const wall = state.wall.slice();
  const tile = replacement ? wall.shift()! : wall.pop()!;
  const uid = state.seats[i].uid;
  return {
    ...state, wall, turn: i, stage: 'discard', justDrew: true, claim: null,
    hands: { ...state.hands, [uid]: [...handOf(state, uid), tile] },
  };
}

function win(state: MahjongState, winner: string, from: string | null, tile: number | null): MahjongState {
  const hand = tile === null ? handOf(state, winner) : [...handOf(state, winner), tile];
  const melds = meldsOf(state, winner);
  const selfDraw = from === null;
  const { fan, lines } = scoreHand(hand, melds, selfDraw);
  const paid = payments(state.seats.map((s) => s.uid), winner, from, state.seats[state.dealer].uid, fan);
  return {
    ...state,
    phase: 'results',
    claim: null,
    hands: { ...state.hands, [winner]: hand },
    discards: from && tile !== null ? { ...state.discards, [from]: (state.discards[from] ?? []).filter((t) => t !== tile) } : state.discards,
    seats: state.seats.map((s) => ({ ...s, score: s.score + (paid[s.uid] ?? 0) })),
    result: { winner, from, selfDraw, hand, melds, fan, lines, payments: paid },
    last: selfDraw
      ? `${nameOf(state, winner)} draws the winning tile — ${fan} fan.`
      : `${nameOf(state, winner)} wins on ${nameOf(state, from!)}'s ${tileName(tile!)} — ${fan} fan.`,
  };
}

/** Opens a claim window on a discard, or — if nobody can use it — lets the next player draw. */
function afterDiscard(state: MahjongState, by: string, tile: number): MahjongState {
  const responses: Record<string, Claim | 'pass' | null> = {};
  for (const s of state.seats) {
    if (s.uid === by) continue;
    responses[s.uid] = !s.absent && claimOptions(state, s.uid, tile, by).length > 0 ? null : 'pass';
  }
  const opened: MahjongState = { ...state, stage: 'claims', justDrew: false, claim: { tile, by, responses } };
  return Object.values(responses).every((r) => r !== null) ? resolve(opened) : opened;
}

/** Everyone has answered: the best claim takes the tile, or the next player draws. */
function resolve(state: MahjongState): MahjongState {
  const w = state.claim!;
  const byIndex = seatIndex(state, w.by);
  // Claimants in turn order after the discarder, so the nearest wins a tie.
  const order = [1, 2, 3].map((d) => state.seats[(byIndex + d) % SEATS].uid);
  const answered = (kind: Claim['kind']) => order.find((u) => {
    const r = w.responses[u];
    return r !== null && r !== 'pass' && r.kind === kind;
  });

  const winner = answered('win');
  if (winner) return win(state, winner, w.by, w.tile);

  const taker = answered('kong') ?? answered('pong') ?? answered('chow');
  if (!taker) return drawFor({ ...state, claim: null }, after(byIndex));

  // A win was handled above, so what is left is a set-making call.
  const claim = w.responses[taker] as Exclude<Claim, { kind: 'win' }>;
  const hand = handOf(state, taker);
  const k = kindOf(w.tile);
  let used: number[];
  if (claim.kind === 'chow') used = claim.tiles;
  else used = hand.filter((t) => kindOf(t) === k).slice(0, claim.kind === 'kong' ? 3 : 2);
  const meld: Meld = { kind: claim.kind, tiles: [...used, w.tile].sort((a, b) => a - b), from: w.by };
  const next: MahjongState = {
    ...state,
    claim: null,
    hands: { ...state.hands, [taker]: hand.filter((t) => !used.includes(t)) },
    melds: { ...state.melds, [taker]: [...meldsOf(state, taker), meld] },
    discards: { ...state.discards, [w.by]: (state.discards[w.by] ?? []).filter((t) => t !== w.tile) },
    turn: seatIndex(state, taker),
    stage: 'discard',
    justDrew: false,
    last: `${nameOf(state, taker)} calls ${claim.kind} on ${tileName(w.tile)}.`,
  };
  // A kong takes a replacement tile before discarding.
  return claim.kind === 'kong' ? drawFor(next, next.turn, true) : next;
}

/* ── Seats ────────────────────────────────────────────────────────────────── */

function syncSeats(state: MahjongState, ctx: GameContext): MahjongState {
  const present = new Map(ctx.players.map((p: RoomPlayer) => [p.uid, p]));
  if (state.phase !== 'lobby') {
    const seats = state.seats.map((s) => ({ ...s, absent: !present.has(s.uid) }));
    if (seats.every((s, i) => !!s.absent === !!state.seats[i].absent)) return state;
    let next: MahjongState = { ...state, seats };
    // Anyone who left has their open claim passed for them.
    if (next.stage === 'claims' && next.claim) {
      const responses = { ...next.claim.responses };
      for (const s of seats) if (s.absent && responses[s.uid] === null) responses[s.uid] = 'pass';
      next = { ...next, claim: { ...next.claim, responses } };
      if (Object.values(responses).every((r) => r !== null)) next = resolve(next);
    }
    return next;
  }
  const kept = state.seats.filter((s) => present.has(s.uid))
    .map((s) => ({ ...s, absent: false, name: present.get(s.uid)!.name, photoURL: present.get(s.uid)!.photoURL }));
  const known = new Set(kept.map((s) => s.uid));
  const added: Seat[] = ctx.players.filter((p) => !known.has(p.uid)).map((p) => ({ uid: p.uid, name: p.name, photoURL: p.photoURL, score: 0 }));
  if (added.length === 0 && kept.length === state.seats.length) return state;
  return { ...state, seats: [...kept, ...added].slice(0, SEATS) };
}

/* ── Actions ──────────────────────────────────────────────────────────────── */

function requireOwner(ctx: GameContext): void {
  if (ctx.actorUid !== ctx.ownerUid) throw new GameRuleError('Only the host can do that.');
}

function requireToMove(state: MahjongState, uid: string): void {
  if (state.phase !== 'playing') throw new GameRuleError('The hand is not under way.');
  if (state.stage !== 'discard') throw new GameRuleError('Wait for the discard to be claimed or passed.');
  if (currentSeat(state)?.uid !== uid) throw new GameRuleError("It's not your turn.");
}

function deal(state: MahjongState, seed: number, dealer: number, handNumber: number): MahjongState {
  const value = Math.floor(Number(seed));
  const s = Number.isFinite(value) ? Math.abs(value) : 1;
  const wall = shuffle(Array.from({ length: TILE_COUNT }, (_, i) => i), s);
  const hands: Record<string, number[]> = {};
  const melds: Record<string, Meld[]> = {};
  const discards: Record<string, number[]> = {};
  for (const seat of state.seats) { hands[seat.uid] = []; melds[seat.uid] = []; discards[seat.uid] = []; }
  for (let k = 0; k < HAND_SIZE; k += 1) {
    for (let i = 0; i < SEATS; i += 1) hands[state.seats[(dealer + i) % SEATS].uid].push(wall.pop()!);
  }
  const dealt: MahjongState = {
    ...state, phase: 'playing', seats: state.seats.map((x) => ({ ...x, absent: false })),
    wall, hands, melds, discards, dealer, handNumber, seed: s, result: null, claim: null,
    last: `${nameOf(state, state.seats[dealer].uid)} is East and starts.`,
  };
  // The dealer starts by drawing a fourteenth tile.
  return drawFor(dealt, dealer);
}

function start(state: MahjongState, seed: number, ctx: GameContext): MahjongState {
  requireOwner(ctx);
  if (state.phase !== 'lobby') throw new GameRuleError('The game has already started.');
  if (state.seats.length !== SEATS) throw new GameRuleError('Mahjong needs exactly four players.');
  return deal(state, seed, 0, 0);
}

function discard(state: MahjongState, tile: number, uid: string): MahjongState {
  requireToMove(state, uid);
  const hand = handOf(state, uid);
  if (!hand.includes(tile)) throw new GameRuleError('That tile is not in your hand.');
  const next: MahjongState = {
    ...state,
    hands: { ...state.hands, [uid]: hand.filter((t) => t !== tile) },
    discards: { ...state.discards, [uid]: [...(state.discards[uid] ?? []), tile] },
    last: `${nameOf(state, uid)} discards ${tileName(tile)}.`,
  };
  return afterDiscard(next, uid, tile);
}

function declareWin(state: MahjongState, uid: string): MahjongState {
  requireToMove(state, uid);
  if (!selfOptions(state, uid).win) throw new GameRuleError('That is not a winning hand yet.');
  return win(state, uid, null, null);
}

function declareKong(state: MahjongState, tile: number, uid: string): MahjongState {
  requireToMove(state, uid);
  if (!selfOptions(state, uid).kongs.some((t) => kindOf(t) === kindOf(tile))) throw new GameRuleError('You cannot make a kong with that.');
  const k = kindOf(tile);
  const hand = handOf(state, uid);
  const melds = meldsOf(state, uid);
  const pongAt = melds.findIndex((m) => m.kind === 'pong' && kindOf(m.tiles[0]) === k);
  let next: MahjongState;
  if (pongAt >= 0) {
    // Adding the fourth tile to a pong already on the table.
    const added = hand.find((t) => kindOf(t) === k)!;
    const upgraded = melds.map((m, i) => (i === pongAt ? { ...m, kind: 'kong' as const, tiles: [...m.tiles, added].sort((a, b) => a - b) } : m));
    next = { ...state, hands: { ...state.hands, [uid]: hand.filter((t) => t !== added) }, melds: { ...state.melds, [uid]: upgraded } };
  } else {
    const four = hand.filter((t) => kindOf(t) === k);
    next = {
      ...state,
      hands: { ...state.hands, [uid]: hand.filter((t) => kindOf(t) !== k) },
      melds: { ...state.melds, [uid]: [...melds, { kind: 'kong', tiles: four, concealed: true }] },
    };
  }
  return drawFor({ ...next, last: `${nameOf(state, uid)} declares a kong of ${tileName(tile)}.` }, state.turn, true);
}

function respond(state: MahjongState, answer: Claim | 'pass', uid: string): MahjongState {
  if (state.phase !== 'playing' || state.stage !== 'claims' || !state.claim) throw new GameRuleError('There is nothing to claim.');
  if (state.claim.responses[uid] !== null) throw new GameRuleError('You have already answered.');
  if (answer !== 'pass') {
    const options = claimOptions(state, uid, state.claim.tile, state.claim.by);
    const ok = options.some((o) => o.kind === answer.kind
      && (o.kind !== 'chow' || (answer.kind === 'chow' && Array.isArray(answer.tiles)
        && answer.tiles.length === 2 && answer.tiles.every((t) => handOf(state, uid).includes(t))
        && [...answer.tiles, state.claim!.tile].map(kindOf).sort((a, b) => a - b).every((v, i, a) => i === 0 || v === a[i - 1] + 1))));
    if (!ok) throw new GameRuleError('You cannot claim that tile that way.');
  }
  const next: MahjongState = { ...state, claim: { ...state.claim, responses: { ...state.claim.responses, [uid]: answer } } };
  return Object.values(next.claim!.responses).every((r) => r !== null) ? resolve(next) : next;
}

/** The host plays the turn of a player who has left: they discard the tile they just drew. */
function cover(state: MahjongState, ctx: GameContext): MahjongState {
  requireOwner(ctx);
  const seat = currentSeat(state);
  if (state.phase !== 'playing' || state.stage !== 'discard' || !seat?.absent) throw new GameRuleError('There is no turn to cover.');
  const hand = handOf(state, seat.uid);
  return discard(state, hand[hand.length - 1], seat.uid);
}

function again(state: MahjongState, seed: number, ctx: GameContext): MahjongState {
  requireOwner(ctx);
  if (state.phase !== 'results') throw new GameRuleError('Finish this hand first.');
  const resynced = syncSeats({ ...state, phase: 'lobby' }, ctx);
  if (resynced.seats.length !== SEATS) return { ...resynced, phase: 'lobby', result: null };
  return deal(resynced, seed, (state.dealer + 1) % SEATS, state.handNumber + 1);
}

export const ranking = (state: MahjongState): Seat[] => [...state.seats].sort((a, b) => b.score - a.score);

export const mahjong: GameDefinition<MahjongState, MahjongAction> = {
  id: 'mahjong',
  name: 'Mahjong',
  tagline: '麻将. Four players, Guangdong-style scoring. Play friends, or three computers.',
  emoji: '🀄',
  minPlayers: 4,
  maxPlayers: SEATS,
  solo: true,
  multiplayer: true,
  soloTitle: 'Play three computers',
  soloDescription: 'No room needed. You and three computer players.',
  newState: initial,
  onPlayersChanged: syncSeats,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'start': return start(state, action.seed, ctx);
      case 'discard': return discard(state, action.tile, ctx.actorUid);
      case 'declareWin': return declareWin(state, ctx.actorUid);
      case 'declareKong': return declareKong(state, action.tile, ctx.actorUid);
      case 'claim': return respond(state, action.claim, ctx.actorUid);
      case 'pass': return respond(state, 'pass', ctx.actorUid);
      case 'cover': return cover(state, ctx);
      case 'again': return again(state, action.seed, ctx);
      default: throw new GameRuleError('Unknown move.');
    }
  },
};
