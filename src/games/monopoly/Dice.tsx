import type { CSSProperties } from 'react';

// Dice faces as dots on a 3x3 grid, by which of the nine positions are filled.
const FACES: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const pips = (value: number) => {
  const dots = FACES[value] ?? FACES[1];
  return Array.from({ length: 9 }, (_, i) => (dots.includes(i) ? <i key={i} /> : <span key={i} />));
};

export function Die({ value, rolling }: { value: number; rolling?: boolean }) {
  return (
    <span className={`die${rolling ? ' rolling' : ''}`} role="img" aria-label={`Die showing ${value}`}>
      {pips(value)}
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

/* ── The throw, for the middle of the board ───────────────────────────────── */

/**
 * The six faces of a cube, in the order the CSS rotates them into place. Opposite faces sum to
 * seven, as they do on a real die — it is visible whenever the cube is mid-tumble.
 */
const CUBE = [1, 6, 2, 5, 3, 4];

/** How far to turn the cube so a given face ends up pointing at you. */
const REST: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  2: [0, -90],
  5: [0, 90],
  3: [-90, 0],
  4: [90, 0],
};

/**
 * A die thrown onto the board: a real cube that tumbles in, bounces and settles showing its face.
 *
 * The landing rotation is a custom property rather than a separate keyframe set per value —
 * six values times two dice would be twelve animations saying the same thing. `--spin` adds a
 * few whole extra turns so the two dice never tumble in lockstep.
 */
function ThrownDie({ value, index }: { value: number; index: number }) {
  const [rx, ry] = REST[value] ?? REST[1];
  const style = {
    '--rx': `${rx}deg`,
    '--ry': `${ry}deg`,
    '--from-x': `${index === 0 ? -1 : 1.3}`,
    '--spin': `${index === 0 ? 2 : 3}`,
    '--delay': `${index * 90}ms`,
  } as CSSProperties;
  return (
    <span className="die-slot" style={style}>
      <span className="die-shadow" />
      <span className="die3d">
        {CUBE.map((face) => (
          <span key={face} className={`die3d-face f${face}`}>{pips(face)}</span>
        ))}
      </span>
    </span>
  );
}

/**
 * Both dice, thrown.
 *
 * Mount this with a `key` that changes per roll (`lastRoll.at`): the tumble is a CSS animation,
 * and the only way to play it again is a fresh element.
 */
export function ThrownDice({ dice }: { dice: [number, number] }) {
  return (
    <span className="dice-throw" aria-hidden>
      {dice.map((value, i) => <ThrownDie key={i} value={value} index={i} />)}
    </span>
  );
}
