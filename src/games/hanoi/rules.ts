// Port of Peizhi Yan's js_codes/hanoi_tower/code.js (2023): seven disks, three pegs, finish right.
import { GameRuleError, type GameDefinition } from '../../types';

export const DISKS = 7;
export const MIN_MOVES = 2 ** DISKS - 1;
export const MAX_MOVES = 10_000;
export const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
export interface HanoiMove { from: number; to: number }
export interface HanoiRun { moves: HanoiMove[]; durationMs: number }
export interface HanoiState {
  // Maps around the arrays keep the state compatible with Firestore's no-nested-arrays rule.
  pegs: { disks: number[] }[];
  moves: HanoiMove[];
  startedAt: number | null;
  finishedAt: number | null;
}
export type HanoiAction = { type: 'start' } | { type: 'move'; from: number; to: number };

export const initialState = (): HanoiState => ({
  pegs: [{ disks: [7, 6, 5, 4, 3, 2, 1] }, { disks: [] }, { disks: [] }],
  moves: [], startedAt: null, finishedAt: null,
});

export function moveDisk(state: HanoiState, move: HanoiMove, now: number): HanoiState {
  if (state.startedAt === null) throw new GameRuleError('Press Start to begin.');
  if (state.finishedAt !== null) throw new GameRuleError('Solved! Start a new game to play again.');
  const { from, to } = move;
  if (![from, to].every(p => Number.isInteger(p) && p >= 0 && p < 3) || from === to) {
    throw new GameRuleError('Choose a different peg.');
  }
  const source = state.pegs[from].disks;
  const target = state.pegs[to].disks;
  const disk = source.at(-1);
  if (disk === undefined) throw new GameRuleError('That peg is empty.');
  if (target.length && disk > target[target.length - 1]) {
    throw new GameRuleError('A larger disk cannot go on a smaller one.');
  }
  if (state.moves.length >= MAX_MOVES) throw new GameRuleError('Move limit reached. Start a new game.');
  const pegs = state.pegs.map((peg, i) => ({
    disks: i === from ? source.slice(0, -1) : i === to ? [...target, disk] : peg.disks,
  }));
  return {
    ...state, pegs, moves: [...state.moves, { from, to }],
    finishedAt: pegs[2].disks.length === DISKS ? now : null,
  };
}

/** Replay every move before submitting a result; a partial or illegal solution is never scored.
 * This runs on the client, as do the other games' rules. It is not server-side anti-cheat. */
export function validateRun(run: HanoiRun): { durationMs: number; moves: number } {
  if (!run || !Number.isInteger(run.durationMs) || run.durationMs <= 0 || run.durationMs > MAX_DURATION_MS) {
    throw new GameRuleError('A ranked game must take between 1 millisecond and 24 hours.');
  }
  if (!Array.isArray(run.moves) || run.moves.length < MIN_MOVES || run.moves.length > MAX_MOVES) {
    throw new GameRuleError('Finish all seven disks before saving a result.');
  }
  let state: HanoiState = { ...initialState(), startedAt: 0 };
  for (const move of run.moves) {
    if (!move || typeof move !== 'object') throw new GameRuleError('That result contains an invalid move.');
    state = moveDisk(state, move, run.durationMs);
  }
  if (state.finishedAt === null) throw new GameRuleError('Move the whole tower to the rightmost peg first.');
  return { durationMs: run.durationMs, moves: run.moves.length };
}

export const hanoi: GameDefinition<HanoiState, HanoiAction> = {
  id: 'hanoi', name: 'Hanoi Tower', emoji: '🗼',
  tagline: 'Seven disks, three pegs. Find your rhythm and beat your best time.',
  minPlayers: 1, maxPlayers: 1, solo: true, multiplayer: false,
  soloTitle: 'Play the puzzle', soloDescription: 'Seven disks. One challenge. Your best time on the leaderboard.',
  newState: initialState,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'start': return { ...initialState(), startedAt: ctx.now };
      case 'move': return moveDisk(state, action, ctx.now);
      default: throw new GameRuleError('Unknown move.');
    }
  },
};
