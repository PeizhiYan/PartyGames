import { m } from './messages';
import { useEffect, useMemo, useState } from 'react';
import {
  COORD_XY, DST, FILE_LEFT, FILE_X, MOVE, PIECE_KING, RANK_TOP, RANK_Y, SIDE_TAG, SRC, type Position,
} from './engine';
import type { Side } from './rules';
import './Board.css';

/** Pixel geometry of the drawing, in viewBox units. Scales to whatever width it is given. */
const CELL = 60;
const MARGIN = 42;
const COLS = 9;
const ROWS = 10;
const WIDTH = (COLS - 1) * CELL + MARGIN * 2;
const HEIGHT = (ROWS - 1) * CELL + MARGIN * 2;
const PIECE_R = 26;

/** The characters on the pieces, red then black, indexed by piece type (king … pawn). */
const RED_CHARS = ['帥', '仕', '相', '傌', '俥', '炮', '兵'];
const BLACK_CHARS = ['將', '士', '象', '馬', '車', '砲', '卒'];

interface Props {
  position: Position;
  /** Which side this viewer plays. Decides which way up the board is drawn; null for a spectator. */
  viewer: Side | null;
  /** Whether a tap may start or complete a move right now. */
  canMove: boolean;
  lastMove: number | null;
  onMove: (mv: number) => void;
}

/**
 * The board, drawn as SVG: a 9x10 grid of intersections, the river between ranks 5 and 6, the
 * two palaces, and the pieces as discs carrying their character.
 *
 * Interaction is tap-tap: a piece of yours, then where it goes. Every square the selected piece
 * can legally reach is marked, so the rules are visible before a move is tried rather than
 * refused after. The board is drawn from the viewer's side — black sees it the right way up too.
 */
export default function XiangqiBoard({ position, viewer, canMove, lastMove, onMove }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const flipped = viewer === 2;

  // A move landing, or the turn passing, invalidates whatever was picked up.
  useEffect(() => { setSelected(null); }, [position, canMove]);

  /** Every legal move from here, grouped by source square. */
  const legal = useMemo(() => {
    const bySource = new Map<number, number[]>();
    for (const mv of position.legalMoves()) {
      const list = bySource.get(SRC(mv)) ?? [];
      list.push(DST(mv));
      bySource.set(SRC(mv), list);
    }
    return bySource;
  }, [position]);

  const targets = selected !== null ? legal.get(selected) ?? [] : [];
  const ownTag = SIDE_TAG(position.sdPlayer);

  /** Pixel centre of an engine square, from the viewer's side. */
  const centre = (sq: number) => {
    let col = FILE_X(sq) - FILE_LEFT;
    let row = RANK_Y(sq) - RANK_TOP;
    if (flipped) { col = COLS - 1 - col; row = ROWS - 1 - row; }
    return { x: MARGIN + col * CELL, y: MARGIN + row * CELL };
  };

  function tap(sq: number) {
    if (!canMove) return;
    const pc = position.squares[sq];
    if ((pc & ownTag) !== 0) {
      setSelected(selected === sq ? null : sq);
      return;
    }
    if (selected !== null && targets.includes(sq)) {
      onMove(MOVE(selected, sq));
      setSelected(null);
    }
  }

  /** The king of the side to move, if it is in check — it gets a warning ring. */
  const checkedKing = useMemo(() => {
    if (!position.inCheck()) return null;
    for (let sq = 0; sq < 256; sq += 1) {
      if (position.squares[sq] === ownTag + PIECE_KING) return sq;
    }
    return null;
  }, [position, ownTag]);

  const squares: number[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) squares.push(COORD_XY(x + FILE_LEFT, y + RANK_TOP));
  }

  const lines: JSX.Element[] = [];
  // Ranks: nine full-width lines, ten including the river banks.
  for (let r = 0; r < ROWS; r += 1) {
    const y = MARGIN + r * CELL;
    lines.push(<line key={`r${r}`} x1={MARGIN} y1={y} x2={MARGIN + (COLS - 1) * CELL} y2={y} />);
  }
  // Files: the outer two run the whole height; the inner seven stop at the river.
  for (let c = 0; c < COLS; c += 1) {
    const x = MARGIN + c * CELL;
    if (c === 0 || c === COLS - 1) {
      lines.push(<line key={`f${c}`} x1={x} y1={MARGIN} x2={x} y2={MARGIN + (ROWS - 1) * CELL} />);
    } else {
      lines.push(<line key={`f${c}a`} x1={x} y1={MARGIN} x2={x} y2={MARGIN + 4 * CELL} />);
      lines.push(<line key={`f${c}b`} x1={x} y1={MARGIN + 5 * CELL} x2={x} y2={MARGIN + (ROWS - 1) * CELL} />);
    }
  }
  // The palaces' diagonals, top and bottom.
  for (const top of [0, 7]) {
    const x1 = MARGIN + 3 * CELL;
    const x2 = MARGIN + 5 * CELL;
    const y1 = MARGIN + top * CELL;
    const y2 = MARGIN + (top + 2) * CELL;
    lines.push(<line key={`p${top}a`} x1={x1} y1={y1} x2={x2} y2={y2} />);
    lines.push(<line key={`p${top}b`} x1={x2} y1={y1} x2={x1} y2={y2} />);
  }

  return (
    <div className="xq">
      <svg className="xq-board" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
        aria-label={m().boardLabel(position.mvList.length - 1)}>
        <rect className="xq-wood" x="0" y="0" width={WIDTH} height={HEIGHT} rx="14" />
        <rect className="xq-frame" x={MARGIN - 8} y={MARGIN - 8} width={(COLS - 1) * CELL + 16} height={(ROWS - 1) * CELL + 16} />
        <g className="xq-lines">{lines}</g>
        <g className="xq-river" aria-hidden>
          {/* Only the pieces flip with the viewer; the writing always faces whoever is looking. */}
          <text x={MARGIN + 2 * CELL} y={MARGIN + 4.5 * CELL}>楚 河</text>
          <text x={MARGIN + 6 * CELL} y={MARGIN + 4.5 * CELL}>漢 界</text>
        </g>

        {lastMove !== null && [SRC(lastMove), DST(lastMove)].map((sq) => {
          const { x, y } = centre(sq);
          return <rect key={sq} className="xq-last" x={x - PIECE_R - 2} y={y - PIECE_R - 2} width={PIECE_R * 2 + 4} height={PIECE_R * 2 + 4} rx="8" />;
        })}

        {squares.map((sq) => {
          const pc = position.squares[sq];
          const { x, y } = centre(sq);
          const red = pc >= 8 && pc < 16;
          const type = pc & 7;
          const isSelected = sq === selected;
          const isTarget = targets.includes(sq);
          return (
            <g key={sq} className={`xq-sq${canMove ? ' live' : ''}`} onPointerUp={() => tap(sq)}>
              <rect x={x - CELL / 2} y={y - CELL / 2} width={CELL} height={CELL} fill="transparent" />
              {pc > 0 && (
                <g className={`xq-piece ${red ? 'red' : 'black'}${isSelected ? ' selected' : ''}${sq === checkedKing ? ' check' : ''}`}>
                  <circle className="xq-shadow" cx={x} cy={y + 3} r={PIECE_R} />
                  <circle className="xq-disc" cx={x} cy={y} r={PIECE_R} />
                  <circle className="xq-rim" cx={x} cy={y} r={PIECE_R - 4} />
                  <text x={x} y={y} className="xq-char">{(red ? RED_CHARS : BLACK_CHARS)[type]}</text>
                </g>
              )}
              {isTarget && (pc > 0
                ? <circle className="xq-capture" cx={x} cy={y} r={PIECE_R + 3} />
                : <circle className="xq-dot" cx={x} cy={y} r="7" />)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
