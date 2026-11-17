/**
 * Test helpers for writing hands by name. `b(3)` is a 3 bamboo, `c(5)` a 5 character, `d(9)` a
 * 9 dot; winds `E S W N`, dragons `R G Wh`. Each call hands out the next unused copy of that
 * kind, so `[b(1), b(1), b(1)]` is three different tiles. Call `fresh()` between hands.
 */
const used = new Map<number, number>();
export function fresh(): void { used.clear(); }
export function tile(kind: number): number {
  const n = used.get(kind) ?? 0;
  if (n >= 4) throw new Error(`no fifth tile of kind ${kind}`);
  used.set(kind, n + 1);
  return kind * 4 + n;
}
export const b = (n: number) => tile(n - 1);
export const c = (n: number) => tile(9 + n - 1);
export const d = (n: number) => tile(18 + n - 1);
export const E = () => tile(27);
export const S = () => tile(28);
export const W = () => tile(29);
export const N = () => tile(30);
export const R = () => tile(31);
export const G = () => tile(32);
export const Wh = () => tile(33);
