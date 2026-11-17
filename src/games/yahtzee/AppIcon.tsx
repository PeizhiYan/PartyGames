/** Yahtzee's phone icon: two dice tumbling on green felt. */
const PIPS: Record<number, [number, number][]> = {
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function Die({ x, y, size, tilt, value }: { x: number; y: number; size: number; tilt: number; value: number }) {
  const off = size * 0.27;
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <rect x={-size / 2 + 3} y={-size / 2 + 6} width={size} height={size} rx={size * 0.2} fill="#0b2410" opacity="0.4" />
      <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={size * 0.2} fill="url(#yzIconFace)" stroke="#cfc5b3" strokeWidth="1.5" />
      {PIPS[value].map(([px, py], i) => <circle key={i} cx={px * off} cy={py * off} r={size * 0.095} fill="#1a1030" />)}
    </g>
  );
}

export default function AppIcon() {
  return (
    <svg viewBox="0 0 120 120" className="app-icon" role="img" aria-label="Yahtzee">
      <defs>
        <radialGradient id="yzIconFelt" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stopColor="#36a05a" /><stop offset="1" stopColor="#134a26" /></radialGradient>
        <linearGradient id="yzIconFace" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e6dfcd" /></linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#yzIconFelt)" />
      <Die x={44} y={48} size={46} tilt={-16} value={6} />
      <Die x={76} y={76} size={50} tilt={12} value={5} />
    </svg>
  );
}
