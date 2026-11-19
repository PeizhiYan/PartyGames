import { t } from '../../i18n';
import { m } from './messages';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '../../hooks/useAuth';
import { useOnline } from '../../hooks/useOnline';
import { backend } from '../../services';
import { errorMessage } from '../../services/errors';
import Icon from '../../ui/Icon';
import { formatTime, type HanoiScore } from './leaderboard';
import './Hanoi.css';

export default function Leaderboard() {
  const { user } = useCurrentUser();
  const online = useOnline();
  const [scores, setScores] = useState<HanoiScore[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setError('');
    setScores(null);
    if (!online) return;
    return backend.hanoiLeaderboard.watch(setScores, e => setError(errorMessage(e)));
  }, [online, user.uid, attempt]);

  return (
    <section className="card hanoi-leaderboard" aria-labelledby="hanoi-leaderboard-title">
      <h3 id="hanoi-leaderboard-title" className="row"><Icon name="trophy" size={18} /> {m().leaderboard}</h3>
      <p className="muted">{m().leaderboardHelp}</p>
      {backend.name === 'memory' && <p className="muted">{m().localScores}</p>}
      {!online ? <p className="empty">{m().connect}</p>
        : error ? <div role="alert"><p className="error">{error}</p><button type="button" onClick={() => setAttempt(n => n + 1)}>{t.common.tryAgain}</button></div>
        : scores === null ? <p className="empty">{m().loadingScores}</p>
        : scores.length === 0 ? <p className="empty">{m().noTimes}</p>
        : <div className="hanoi-table-scroll">
          <table>
            <thead><tr><th scope="col">{m().rank}</th><th scope="col">{m().player}</th><th scope="col">{m().time}</th><th scope="col">{m().moves}</th></tr></thead>
            <tbody>{scores.map((score, i) => (
              <tr key={score.uid} className={score.uid === user.uid ? 'is-you' : undefined}>
                <td>{i + 1}</td>
                <th scope="row"><span className="hanoi-player-name">{score.uid === user.uid ? t.common.you : score.displayName}</span></th>
                <td>{formatTime(score.durationMs)}</td><td>{score.moves}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
    </section>
  );
}
