/**
 * Seeded shuffling for card and tile games.
 *
 * A reducer may not call `Math.random()`, so a deal is a pure function of a seed that arrives on
 * the `start` action (`newSeed()`, called on the device). Same seed, same deal — which is also
 * what makes a deal testable.
 */

/** mulberry32: a small, fast, well-mixed PRNG. Not for anything secret. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A Fisher-Yates shuffle driven by `seed`. Returns a new array. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A fresh seed, for the device to send on a `start` action. Never call this in a reducer. */
export const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
