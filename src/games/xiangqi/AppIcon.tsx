import { m } from './messages';
/** Chinese chess's phone icon: the red general, 帥, large on the board, the black general behind. */
const CJK = "'Noto Serif CJK SC', 'Songti SC', 'STSong', 'SimSun', serif";

function Piece({ cx, cy, r, char, red }: { cx: number; cy: number; r: number; char: string; red: boolean }) {
  const ink = red ? '#c0392b' : '#1f1f1f';
  return (
    <g>
      <circle cx={cx + 1.5} cy={cy + 4} r={r} fill="#3a2409" opacity="0.35" />
      <circle cx={cx} cy={cy} r={r} fill="url(#xqiFace)" stroke="#8a6a3a" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={r * 0.8} fill="none" stroke={ink} strokeWidth={r * 0.08} />
      <text x={cx} y={cy} fill={ink} fontSize={r * 1.05} fontWeight="700" textAnchor="middle" dominantBaseline="central" fontFamily={CJK}>{char}</text>
    </g>
  );
}

export default function AppIcon() {
  return (
    <svg viewBox="0 0 120 120" className="app-icon" role="img" aria-label={m().name}>
      <defs>
        <linearGradient id="xqiWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0cf92" /><stop offset="1" stopColor="#b9853f" />
        </linearGradient>
        <linearGradient id="xqiFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf1dc" /><stop offset="1" stopColor="#e8d4ac" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#xqiWood)" />
      <g stroke="#6b4514" strokeOpacity="0.4" strokeWidth="1.2">
        {[8, 36, 64, 92].map((v) => <line key={`h${v}`} x1="0" y1={v} x2="120" y2={v} />)}
        {[4, 32, 60, 88, 116].map((v) => <line key={`v${v}`} x1={v} y1="0" x2={v} y2="120" />)}
        <line x1="32" y1="8" x2="88" y2="64" /><line x1="88" y1="8" x2="32" y2="64" />
      </g>
      <Piece cx={92} cy={30} r={17} char="將" red={false} />
      <Piece cx={56} cy={68} r={34} char="帥" red />
    </svg>
  );
}
