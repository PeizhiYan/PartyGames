import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import XiangqiBoard from './Board';
import Icon from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import { OpponentCard, TurningCard, useRemembered, type Opponent, type Turning } from '../cast/Opponent';
import { chooseMove, type Difficulty } from './ai';
import { positionOf, seatOf, sideToMove, uidOfSide, xiangqi, type Side } from './rules';
import { COMPUTER_UID, GUEST_UID, localRoster, useLocalGame } from '../local';
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
const SIDE_NAME: Record<Side, string> = { 1: 'Red', 2: 'Black' };

/** Chinese chess on this device: against the engine, or against a friend sharing it. */
export default function XiangqiSoloPage() {
  const [opponent, setOpponent] = useRemembered<Opponent>('partygames:xiangqi:opponent', ['computer', 'friend'], 'computer');
  // Keyed, so changing opponent starts a fresh game rather than carrying a position across.
  return <XiangqiGame key={opponent} opponent={opponent} onOpponent={setOpponent} />;
}

/**
 * The room's own reducer run on this device — no room, no network, works offline. Against the
 * engine your colours swap each game, like a rematch would; between two friends Red stays Red
 * and the tally is kept by colour.
 */
function XiangqiGame({ opponent, onOpponent }: { opponent: Opponent; onOpponent: (o: Opponent) => void }) {
  const { user } = useCurrentUser();
  const vsComputer = opponent === 'computer';
  const [difficulty, setDifficulty] = useRemembered<Difficulty>('partygames:xiangqi:difficulty', ['easy', 'normal', 'hard'], 'normal');
  const [turning, setTurning] = useRemembered<Turning>('partygames:xiangqi:turning', ['turn', 'still'], 'turn');

  const other = vsComputer ? COMPUTER_UID : GUEST_UID;
  const players = useMemo(
    () => localRoster({ uid: user.uid, name: user.displayName, photoURL: user.photoURL },
      [vsComputer ? { kind: 'computer', name: 'The engine' } : { kind: 'person', name: 'Friend' }]),
    [user, vsComputer],
  );
  const { state, act, reset, error, generation } = useLocalGame(xiangqi, players, user.uid);
  const [thinking, setThinking] = useState(false);
  const [score, setScore] = useState({ you: 0, computer: 0, red: 0, black: 0 });

  const mySeat = seatOf(state, user.uid);
  const turn = sideToMove(state.moves);
  const otherSeat = seatOf(state, other);
  const computersTurn = vsComputer && state.outcome === 0 && turn === otherSeat;
  const position = useMemo(() => positionOf(state.moves), [state.moves]);
  const lastMove = state.moves.length ? state.moves[state.moves.length - 1] : null;
  /** Whoever is to move: you, or on a shared device whichever of you has the move. */
  const mover = vsComputer ? user.uid : uidOfSide(state, turn) ?? user.uid;

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

  useEffect(() => {
    if (state.outcome === 0) return;
    setScore((s) => {
      const next = { ...s };
      if (state.outcome === 1) next.red += 1;
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
    : state.outcome !== 0 ? `The engine wins. ${state.reason}`
    : thinking ? 'Thinking…'
    : !vsComputer ? `${position.inCheck() ? 'Check — ' : ''}${SIDE_NAME[turn]} to move`
    : position.inCheck() ? 'Check — your turn'
    : 'Your turn';

  // Between friends the board turns to whoever has the move, unless it is lying flat between them.
  const viewer: Side | null = vsComputer ? mySeat : turning === 'turn' ? turn : 1;

  return (
    <div className="room-screen">
      <header className="room-bar">
        <Link to="/g/xiangqi" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <div className="grow col" style={{ gap: 0 }}>
          <strong>{vsComputer ? 'Chinese Chess vs the engine' : 'Chinese Chess · two players'}</strong>
          <small className="muted tabular">
            {vsComputer
              ? `You ${score.you} — ${score.computer} Engine · you are ${mySeat === 1 ? 'red' : 'black'}`
              : `Red ${score.red} — ${score.black} Black`}
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
          <span className={`xq-side-dot ${turn === 1 ? 'red' : 'black'}`} aria-hidden />
          {status}
        </span>
      </div>

      <XiangqiBoard position={position} viewer={viewer}
        canMove={state.outcome === 0 && !thinking && (vsComputer ? turn === mySeat : true)}
        lastMove={lastMove} onMove={(mv) => act({ type: 'move', mv }, mover)} />

      {error && <p className="error row center" style={{ marginTop: 10 }}>{error}</p>}

      <div style={{ marginTop: 16 }}>
        <OpponentCard value={opponent} onChange={onOpponent} computer="The engine" />
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
