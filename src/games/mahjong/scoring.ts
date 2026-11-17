/**
 * Scoring, simplified Guangdong-style. One table, in one place, with a test for every line.
 *
 * Fan (番) for a winning hand:
 *   Win (any standard hand)          1
 *   Seven pairs (instead of Win)     2
 *   Thirteen orphans (the whole hand) 8, nothing added
 *   Self-drawn                      +1
 *   All pongs                       +1   standard hands with no chow anywhere
 *   Half flush                      +1   one suit plus honours
 *   Full flush                      +3   one suit, no honours
 *   All honours                     +3   winds and dragons only
 *   Each dragon pong or kong        +1
 *   Each kong                       +1
 * capped at 8.
 *
 * Points are 2^fan. On a self-draw each other player pays that; on a discard the discarder pays
 * for the whole table (three shares). Any payment to or from the dealer is doubled.
 */
import { concealedAllPongs, isSevenPairs, isThirteenOrphans, type Meld } from './hand';
import { countKinds, isDragonKind, isHonourKind, kindOf, suitOfKind } from './tiles';

export const MAX_FAN = 8;

export interface FanLine { label: string; fan: number }

export function scoreHand(concealed: readonly number[], melds: readonly Meld[], selfDraw: boolean): { fan: number; lines: FanLine[] } {
  if (isThirteenOrphans(concealed, melds)) return { fan: 8, lines: [{ label: 'Thirteen orphans', fan: 8 }] };

  const lines: FanLine[] = [];
  const sevenPairs = isSevenPairs(concealed, melds);
  lines.push(sevenPairs ? { label: 'Seven pairs', fan: 2 } : { label: 'Win', fan: 1 });
  if (selfDraw) lines.push({ label: 'Self-drawn', fan: 1 });

  if (!sevenPairs && melds.every((m) => m.kind !== 'chow') && concealedAllPongs(concealed)) {
    lines.push({ label: 'All pongs', fan: 1 });
  }

  const allTiles = [...concealed, ...melds.flatMap((m) => m.tiles)];
  const suits = new Set(allTiles.map((t) => suitOfKind(kindOf(t))).filter((s) => s !== null));
  const honours = allTiles.some((t) => isHonourKind(kindOf(t)));
  if (suits.size === 0) lines.push({ label: 'All honours', fan: 3 });
  else if (suits.size === 1 && !honours) lines.push({ label: 'Full flush', fan: 3 });
  else if (suits.size === 1 && honours) lines.push({ label: 'Half flush', fan: 1 });

  // Dragon sets: laid down as a pong or kong, or three of a kind held concealed (an honour cannot
  // be part of a chow, so three in hand can only be a pong).
  const counts = countKinds(concealed);
  const dragonSets = melds.filter((m) => m.kind !== 'chow' && isDragonKind(kindOf(m.tiles[0]))).length
    + (sevenPairs ? 0 : [31, 32, 33].filter((k) => counts[k] >= 3).length);
  for (let i = 0; i < dragonSets; i += 1) lines.push({ label: 'Dragon pong', fan: 1 });

  for (const m of melds) if (m.kind === 'kong') lines.push({ label: m.concealed ? 'Concealed kong' : 'Kong', fan: 1 });

  const fan = Math.min(MAX_FAN, lines.reduce((t, l) => t + l.fan, 0));
  return { fan, lines };
}

/**
 * Who pays whom. `seats` are uids in seat order; returns uid → change in score (the winner's
 * entry is positive, everyone who paid is negative, the rest absent).
 */
export function payments(
  seats: readonly string[], winner: string, discarder: string | null, dealer: string, fan: number,
): Record<string, number> {
  const base = 2 ** fan;
  const share = (payer: string) => base * (payer === dealer || winner === dealer ? 2 : 1);
  const out: Record<string, number> = {};
  const others = seats.filter((u) => u !== winner);
  if (discarder === null) {
    for (const u of others) out[u] = -share(u);
  } else {
    // The discarder covers the whole table — three shares — doubled only if the dealer is the
    // discarder or the winner, not because the dealer happens to be sitting elsewhere.
    out[discarder] = -3 * share(discarder);
  }
  out[winner] = -Object.values(out).reduce((t, v) => t + v, 0);
  return out;
}
