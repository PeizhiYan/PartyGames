import type { CSSProperties } from 'react';

const COLORS = ['#e0393e', '#f2b400', '#2e9e4f', '#1f78d1', '#b259e0', '#ff8fa3'];

/**
 * A burst of confetti, for a win. Directions are worked out from the piece's index, not from
 * `Math.random()`, so a re-render does not reshuffle a burst mid-flight.
 */
export default function Confetti({ pieces = 36 }: { pieces?: number }) {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2 + (i % 3) * 0.3;
        const dist = 90 + ((i * 37) % 80);
        return (
          <i key={i} style={{
            background: COLORS[i % COLORS.length],
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist - 30}px`,
            '--rot': `${(i * 71) % 540 - 270}deg`,
            animationDelay: `${(i % 5) * 0.03}s`,
          } as CSSProperties} />
        );
      })}
    </div>
  );
}
