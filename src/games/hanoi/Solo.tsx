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
  const [message, setMessage] = useState('Move all seven disks to the rightmost peg.');
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
    setMessage('Pick a peg to lift its top disk, then pick a destination.');
    setRestart(false);
  }

  function choosePeg(peg: number) {
    if (!playing) return;
    if (selected === peg) { setSelected(null); setMessage('Selection cancelled. Pick a peg.'); return; }
    if (selected === null) {
      if (state.pegs[peg].disks.length === 0) { setMessage('That peg is empty. Pick one with a disk.'); return; }
      setSelected(peg);
      setMessage(`Disk ${state.pegs[peg].disks.at(-1)} lifted. Choose its destination, or tap the same peg to cancel.`);
      return;
    }
    try {
      const at = Date.now();
      const next = moveDisk(state, { from: selected, to: peg }, at);
      setState(next);
      setNow(at);
      setSelected(null);
      if (next.finishedAt !== null) {
        setMessage('Tower complete!');
        score.queue({ moves: next.moves, durationMs: next.finishedAt - next.startedAt! });
      } else setMessage('Nice move. Pick the next disk.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'That move is not allowed.');
    }
  }

  return (
    <div className="room-screen hanoi-screen">
      <header className="room-bar">
        <Link to="/g/hanoi" className="icon-button" aria-label="Back to Hanoi lobby"><Icon name="left" /></Link>
        <strong className="grow">Hanoi Tower</strong>
        <span className="badge">Solo · 7 disks</span>
      </header>
      <div className="hanoi-stats">
        <div><span className="muted">Time</span><strong>{formatTime(elapsed)}</strong></div>
        <div><span className="muted">Moves</span><strong>{state.moves.length}</strong></div>
        <div><span className="muted">Perfect solve</span><strong>{MIN_MOVES}</strong></div>
      </div>
      <Board state={state} selected={selected} onPeg={choosePeg} />
      <p className="hanoi-message" role="status">{message}</p>
      {solved && <section className="card hanoi-result">
        <Icon name="trophy" size={32} />
        <h2>{state.moves.length === MIN_MOVES ? 'A perfect solve!' : 'Tower complete!'}</h2>
        <p>Seven disks in <strong>{formatTime(elapsed)}</strong>, using <strong>{state.moves.length} moves</strong>.</p>
      </section>}
      <button type="button" className={`${playing ? '' : 'primary '}block`} onClick={() => playing ? setRestart(true) : start()}>
        {playing ? 'Restart' : solved ? 'Play again' : 'Start'}
      </button>
      {(score.pending || score.status === 'saved' || score.status === 'kept') && (
        <div className="hanoi-score-status" role="status">
          {!score.online && score.pending ? 'Your completed result is waiting to save. Reconnect and open this game to sync it.'
            : score.status === 'error' ? <><p className="error">Could not save your result: {score.error}</p><button type="button" onClick={score.retry}>Retry saving</button></>
            : score.pending ? 'Saving your best result…'
            : score.status === 'saved' ? 'Your personal best is saved to the leaderboard.' : 'Result checked. Your earlier personal best still stands.'}
        </div>
      )}
      <section className="card" style={{ marginTop: 16 }}>
        <h3>How to play</h3>
        <p>Move one disk at a time. Only the top disk can move, and a larger disk cannot sit on a smaller one. Finish on the rightmost peg.</p>
        <p className="muted">Tap a peg, then its destination. Keyboard: Tab to a peg and press Enter or Space. The clock starts when you press Start and keeps running while you are away.</p>
        {!score.online && <p className="muted">You’re offline. The puzzle still works; completed results can sync when you reconnect.</p>}
      </section>
      <Leaderboard />
      <Sheet open={restart} title="Restart this game?" onClose={() => setRestart(false)}>
        <p>Your current moves and time will reset. Any completed result waiting to save is kept.</p>
        <button type="button" className="primary block" onClick={start}>Restart</button>
      </Sheet>
    </div>
  );
}
