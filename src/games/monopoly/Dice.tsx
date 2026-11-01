// Dice faces as dots on a 3x3 grid, by which of the nine positions are filled.
const FACES: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({ value, rolling }: { value: number; rolling?: boolean }) {
  const dots = FACES[value] ?? FACES[1];
  return (
    <span className={`die${rolling ? ' rolling' : ''}`} role="img" aria-label={`Die showing ${value}`}>
      {Array.from({ length: 9 }, (_, i) => (dots.includes(i) ? <i key={i} /> : <span key={i} />))}
    </span>
  );
}

export default function Dice({ dice, rolling }: { dice: [number, number] | null; rolling?: boolean }) {
  const [a, b] = dice ?? [1, 1];
  return (
    <span className="dice">
      <Die value={a} rolling={rolling} />
      <Die value={b} rolling={rolling} />
    </span>
  );
}
