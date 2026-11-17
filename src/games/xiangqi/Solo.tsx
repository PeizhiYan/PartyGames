import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import XiangqiBoard from './Board';
import Icon from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import { chooseMove, type Difficulty } from './ai';
import { positionOf, seatOf, sideToMove, xiangqi } from './rules';
import { COMPUTER_UID, localPlayers, useLocalGame } from '../local';
import { useCurrentUser } from '../../hooks/useAuth';

const DIFFICULTY_LABELS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
];
const DIFFICULTY_HELP: Record<Difficulty, string> = {
  easy: 'Two plies deep and quick about it.',
  normal: 'Half a second of search per move.',
  hard: 'Two and a half seconds per move. The original site\'s strength.',
};
const STORED_DIFFICULTY = 'partygames:xiangqi:difficulty';

/**
 * Chinese chess against the engine. The room's own reducer, run on this device with the computer
 * in the black seat — no room, no network, works offline.
 */
export default function XiangqiSoloPage() {
  const { user } = useCurrentUser();
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => (localStorage.getItem(STORED_DIFFICULTY) as Difficulty | null) ?? 'normal',
  );
  useEffect(() => { localStorage.setItem(STORED_DIFFICULTY, difficulty); }, [difficulty]);

  const players = useMemo(
    () => localPlayers({ uid: user.uid, name: user.displayName, photoURL: user.photoURL }, ['The engine']),
    [user],
  );
  const { state, act, reset, error, generation } = useLocalGame(xiangqi, players, user.uid);
  const [thinking, setThinking] = useState(false);
  const [score, setScore] = useState({ you: 0, computer: 0 });

  const mySeat = seatOf(state, user.uid);
  const turn = sideToMove(state.moves);
  const computerSeat = seatOf(state, COMPUTER_UID);
  const computersTurn = state.outcome === 0 && turn === computerSeat;
  const position = useMemo(() => positionOf(state.moves), [state.moves]);
  const lastMove = state.moves.length ? state.moves[state.moves.length - 1] : null;

  // The engine replies whenever it is its move. A deep search blocks the main thread, so the
  // browser gets a frame to paint "thinking…" first; a reply from before a reset is dropped.
  useEffect(() => {
    if (!computersTurn) return;
    const mine = generation.current;
    setThinking(true);
    const timer = window.setTimeout(() => {
      const mv = chooseMove(state.moves, difficulty);
      if (mine !== generation.current) return;
      setThinking(false);
      if (mv > 0) act({ type: 'move', mv }, COMPUTER_UID);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [computersTurn, state.moves, difficulty, act, generation]);

  // Keep the tally once a game ends.
  useEffect(() => {
    if (state.outcome === 0) return;
    if (state.outcome === mySeat) setScore((s) => ({ ...s, you: s.you + 1 }));
    else if (state.outcome === computerSeat) setScore((s) => ({ ...s, computer: s.computer + 1 }));
  }, [state.outcome, mySeat, computerSeat]);

  /** Takes back your move and the engine's reply: asked for as you, approved as the engine. */
  function undo() {
    if (thinking || state.outcome !== 0 || state.moves.length === 0) return;
    generation.current += 1;
    setThinking(false);
    if (act({ type: 'requestTakeback' })) act({ type: 'respondTakeback', approve: true }, COMPUTER_UID);
  }

  /** A new game: both seats vote, which is what starts the next round and swaps the colours. */
  function again() {
    generation.current += 1;
    setThinking(false);
    if (state.outcome === 0) { reset(); return; }
    act({ type: 'rematch' });
    act({ type: 'rematch' }, COMPUTER_UID);
  }

  const status = state.outcome === 3 ? `Draw. ${state.reason}`
    : state.outcome === mySeat ? `You win! 🎉 ${state.reason}`
    : state.outcome !== 0 ? `The engine wins. ${state.reason}`
    : thinking ? 'Thinking…'
    : position.inCheck() ? 'Check — your turn'
    : 'Your turn';

  return (
    <div className="room-screen">
      <header className="room-bar">
        <Link to="/g/xiangqi" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <div className="grow col" style={{ gap: 0 }}>
          <strong>Chinese Chess vs the engine</strong>
          <small className="muted tabular">You {score.you} — {score.computer} Engine · you are {mySeat === 1 ? 'red' : 'black'}</small>
        </div>
        <button type="button" className="icon-button" aria-label="Undo your last move"
          disabled={thinking || state.outcome !== 0 || state.moves.length === 0} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button type="button" className="icon-button" aria-label="Start over" onClick={again}>
          <Icon name="plus" />
        </button>
      </header>

      <div className="row center" style={{ marginBottom: 10 }}>
        <span className="turn-pill">
          <span className={`xq-side-dot ${turn === 1 ? 'red' : 'black'}`} aria-hidden />
          {status}
        </span>
      </div>

      <XiangqiBoard
        position={position}
        viewer={mySeat}
        canMove={state.outcome === 0 && !thinking && turn === mySeat}
        lastMove={lastMove}
        onMove={(mv) => act({ type: 'move', mv })}
      />

      {error && <p className="error row center" style={{ marginTop: 10 }}>{error}</p>}

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Strength</h3>
        <Segmented label="Strength" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_LABELS} block />
        <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>{DIFFICULTY_HELP[difficulty]}</p>
      </section>

      {state.outcome !== 0 && (
        <button type="button" className="primary block" onClick={again}>Play again</button>
      )}
    </div>
  );
}
