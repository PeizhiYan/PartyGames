import type { HanoiMove, HanoiRun } from '../../src/games/hanoi/rules';

export function solution(n = 7, from = 0, to = 2, spare = 1): HanoiMove[] {
  if (n === 0) return [];
  return [...solution(n - 1, from, spare, to), { from, to }, ...solution(n - 1, spare, to, from)];
}
export const completedRun = (durationMs = 180_000, detour = false): HanoiRun => ({
  durationMs,
  moves: [...(detour ? [{ from: 0, to: 1 }, { from: 1, to: 0 }] : []), ...solution()],
});
