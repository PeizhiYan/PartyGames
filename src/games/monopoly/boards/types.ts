/**
 * What a board is made of.
 *
 * Boards differ in shape, not just in names: each one declares its own ring of spaces, its own
 * colour groups and its own prices. The only structural rule is that a board is a square, so the
 * space count has to be four corners plus an equal run down each side — `spacesPerSide` below.
 */

export type Space =
  | { kind: 'go' }
  | { kind: 'jail' }            // just visiting
  | { kind: 'parking' }
  | { kind: 'gotojail' }
  | { kind: 'chance' }
  | { kind: 'chest' }
  | { kind: 'tax'; name: string; amount: number }
  | { kind: 'property'; name: string; group: string; price: number }
  | { kind: 'rail'; name: string; price: number }
  | { kind: 'utility'; name: string; price: number };

/** A space somebody can own. */
export type OwnableSpace = Extract<Space, { price: number }>;
export const isOwnable = (s: Space): s is OwnableSpace => 'price' in s;

export interface Group {
  /** Shown as the stripe along the top of the space. */
  color: string;
  /** What one house costs on this group. A hotel is the fifth house. */
  houseCost: number;
}

export interface BoardDef {
  id: string;
  name: string;
  /** Prefixed to every amount, e.g. `$`, `C$`, `¥`. */
  currency: string;
  /** Collected for passing the first space. */
  salary: number;
  /** What it costs to buy your way out of jail. */
  jailFine: number;
  groups: Record<string, Group>;
  spaces: Space[];
}

/**
 * Rent for a property, by how many houses are on it: [none, 1, 2, 3, 4, hotel].
 *
 * Derived from the price rather than written out per property — seventy hand-typed tables across
 * four boards would be seventy chances to fat-finger a number. The multipliers are shaped like a
 * real Monopoly table (a monopoly roughly doubles bare rent, the third house is the big jump),
 * but they are balanced for this app, not a reproduction of anyone's published one.
 */
export function rentLadder(price: number): [number, number, number, number, number, number] {
  const base = Math.max(2, Math.round(price / 12));
  return [base, base * 5, base * 15, base * 40, base * 55, base * 70];
}

/** Bare rent doubles when one player holds every property in the group and none are built on. */
export const MONOPOLY_MULTIPLIER = 2;
/** A railway's rent doubles for each one its owner holds beyond the first. */
export const railRent = (price: number, owned: number): number =>
  Math.round(price / 4) * 2 ** Math.max(0, owned - 1);
/** A utility charges the dice roll, by how many its owner holds. */
export const utilityMultiplier = (owned: number): number => (owned >= 2 ? 10 : 4);

export const spacesPerSide = (board: BoardDef): number => (board.spaces.length - 4) / 4;

/** Every board has to be a square with the four corners in the right places. */
export function checkBoard(board: BoardDef): string[] {
  const problems: string[] = [];
  const n = board.spaces.length;
  if ((n - 4) % 4 !== 0) problems.push(`${board.id}: ${n} spaces is not four corners plus equal sides`);
  const per = spacesPerSide(board);
  const corners: [number, Space['kind']][] = [
    [0, 'go'], [per + 1, 'jail'], [2 * (per + 1), 'parking'], [3 * (per + 1), 'gotojail'],
  ];
  for (const [at, kind] of corners) {
    if (board.spaces[at]?.kind !== kind) problems.push(`${board.id}: space ${at} should be ${kind}`);
  }
  for (const space of board.spaces) {
    if (space.kind === 'property' && !board.groups[space.group]) {
      problems.push(`${board.id}: "${space.name}" is in unknown group "${space.group}"`);
    }
    if (isOwnable(space) && space.price <= 0) problems.push(`${board.id}: "${space.name}" costs nothing`);
  }
  return problems;
}
