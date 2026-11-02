export interface HanoiScore {
  uid: string;
  displayName: string;
  durationMs: number;
  moves: number;
  achievedAt: Date;
}

export const LEADERBOARD_LIMIT = 50;
export function compareScores(a: Pick<HanoiScore, 'durationMs' | 'moves'>, b: Pick<HanoiScore, 'durationMs' | 'moves'>): number {
  return a.durationMs - b.durationMs || a.moves - b.moves;
}

/** Always show milliseconds: two ranked times should not look tied just because of rounding. */
export function formatTime(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${String(Math.max(0, ms) % 1000).padStart(3, '0')}`;
}
