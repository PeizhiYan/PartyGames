import { ART_H, ART_W } from '../art';
import MahjongTile from './Tile';

/**
 * A winning hand on green felt, laid out as its sets on two rows so it fits the safe zone
 * (x 120-520, y 34-166). One row of fourteen tiles was wider than the card crop and lost both ends.
 */
const ROWS: number[][][] = [
  [[36, 40, 44], [72, 76, 80]],                      // 1-2-3 characters, 1-2-3 dots
  [[124, 125, 126], [128, 129, 130], [132, 133]],   // red dragons, green dragons, a pair of whites
];
const W = 34;
const STEP = W + 2;
const GAP = 12;

export default function Art() {
  const rowWidth = (row: number[][]) => row.flat().length * STEP + (row.length - 1) * GAP;
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="game-art" preserveAspectRatio="xMidYMid slice"
      role="img" aria-label="A winning mahjong hand on green felt">
      <defs>
        <radialGradient id="mjFelt" cx="0.5" cy="0.45" r="0.8">
          <stop offset="0" stopColor="#2b7a4b" />
          <stop offset="1" stopColor="#123d25" />
        </radialGradient>
      </defs>
      <rect width={ART_W} height={ART_H} fill="url(#mjFelt)" />
      {ROWS.map((row, r) => {
        let x = 320 - rowWidth(row) / 2;
        const y = 50 + r * 52;
        return row.map((set, s) => {
          const tiles = set.map((t) => {
            const at = x;
            x += STEP;
            return <g key={t} transform={`translate(${at} ${y})`}><MahjongTile tile={t} width={W} /></g>;
          });
          x += GAP;
          return <g key={`${r}-${s}`}>{tiles}</g>;
        });
      })}
    </svg>
  );
}
