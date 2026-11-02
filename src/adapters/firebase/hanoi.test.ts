import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteApp, FirebaseError, initializeApp } from 'firebase/app';
import { getFirestore, Timestamp, type Query, type QuerySnapshot } from 'firebase/firestore';
import { createHanoiLeaderboard } from './hanoi';
import type { FirebaseContext } from './app';
import { PermissionDeniedError } from '../../services/errors';

// The emulator does not reproduce the production index-building error. Inject that error into
// the real adapter's snapshot listener and verify its recovery, ranking, and unsubscribe behavior.
const { onSnapshot } = vi.hoisted(() => ({ onSnapshot: vi.fn() }));
vi.mock('firebase/firestore', async importOriginal => ({
  ...await importOriginal<typeof import('firebase/firestore')>(), onSnapshot,
}));
const app = initializeApp({ projectId: 'demo-hanoi-index-test' }, 'hanoi-index-test');
const db = getFirestore(app);
const repo = createHanoiLeaderboard({ db } as FirebaseContext);
const subscriptions: { source: Query; next: (snap: QuerySnapshot) => void; error: (e: FirebaseError) => void; stop: ReturnType<typeof vi.fn> }[] = [];
beforeEach(() => {
  subscriptions.length = 0;
  onSnapshot.mockReset().mockImplementation((source, next, error) => {
    const stop = vi.fn();
    subscriptions.push({ source, next, error, stop });
    return stop;
  });
});
afterAll(() => deleteApp(app));
const indexError = () => new FirebaseError('failed-precondition', 'The query requires an index. That index is currently building. https://console.firebase.google.com/long-console-link');
function snapshot(rows: { uid: string; durationMs: number; moves: number }[]): QuerySnapshot {
  return { docs: rows.map(row => ({ id: row.uid, data: () => ({
    ...row, displayName: row.uid, achievedAt: Timestamp.fromMillis(1000),
  }) })) } as unknown as QuerySnapshot;
}

describe('Hanoi leaderboard index recovery', () => {
  it('uses just the indexed query when it is available', () => {
    const receive = vi.fn();
    const stop = repo.watch(receive);
    subscriptions[0].next(snapshot([{ uid: 'a', durationMs: 1000, moves: 127 }]));
    expect(subscriptions).toHaveLength(1);
    expect(receive.mock.calls[0][0][0]).toMatchObject({ uid: 'a', achievedAt: new Date(1000) });
    stop();
    expect(subscriptions[0].stop).toHaveBeenCalledOnce();
  });
  it('falls back while an index builds and ranks all records before taking the top 50', () => {
    const receive = vi.fn();
    const error = vi.fn();
    const stop = repo.watch(receive, error);
    subscriptions[0].error(indexError());
    expect(subscriptions).toHaveLength(2);
    expect(subscriptions[1].source.type).toBe('collection');
    const rows = Array.from({ length: 55 }, (_, i) => ({ uid: `a${i}`, durationMs: 2000 + i, moves: 127 }));
    // These late document IDs must still win, with moves breaking the time tie.
    rows.push({ uid: 'z-slower', durationMs: 1000, moves: 129 }, { uid: 'z-fastest', durationMs: 1000, moves: 127 });
    subscriptions[1].next(snapshot(rows));
    const ranked = receive.mock.calls[0][0];
    expect(ranked).toHaveLength(50);
    expect(ranked.slice(0, 3).map((r: { uid: string }) => r.uid)).toEqual(['z-fastest', 'z-slower', 'a0']);
    expect(ranked[49].uid).toBe('a47');
    expect(error).not.toHaveBeenCalled();
    subscriptions[1].next(snapshot([]));
    expect(receive).toHaveBeenLastCalledWith([]);
    stop();
    expect(subscriptions.every(s => s.stop.mock.calls.length === 1)).toBe(true);
    subscriptions[1].next(snapshot(rows));
    expect(receive).toHaveBeenCalledTimes(2);
  });
  it('does not fall back around permission errors', () => {
    const error = vi.fn();
    const stop = repo.watch(vi.fn(), error);
    subscriptions[0].error(new FirebaseError('permission-denied', 'Missing permissions'));
    expect(subscriptions).toHaveLength(1);
    expect(error.mock.calls[0][0]).toBeInstanceOf(PermissionDeniedError);
    stop();
  });
  it('shows a short message if fallback also fails, without a retry loop or console URL', () => {
    const error = vi.fn();
    const stop = repo.watch(vi.fn(), error);
    subscriptions[0].error(indexError());
    subscriptions[1].error(indexError());
    expect(subscriptions).toHaveLength(2);
    expect(error.mock.calls[0][0].message).toBe('The leaderboard could not load. Please try again.');
    stop();
  });
  it('ignores late errors after leaving the page and retries the indexed query next visit', () => {
    const error = vi.fn();
    const stop = repo.watch(vi.fn(), error);
    stop();
    subscriptions[0].error(indexError());
    expect(subscriptions).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    const stopAgain = repo.watch(vi.fn());
    expect(subscriptions[1].source.type).toBe('query');
    stopAgain();
  });
});
