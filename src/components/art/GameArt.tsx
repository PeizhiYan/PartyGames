/**
 * Cover art for each game, drawn as inline SVG.
 *
 * Inline rather than image files so the artwork scales to any card size without a second request,
 * and so the one place a game's look is defined is next to the code that uses it. Each piece is
 * drawn on a 320x160 canvas and stretched with `preserveAspectRatio="none"`-free scaling — the
 * card gives it a 2:1 box, and the art is composed to survive being cropped a little either side.
 */
import type { GameId } from '../../domain/types';

const BOARD_CELL = 26;
const BOARD_X = 22;
const BOARD_Y = 18;
/** Grid intersection (column, row) → pixel centre. */
const at = (col: number, row: number) => ({
  cx: BOARD_X + col * BOARD_CELL,
  cy: BOARD_Y + row * BOARD_CELL,
});

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

/** Five black stones running down the board, with white trying and failing to get in the way. */
function GomokuArt() {
  const line = { from: at(1, 0), to: at(5, 4) };
  return (
    <svg viewBox="0 0 320 160" className="game-art" role="img" aria-label="A gomoku board with five black stones in a row">
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
        <radialGradient id="gomokuGlow" cx="0.25" cy="0.15" r="0.9">
          <stop offset="0" stopColor="#fff6e2" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff6e2" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="320" height="160" fill="url(#gomokuWood)" />
      <rect width="320" height="160" fill="url(#gomokuGlow)" />

      {/* Grid, drawn past the edges so the board reads as bigger than the card */}
      <g stroke="#6b4514" strokeOpacity="0.38" strokeWidth="1.2">
        {Array.from({ length: 6 }, (_, r) => (
          <line key={`r${r}`} x1="-10" x2="330" y1={BOARD_Y + r * BOARD_CELL} y2={BOARD_Y + r * BOARD_CELL} />
        ))}
        {Array.from({ length: 12 }, (_, c) => (
          <line key={`c${c}`} y1="-10" y2="170" x1={BOARD_X + c * BOARD_CELL} x2={BOARD_X + c * BOARD_CELL} />
        ))}
      </g>
      <circle cx={at(4, 2).cx} cy={at(4, 2).cy} r="3" fill="#6b4514" fillOpacity="0.5" />

      {/* The winning line, struck through behind the stones */}
      <line x1={line.from.cx} y1={line.from.cy} x2={line.to.cx} y2={line.to.cy}
        stroke="#ff3f72" strokeOpacity="0.9" strokeWidth="5" strokeLinecap="round" />

      <Stone col={2} row={0} black={false} />
      <Stone col={6} row={1} black={false} />
      <Stone col={2} row={4} black={false} />
      <Stone col={7} row={3} black={false} />
      <Stone col={9} row={1} black={false} />

      <Stone col={1} row={0} black />
      <Stone col={2} row={1} black />
      <Stone col={3} row={2} black />
      <Stone col={4} row={3} black />
      <Stone col={5} row={4} black marked />
    </svg>
  );
}

function Pips({ x, y, face }: { x: number; y: number; face: number }) {
  // Which of the nine positions in a 3x3 grid are filled, per face.
  const FACES: Record<number, number[]> = {
    1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  };
  return (
    <g fill="#241a12">
      {(FACES[face] ?? []).map((i) => (
        <circle key={i} cx={x + 11 + (i % 3) * 13} cy={y + 11 + Math.floor(i / 3) * 13} r="3.6" />
      ))}
    </g>
  );
}

function Die({ x, y, face, tilt }: { x: number; y: number; face: number; tilt: number }) {
  return (
    <g transform={`rotate(${tilt} ${x + 23} ${y + 23})`}>
      <rect x={x + 2} y={y + 5} width="46" height="46" rx="11" fill="#2a1c0f" opacity="0.28" />
      <rect x={x} y={y} width="46" height="46" rx="11" fill="url(#dieFace)" stroke="#d8cfbe" strokeWidth="1.5" />
      <Pips x={x} y={y} face={face} />
    </g>
  );
}

/** The banking side of Monopoly: money changing hands, and the dice that caused it. */
function MonopolyArt() {
  return (
    <svg viewBox="0 0 320 160" className="game-art" role="img" aria-label="Dice and banknotes on a Monopoly board">
      <defs>
        <linearGradient id="monoFelt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f9f3e4" />
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
        <radialGradient id="monoGlow" cx="0.22" cy="0.12" r="0.9">
          <stop offset="0" stopColor="#fffdf6" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fffdf6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="320" height="160" fill="url(#monoFelt)" />
      <rect width="320" height="160" fill="url(#monoGlow)" />

      {/* Property strips along the top edge, as on the board */}
      <g>
        {[
          ['#d32f2f', 0], ['#f9a825', 58], ['#2e7d32', 116], ['#1565c0', 174], ['#6a1b9a', 232], ['#ef6c00', 290],
        ].map(([colour, x]) => (
          <g key={x as number}>
            <rect x={x as number} y="0" width="52" height="16" rx="3" fill={colour as string} />
            <rect x={x as number} y="16" width="52" height="9" rx="2" fill="#fffdf6" opacity="0.55" />
          </g>
        ))}
      </g>

      {/* A fan of banknotes */}
      <g>
        {[
          { x: 24, y: 96, r: -13 },
          { x: 38, y: 88, r: -6 },
          { x: 52, y: 82, r: 2 },
        ].map((n) => (
          <g key={n.x} transform={`rotate(${n.r} ${n.x + 46} ${n.y + 23})`}>
            <rect x={n.x + 2} y={n.y + 4} width="92" height="46" rx="6" fill="#2a1c0f" opacity="0.2" />
            <rect x={n.x} y={n.y} width="92" height="46" rx="6" fill="url(#note)" stroke="#3f8f57" strokeWidth="1.5" />
            <rect x={n.x + 7} y={n.y + 7} width="78" height="32" rx="4" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
            <circle cx={n.x + 46} cy={n.y + 23} r="11" fill="#fff" fillOpacity="0.35" />
            <text x={n.x + 46} y={n.y + 29} textAnchor="middle" fontSize="18" fontWeight="700"
              fill="#1f5c33" fontFamily="system-ui, sans-serif">$</text>
          </g>
        ))}
      </g>

      {/* Two dice mid-throw */}
      <Die x={186} y={56} face={5} tilt={-12} />
      <Die x={242} y={84} face={3} tilt={14} />

      {/* A little house, because somebody always buys one */}
      <g transform="translate(150 112)">
        <path d="M0 14 L16 0 L32 14 V34 H0 Z" fill="#2e7d32" />
        <path d="M0 14 L16 0 L32 14 H0 Z" fill="#43a047" />
        <rect x="12" y="20" width="9" height="14" fill="#1b5e20" />
      </g>
    </svg>
  );
}

const ART: Record<GameId, () => JSX.Element> = {
  gomoku: GomokuArt,
  monopoly: MonopolyArt,
};

/** The cover for one game. Falls back to nothing for a game with no art yet. */
export default function GameArt({ game }: { game: GameId }) {
  const Art = ART[game];
  return Art ? <Art /> : null;
}
