/**
 * The computer's mahjong: tile efficiency, not a search.
 *
 * It keeps tiles that already have partners — a second copy, a neighbour, a near-neighbour — and
 * throws away the loneliest, preferring to let go of tiles everyone else has already discarded
 * (fewer of those can still be waiting to complete someone's hand). It always takes a win,
 * declares kongs, pongs pairs it is not relying on, and chows only when that tidies up its hand.
 *
 * It reads its own hand and public things (melds, discards), the same view a person has.
 */
import { claimOptions, handOf, meldsOf, selfOptions, type Claim, type MahjongAction, type MahjongState } from './rules';
import { countKinds, isHonourKind, isSuitKind, kindOf } from './tiles';

/** How much a tile is worth keeping in this hand: partners score, lone honours do not. */
export function keepScore(tile: number, hand: readonly number[]): number {
  const k = kindOf(tile);
  const c = countKinds(hand);
  let score = (c[k] - 1) * 4;
  if (isSuitKind(k)) {
    const rank = k % 9;
    if (rank > 0 && c[k - 1]) score += 3;
    if (rank < 8 && c[k + 1]) score += 3;
    if (rank > 1 && c[k - 2]) score += 1;
    if (rank < 7 && c[k + 2]) score += 1;
    // Middle tiles have more ways to grow than edge ones.
    if (rank >= 2 && rank <= 6) score += 0.5;
  } else if (c[k] === 1) {
    score -= 1;
  }
  return score;
}

/** The tile to throw away. Ties go to the tile most often seen discarded already. */
export function chooseDiscard(state: MahjongState, uid: string): number {
  const hand = handOf(state, uid);
  const seen = countKinds(Object.values(state.discards).flat());
  let best = hand[0];
  let bestScore = Infinity;
  for (const t of hand) {
    const s = keepScore(t, hand) - seen[kindOf(t)] * 0.2;
    if (s < bestScore) { best = t; bestScore = s; }
  }
  return best;
}

/** Total keep score of a hand, for comparing it before and after a call. */
const shape = (hand: readonly number[]): number => hand.reduce((t, x) => t + keepScore(x, hand), 0) / Math.max(1, hand.length);

/** On its own turn: win if it can, kong if it can, otherwise discard. */
export function chooseTurn(state: MahjongState, uid: string): MahjongAction {
  const own = selfOptions(state, uid);
  if (own.win) return { type: 'declareWin' };
  if (own.kongs.length) return { type: 'declareKong', tile: own.kongs[0] };
  return { type: 'discard', tile: chooseDiscard(state, uid) };
}

/** Its answer to an open claim window. */
export function chooseClaim(state: MahjongState, uid: string): Claim | 'pass' {
  const w = state.claim;
  if (!w) return 'pass';
  const options = claimOptions(state, uid, w.tile, w.by);
  const pick = (kind: Claim['kind']) => options.find((o) => o.kind === kind);
  const winning = pick('win');
  if (winning) return winning;
  const kong = pick('kong');
  if (kong) return kong;
  const hand = handOf(state, uid);
  const k = kindOf(w.tile);
  const pairs = countKinds(hand).filter((n) => n >= 2).length;
  const pong = pick('pong');
  // Pong honours always; a suited pair only if another pair is left to be the hand's pair.
  if (pong && (isHonourKind(k) || pairs >= 2)) return pong;
  for (const chow of options.filter((o): o is Extract<Claim, { kind: 'chow' }> => o.kind === 'chow')) {
    const rest = hand.filter((t) => !chow.tiles.includes(t));
    if (meldsOf(state, uid).length < 3 && shape(rest) >= shape(hand)) return chow;
  }
  return 'pass';
}

/** Names for the three computer seats. */
export const COMPUTER_NAMES = ['Dot', 'Pip', 'Ace'];
