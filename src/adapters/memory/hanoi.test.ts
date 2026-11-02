import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completedRun } from '../../../tests/helpers/hanoi';
import type { HanoiScore } from '../../games/hanoi/leaderboard';

function storage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: k => { data.delete(k); }, clear: () => data.clear(),
  };
}
vi.stubGlobal('localStorage', storage());
vi.stubGlobal('sessionStorage', storage());
import { createMemoryBackend } from './index';

const stops: (() => void)[] = [];
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { stops.splice(0).forEach(stop => stop()); });

describe('Hanoi leaderboard adapter', () => {
  it('keeps one best per identity, broadcasts updates and preserves a better previous time', async () => {
    const first = createMemoryBackend();
    await first.auth.signInWithGoogle();
    sessionStorage.clear();
    const second = createMemoryBackend();
    await second.auth.signInWithGoogle();
    let scores: HanoiScore[] = [];
    stops.push(second.hanoiLeaderboard.watch(s => { scores = s; }));
    expect(await first.hanoiLeaderboard.submit(completedRun(200_000))).toBe('saved');
    expect(await second.hanoiLeaderboard.submit(completedRun(180_000, true))).toBe('saved');
    expect(scores.map(s => s.uid)).toEqual(['player2', 'admin']);
    expect(await first.hanoiLeaderboard.submit(completedRun(220_000))).toBe('kept');
    expect(await first.hanoiLeaderboard.submit(completedRun(180_000))).toBe('saved');
    expect(scores.map(s => s.uid)).toEqual(['admin', 'player2']);
    expect(scores).toHaveLength(2);
    const date = scores[0].achievedAt;
    expect(await first.hanoiLeaderboard.submit(completedRun(180_000))).toBe('kept');
    expect(scores[0].achievedAt).toEqual(date);
    const reloaded = createMemoryBackend();
    await reloaded.auth.signInWithGoogle();
    let persisted: HanoiScore[] = [];
    stops.push(reloaded.hanoiLeaderboard.watch(s => { persisted = s; }));
    expect(persisted).toEqual(scores);
  });
  it('rejects signed-out, incomplete and disabled submissions and refuses Hanoi rooms', async () => {
    const host = createMemoryBackend();
    await expect(host.hanoiLeaderboard.submit(completedRun())).rejects.toThrow(/signed in/);
    await host.auth.signInWithGoogle();
    await expect(host.hanoiLeaderboard.submit({ durationMs: 5000, moves: [] })).rejects.toThrow(/finish/i);
    await expect(host.rooms.create('hanoi', 'Puzzle')).rejects.toThrow(/solo/);
    sessionStorage.clear();
    const guest = createMemoryBackend();
    await guest.auth.signInWithGoogle();
    await guest.account.recordVisit({ installed: false });
    await host.admin.removeAccount('player2', 'player2@example.com');
    await expect(guest.hanoiLeaderboard.submit(completedRun())).rejects.toThrow(/permission/);
  });
});
