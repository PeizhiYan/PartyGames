/** Gomoku's phone icon: five black stones in a row on a wooden board, struck through. */
export default function AppIcon() {
  const stone = (cx: number, cy: number, black: boolean) => (
    <g key={`${cx}-${cy}`}>
      <circle cx={cx + 1.2} cy={cy + 2} r="9" fill="#3a2409" opacity="0.3" />
      <circle cx={cx} cy={cy} r="9" fill={black ? 'url(#gkBlack)' : 'url(#gkWhite)'} />
    </g>
  );
  return (
    <svg viewBox="0 0 120 120" className="app-icon" role="img" aria-label="Gomoku">
      <defs>
        <linearGradient id="gkWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d49b" /><stop offset="1" stopColor="#c8914a" />
        </linearGradient>
        <radialGradient id="gkBlack" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#5a5a5a" /><stop offset="1" stopColor="#0d0d0d" /></radialGradient>
        <radialGradient id="gkWhite" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d8d2c4" /></radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#gkWood)" />
      <g stroke="#6b4514" strokeOpacity="0.45" strokeWidth="1.2">
        {[20, 40, 60, 80, 100].map((v) => <line key={`h${v}`} x1="0" y1={v} x2="120" y2={v} />)}
        {[20, 40, 60, 80, 100].map((v) => <line key={`v${v}`} x1={v} y1="0" x2={v} y2="120" />)}
      </g>
      {stone(80, 40, false)}
      {stone(40, 80, false)}
      {[20, 40, 60, 80, 100].map((v) => stone(v, v, true))}
      <line x1="12" y1="12" x2="108" y2="108" stroke="#e8443a" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}
