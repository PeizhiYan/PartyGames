import { t } from '../../i18n';
import { m } from './messages';
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
  if (state.startedAt === null) throw new GameRuleError(m().errors.pressStart);
  if (state.finishedAt !== null) throw new GameRuleError(m().errors.solved);
  const { from, to } = move;
  if (![from, to].every(p => Number.isInteger(p) && p >= 0 && p < 3) || from === to) {
    throw new GameRuleError(m().errors.differentPeg);
  }
  const source = state.pegs[from].disks;
  const target = state.pegs[to].disks;
  const disk = source.at(-1);
  if (disk === undefined) throw new GameRuleError(m().errors.emptyPeg);
  if (target.length && disk > target[target.length - 1]) {
    throw new GameRuleError(m().errors.larger);
  }
  if (state.moves.length >= MAX_MOVES) throw new GameRuleError(m().errors.limit);
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
    throw new GameRuleError(m().errors.duration);
  }
  if (!Array.isArray(run.moves) || run.moves.length < MIN_MOVES || run.moves.length > MAX_MOVES) {
    throw new GameRuleError(m().errors.finishAll);
  }
  let state: HanoiState = { ...initialState(), startedAt: 0 };
  for (const move of run.moves) {
    if (!move || typeof move !== 'object') throw new GameRuleError(m().errors.invalidMove);
    state = moveDisk(state, move, run.durationMs);
  }
  if (state.finishedAt === null) throw new GameRuleError(m().errors.rightmost);
  return { durationMs: run.durationMs, moves: run.moves.length };
}

export const hanoi: GameDefinition<HanoiState, HanoiAction> = {
  id: 'hanoi', get name() { return m().name; }, emoji: '🗼',
  get tagline() { return m().tagline; },
  minPlayers: 1, maxPlayers: 1, solo: true, multiplayer: false,
  get soloTitle() { return m().soloTitle; },
  get soloDescription() { return m().soloDescription; },
  newState: initialState,
  reduce(state, action, ctx) {
    switch (action.type) {
      case 'start': return { ...initialState(), startedAt: ctx.now };
      case 'move': return moveDisk(state, action, ctx.now);
      default: throw new GameRuleError(t.rules.unknownMove);
    }
  },
};
