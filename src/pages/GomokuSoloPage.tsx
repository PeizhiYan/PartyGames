import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GomokuBoard from '../components/gomoku/GomokuBoard';
import Icon from '../components/ui/Icon';
import Segmented from '../components/ui/Segmented';
import { chooseMove, heatMap, type Difficulty } from '../domain/gomoku/ai';
import { emptyBoard, fiveThrough, isFull, type Board } from '../domain/gomoku/board';

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
const STORED_DIFFICULTY = 'partygames:gomoku:difficulty';

/** You are black and move first, as in the original game. */
const YOU = 1;
const COMPUTER = 2;

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

/** Gomoku against the computer. No room, no network: everything happens on this device. */
export default function GomokuSoloPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => (localStorage.getItem(STORED_DIFFICULTY) as Difficulty | null) ?? 'normal',
  );
  const [position, setPosition] = useState<Position>(start);
  const [thinking, setThinking] = useState(false);
  const [insight, setInsight] = useState(false);
  const [score, setScore] = useState({ you: 0, computer: 0 });
  // Bumped on restart/undo so a reply that is already on its way is thrown away.
  const generation = useRef(0);

  useEffect(() => { localStorage.setItem(STORED_DIFFICULTY, difficulty); }, [difficulty]);

  const reset = useCallback(() => {
    generation.current++;
    setThinking(false);
    setPosition(start());
  }, []);

  const finish = useCallback((next: Position) => {
    if (next.outcome === YOU) setScore((s) => ({ ...s, you: s.you + 1 }));
    if (next.outcome === COMPUTER) setScore((s) => ({ ...s, computer: s.computer + 1 }));
  }, []);

  function place(cell: number) {
    if (position.outcome !== 0 || thinking || position.board[cell] !== 0) return;
    const afterYou = play(position, cell, YOU);
    setPosition(afterYou);
    if (afterYou.outcome !== 0) { finish(afterYou); return; }

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

  /** Takes back your move and the computer's reply, so it's your turn again. */
  function undo() {
    if (thinking || position.moves.length === 0) return;
    generation.current++;
    const keep = position.moves.slice(0, Math.max(0, position.moves.length - 2));
    let rebuilt = start();
    keep.forEach((cell, i) => { rebuilt = play(rebuilt, cell, i % 2 === 0 ? YOU : COMPUTER); });
    setPosition(rebuilt);
  }

  // Only computed while the heat map is on: it scores every empty cell.
  const heat = useMemo(
    () => (insight && position.outcome === 0 ? heatMap(position.board, YOU) : null),
    [insight, position.board, position.outcome],
  );

  const status = position.outcome === YOU ? 'You win! 🎉'
    : position.outcome === COMPUTER ? 'The computer wins.'
    : position.outcome === 3 ? "It's a draw — the board is full."
    : thinking ? 'Thinking…'
    : 'Your turn';

  return (
    <div className="room-screen">
      <header className="room-bar">
        <Link to="/g/gomoku" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <div className="grow col" style={{ gap: 0 }}>
          <strong>Gomoku vs the computer</strong>
          <small className="muted tabular">You {score.you} — {score.computer} Computer</small>
        </div>
        <button type="button" className="icon-button" aria-label="Undo your last move"
          disabled={thinking || position.moves.length === 0} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button type="button" className="icon-button" aria-label="Start over" onClick={reset}>
          <Icon name="plus" />
        </button>
      </header>

      <div className="row center" style={{ marginBottom: 10 }}>
        <span className="turn-pill">
          <span className={`stone-dot ${thinking ? 'white' : position.outcome === 0 ? 'black' : 'none'}`} aria-hidden />
          {status}
        </span>
      </div>

      <GomokuBoard
        board={position.board}
        placing={position.outcome === 0 && !thinking ? YOU : null}
        lastMove={position.moves.length ? position.moves[position.moves.length - 1] : null}
        winLine={position.winLine}
        heat={heat}
        onPlace={place}
      />

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Difficulty</h3>
        <Segmented label="Difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_LABELS} block />
        <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>{DIFFICULTY_HELP[difficulty]}</p>
      </section>

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
