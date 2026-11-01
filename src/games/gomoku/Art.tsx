import { ART_H, ART_W } from '../art';

/** Five black stones running down the middle of the board, with white failing to stop them. */

const CELL = 26;
const GRID_X = 10;
const GRID_Y = 20;
/** Grid intersection (column, row) → pixel centre. */
const at = (col: number, row: number) => ({ cx: GRID_X + col * CELL, cy: GRID_Y + row * CELL });

function Stone({ col, row, black, marked }: { col: number; row: number; black: boolean; marked?: boolean }) {
  const { cx, cy } = at(col, row);
  return (
    <g>
      <ellipse cx={cx} cy={cy + 2.5} rx="11" ry="10" fill="#3a2409" opacity="0.3" />
      <circle cx={cx} cy={cy} r="11" fill={black ? 'url(#stoneBlack)' : 'url(#stoneWhite)'} />
      <ellipse cx={cx - 3.5} cy={cy - 4} rx="4.5" ry="3.2" transform={`rotate(-35 ${cx - 3.5} ${cy - 4})`}
        fill="#fff" opacity={black ? 0.38 : 0.85} />
      {marked && <circle cx={cx} cy={cy} r="2.6" fill="#ff5d8f" />}
    </g>
  );
}

/** Five black stones running down the middle of the board, with white failing to stop them. */
export default function Art() {
  const first = at(10, 1);
  const last = at(14, 5);
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="game-art" preserveAspectRatio="xMidYMid slice"
      role="img" aria-label="A gomoku board with five black stones in a row">
      <defs>
        <linearGradient id="gomokuWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0cf92" />
          <stop offset="0.55" stopColor="#dcae62" />
          <stop offset="1" stopColor="#b9853f" />
        </linearGradient>
        <radialGradient id="stoneBlack" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#6c6c6c" />
          <stop offset="0.45" stopColor="#2b2b2b" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <radialGradient id="stoneWhite" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.55" stopColor="#f2f0ec" />
          <stop offset="1" stopColor="#c3bdb4" />
        </radialGradient>
        <radialGradient id="gomokuGlow" cx="0.3" cy="0.1" r="0.9">
          <stop offset="0" stopColor="#fff6e2" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff6e2" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={ART_W} height={ART_H} fill="url(#gomokuWood)" />
      <rect width={ART_W} height={ART_H} fill="url(#gomokuGlow)" />

      {/* Grid, running past every edge so the board reads as bigger than whatever is showing */}
      <g stroke="#6b4514" strokeOpacity="0.36" strokeWidth="1.2">
        {Array.from({ length: 9 }, (_, i) => GRID_Y + (i - 1) * CELL).map((y) => (
          <line key={`r${y}`} x1="-10" x2={ART_W + 10} y1={y} y2={y} />
        ))}
        {Array.from({ length: 26 }, (_, i) => GRID_X + (i - 1) * CELL).map((x) => (
          <line key={`c${x}`} y1="-10" y2={ART_H + 10} x1={x} x2={x} />
        ))}
      </g>
      {([[4, 1], [4, 5], [20, 1], [20, 5]] as [number, number][]).map(([c, r]) => (
        <circle key={`${c}-${r}`} cx={at(c, r).cx} cy={at(c, r).cy} r="3" fill="#6b4514" fillOpacity="0.5" />
      ))}

      {/* The winning line, struck through behind the stones */}
      <line x1={first.cx} y1={first.cy} x2={last.cx} y2={last.cy}
        stroke="#ff3f72" strokeOpacity="0.9" strokeWidth="5" strokeLinecap="round" />

      <Stone col={6} row={3} black={false} />
      <Stone col={8} row={2} black={false} />
      <Stone col={9} row={5} black={false} />
      <Stone col={16} row={1} black={false} />
      <Stone col={17} row={4} black={false} />
      <Stone col={19} row={2} black={false} />

      <Stone col={10} row={1} black />
      <Stone col={11} row={2} black />
      <Stone col={12} row={3} black />
      <Stone col={13} row={4} black />
      <Stone col={14} row={5} black marked />
    </svg>
  );
}

