import { useId } from 'react';
import { cardOf, type Color, type Kind } from './cards';

/** The four card colours, picked to stay distinct for the common kinds of colour blindness. */
export const INK: Record<Color, string> = {
  red: '#e0393e',
  yellow: '#f2b400',
  green: '#2e9e4f',
  blue: '#1f78d1',
};
const WILD_INK = '#1e1e22';

/** A card's middle symbol, drawn around (0, 0) at roughly 30 units tall. Never an emoji. */
function Glyph({ kind, fill, small }: { kind: Kind; fill: string; small?: boolean }) {
  const font = { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: 900, textAnchor: 'middle' as const, dominantBaseline: 'central' as const };
  if (/^[0-9]$/.test(kind)) {
    return <text x="0" y="1" fontSize={small ? 13 : 34} fill={fill} {...font}
      style={{ fontStyle: 'italic' }} stroke={small ? 'none' : '#00000026'} strokeWidth="1">{kind}</text>;
  }
  if (kind === 'draw2' || kind === 'wild4') {
    return <text x="0" y="1" fontSize={small ? 11 : 26} fill={fill} {...font}
      stroke={small ? 'none' : '#00000040'} strokeWidth="1">{kind === 'draw2' ? '+2' : '+4'}</text>;
  }
  const s = small ? 0.38 : 1;
  if (kind === 'skip') {
    return (
      <g transform={`scale(${s})`} fill="none" stroke={fill} strokeWidth="5" strokeLinecap="round">
        <circle cx="0" cy="0" r="12" />
        <line x1="-8.5" y1="8.5" x2="8.5" y2="-8.5" />
      </g>
    );
  }
  if (kind === 'reverse') {
    return (
      <g transform={`scale(${s}) rotate(-35)`} fill={fill}>
        <path d="M-12 -4 L4 -4 L4 -10 L14 0 L4 10 L4 4 L-12 4 Z" transform="translate(0 -7)" />
        <path d="M12 -4 L-4 -4 L-4 -10 L-14 0 L-4 10 L-4 4 L12 4 Z" transform="translate(0 7)" />
      </g>
    );
  }
  return null;
}

/** The four-colour oval of a wild, as quadrants. */
function WildOval({ rx, ry }: { rx: number; ry: number }) {
  const quad = (sx: number, sy: number, color: string) => (
    <path d={`M0 0 L${sx * rx} 0 A${rx} ${ry} 0 0 ${sx * sy > 0 ? 1 : 0} 0 ${sy * ry} Z`} fill={color} />
  );
  return <g>{quad(1, -1, INK.red)}{quad(-1, -1, INK.blue)}{quad(-1, 1, INK.yellow)}{quad(1, 1, INK.green)}</g>;
}

/**
 * One UNO card, drawn in SVG at `width` pixels wide (cards are 2:3). `faceDown` draws the back.
 * `id` is a card id from `./cards`.
 */
export default function UnoCard({ id, width = 56, faceDown, className }: {
  id?: number;
  width?: number;
  faceDown?: boolean;
  className?: string;
}) {
  const clip = useId();
  const height = width * 1.5;
  if (faceDown || id === undefined) {
    return (
      <svg className={`uno-card back${className ? ` ${className}` : ''}`} width={width} height={height} viewBox="0 0 60 90" aria-hidden>
        <rect x="0.5" y="0.5" width="59" height="89" rx="7" fill="#fff" stroke="#0000001f" />
        <rect x="3.5" y="3.5" width="53" height="83" rx="5" fill={WILD_INK} />
        <ellipse cx="30" cy="45" rx="21" ry="34" transform="rotate(28 30 45)" fill={INK.red} />
        <text x="30" y="46" fontSize="17" fontWeight="900" fontStyle="italic" fill={INK.yellow}
          stroke={WILD_INK} strokeWidth="1.2" paintOrder="stroke" textAnchor="middle" dominantBaseline="central"
          transform="rotate(-18 30 45)" fontFamily='system-ui, -apple-system, "Segoe UI", sans-serif'>UNO</text>
      </svg>
    );
  }
  const card = cardOf(id);
  const wild = card.color === 'wild';
  const body = wild ? WILD_INK : INK[card.color as Color];
  return (
    <svg className={`uno-card${className ? ` ${className}` : ''}`} width={width} height={height} viewBox="0 0 60 90"
      role="img" aria-label={`${wild ? '' : `${card.color} `}${card.kind}`}>
      <defs>
        <clipPath id={clip}><rect x="3.5" y="3.5" width="53" height="83" rx="5" /></clipPath>
      </defs>
      <rect x="0.5" y="0.5" width="59" height="89" rx="7" fill="#fff" stroke="#0000001f" />
      <rect x="3.5" y="3.5" width="53" height="83" rx="5" fill={body} />
      {/* The clip goes on an untransformed group: a clipPath is resolved in the coordinates of
          the element using it, so on the translated group it only covered the bottom-right. */}
      <g clipPath={`url(#${clip})`}>
        <g transform="translate(30 45)">
          <g transform="rotate(28)">
            {wild ? <WildOval rx={21} ry={33} /> : <ellipse cx="0" cy="0" rx="21" ry="33" fill="#fff" />}
          </g>
          {card.kind === 'wild4' && <Glyph kind="wild4" fill="#fff" />}
          {!wild && <Glyph kind={card.kind} fill={body} />}
        </g>
      </g>
      {/* Corner indices, top-left and (upside down) bottom-right, as on a printed card. */}
      {card.kind !== 'wild' && (
        <>
          <g transform="translate(11 14)"><Glyph kind={card.kind} fill="#fff" small /></g>
          <g transform="translate(49 76) rotate(180)"><Glyph kind={card.kind} fill="#fff" small /></g>
        </>
      )}
      {card.kind === 'wild' && (
        <>
          <g transform="translate(11 14) rotate(28)"><WildOval rx={5} ry={7.5} /></g>
          <g transform="translate(49 76) rotate(28)"><WildOval rx={5} ry={7.5} /></g>
        </>
      )}
    </svg>
  );
}
