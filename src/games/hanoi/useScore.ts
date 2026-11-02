import { useEffect, useState } from 'react';
import { useOnline } from '../../hooks/useOnline';
import { backend } from '../../services';
import { errorMessage } from '../../services/errors';
import { compareScores } from './leaderboard';
import { validateRun, type HanoiRun } from './rules';

const keyFor = (uid: string) => `partygames:hanoi:pending:${uid}`;
function loadPending(uid: string): HanoiRun | null {
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(uid)) ?? 'null') as HanoiRun | null;
    if (saved) validateRun(saved);
    return saved;
  } catch { return null; }
}
function persist(uid: string, run: HanoiRun) {
  try { localStorage.setItem(keyFor(uid), JSON.stringify(run)); } catch { /* current tab can still submit */ }
}

/** A completed offline game survives reloads and new games. Retries are idempotent at the backend. */
export function useScore(uid: string) {
  const online = useOnline();
  const [pending, setPending] = useState(() => loadPending(uid));
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'kept' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!online || !pending) return;
    let active = true;
    setStatus('saving');
    setError('');
    backend.hanoiLeaderboard.submit(pending).then(result => {
      if (!active) return;
      // Another tab may have queued a newer best while this request was in flight.
      const stored = loadPending(uid);
      if (stored && compareScores(validateRun(stored), validateRun(pending)) < 0) {
        setPending(stored);
        return;
      }
      try { localStorage.removeItem(keyFor(uid)); } catch { /* storage unavailable */ }
      setPending(null);
      setStatus(result);
    }, e => {
      if (active) { setStatus('error'); setError(errorMessage(e)); }
    });
    return () => { active = false; };
  }, [pending, online, uid, attempt]);

  function queue(run: HanoiRun) {
    const result = validateRun(run);
    const previous = loadPending(uid) ?? pending;
    const best = previous && compareScores(validateRun(previous), result) <= 0 ? previous : run;
    persist(uid, best);
    setPending(best);
    setAttempt(n => n + 1);
  }

  return { queue, pending, status, error, online, retry: () => setAttempt(n => n + 1) };
}
