import { m } from './messages';
import { useEffect, useMemo, useState } from 'react';
import {
  BISHOP, KNIGHT, QUEEN, ROOK, fileOf, makeMoveCode, moveFrom, movePromotion, moveTo, rankOf, type Board,
} from './engine';
import { Piece } from './Pieces';
import type { Side } from './rules';
import Sheet from '../../ui/Sheet';
import './Board.css';

const CELL = 64;
const MARGIN = 22;
const SIZE = 8 * CELL + MARGIN * 2;

interface Props {
  board: Board;
  /** Which side this viewer plays. Decides which way up the board is drawn; null for a spectator. */
  viewer: Side | null;
  canMove: boolean;
  lastMove: number | null;
  onMove: (mv: number) => void;
}

/**
 * The board: eight by eight, pieces drawn from `./Pieces`, interaction by tap-tap. Every square
 * the picked-up piece may legally reach is marked before a move is tried. A pawn reaching the
 * last rank asks what it becomes. Black sees the board from black's side.
 */
export default function ChessBoard({ board, viewer, canMove, lastMove, onMove }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  /** A pawn move that needs a promotion choice before it can be played. */
  const [promoting, setPromoting] = useState<{ from: number; to: number } | null>(null);
  const flipped = viewer === 2;

  useEffect(() => { setSelected(null); setPromoting(null); }, [board, canMove]);

  const legal = useMemo(() => {
    const bySource = new Map<number, number[]>();
    for (const mv of board.legalMoves()) {
      const list = bySource.get(moveFrom(mv)) ?? [];
      list.push(mv);
      bySource.set(moveFrom(mv), list);
    }
    return bySource;
  }, [board]);

  const fromSelected = selected !== null ? legal.get(selected) ?? [] : [];
  const targets = new Set(fromSelected.map(moveTo));

  /** Top-left pixel of a square, from the viewer's side. */
  const origin = (sq: number) => {
    let f = fileOf(sq);
    let r = rankOf(sq);
    if (flipped) { f = 7 - f; r = 7 - r; }
    return { x: MARGIN + f * CELL, y: MARGIN + (7 - r) * CELL };
  };

  function tap(sq: number) {
    if (!canMove) return;
    const pc = board.squares[sq];
    if (pc !== 0 && Math.sign(pc) === board.turn) {
      setSelected(selected === sq ? null : sq);
      return;
    }
    if (selected === null || !targets.has(sq)) return;
    const choices = fromSelected.filter((mv) => moveTo(mv) === sq);
    if (choices.some((mv) => movePromotion(mv) !== 0)) {
      setPromoting({ from: selected, to: sq });
      return;
    }
    onMove(choices[0]);
    setSelected(null);
  }

  const kingInCheck = board.inCheck() ? board.kingSquare(board.turn) : -1;
  const files = flipped ? 'hgfedcba' : 'abcdefgh';
  const ranks = flipped ? '12345678' : '87654321';

  return (
    <div className="chess">
      <svg className="chess-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img"
        aria-label={m().boardLabel(board.fullmove)}>
        <rect className="chess-frame" x="0" y="0" width={SIZE} height={SIZE} rx="12" />
        {Array.from({ length: 64 }, (_, sq) => {
          const { x, y } = origin(sq);
          const dark = ((fileOf(sq) + rankOf(sq)) & 1) === 0;
          const isLast = lastMove !== null && (moveFrom(lastMove) === sq || moveTo(lastMove) === sq);
          const pc = board.squares[sq];
          return (
            <g key={sq} className={`chess-sq${canMove ? ' live' : ''}`} onPointerUp={() => tap(sq)}>
              <rect className={dark ? 'dark' : 'light'} x={x} y={y} width={CELL} height={CELL} />
              {isLast && <rect className="chess-last" x={x} y={y} width={CELL} height={CELL} />}
              {sq === selected && <rect className="chess-selected" x={x} y={y} width={CELL} height={CELL} />}
              {sq === kingInCheck && <rect className="chess-check" x={x} y={y} width={CELL} height={CELL} />}
              {pc !== 0 && <Piece type={Math.abs(pc)} white={pc > 0} x={x} y={y} size={CELL} />}
              {targets.has(sq) && (pc !== 0
                ? <circle className="chess-capture" cx={x + CELL / 2} cy={y + CELL / 2} r={CELL / 2 - 4} />
                : <circle className="chess-dot" cx={x + CELL / 2} cy={y + CELL / 2} r={CELL * 0.14} />)}
            </g>
          );
        })}
        <g className="chess-coords" aria-hidden>
          {Array.from(files, (f, i) => (
            <text key={f} x={MARGIN + i * CELL + CELL / 2} y={SIZE - MARGIN / 2 + 1}>{f}</text>
          ))}
          {Array.from(ranks, (r, i) => (
            <text key={r} x={MARGIN / 2} y={MARGIN + i * CELL + CELL / 2}>{r}</text>
          ))}
        </g>
      </svg>

      <Sheet open={promoting !== null} title={m().promoteTo} onClose={() => setPromoting(null)}>
        <div className="chess-promote">
          {[QUEEN, ROOK, BISHOP, KNIGHT].map((type) => (
            <button key={type} type="button" aria-label={['', '', m().pieces.knight, m().pieces.bishop, m().pieces.rook, m().pieces.queen][type]}
              onClick={() => {
                if (!promoting) return;
                onMove(makeMoveCode(promoting.from, promoting.to, type));
                setPromoting(null);
                setSelected(null);
              }}>
              <svg viewBox="0 0 64 64" width="52" height="52"><Piece type={type} white={board.turn === 1} x={0} y={0} size={64} /></svg>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
