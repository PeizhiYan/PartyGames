import { describe, expect, it } from 'vitest';
import { completedRun, solution } from '../../../tests/helpers/hanoi';
import { initialState, moveDisk, validateRun, MAX_DURATION_MS, type HanoiState } from './rules';
import { compareScores, formatTime } from './leaderboard';

describe('the seven-disk Hanoi challenge', () => {
  it('starts with the whole tower on the left and refuses moves before Start', () => {
    const state = initialState();
    expect(state.pegs.map(p => p.disks)).toEqual([[7, 6, 5, 4, 3, 2, 1], [], []]);
    expect(() => moveDisk(state, { from: 0, to: 2 }, 0)).toThrow(/start/i);
  });
  it('moves only the top disk without mutating the old position', () => {
    const before = { ...initialState(), startedAt: 100 };
    const after = moveDisk(before, { from: 0, to: 2 }, 200);
    expect(before.pegs[0].disks).toHaveLength(7);
    expect(after.pegs[2].disks).toEqual([1]);
    expect(after.moves).toEqual([{ from: 0, to: 2 }]);
  });
  it('rejects a larger disk, an empty peg, and invalid or same-peg moves', () => {
    const state = moveDisk({ ...initialState(), startedAt: 0 }, { from: 0, to: 2 }, 1);
    expect(() => moveDisk(state, { from: 0, to: 2 }, 2)).toThrow(/larger/);
    expect(() => moveDisk(state, { from: 1, to: 0 }, 2)).toThrow(/empty/);
    for (const move of [{ from: 0, to: 0 }, { from: -1, to: 2 }, { from: 0, to: 3 }, { from: .5, to: 1 }]) {
      expect(() => moveDisk(state, move, 2)).toThrow();
    }
    expect(state.moves).toHaveLength(1);
  });
  it('finishes in exactly 127 legal moves and freezes the completion time', () => {
    let state: HanoiState = { ...initialState(), startedAt: 1000 };
    for (const [i, move] of solution().entries()) state = moveDisk(state, move, 1000 + (i + 1) * 1000);
    expect(state.pegs[2].disks).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(state.moves).toHaveLength(127);
    expect(state.finishedAt).toBe(128_000);
    expect(() => moveDisk(state, { from: 2, to: 0 }, 129_000)).toThrow(/solved/i);
  });
  it('does not count a tower on the middle peg as a win', () => {
    let state: HanoiState = { ...initialState(), startedAt: 0 };
    for (const move of solution(7, 0, 1, 2)) state = moveDisk(state, move, 1000);
    expect(state.finishedAt).toBeNull();
    expect(() => validateRun({ durationMs: 1000, moves: state.moves })).toThrow(/rightmost/);
  });
  it('replays a completed run and accepts a non-optimal legal solution', () => {
    expect(validateRun(completedRun())).toEqual({ durationMs: 180_000, moves: 127 });
    expect(validateRun(completedRun(200_000, true))).toEqual({ durationMs: 200_000, moves: 129 });
  });
  it('rejects partial, illegal and post-completion replays', () => {
    const run = completedRun();
    expect(() => validateRun({ ...run, moves: run.moves.slice(0, -1) })).toThrow();
    expect(() => validateRun({ ...run, moves: [{ from: 1, to: 2 }, ...run.moves] })).toThrow();
    expect(() => validateRun({ ...run, moves: [...run.moves, { from: 2, to: 0 }] })).toThrow();
  });
  it('rejects invalid ranked durations', () => {
    for (const durationMs of [0, -1, NaN, Infinity, .5, MAX_DURATION_MS + 1]) {
      expect(() => validateRun(completedRun(durationMs))).toThrow();
    }
  });
  it('ranks time first, moves second, and preserves an exact tie', () => {
    const a = { durationMs: 1000, moves: 129 };
    expect(compareScores(a, { durationMs: 1001, moves: 127 })).toBeLessThan(0);
    expect(compareScores(a, { durationMs: 1000, moves: 127 })).toBeGreaterThan(0);
    expect(compareScores(a, a)).toBe(0);
    expect(formatTime(61_007)).toBe('1:01.007');
  });
});
