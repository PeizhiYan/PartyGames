/**
 * The engine as an opponent. Thin: the search in `./engine` is the original's, and all this does
 * is give it a time budget per difficulty and hand it the current move list.
 *
 * Runs on the main thread, like Gomoku's — the screen hands the browser a frame to paint
 * "thinking…" before calling in. Hard genuinely takes its time.
 */
import { Position, Search, STARTUP_FEN } from './engine';

export type Difficulty = 'easy' | 'normal' | 'hard';

/** Depth cap, time budget, and transposition-table size (as a power of two) per level. */
const LEVELS: Record<Difficulty, { depth: number; millis: number; hash: number }> = {
  easy: { depth: 2, millis: 100, hash: 12 },
  normal: { depth: 10, millis: 500, hash: 15 },
  hard: { depth: 10, millis: 2500, hash: 16 },
};

/** The move the engine would play now, or 0 if the side to move has none. */
export function chooseMove(moves: number[], difficulty: Difficulty): number {
  const pos = Position.fromFen(STARTUP_FEN);
  for (const mv of moves) pos.makeMove(mv);
  const level = LEVELS[difficulty];
  return new Search(pos, level.hash).searchMain(level.depth, level.millis);
}
