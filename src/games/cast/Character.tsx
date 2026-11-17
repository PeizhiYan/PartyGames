import type { CSSProperties } from 'react';
import { jitter, speciesFor, type Expression, type Species } from './cast';
import './cast.css';

/**
 * A player's face: one of eight cartoon characters, drawn in SVG, with an expression.
 *
 * The expression is what makes a table feel alive — the player to move looks up and thinks,
 * someone hit by a draw-four looks crestfallen, a winner beams. Everyone blinks now and then, each
 * on their own clock (`jitter`), so a table of faces never blinks in unison.
 */

interface Look { face: string; accent: string; feature: string; eyeY: number }

const LOOK: Record<Species, Look> = {
  cat: { face: '#f4b860', accent: '#e0913a', feature: '#3a2618', eyeY: 34 },
  bear: { face: '#b98457', accent: '#e6c39d', feature: '#2e1d12', eyeY: 33 },
  bunny: { face: '#f3e9ef', accent: '#f4a7c0', feature: '#3b2a36', eyeY: 35 },
  robot: { face: '#9fb7cc', accent: '#ff6b6b', feature: '#1f2b38', eyeY: 34 },
  frog: { face: '#7cc46a', accent: '#5aa64a', feature: '#1f3a17', eyeY: 22 },
  fox: { face: '#f08a3e', accent: '#fff3e6', feature: '#2f1a0c', eyeY: 34 },
  panda: { face: '#fbfbfb', accent: '#2b2b2b', feature: '#1b1b1b', eyeY: 34 },
  owl: { face: '#a7845e', accent: '#f1dfc4', feature: '#2a1d10', eyeY: 32 },
};

/** Ears, horns, antennae: everything behind the head. */
function Behind({ species, l }: { species: Species; l: Look }) {
  switch (species) {
    case 'cat':
      return <><path d="M12 22 L16 4 L28 15 Z" fill={l.face} /><path d="M52 22 L48 4 L36 15 Z" fill={l.face} />
        <path d="M15 17 L17 9 L23 14 Z" fill={l.accent} /><path d="M49 17 L47 9 L41 14 Z" fill={l.accent} /></>;
    case 'bear':
      return <><circle cx="15" cy="16" r="8" fill={l.face} /><circle cx="49" cy="16" r="8" fill={l.face} />
        <circle cx="15" cy="16" r="4" fill={l.accent} /><circle cx="49" cy="16" r="4" fill={l.accent} /></>;
    case 'bunny':
      return <><ellipse cx="22" cy="10" rx="6" ry="14" fill={l.face} /><ellipse cx="42" cy="10" rx="6" ry="14" fill={l.face} />
        <ellipse cx="22" cy="11" rx="3" ry="10" fill={l.accent} /><ellipse cx="42" cy="11" rx="3" ry="10" fill={l.accent} /></>;
    case 'robot':
      return <><line x1="32" y1="12" x2="32" y2="4" stroke={l.feature} strokeWidth="2.5" />
        <circle className="cast-antenna" cx="32" cy="4" r="3.5" fill={l.accent} /></>;
    case 'frog':
      return <><circle cx="21" cy="22" r="9" fill={l.face} /><circle cx="43" cy="22" r="9" fill={l.face} /></>;
    case 'fox':
      return <><path d="M11 24 L13 3 L28 14 Z" fill={l.face} /><path d="M53 24 L51 3 L36 14 Z" fill={l.face} />
        <path d="M14 18 L15 8 L23 14 Z" fill="#2f1a0c" /><path d="M50 18 L49 8 L41 14 Z" fill="#2f1a0c" /></>;
    case 'panda':
      return <><circle cx="15" cy="16" r="8" fill={l.accent} /><circle cx="49" cy="16" r="8" fill={l.accent} /></>;
    case 'owl':
      return <><path d="M12 20 L14 6 L24 16 Z" fill={l.face} /><path d="M52 20 L50 6 L40 16 Z" fill={l.face} /></>;
    default:
      return null;
  }
}

/** The head itself, plus markings that sit under the eyes. */
function Head({ species, l }: { species: Species; l: Look }) {
  if (species === 'robot') {
    return <><rect x="11" y="12" width="42" height="42" rx="10" fill={l.face} stroke="#7d95ab" strokeWidth="1.5" />
      <rect x="16" y="26" width="32" height="16" rx="6" fill="#2a3a4a" /></>;
  }
  return (
    <>
      <ellipse cx="32" cy="36" rx="22" ry="21" fill={l.face} />
      {species === 'bear' && <ellipse cx="32" cy="44" rx="10" ry="7.5" fill={l.accent} />}
      {species === 'fox' && <path d="M14 38 Q22 52 32 52 Q42 52 50 38 Q42 44 32 44 Q22 44 14 38 Z" fill={l.accent} />}
      {species === 'panda' && <><ellipse cx="23" cy="34" rx="6" ry="7.5" transform="rotate(-20 23 34)" fill={l.accent} />
        <ellipse cx="41" cy="34" rx="6" ry="7.5" transform="rotate(20 41 34)" fill={l.accent} /></>}
      {species === 'owl' && <><circle cx="23" cy="32" r="8.5" fill={l.accent} /><circle cx="41" cy="32" r="8.5" fill={l.accent} /></>}
      {species === 'frog' && <><circle cx="21" cy="22" r="5.5" fill="#fff" /><circle cx="43" cy="22" r="5.5" fill="#fff" /></>}
    </>
  );
}

function Eyes({ expression, l, species }: { expression: Expression; l: Look; species: Species }) {
  const y = l.eyeY;
  // On a robot or panda the eyes sit on a dark patch, so they are drawn light.
  const ink = species === 'robot' ? '#7ef0ff' : species === 'panda' ? '#fff' : l.feature;
  if (expression === 'happy') {
    return <g fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round">
      <path d={`M19 ${y + 1} Q23 ${y - 4} 27 ${y + 1}`} /><path d={`M37 ${y + 1} Q41 ${y - 4} 45 ${y + 1}`} /></g>;
  }
  const r = expression === 'surprised' ? 4.2 : 3.2;
  const dx = expression === 'thinking' ? 1.5 : 0;
  const dy = expression === 'thinking' ? -1.5 : 0;
  return (
    <g className="cast-eyes">
      {species === 'robot'
        ? <><rect x={20 + dx} y={y - 3 + dy} width="7" height="6" rx="2" fill={ink} /><rect x={37 + dx} y={y - 3 + dy} width="7" height="6" rx="2" fill={ink} /></>
        : <><circle cx={23 + dx} cy={y + dy} r={r} fill={ink} /><circle cx={41 + dx} cy={y + dy} r={r} fill={ink} />
          <circle cx={24 + dx} cy={y - 1 + dy} r="1" fill="#fff" /><circle cx={42 + dx} cy={y - 1 + dy} r="1" fill="#fff" /></>}
      {expression === 'sad' && <g stroke={species === 'panda' ? '#fff' : l.feature} strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1={y - 7} x2="26" y2={y - 5} /><line x1="46" y1={y - 7} x2="38" y2={y - 5} /></g>}
    </g>
  );
}

function Mouth({ expression, l, species }: { expression: Expression; l: Look; species: Species }) {
  const ink = species === 'robot' ? '#7ef0ff' : l.feature;
  const y = species === 'frog' ? 42 : 45;
  const stroke = { fill: 'none', stroke: ink, strokeWidth: 2.4, strokeLinecap: 'round' as const };
  switch (expression) {
    case 'happy':
      return <path d={`M24 ${y - 2} Q32 ${y + 9} 40 ${y - 2} Z`} fill={species === 'robot' ? ink : '#c0392b'} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />;
    case 'sad':
      return <path d={`M26 ${y + 3} Q32 ${y - 3} 38 ${y + 3}`} {...stroke} />;
    case 'surprised':
      return <ellipse cx="32" cy={y + 1} rx="3.5" ry="4.5" fill={ink} />;
    case 'thinking':
      return <path d={`M28 ${y + 1} L37 ${y - 1}`} {...stroke} />;
    default:
      return <path d={`M26 ${y} Q32 ${y + 5} 38 ${y}`} {...stroke} />;
  }
}

export default function Character({ uid, size = 48, expression = 'idle', species, className }: {
  uid: string;
  size?: number;
  expression?: Expression;
  /** Force a character instead of the uid's own — for previews. */
  species?: Species;
  className?: string;
}) {
  const kind = species ?? speciesFor(uid);
  const l = LOOK[kind];
  return (
    <svg className={`cast cast-${expression}${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 64 64"
      style={{ '--blink-delay': `${-jitter(uid) * 5}s` } as CSSProperties} aria-hidden>
      <g className="cast-body">
        <Behind species={kind} l={l} />
        <Head species={kind} l={l} />
        {kind === 'owl' && <path d="M29 40 L35 40 L32 46 Z" fill="#e6a23c" />}
        {kind === 'cat' && <g stroke={l.feature} strokeWidth="1" opacity="0.6"><line x1="8" y1="42" x2="20" y2="43" /><line x1="56" y1="42" x2="44" y2="43" /></g>}
        {expression === 'happy' && kind !== 'robot' && <><circle cx="17" cy="42" r="3.5" fill="#ff8fa3" opacity="0.6" /><circle cx="47" cy="42" r="3.5" fill="#ff8fa3" opacity="0.6" /></>}
        <Eyes expression={expression} l={l} species={kind} />
        <Mouth expression={expression} l={l} species={kind} />
        {expression === 'sad' && kind !== 'robot' && <path className="cast-tear" d="M45 38 Q47 42 45 44 Q43 42 45 38 Z" fill="#6ec6ff" />}
      </g>
      {expression === 'thinking' && (
        <g className="cast-dots">
          <circle cx="50" cy="12" r="2.4" /><circle cx="56" cy="8" r="2.4" /><circle cx="62" cy="4" r="2.4" />
        </g>
      )}
    </svg>
  );
}
