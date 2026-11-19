import { m } from './messages';
import UnoCard from './Card';
import { DECK } from './cards';
import './Uno.css';

/** UNO's phone icon: three cards fanned in a hand. */
const pick = (kind: string, color: string) => DECK.find((c) => c.kind === kind && c.color === color)!.id;
const FAN = [pick('7', 'red'), pick('wild', 'wild'), pick('draw2', 'blue')];

export default function AppIcon() {
  return (
    <svg viewBox="0 0 120 120" className="app-icon" role="img" aria-label={m().name}>
      <defs>
        <radialGradient id="unoIconBg" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stopColor="#4a3577" /><stop offset="1" stopColor="#1a1230" /></radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#unoIconBg)" />
      {FAN.map((id, i) => (
        <g key={id} transform={`translate(60 150) rotate(${(i - 1) * 20}) translate(-24 -132)`}>
          <UnoCard id={id} width={48} />
        </g>
      ))}
    </svg>
  );
}
