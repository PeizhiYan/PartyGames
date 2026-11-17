import type { CSSProperties, ReactNode } from 'react';
import Character from './Character';
import type { Expression, Species } from './cast';

/**
 * One player at a table: their face in a ring that lights up on their turn, their name, a line
 * of detail underneath, and any speech bubble they are saying right now.
 */
export default function Seat({ uid, name, species, expression, turn, away, meta, bubble, size = 52, style, corner, children }: {
  uid: string;
  /** From `assignSpecies`, so no two at a table look alike. */
  species?: Species;
  name: string;
  expression?: Expression;
  turn?: boolean;
  away?: boolean;
  meta?: ReactNode;
  bubble?: { text: string; tone?: 'hot' | 'gold'; key: number } | null;
  size?: number;
  style?: CSSProperties;
  /** Pinned to the top corner of the face, like the button that takes a computer out. */
  corner?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`seat${turn ? ' turn' : ''}${away ? ' away' : ''}`} style={style}>
      <div className="seat-face">
        <Character uid={uid} species={species} size={size} expression={expression} />
        {corner}
        {bubble && <span key={bubble.key} className={`bubble${bubble.tone ? ` ${bubble.tone}` : ''}`}>{bubble.text}</span>}
      </div>
      <span className="seat-name">{name}</span>
      {meta !== undefined && <span className="seat-meta">{meta}</span>}
      {children}
    </div>
  );
}
