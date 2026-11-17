import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ChessBoard from './Board';
import Icon from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import { OpponentCard, TurningCard, useRemembered, type Opponent, type Turning } from '../cast/Opponent';
import { chooseMove, type Difficulty } from './ai';
import { boardOf, chess, seatOf, sideToMove, uidOfSide, type Side } from './rules';
import { COMPUTER_UID, GUEST_UID, localRoster, useLocalGame } from '../local';
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
const SIDE_NAME: Record<Side, string> = { 1: 'White', 2: 'Black' };

/** Chess on this device: against the computer, or against a friend sharing it. */
export default function ChessSoloPage() {
  const [opponent, setOpponent] = useRemembered<Opponent>('partygames:chess:opponent', ['computer', 'friend'], 'computer');
  // Keyed, so changing opponent starts a fresh game rather than carrying a position across.
  return <ChessGame key={opponent} opponent={opponent} onOpponent={setOpponent} />;
}

/**
 * The room's own reducer run on this device. Against the computer your colours swap each game,
 * like a rematch would; between two friends White stays White and the tally is kept by colour.
 */
function ChessGame({ opponent, onOpponent }: { opponent: Opponent; onOpponent: (o: Opponent) => void }) {
  const { user } = useCurrentUser();
  const vsComputer = opponent === 'computer';
  const [difficulty, setDifficulty] = useRemembered<Difficulty>('partygames:chess:difficulty', ['easy', 'normal', 'hard'], 'normal');
  const [turning, setTurning] = useRemembered<Turning>('partygames:chess:turning', ['turn', 'still'], 'turn');

  const other = vsComputer ? COMPUTER_UID : GUEST_UID;
  const players = useMemo(
    () => localRoster({ uid: user.uid, name: user.displayName, photoURL: user.photoURL },
      [vsComputer ? { kind: 'computer', name: 'The computer' } : { kind: 'person', name: 'Friend' }]),
    [user, vsComputer],
  );
  const { state, act, reset, error, generation } = useLocalGame(chess, players, user.uid);
  const [thinking, setThinking] = useState(false);
  const [score, setScore] = useState({ you: 0, computer: 0, white: 0, black: 0 });

  const mySeat = seatOf(state, user.uid);
  const turn = sideToMove(state.moves);
  const otherSeat = seatOf(state, other);
  const computersTurn = vsComputer && state.outcome === 0 && turn === otherSeat;
  const board = useMemo(() => boardOf(state.moves), [state.moves]);
  const lastMove = state.moves.length ? state.moves[state.moves.length - 1] : null;
  /** Whoever is to move: you, or on a shared device whichever of you has the move. */
  const mover = vsComputer ? user.uid : uidOfSide(state, turn) ?? user.uid;

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
    setScore((s) => {
      const next = { ...s };
      if (state.outcome === 1) next.white += 1;
      if (state.outcome === 2) next.black += 1;
      if (state.outcome === mySeat) next.you += 1;
      else if (state.outcome === otherSeat) next.computer += 1;
      return next;
    });
  }, [state.outcome, mySeat, otherSeat]);

  /** Against the computer: your move and its reply. Between friends: the last move, whoever made it. */
  function undo() {
    if (thinking || state.outcome !== 0 || state.moves.length === 0) return;
    generation.current += 1;
    setThinking(false);
    if (vsComputer) {
      if (act({ type: 'requestTakeback' })) act({ type: 'respondTakeback', approve: true }, COMPUTER_UID);
      return;
    }
    const lastMover = uidOfSide(state, turn === 1 ? 2 : 1);
    if (lastMover && act({ type: 'requestTakeback' }, lastMover)) act({ type: 'respondTakeback', approve: true }, mover);
  }

  function again() {
    generation.current += 1;
    setThinking(false);
    if (state.outcome === 0 || !vsComputer) { reset(); return; }
    act({ type: 'rematch' });
    act({ type: 'rematch' }, COMPUTER_UID);
  }

  const status = state.outcome === 3 ? `Draw. ${state.reason}`
    : !vsComputer && state.outcome !== 0 ? `${SIDE_NAME[state.outcome]} wins! 🎉 ${state.reason}`
    : state.outcome === mySeat ? `You win! 🎉 ${state.reason}`
    : state.outcome !== 0 ? `The computer wins. ${state.reason}`
    : thinking ? 'Thinking…'
    : !vsComputer ? `${board.inCheck() ? 'Check — ' : ''}${SIDE_NAME[turn]} to move`
    : board.inCheck() ? 'Check — your turn'
    : 'Your turn';

  // Between friends the board turns to whoever has the move, unless it is lying flat between them.
  const viewer: Side | null = vsComputer ? mySeat : turning === 'turn' ? turn : 1;

  return (
    <div className="room-screen">
      <header className="room-bar">
        <Link to="/g/chess" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <div className="grow col" style={{ gap: 0 }}>
          <strong>{vsComputer ? 'Chess vs the computer' : 'Chess · two players'}</strong>
          <small className="muted tabular">
            {vsComputer
              ? `You ${score.you} — ${score.computer} Computer · you are ${mySeat === 1 ? 'white' : 'black'}`
              : `White ${score.white} — ${score.black} Black`}
          </small>
        </div>
        <button type="button" className="icon-button" aria-label={vsComputer ? 'Undo your last move' : 'Undo the last move'}
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

      <ChessBoard board={board} viewer={viewer}
        canMove={state.outcome === 0 && !thinking && (vsComputer ? turn === mySeat : true)}
        lastMove={lastMove} onMove={(mv) => act({ type: 'move', mv }, mover)} />

      {error && <p className="error row center" style={{ marginTop: 10 }}>{error}</p>}

      <div style={{ marginTop: 16 }}>
        <OpponentCard value={opponent} onChange={onOpponent} />
      </div>
      {vsComputer ? (
        <section className="card">
          <h3>Strength</h3>
          <Segmented label="Strength" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_LABELS} block />
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>{DIFFICULTY_HELP[difficulty]}</p>
        </section>
      ) : <TurningCard value={turning} onChange={setTurning} />}

      {state.outcome !== 0 && <button type="button" className="primary block" onClick={again}>Play again</button>}
    </div>
  );
}
