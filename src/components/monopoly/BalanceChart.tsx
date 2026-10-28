import type { MonopolyState, Seat } from '../../domain/monopoly/game';
import { firstName, money } from '../../lib/format';

const WIDTH = 320;
const HEIGHT = 140;
const PAD = { left: 4, right: 4, top: 8, bottom: 8 };

/**
 * How everyone's cash moved over the game, as a step line per player — a balance holds its value
 * until the next transaction, so straight segments are the honest shape. Hand-drawn SVG rather
 * than a charting library: one chart isn't worth 100 kB of JavaScript on a phone.
 */
export default function BalanceChart({ state }: { state: MonopolyState }) {
  const series = state.seats
    .map((seat) => ({ seat, points: state.history[seat.uid] ?? [] }))
    .filter((s) => s.points.length > 1);
  if (series.length === 0) return null;

  const times = series.flatMap((s) => s.points.map((p) => p.t));
  const start = Math.min(...times);
  const end = Math.max(...times);
  const span = Math.max(1, end - start);
  const peak = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.b)));

  const x = (t: number) => PAD.left + ((t - start) / span) * (WIDTH - PAD.left - PAD.right);
  const y = (b: number) => HEIGHT - PAD.bottom - (b / peak) * (HEIGHT - PAD.top - PAD.bottom);

  const path = (points: { t: number; b: number }[]) => {
    const steps = points.map((p, i) => (i === 0
      ? `M${x(p.t).toFixed(1)},${y(p.b).toFixed(1)}`
      // Across at the old level, then down (or up) to the new one: a step, not a slope.
      : `H${x(p.t).toFixed(1)}V${y(p.b).toFixed(1)}`));
    // Hold the last balance out to the right edge, so every line ends at the same place.
    return `${steps.join('')}H${x(end).toFixed(1)}`;
  };

  const colorOf = (seat: Seat) => seat.color ?? 'var(--accent)';

  return (
    <section className="card">
      <h3>Cash over the game</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="balance-chart" role="img"
        aria-label={`Balance history. Peak balance ${money(peak)}.`}>
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth="1" />
        {series.map(({ seat, points }) => (
          <path key={seat.uid} d={path(points)} fill="none" stroke={colorOf(seat)}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <ul className="chart-legend">
        {series.map(({ seat }) => (
          <li key={seat.uid}>
            <span className="swatch" style={{ background: colorOf(seat) }} aria-hidden />
            {firstName(seat.name)}
          </li>
        ))}
        <li className="muted">Peak {money(peak)}</li>
      </ul>
    </section>
  );
}
