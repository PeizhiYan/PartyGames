import { m } from './messages';
/** Monopoly's phone icon: a green house and a red hotel on a property card's colour band. */
export default function AppIcon() {
  return (
    <svg viewBox="0 0 120 120" className="app-icon" role="img" aria-label={m().name}>
      <defs>
        <linearGradient id="monoIconBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f8f3e6" /><stop offset="1" stopColor="#e6dcc3" /></linearGradient>
        <linearGradient id="monoHouse" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3fae5c" /><stop offset="1" stopColor="#1f7a3a" /></linearGradient>
        <linearGradient id="monoHotel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e5483d" /><stop offset="1" stopColor="#a8231b" /></linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#monoIconBg)" />
      {['#c0392b', '#f1c40f', '#27ae60', '#2061b5'].map((c, i) => <rect key={c} x={i * 30} y="0" width="30" height="22" fill={c} />)}
      <rect x="0" y="22" width="120" height="2" fill="#000" opacity="0.15" />
      <ellipse cx="60" cy="100" rx="46" ry="6" fill="#000" opacity="0.15" />
      {/* The hotel, behind. */}
      <path d="M50 46 L72 34 L94 46 V98 H50 Z" fill="url(#monoHotel)" stroke="#7a1912" strokeWidth="1.5" strokeLinejoin="round" />
      {[56, 70, 84].map((x) => [54, 68].map((y) => <rect key={`${x}-${y}`} x={x - 3} y={y} width="8" height="8" rx="1.5" fill="#ffe7b0" opacity="0.9" />))}
      <rect x="66" y="84" width="12" height="14" rx="2" fill="#5a120d" />
      {/* The house, in front. */}
      <path d="M18 68 L40 48 L62 68 V100 H18 Z" fill="url(#monoHouse)" stroke="#0f4d22" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="34" y="82" width="12" height="18" rx="2" fill="#0f4d22" />
      <rect x="24" y="72" width="8" height="8" rx="1.5" fill="#e9ffe9" opacity="0.85" />
    </svg>
  );
}
