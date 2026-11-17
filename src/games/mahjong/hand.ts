/**
 * Whether a set of tiles is a winning hand, and how to read it.
 *
 * A standard hand is four sets plus a pair, where a set is a pong (three of a kind) or a chow
 * (three in a row of one suit). Melds already laid down count as sets, so the concealed part has
 * to supply the rest. Two special hands need all fourteen tiles concealed: seven pairs, and
 * thirteen orphans.
 */
import { KINDS, ORPHAN_KINDS, countKinds } from './tiles';

export type MeldKind = 'chow' | 'pong' | 'kong';
export interface Meld {
  kind: MeldKind;
  tiles: number[];
  /** A kong made from four tiles in your own hand. */
  concealed?: boolean;
  /** Who discarded the tile that made it, if anyone. */
  from?: string;
}

/**
 * Whether `c` (kind counts) splits into exactly `need` sets. The lowest kind present has to start
 * either a pong or a chow, so trying those two is complete — no other branch is ever needed.
 * Mutates and restores `c`.
 */
function sets(c: number[], need: number): boolean {
  const i = c.findIndex((x) => x > 0);
  if (i < 0) return need === 0;
  if (need === 0) return false;
  if (c[i] >= 3) {
    c[i] -= 3;
    const ok = sets(c, need - 1);
    c[i] += 3;
    if (ok) return true;
  }
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i] -= 1; c[i + 1] -= 1; c[i + 2] -= 1;
    const ok = sets(c, need - 1);
    c[i] += 1; c[i + 1] += 1; c[i + 2] += 1;
    if (ok) return true;
  }
  return false;
}

/** Four sets and a pair, counting `melds` as sets already made. */
export function isStandardWin(concealed: readonly number[], melds: readonly Meld[] = []): boolean {
  const need = 4 - melds.length;
  if (need < 0 || concealed.length !== need * 3 + 2) return false;
  const c = countKinds(concealed);
  for (let k = 0; k < KINDS; k += 1) {
    if (c[k] < 2) continue;
    c[k] -= 2;
    const ok = sets(c, need);
    c[k] += 2;
    if (ok) return true;
  }
  return false;
}

/** Seven different pairs, all concealed. */
export function isSevenPairs(concealed: readonly number[], melds: readonly Meld[] = []): boolean {
  if (melds.length || concealed.length !== 14) return false;
  const c = countKinds(concealed);
  return c.filter((n) => n === 2).length === 7;
}

/** One each of every terminal and honour, plus one more of any of them. All concealed. */
export function isThirteenOrphans(concealed: readonly number[], melds: readonly Meld[] = []): boolean {
  if (melds.length || concealed.length !== 14) return false;
  const c = countKinds(concealed);
  if (c.some((n, k) => n > 0 && !ORPHAN_KINDS.includes(k))) return false;
  return ORPHAN_KINDS.every((k) => c[k] >= 1) && ORPHAN_KINDS.some((k) => c[k] === 2);
}

export const isWinningHand = (concealed: readonly number[], melds: readonly Meld[] = []): boolean =>
  isStandardWin(concealed, melds) || isSevenPairs(concealed, melds) || isThirteenOrphans(concealed, melds);

/**
 * Whether the concealed part can be read with no chows at all — a pair plus pongs only. Used for
 * the all-pongs bonus. Kind counts must be 0, 2 (the one pair) or 3.
 */
export function concealedAllPongs(concealed: readonly number[]): boolean {
  const c = countKinds(concealed);
  return c.every((n) => n === 0 || n === 2 || n === 3) && c.filter((n) => n === 2).length === 1;
}
