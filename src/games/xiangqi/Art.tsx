import { ART_H, ART_W } from '../art';

/**
 * A corner of a xiangqi board: the river, a palace, and a few pieces mid-fight. Everything that
 * matters sits inside the safe zone (x 120-520, y 34-166) so both crops keep it.
 */

const CELL = 44;
const X0 = 98;
const Y0 = 14;
const at = (col: number, row: number) => ({ cx: X0 + col * CELL, cy: Y0 + row * CELL });

function Piece({ col, row, char, red }: { col: number; row: number; char: string; red: boolean }) {
  const { cx, cy } = at(col, row);
  const ink = red ? '#c0392b' : '#1f1f1f';
  return (
    <g>
      <circle cx={cx} cy={cy + 2.5} r="18" fill="#3a2409" opacity="0.3" />
      <circle cx={cx} cy={cy} r="18" fill="#f3e6cb" stroke="#8a6a3a" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r="14.5" fill="none" stroke={ink} strokeWidth="1.6" />
      <text x={cx} y={cy} fill={ink} fontSize="19" fontWeight="700" textAnchor="middle" dominantBaseline="central"
        fontFamily="'Noto Serif CJK SC', 'Songti SC', 'STSong', 'SimSun', serif">{char}</text>
    </g>
  );
}

export default function Art() {
  const cols = 10;
  const rows = 5;
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="game-art" preserveAspectRatio="xMidYMid slice"
      role="img" aria-label="A Chinese chess board with pieces either side of the river">
      <defs>
        <linearGradient id="xqWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0cf92" />
          <stop offset="0.55" stopColor="#dcae62" />
          <stop offset="1" stopColor="#b9853f" />
        </linearGradient>
      </defs>
      <rect width={ART_W} height={ART_H} fill="url(#xqWood)" />
      <g stroke="#6b4514" strokeOpacity="0.42" strokeWidth="1.3">
        {Array.from({ length: rows }, (_, r) => (
          <line key={`r${r}`} x1={X0} y1={Y0 + r * CELL} x2={X0 + (cols - 1) * CELL} y2={Y0 + r * CELL} />
        ))}
        {Array.from({ length: cols }, (_, c) => (
          <line key={`c${c}`} x1={X0 + c * CELL} y1={Y0} x2={X0 + c * CELL} y2={c === 0 || c === cols - 1 ? Y0 + (rows - 1) * CELL + 40 : Y0 + 2 * CELL} />
        ))}
        {/* The palace at the top of this corner. */}
        <line x1={at(3, 0).cx} y1={at(3, 0).cy} x2={at(5, 2).cx} y2={at(5, 2).cy} />
        <line x1={at(5, 0).cx} y1={at(5, 0).cy} x2={at(3, 2).cx} y2={at(3, 2).cy} />
        {/* The far bank of the river. */}
        <line x1={X0} y1={Y0 + 3 * CELL} x2={X0 + (cols - 1) * CELL} y2={Y0 + 3 * CELL} />
        {Array.from({ length: cols - 2 }, (_, c) => (
          <line key={`d${c}`} x1={X0 + (c + 1) * CELL} y1={Y0 + 3 * CELL} x2={X0 + (c + 1) * CELL} y2={Y0 + 3 * CELL + 40} />
        ))}
      </g>
      <text x={X0 + 2.5 * CELL} y={Y0 + 2.5 * CELL} fill="#6b4514" fillOpacity="0.55" fontSize="24" fontWeight="600"
        letterSpacing="6" textAnchor="middle" dominantBaseline="central"
        fontFamily="'Noto Serif CJK SC', 'Songti SC', serif">楚 河</text>
      <text x={X0 + 6.5 * CELL} y={Y0 + 2.5 * CELL} fill="#6b4514" fillOpacity="0.55" fontSize="24" fontWeight="600"
        letterSpacing="6" textAnchor="middle" dominantBaseline="central"
        fontFamily="'Noto Serif CJK SC', 'Songti SC', serif">漢 界</text>

      <Piece col={4} row={0} char="將" red={false} />
      <Piece col={3} row={1} char="士" red={false} />
      <Piece col={6} row={2} char="砲" red={false} />
      <Piece col={1} row={3} char="卒" red={false} />
      <Piece col={5} row={3} char="炮" red />
      <Piece col={7} row={3} char="傌" red />
      <Piece col={2} row={2} char="俥" red />
      <Piece col={8} row={1} char="兵" red />
    </svg>
  );
}
