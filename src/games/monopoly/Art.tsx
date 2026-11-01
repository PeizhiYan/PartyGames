import { ART_H, ART_W } from '../art';

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
export default function Art() {
  const strips: [string, number][] = [
    ['#d32f2f', -10], ['#f9a825', 62], ['#2e7d32', 134], ['#1565c0', 206], ['#6a1b9a', 278],
    ['#ef6c00', 350], ['#0097a7', 422], ['#c2185b', 494], ['#558b2f', 566],
  ];
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="game-art" preserveAspectRatio="xMidYMid slice"
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

      <rect width={ART_W} height={ART_H} fill="url(#monoFelt)" />
      <rect width={ART_W} height={ART_H} fill="url(#monoGlow)" />

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

