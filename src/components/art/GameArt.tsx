/**
 * Cover art for each game, drawn as inline SVG.
 *
 * Inline rather than image files so the artwork scales to any size without a second request, and
 * so the one place a game's look is defined sits next to the code that uses it.
 *
 * Each piece is drawn on a 640x200 canvas and cropped to fill its box
 * (`preserveAspectRatio="slice"`). It appears in two very different shapes — a 2:1 card, which
 * crops the sides, and a page-wide lobby banner nearer 5:1, which crops top and bottom — so
 * anything that matters has to sit inside the overlap: **x 120-520, y 34-166**. The canvas was
 * 320x160 at first, which left the banner cropped about three times into the middle of the
 * picture, showing a couple of enormous dice and nothing else.
 */
import type { GameId } from '../../domain/types';

const W = 640;
const H = 200;

/* ── Gomoku ───────────────────────────────────────────────────────────────── */

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
function GomokuArt() {
  const first = at(10, 1);
  const last = at(14, 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="game-art" preserveAspectRatio="xMidYMid slice"
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

      <rect width={W} height={H} fill="url(#gomokuWood)" />
      <rect width={W} height={H} fill="url(#gomokuGlow)" />

      {/* Grid, running past every edge so the board reads as bigger than whatever is showing */}
      <g stroke="#6b4514" strokeOpacity="0.36" strokeWidth="1.2">
        {Array.from({ length: 9 }, (_, i) => GRID_Y + (i - 1) * CELL).map((y) => (
          <line key={`r${y}`} x1="-10" x2={W + 10} y1={y} y2={y} />
        ))}
        {Array.from({ length: 26 }, (_, i) => GRID_X + (i - 1) * CELL).map((x) => (
          <line key={`c${x}`} y1="-10" y2={H + 10} x1={x} x2={x} />
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

/* ── MonopolyBuddy ────────────────────────────────────────────────────────── */

const DICE_FACES: Record<number, number[]> = {
  1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function Die({ x, y, face, tilt }: { x: number; y: number; face: number; tilt: number }) {
  return (
    <g transform={`rotate(${tilt} ${x + 23} ${y + 23})`}>
      <rect x={x + 2} y={y + 5} width="46" height="46" rx="11" fill="#2a1c0f" opacity="0.28" />
      <rect x={x} y={y} width="46" height="46" rx="11" fill="url(#dieFace)" stroke="#d8cfbe" strokeWidth="1.5" />
      <g fill="#241a12">
        {(DICE_FACES[face] ?? []).map((i) => (
          <circle key={i} cx={x + 11 + (i % 3) * 13} cy={y + 11 + Math.floor(i / 3) * 13} r="3.6" />
        ))}
      </g>
    </g>
  );
}

function Note({ x, y, tilt }: { x: number; y: number; tilt: number }) {
  return (
    <g transform={`rotate(${tilt} ${x + 46} ${y + 23})`}>
      <rect x={x + 2} y={y + 4} width="92" height="46" rx="6" fill="#2a1c0f" opacity="0.2" />
      <rect x={x} y={y} width="92" height="46" rx="6" fill="url(#note)" stroke="#3f8f57" strokeWidth="1.5" />
      <rect x={x + 7} y={y + 7} width="78" height="32" rx="4" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx={x + 46} cy={y + 23} r="11" fill="#fff" fillOpacity="0.35" />
      <text x={x + 46} y={y + 29} textAnchor="middle" fontSize="18" fontWeight="700"
        fill="#1f5c33" fontFamily="system-ui, sans-serif">$</text>
    </g>
  );
}

/** The banking side of Monopoly: money changing hands, and the dice that caused it. */
function MonopolyArt() {
  const strips: [string, number][] = [
    ['#d32f2f', -10], ['#f9a825', 62], ['#2e7d32', 134], ['#1565c0', 206], ['#6a1b9a', 278],
    ['#ef6c00', 350], ['#0097a7', 422], ['#c2185b', 494], ['#558b2f', 566],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="game-art" preserveAspectRatio="xMidYMid slice"
      role="img" aria-label="Dice, banknotes and a house from a Monopoly board">
      <defs>
        <linearGradient id="monoFelt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#faf5e8" />
          <stop offset="0.6" stopColor="#efe4cd" />
          <stop offset="1" stopColor="#d9c9a8" />
        </linearGradient>
        <linearGradient id="dieFace" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#eae3d6" />
        </linearGradient>
        <linearGradient id="note" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a8e0b4" />
          <stop offset="1" stopColor="#5fb879" />
        </linearGradient>
        <radialGradient id="monoGlow" cx="0.25" cy="0.1" r="0.9">
          <stop offset="0" stopColor="#fffdf6" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fffdf6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="url(#monoFelt)" />
      <rect width={W} height={H} fill="url(#monoGlow)" />

      {/* The property strips, pushed down far enough to survive the banner's crop */}
      {strips.map(([colour, x]) => (
        <g key={x}>
          <rect x={x} y="34" width="64" height="17" rx="3" fill={colour} />
          <rect x={x} y="51" width="64" height="9" rx="2" fill="#fffdf6" opacity="0.55" />
        </g>
      ))}

      {/* A fan of banknotes, left of centre */}
      <Note x={128} y={116} tilt={-13} />
      <Note x={146} y={108} tilt={-5} />
      <Note x={164} y={100} tilt={3} />

      {/* A house between the money and the dice */}
      <g transform="translate(318 126)">
        <path d="M0 14 L18 0 L36 14 V38 H0 Z" fill="#2e7d32" />
        <path d="M0 14 L18 0 L36 14 H0 Z" fill="#43a047" />
        <rect x="13" y="21" width="10" height="17" fill="#1b5e20" />
      </g>

      {/* Two dice mid-throw, right of centre */}
      <Die x={396} y={82} face={5} tilt={-12} />
      <Die x={458} y={112} face={3} tilt={14} />
    </svg>
  );
}

const ART: Record<GameId, () => JSX.Element> = {
  gomoku: GomokuArt,
  monopoly: MonopolyArt,
};

/** The cover for one game. Renders nothing for a game that has no art yet. */
export default function GameArt({ game }: { game: GameId }) {
  const Art = ART[game];
  return Art ? <Art /> : null;
}
