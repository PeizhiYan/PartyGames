import { m } from './messages';
import { ART_H, ART_W } from '../art';
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK } from './engine';
import { Piece } from './Pieces';
import './Board.css';

/** A slice of a chess board mid-game, kept inside the safe zone (x 120-520, y 34-166). */
const CELL = 46;
const X0 = -14;
const Y0 = -4;
const at = (file: number, rank: number) => ({ x: X0 + file * CELL, y: Y0 + rank * CELL });

export default function Art() {
  const pieces: { f: number; r: number; type: number; white: boolean }[] = [
    { f: 1, r: 0, type: ROOK, white: false }, { f: 3, r: 0, type: QUEEN, white: false }, { f: 4, r: 0, type: KING, white: false },
    { f: 2, r: 1, type: PAWN, white: false }, { f: 5, r: 1, type: PAWN, white: false }, { f: 6, r: 1, type: BISHOP, white: false },
    { f: 4, r: 2, type: KNIGHT, white: true }, { f: 1, r: 2, type: PAWN, white: false },
    { f: 3, r: 3, type: PAWN, white: true }, { f: 7, r: 3, type: PAWN, white: true }, { f: 0, r: 3, type: ROOK, white: true },
    { f: 5, r: 4, type: KING, white: true }, { f: 2, r: 4, type: QUEEN, white: true }, { f: 8, r: 2, type: BISHOP, white: true },
  ];
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="game-art" preserveAspectRatio="xMidYMid slice"
      role="img" aria-label={m().art}>
      <rect width={ART_W} height={ART_H} fill="#8d6433" />
      {Array.from({ length: 5 }, (_, r) => Array.from({ length: 15 }, (_, f) => {
        const { x, y } = at(f, r);
        return <rect key={`${f}-${r}`} x={x} y={y} width={CELL} height={CELL} fill={((f + r) & 1) === 0 ? '#f0d9b5' : '#b58863'} />;
      }))}
      {pieces.map((p) => {
        // Pieces are laid out on the middle ten files, which is the safe zone.
        const { x, y } = at(p.f + 3, p.r);
        return <Piece key={`${p.f}-${p.r}`} type={p.type} white={p.white} x={x} y={y} size={CELL} />;
      })}
    </svg>
  );
}
