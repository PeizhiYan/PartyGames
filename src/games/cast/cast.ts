/**
 * Who sits at the table: every seat gets a character, so a game reads as people around a table
 * rather than a list of names.
 *
 * Computer players are a fixed cast with fixed looks — Dot is always the robot — so a player
 * learns who they are up against. People get a character picked from their uid, so the same
 * person looks the same in every game and on every device, with no setting to store.
 */
import { COMPUTER_UID } from '../../rooms/computers';

export const SPECIES = ['cat', 'bear', 'bunny', 'robot', 'frog', 'fox', 'panda', 'owl'] as const;
export type Species = (typeof SPECIES)[number];

export type Expression = 'idle' | 'thinking' | 'happy' | 'sad' | 'surprised';

/** The computer players, in the order seats are filled. */
export const COMPUTER_CAST: { name: string; species: Species }[] = [
  { name: 'Dot', species: 'robot' },
  { name: 'Pip', species: 'frog' },
  { name: 'Ace', species: 'fox' },
  { name: 'Bea', species: 'bunny' },
  { name: 'Mo', species: 'panda' },
  { name: 'Ollie', species: 'owl' },
  { name: 'Kit', species: 'cat' },
  { name: 'Bo', species: 'bear' },
  { name: 'Zed', species: 'robot' },
];

/** Names for `n` computer players, for `localPlayers()`. */
export const computerNames = (n: number): string[] => COMPUTER_CAST.slice(0, n).map((c) => c.name);

/** The index of a computer seat from its uid (`computer` is 0, `computer-2` is 1, …), or -1. */
export function computerIndex(uid: string): number {
  if (uid === COMPUTER_UID) return 0;
  const m = /^computer-(\d+)$/.exec(uid);
  return m ? Number(m[1]) - 1 : -1;
}

/** A computer player's name, from its uid. */
export function computerName(uid: string): string {
  const i = computerIndex(uid);
  return i >= 0 ? COMPUTER_CAST[i % COMPUTER_CAST.length].name : 'Computer';
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** This uid's character. Stable: the same uid always gets the same one. */
export function speciesFor(uid: string): Species {
  const i = computerIndex(uid);
  if (i >= 0) return COMPUTER_CAST[i % COMPUTER_CAST.length].species;
  return SPECIES[hash(uid) % SPECIES.length];
}

/**
 * Characters for everyone at one table, with no two alike while there are characters to go round.
 * Computers keep their fixed looks; each person gets their usual character unless it is already
 * taken at this table, in which case the next free one. (Picking by uid alone put a person and a
 * computer, both frogs, side by side.)
 */
export function assignSpecies(uids: readonly string[]): Record<string, Species> {
  const out: Record<string, Species> = {};
  const taken = new Set<Species>();
  for (const uid of uids) {
    if (computerIndex(uid) >= 0) { out[uid] = speciesFor(uid); taken.add(out[uid]); }
  }
  for (const uid of uids) {
    if (out[uid]) continue;
    const start = hash(uid) % SPECIES.length;
    let pick = SPECIES[start];
    for (let k = 0; k < SPECIES.length; k += 1) {
      const candidate = SPECIES[(start + k) % SPECIES.length];
      if (!taken.has(candidate)) { pick = candidate; break; }
    }
    out[uid] = pick;
    taken.add(pick);
  }
  return out;
}

/** A per-uid number in [0, 1), for small differences like when someone blinks. */
export const jitter = (uid: string): number => (hash(`${uid}:j`) % 1000) / 1000;
