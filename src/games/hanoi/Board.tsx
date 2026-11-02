import { useId } from 'react';
import type { HanoiState } from './rules';

// The rainbow of the original canvas game, smallest to largest.
const COLORS = ['#ff1900', '#ff7d00', '#ffeb00', '#32ff00', '#00faff', '#0078ff', '#e768e7'];
const PEG_NAMES = ['Left', 'Middle', 'Right'];

/** The original's cylindrical disks and wooden stand, redrawn as responsive SVG. */
export function TowerScene({ pegs, selected = null }: { pegs: HanoiState['pegs']; selected?: number | null }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 600 300" aria-hidden className="hanoi-scene">
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" x2="1">
          <stop stopColor="#48200c" /><stop offset=".4" stopColor="#bc7946" /><stop offset="1" stopColor="#5e2e10" />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" x2="1">
          <stop stopColor="#000" stopOpacity=".5" /><stop offset=".42" stopColor="#fff" stopOpacity=".25" />
          <stop offset="1" stopColor="#000" stopOpacity=".4" />
        </linearGradient>
      </defs>
      <ellipse cx="300" cy="265" rx="273" ry="12" fill="#000" opacity=".25" />
      <path d="M25 246L36 231H564L575 246Z" fill="#bc7946" />
      <rect x="25" y="246" width="550" height="18" rx="5" fill={`url(#${id}-wood)`} />
      {pegs.map((peg, p) => {
        const x = 100 + p * 200;
        return (
          <g key={p}>
            <rect x={x - 7} y="35" width="14" height="203" rx="7" fill={`url(#${id}-wood)`} />
            <ellipse cx={x} cy="39" rx="7" ry="3" fill="#e4b179" />
            {peg.disks.map((disk, i) => {
              const width = 26 + disk * 19;
              const y = 229 - i * 25;
              const lifted = selected === p && i === peg.disks.length - 1;
              return (
                <g key={disk} className={`hanoi-disk${lifted ? ' lifted' : ''}`}>
                  <ellipse cx={x} cy={y + 13} rx={width / 2 + 2} ry="7" fill="#000" opacity=".28" />
                  <rect x={x - width / 2} y={y - 7} width={width} height="18" rx="5" fill={COLORS[disk - 1]} />
                  <rect x={x - width / 2} y={y - 7} width={width} height="18" rx="5" fill={`url(#${id}-shade)`} />
                  <ellipse cx={x} cy={y - 7} rx={width / 2} ry="7" fill={COLORS[disk - 1]} />
                  <ellipse cx={x - width * .15} cy={y - 9} rx={width * .25} ry="2.5" fill="#fff" opacity=".35" />
                  {lifted && <ellipse cx={x} cy={y - 7} rx={width / 2 + 2} ry="8" fill="none" stroke="#fff" strokeWidth="2" />}
                </g>
              );
            })}
            <text x={x} y="288" fill="currentColor" textAnchor="middle" fontSize="13" letterSpacing="2">
              {p === 2 ? 'GOAL' : p === 0 ? 'START' : 'HELPER'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Board({ state, selected, onPeg }: {
  state: HanoiState; selected: number | null; onPeg: (peg: number) => void;
}) {
  const playing = state.startedAt !== null && state.finishedAt === null;
  return (
    <div className="hanoi-board">
      <TowerScene pegs={state.pegs} selected={selected} />
      <div className="hanoi-peg-controls" role="group" aria-label="Hanoi pegs">
        {state.pegs.map((peg, i) => (
          <button key={i} type="button" aria-pressed={selected === i} disabled={!playing}
            aria-label={`${PEG_NAMES[i]} peg, ${peg.disks.length} disks${peg.disks.length ? `, top disk ${peg.disks.at(-1)}` : ', empty'}${i === 2 ? ', goal' : ''}`}
            onClick={() => onPeg(i)} />
        ))}
      </div>
    </div>
  );
}
