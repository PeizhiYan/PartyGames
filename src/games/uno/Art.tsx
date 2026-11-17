import { ART_H, ART_W } from '../art';
import UnoCard from './Card';
import { DECK } from './cards';
import './Uno.css';

/** A hand of five cards fanned on a dark table. Inside the safe zone (x 120-520, y 34-166). */
const pick = (kind: string, color: string) => DECK.find((c) => c.kind === kind && c.color === color)!.id;
const FAN = [pick('7', 'red'), pick('skip', 'yellow'), pick('wild', 'wild'), pick('reverse', 'green'), pick('draw2', 'blue')];

export default function Art() {
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="game-art" preserveAspectRatio="xMidYMid slice"
      role="img" aria-label="Five UNO cards fanned out">
      <defs>
        <radialGradient id="unoTable" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0" stopColor="#3a2a5c" />
          <stop offset="1" stopColor="#1a1230" />
        </radialGradient>
      </defs>
      <rect width={ART_W} height={ART_H} fill="url(#unoTable)" />
      {FAN.map((id, i) => {
        const angle = (i - 2) * 13;
        return (
          <g key={id} transform={`translate(320 255) rotate(${angle}) translate(-42 -220)`}>
            <UnoCard id={id} width={84} />
          </g>
        );
      })}
    </svg>
  );
}
