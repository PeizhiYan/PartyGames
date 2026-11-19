import { t } from '../../i18n';
import { m } from './messages';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useAuth';
import Icon from '../../ui/Icon';
import Sheet from '../../ui/Sheet';
import Board from './Board';
import Leaderboard from './Leaderboard';
import { formatTime } from './leaderboard';
import { initialState, moveDisk, MIN_MOVES } from './rules';
import { useScore } from './useScore';
import './Hanoi.css';

export default function Solo() {
  const { user } = useCurrentUser();
  const [state, setState] = useState(initialState);
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState(() => m().messages.intro);
  const [restart, setRestart] = useState(false);
  const score = useScore(user.uid);
  const playing = state.startedAt !== null && state.finishedAt === null;
  const solved = state.finishedAt !== null;
  const elapsed = state.startedAt === null ? 0 : Math.max(0, (state.finishedAt ?? now) - state.startedAt);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [playing]);

  function start() {
    const at = Date.now();
    setState({ ...initialState(), startedAt: at });
    setNow(at);
    setSelected(null);
    setMessage(m().messages.started);
    setRestart(false);
  }

  function choosePeg(peg: number) {
    if (!playing) return;
    if (selected === peg) { setSelected(null); setMessage(m().messages.cancelled); return; }
    if (selected === null) {
      if (state.pegs[peg].disks.length === 0) { setMessage(m().messages.empty); return; }
      setSelected(peg);
      setMessage(m().messages.lifted(state.pegs[peg].disks.at(-1)!));
      return;
    }
    try {
      const at = Date.now();
      const next = moveDisk(state, { from: selected, to: peg }, at);
      setState(next);
      setNow(at);
      setSelected(null);
      if (next.finishedAt !== null) {
        setMessage(m().messages.complete);
        score.queue({ moves: next.moves, durationMs: next.finishedAt - next.startedAt! });
      } else setMessage(m().messages.nice);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : m().messages.notAllowed);
    }
  }

  return (
    <div className="room-screen hanoi-screen">
      <header className="room-bar">
        <Link to="/g/hanoi" className="icon-button" aria-label={m().backToLobby}><Icon name="left" /></Link>
        <strong className="grow">{m().name}</strong>
        <span className="badge">{m().badge}</span>
      </header>
      <div className="hanoi-stats">
        <div><span className="muted">{m().time}</span><strong>{formatTime(elapsed)}</strong></div>
        <div><span className="muted">{m().moves}</span><strong>{state.moves.length}</strong></div>
        <div><span className="muted">{m().perfect}</span><strong>{MIN_MOVES}</strong></div>
      </div>
      <Board state={state} selected={selected} onPeg={choosePeg} />
      <p className="hanoi-message" role="status">{message}</p>
      {solved && <section className="card hanoi-result">
        <Icon name="trophy" size={32} />
        <h2>{state.moves.length === MIN_MOVES ? m().perfectSolve : m().messages.complete}</h2>
        <p>{m().solvedBefore}<strong>{formatTime(elapsed)}</strong>{m().solvedMiddle}<strong>{m().solvedMoves(state.moves.length)}</strong>{m().solvedAfter}</p>
      </section>}
      <button type="button" className={`${playing ? '' : 'primary '}block`} onClick={() => playing ? setRestart(true) : start()}>
        {playing ? m().restart : solved ? t.cast.playAgain : m().start}
      </button>
      {(score.pending || score.status === 'saved' || score.status === 'kept') && (
        <div className="hanoi-score-status" role="status">
          {!score.online && score.pending ? m().waitingToSave
            : score.status === 'error' ? <><p className="error">{m().couldNotSave(score.error)}</p><button type="button" onClick={score.retry}>{m().retrySaving}</button></>
            : score.pending ? m().saving
            : score.status === 'saved' ? m().saved : m().kept}
        </div>
      )}
      <section className="card" style={{ marginTop: 16 }}>
        <h3>{m().howToPlay}</h3>
        <p>{m().rules}</p>
        <p className="muted">{m().controls}</p>
        {!score.online && <p className="muted">{m().offline}</p>}
      </section>
      <Leaderboard />
      <Sheet open={restart} title={m().restartTitle} onClose={() => setRestart(false)}>
        <p>{m().restartBody}</p>
        <button type="button" className="primary block" onClick={start}>{m().restart}</button>
      </Sheet>
    </div>
  );
}
