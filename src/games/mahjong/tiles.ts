/**
 * The 136 tiles of Chinese mahjong (no flowers or seasons).
 *
 * A tile is a number 0-135; its *kind* is `Math.floor(tile / 4)`, one of 34, and the four tiles of
 * a kind are interchangeable. The room document stores tile numbers, so two identical faces are
 * still two different tiles — the same trick UNO uses with card ids.
 *
 *   0-8    bamboo 1-9 (条)
 *   9-17   characters 1-9 (万)
 *   18-26  dots 1-9 (筒)
 *   27-30  winds: east, south, west, north
 *   31-33  dragons: red (中), green (發), white (白)
 */

export const TILE_COUNT = 136;
export const KINDS = 34;

export type Suit = 'bamboo' | 'characters' | 'dots';
export const SUITS: Suit[] = ['bamboo', 'characters', 'dots'];

export const kindOf = (tile: number): number => Math.floor(tile / 4);
export const isSuitKind = (kind: number): boolean => kind < 27;
export const isHonourKind = (kind: number): boolean => kind >= 27;
export const isDragonKind = (kind: number): boolean => kind >= 31;
export const suitOfKind = (kind: number): Suit | null => (kind < 27 ? SUITS[Math.floor(kind / 9)] : null);
/** 1-9 for a suited kind, 0 for an honour. */
export const rankOfKind = (kind: number): number => (kind < 27 ? (kind % 9) + 1 : 0);
export const isTerminalOrHonourKind = (kind: number): boolean => kind >= 27 || kind % 9 === 0 || kind % 9 === 8;

/** The thirteen kinds of thirteen orphans: every 1 and 9, every wind and dragon. */
export const ORPHAN_KINDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

/** How many of each kind, as a 34-long array. */
export function countKinds(tiles: readonly number[]): number[] {
  const c = new Array<number>(KINDS).fill(0);
  for (const t of tiles) c[kindOf(t)] += 1;
  return c;
}

/** By kind, then by tile number, so a hand reads left to right by suit. */
export const sortTiles = (tiles: readonly number[]): number[] => [...tiles].sort((a, b) => a - b);

const WINDS = ['East', 'South', 'West', 'North'];
const DRAGONS = ['Red dragon', 'Green dragon', 'White dragon'];

export function kindName(kind: number): string {
  if (kind < 27) return `${rankOfKind(kind)} ${suitOfKind(kind)}`;
  if (kind < 31) return `${WINDS[kind - 27]} wind`;
  return DRAGONS[kind - 31];
}
export const tileName = (tile: number): string => kindName(kindOf(tile));
