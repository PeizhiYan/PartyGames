/**
 * A flat die face, for any game that rolls one. Dots on a 3x3 grid, by which of the nine
 * positions are filled. With `onToggle` it is a button — Yahtzee uses that to hold a die.
 */
const FACES: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export default function Die({ value, rolling, held, onToggle }: {
  value: number;
  rolling?: boolean;
  held?: boolean;
  onToggle?: () => void;
}) {
  const dots = FACES[value] ?? FACES[1];
  const pips = Array.from({ length: 9 }, (_, i) => (dots.includes(i) ? <i key={i} /> : <span key={i} />));
  const className = `die${rolling && !held ? ' rolling' : ''}${held ? ' held' : ''}`;
  if (onToggle) {
    return (
      <button type="button" className={className} aria-pressed={!!held}
        aria-label={`Die showing ${value}${held ? ', held' : ''}`} onClick={onToggle}>
        {pips}
      </button>
    );
  }
  return <span className={className} role="img" aria-label={`Die showing ${value}`}>{pips}</span>;
}
