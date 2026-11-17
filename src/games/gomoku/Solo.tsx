import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GomokuBoard from './BoardCanvas';
import Icon from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import { OpponentCard, useRemembered, type Opponent } from '../cast/Opponent';
import { chooseMove, heatMap, type Difficulty } from './ai';
import { emptyBoard, fiveThrough, isFull, type Board } from './board';

const DIFFICULTY_LABELS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
];
const DIFFICULTY_HELP: Record<Difficulty, string> = {
  easy: 'One move ahead, and it will let things slide.',
  normal: 'Looks two moves ahead, including your reply.',
  hard: 'Looks four moves ahead. Takes a moment to think.',
};
/** Against the computer you are black and move first, as in the original game. */
const YOU = 1;
const COMPUTER = 2;
const STONE: Record<1 | 2, string> = { 1: 'Black', 2: 'White' };

interface Position {
  board: Board;
  /** Cells in play order, so Undo can take back a pair of moves. */
  moves: number[];
  outcome: 0 | 1 | 2 | 3;
  winLine: number[];
}

const start = (): Position => ({ board: emptyBoard(), moves: [], outcome: 0, winLine: [] });

function play(position: Position, cell: number, player: 1 | 2): Position {
  const board = position.board.slice();
  board[cell] = player;
  const five = fiveThrough(board, cell, player);
  return {
    board,
    moves: [...position.moves, cell],
    outcome: five ? player : isFull(board) ? 3 : 0,
    winLine: five ?? [],
  };
}

/** Whose stone goes down next: black on even moves. */
const toMove = (position: Position): 1 | 2 => (position.moves.length % 2 === 0 ? 1 : 2);

/** Gomoku on this device: against the computer, or a friend sharing it. */
export default function GomokuSoloPage() {
  const [opponent, setOpponent] = useRemembered<Opponent>('partygames:gomoku:opponent', ['computer', 'friend'], 'computer');
  // Keyed, so changing opponent starts a fresh game.
  return <GomokuGame key={opponent} opponent={opponent} onOpponent={setOpponent} />;
}

/** No room, no network: everything happens on this device. */
function GomokuGame({ opponent, onOpponent }: { opponent: Opponent; onOpponent: (o: Opponent) => void }) {
  const vsComputer = opponent === 'computer';
  const [difficulty, setDifficulty] = useRemembered<Difficulty>('partygames:gomoku:difficulty', ['easy', 'normal', 'hard'], 'normal');
  const [position, setPosition] = useState<Position>(start);
  const [thinking, setThinking] = useState(false);
  const [insight, setInsight] = useState(false);
  const [score, setScore] = useState({ you: 0, computer: 0 });
  // Bumped on restart/undo so a reply that is already on its way is thrown away.
  const generation = useRef(0);

  const reset = useCallback(() => {
    generation.current++;
    setThinking(false);
    setPosition(start());
  }, []);

  // `you` and `computer` count black's and white's wins between friends, who swap nothing.
  const finish = useCallback((next: Position) => {
    if (next.outcome === YOU) setScore((s) => ({ ...s, you: s.you + 1 }));
    if (next.outcome === COMPUTER) setScore((s) => ({ ...s, computer: s.computer + 1 }));
  }, []);

  function place(cell: number) {
    if (position.outcome !== 0 || thinking || position.board[cell] !== 0) return;
    const afterYou = play(position, cell, vsComputer ? YOU : toMove(position));
    setPosition(afterYou);
    if (afterYou.outcome !== 0) { finish(afterYou); return; }
    if (!vsComputer) return;

    const mine = ++generation.current;
    setThinking(true);
    // A deep search blocks the main thread, so hand the browser a frame to paint "thinking…" first.
    window.setTimeout(() => {
      const reply = chooseMove(afterYou.board, COMPUTER, difficulty);
      if (mine !== generation.current) return; // restarted or undone while thinking
      setThinking(false);
      if (reply === null) return;
      const afterComputer = play(afterYou, reply, COMPUTER);
      setPosition(afterComputer);
      if (afterComputer.outcome !== 0) finish(afterComputer);
    }, 30);
  }

  /**
   * Against the computer, takes back your move and its reply so it's your turn again. Between
   * friends, takes back the last stone, whoever played it.
   */
  function undo() {
    if (thinking || position.moves.length === 0) return;
    generation.current++;
    const keep = position.moves.slice(0, Math.max(0, position.moves.length - (vsComputer ? 2 : 1)));
    let rebuilt = start();
    keep.forEach((cell, i) => { rebuilt = play(rebuilt, cell, i % 2 === 0 ? 1 : 2); });
    setPosition(rebuilt);
  }

  // Only computed while the heat map is on: it scores every empty cell.
  const heat = useMemo(
    () => (insight && position.outcome === 0 ? heatMap(position.board, vsComputer ? YOU : toMove(position)) : null),
    [insight, position, vsComputer],
  );

  const status = position.outcome === 3 ? "It's a draw — the board is full."
    : !vsComputer && position.outcome !== 0 ? `${STONE[position.outcome]} wins! 🎉`
    : position.outcome === YOU ? 'You win! 🎉'
    : position.outcome === COMPUTER ? 'The computer wins.'
    : thinking ? 'Thinking…'
    : !vsComputer ? `${STONE[toMove(position)]} to play`
    : 'Your turn';

  return (
    <div className="room-screen">
      <header className="room-bar">
        <Link to="/g/gomoku" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <div className="grow col" style={{ gap: 0 }}>
          <strong>{vsComputer ? 'Gomoku vs the computer' : 'Gomoku · two players'}</strong>
          <small className="muted tabular">
            {vsComputer ? `You ${score.you} — ${score.computer} Computer` : `Black ${score.you} — ${score.computer} White`}
          </small>
        </div>
        <button type="button" className="icon-button" aria-label={vsComputer ? 'Undo your last move' : 'Undo the last stone'}
          disabled={thinking || position.moves.length === 0} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button type="button" className="icon-button" aria-label="Start over" onClick={reset}>
          <Icon name="plus" />
        </button>
      </header>

      <div className="row center" style={{ marginBottom: 10 }}>
        <span className="turn-pill">
          <span className={`stone-dot ${position.outcome !== 0 ? 'none' : thinking || toMove(position) === 2 ? 'white' : 'black'}`} aria-hidden />
          {status}
        </span>
      </div>

      <GomokuBoard
        board={position.board}
        placing={position.outcome === 0 && !thinking ? (vsComputer ? YOU : toMove(position)) : null}
        lastMove={position.moves.length ? position.moves[position.moves.length - 1] : null}
        winLine={position.winLine}
        heat={heat}
        onPlace={place}
      />

      <div style={{ marginTop: 16 }}>
        <OpponentCard value={opponent} onChange={onOpponent} />
      </div>
      {vsComputer && (
        <section className="card">
          <h3>Difficulty</h3>
          <Segmented label="Difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_LABELS} block />
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>{DIFFICULTY_HELP[difficulty]}</p>
        </section>
      )}

      <section className="card">
        <div className="row between">
          <div className="col" style={{ gap: 2 }}>
            <strong style={{ fontSize: '0.95rem' }}>Insight</strong>
            <small className="muted">Shade the board by how much each point is worth.</small>
          </div>
          <Segmented
            label="Insight"
            value={insight ? 'on' : 'off'}
            onChange={(v) => setInsight(v === 'on')}
            options={[{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }]}
            size="small"
          />
        </div>
      </section>

      {position.outcome !== 0 && (
        <button type="button" className="primary block" onClick={reset}>Play again</button>
      )}
    </div>
  );
}
