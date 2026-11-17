import { KING, KNIGHT } from './engine';
import { Piece } from './Pieces';
import './Board.css';

/** Chess's phone icon: a white knight, large, with the black king looking on. */
export default function AppIcon() {
  return (
    <svg viewBox="0 0 120 120" className="app-icon" role="img" aria-label="Chess">
      <defs>
        <radialGradient id="chIconShade" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>
      </defs>
      {Array.from({ length: 16 }, (_, i) => {
        const f = i % 4;
        const r = Math.floor(i / 4);
        return <rect key={i} x={f * 30} y={r * 30} width="30" height="30" fill={((f + r) & 1) === 0 ? '#f0d9b5' : '#b58863'} />;
      })}
      <rect width="120" height="120" fill="url(#chIconShade)" />
      <Piece type={KING} white={false} x={64} y={2} size={50} />
      <Piece type={KNIGHT} white x={8} y={24} size={96} />
    </svg>
  );
}
