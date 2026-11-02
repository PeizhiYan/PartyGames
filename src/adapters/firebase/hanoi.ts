import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { LEADERBOARD_LIMIT, compareScores, type HanoiScore } from '../../games/hanoi/leaderboard';
import { validateRun } from '../../games/hanoi/rules';
import type { HanoiLeaderboardRepo } from '../../services/types';
import { NotSignedInError } from '../../services/errors';
import { ROOT, type FirebaseContext } from './app';
import { mapError, wrap } from './errors';

export function createHanoiLeaderboard({ auth, db }: FirebaseContext): HanoiLeaderboardRepo {
  const scores = collection(db, ROOT, 'leaderboards', 'hanoi', 'scores');
  return {
    watch(cb, onError) {
      return onSnapshot(query(scores, orderBy('durationMs'), orderBy('moves'), limit(LEADERBOARD_LIMIT)), snap => {
        cb(snap.docs.map(d => {
          const v = d.data();
          return {
            uid: d.id, displayName: v.displayName, durationMs: v.durationMs, moves: v.moves,
            achievedAt: v.achievedAt instanceof Timestamp ? v.achievedAt.toDate() : new Date(0),
          } as HanoiScore;
        }));
      }, e => onError?.(mapError(e)));
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
