import { ART_H, ART_W } from '../art';

/** Five dice tumbling across green felt, all showing five: a Yahtzee. Inside x 120-520, y 34-166. */
const PIPS: Record<number, [number, number][]> = {
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
};

function DieArt({ x, y, size, tilt, value }: { x: number; y: number; size: number; tilt: number; value: number }) {
  const r = size * 0.18;
  const pip = size * 0.1;
  const off = size * 0.27;
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <rect x={-size / 2 + 3} y={-size / 2 + 6} width={size} height={size} rx={r} fill="#102a14" opacity="0.35" />
      <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={r} fill="url(#yzFace)" stroke="#cfc5b3" strokeWidth="1.5" />
      {(PIPS[value] ?? []).map(([px, py], i) => (
        <circle key={i} cx={px * off} cy={py * off} r={pip} fill="#1a1030" />
      ))}
    </g>
  );
}

export default function Art() {
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="game-art" preserveAspectRatio="xMidYMid slice"
      role="img" aria-label="Five dice all showing five on green felt">
      <defs>
        <radialGradient id="yzFelt" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#2f8f4e" />
          <stop offset="1" stopColor="#15502a" />
        </radialGradient>
        <linearGradient id="yzFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9e2d2" />
        </linearGradient>
      </defs>
      <rect width={ART_W} height={ART_H} fill="url(#yzFelt)" />
      <DieArt x={170} y={104} size={66} tilt={-14} value={5} />
      <DieArt x={246} y={92} size={66} tilt={9} value={5} />
      <DieArt x={322} y={108} size={66} tilt={-5} value={5} />
      <DieArt x={398} y={94} size={66} tilt={16} value={5} />
      <DieArt x={474} y={106} size={66} tilt={-10} value={5} />
    </svg>
  );
}
