import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, type Query } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { LEADERBOARD_LIMIT, compareScores, type HanoiScore } from '../../games/hanoi/leaderboard';
import { validateRun } from '../../games/hanoi/rules';
import type { HanoiLeaderboardRepo } from '../../services/types';
import { BackendError, NotSignedInError } from '../../services/errors';
import { ROOT, type FirebaseContext } from './app';
import { mapError, wrap } from './errors';

export function createHanoiLeaderboard({ auth, db }: FirebaseContext): HanoiLeaderboardRepo {
  const scores = collection(db, ROOT, 'leaderboards', 'hanoi', 'scores');
  return {
    watch(cb, onError) {
      let active = true;
      const stops: (() => void)[] = [];
      const listen = (source: Query, canFallBack: boolean) => {
        stops.push(onSnapshot(source, snap => {
          if (!active) return;
          const ranked = snap.docs.map(d => {
            const v = d.data();
            return {
              uid: d.id, displayName: v.displayName, durationMs: v.durationMs, moves: v.moves,
              achievedAt: v.achievedAt instanceof Timestamp ? v.achievedAt.toDate() : new Date(0),
            } as HanoiScore;
          });
          // Sort before limiting, including ties at rank 50. A document-ID-limited fallback
          // would silently exclude faster players whose IDs happen to sort later.
          ranked.sort((a, b) => compareScores(a, b) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
          cb(ranked.slice(0, LEADERBOARD_LIMIT));
        }, e => {
          if (!active) return;
          if (canFallBack && e.code === 'failed-precondition' && /index/i.test(e.message)) {
            // Composite indexes build asynchronously after deploy. A failed listener never
            // resumes, so use the collection itself for this visit (one best per player).
            // The next subscription tries the efficient indexed query again.
            listen(scores, false);
            return;
          }
          onError?.(e instanceof FirebaseError && e.code === 'permission-denied'
            ? mapError(e)
            : new BackendError('The leaderboard could not load. Please try again.', e));
        }));
      };
      listen(query(scores, orderBy('durationMs'), orderBy('moves'), limit(LEADERBOARD_LIMIT)), true);
      return () => { active = false; stops.forEach(stop => stop()); };
    },
    submit: run => wrap(async () => {
      const user = auth.currentUser;
      if (!user) throw new NotSignedInError();
      const result = validateRun(run);
      const ref = doc(scores, user.uid);
      return runTransaction(db, async tx => {
        const previous = await tx.get(ref);
        if (previous.exists() && compareScores(result, previous.data() as HanoiScore) >= 0) return 'kept' as const;
        tx.set(ref, {
          uid: user.uid, displayName: user.displayName?.trim().slice(0, 100) || 'Player',
          ...result, achievedAt: serverTimestamp(),
        });
        return 'saved' as const;
      });
    }),
  };
}
