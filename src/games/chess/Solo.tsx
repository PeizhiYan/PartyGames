import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ChessBoard from './Board';
import Icon from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import { chooseMove, type Difficulty } from './ai';
import { boardOf, chess, seatOf, sideToMove } from './rules';
import { COMPUTER_UID, localPlayers, useLocalGame } from '../local';
import { useCurrentUser } from '../../hooks/useAuth';

const DIFFICULTY_LABELS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
];
const DIFFICULTY_HELP: Record<Difficulty, string> = {
  easy: 'One move ahead. It will blunder.',
  normal: 'Four plies ahead, captures to the end.',
  hard: 'Six plies in a couple of seconds. It sees short mates.',
};
const STORED_DIFFICULTY = 'partygames:chess:difficulty';

/**
 * Chess against the computer: the room's own reducer run on this device, with the computer in
 * the other seat. Colours swap each game, like a rematch would.
 */
export default function ChessSoloPage() {
  const { user } = useCurrentUser();
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => (localStorage.getItem(STORED_DIFFICULTY) as Difficulty | null) ?? 'normal',
  );
  useEffect(() => { localStorage.setItem(STORED_DIFFICULTY, difficulty); }, [difficulty]);

  const players = useMemo(
    () => localPlayers({ uid: user.uid, name: user.displayName, photoURL: user.photoURL }, ['The computer']),
    [user],
  );
  const { state, act, reset, error, generation } = useLocalGame(chess, players, user.uid);
  const [thinking, setThinking] = useState(false);
  const [score, setScore] = useState({ you: 0, computer: 0 });

  const mySeat = seatOf(state, user.uid);
  const turn = sideToMove(state.moves);
  const computerSeat = seatOf(state, COMPUTER_UID);
  const computersTurn = state.outcome === 0 && turn === computerSeat;
  const board = useMemo(() => boardOf(state.moves), [state.moves]);
  const lastMove = state.moves.length ? state.moves[state.moves.length - 1] : null;

  useEffect(() => {
    if (!computersTurn) return;
    const mine = generation.current;
    setThinking(true);
    const timer = window.setTimeout(() => {
      const mv = chooseMove(boardOf(state.moves), difficulty);
      if (mine !== generation.current) return;
      setThinking(false);
      if (mv > 0) act({ type: 'move', mv }, COMPUTER_UID);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [computersTurn, state.moves, difficulty, act, generation]);

  useEffect(() => {
    if (state.outcome === 0) return;
    if (state.outcome === mySeat) setScore((s) => ({ ...s, you: s.you + 1 }));
    else if (state.outcome === computerSeat) setScore((s) => ({ ...s, computer: s.computer + 1 }));
  }, [state.outcome, mySeat, computerSeat]);

  function undo() {
    if (thinking || state.outcome !== 0 || state.moves.length === 0) return;
    generation.current += 1;
    setThinking(false);
    if (act({ type: 'requestTakeback' })) act({ type: 'respondTakeback', approve: true }, COMPUTER_UID);
  }

  function again() {
    generation.current += 1;
    setThinking(false);
    if (state.outcome === 0) { reset(); return; }
    act({ type: 'rematch' });
    act({ type: 'rematch' }, COMPUTER_UID);
  }

  const status = state.outcome === 3 ? `Draw. ${state.reason}`
    : state.outcome === mySeat ? `You win! 🎉 ${state.reason}`
    : state.outcome !== 0 ? `The computer wins. ${state.reason}`
    : thinking ? 'Thinking…'
    : board.inCheck() ? 'Check — your turn'
    : 'Your turn';

  return (
    <div className="room-screen">
      <header className="room-bar">
        <Link to="/g/chess" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <div className="grow col" style={{ gap: 0 }}>
          <strong>Chess vs the computer</strong>
          <small className="muted tabular">You {score.you} — {score.computer} Computer · you are {mySeat === 1 ? 'white' : 'black'}</small>
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
          <span className={`chess-side-dot ${turn === 1 ? 'white' : 'black'}`} aria-hidden />
          {status}
        </span>
      </div>

      <ChessBoard board={board} viewer={mySeat} canMove={state.outcome === 0 && !thinking && turn === mySeat}
        lastMove={lastMove} onMove={(mv) => act({ type: 'move', mv })} />

      {error && <p className="error row center" style={{ marginTop: 10 }}>{error}</p>}

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Strength</h3>
        <Segmented label="Strength" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_LABELS} block />
        <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>{DIFFICULTY_HELP[difficulty]}</p>
      </section>

      {state.outcome !== 0 && <button type="button" className="primary block" onClick={again}>Play again</button>}
    </div>
  );
}
