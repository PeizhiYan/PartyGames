import type { CSSProperties } from 'react';
import './Backdrop.css';

/**
 * The live band along the bottom of every screen, in whichever form the Appearance setting asks
 * for. Purely decorative: fixed, behind everything, and invisible to assistive tech.
 *
 * All three forms are rendered and the CSS shows one, keyed off `data-backdrop` on <html> — the
 * same trick the accent and light/dark settings use, so switching needs no React state and no
 * re-render. A hidden one is `display: none`, which stops its animations dead, so the two you
 * are not looking at cost some empty elements and nothing else.
 *
 * Everything is tinted with `--accent`, so the decoration follows the chosen highlight colour
 * rather than being a fixed brand colour, and everything stops under `prefers-reduced-motion`.
 */
export default function Backdrop() {
  return (
    <div className="app-backdrop" aria-hidden>
      <Waves />
      <Smoke />
      <Particles />
    </div>
  );
}

/* ── The three layers every form is built from ────────────────────────────── */

/**
 * One swell. All three forms draw these same three layers, so smoke and particles read as the
 * same band of waves in a different material rather than as three unrelated decorations.
 *
 * `base` and `amp` describe the same curve the path draws — `y = base - amp·sin(2πx / 720)` —
 * so the particles can sit on it without anyone having to parse an SVG path. Keep them in step
 * if a path changes.
 *
 * **The period is 720 of the viewBox's 1440.** Each layer is two viewports wide and holds two
 * periods, so `translateX(-50%)` is exactly one period and the loop has no seam. Anything else
 * positioned along a layer has to repeat on that same period or the loop will visibly jump.
 */
const PERIOD = 720;

interface Layer {
  d: string;
  base: number;
  amp: number;
  opacity: number;
  duration: string;
  direction: 'normal' | 'reverse';
}

const LAYERS: Layer[] = [
  {
    d: 'M0,74 C120,42 240,42 360,74 C480,106 600,106 720,74 C840,42 960,42 1080,74 C1200,106 1320,106 1440,74 L1440,200 L0,200 Z',
    base: 74, amp: 32, opacity: 0.08, duration: '34s', direction: 'normal',
  },
  {
    d: 'M0,106 C120,63.3333 240,63.3333 360,106 C480,148.667 600,148.667 720,106 C840,63.3333 960,63.3333 1080,106 C1200,148.667 1320,148.667 1440,106 L1440,200 L0,200 Z',
    base: 106, amp: 42.667, opacity: 0.12, duration: '24s', direction: 'reverse',
  },
  {
    d: 'M0,140 C120,105.333 240,105.333 360,140 C480,174.667 600,174.667 720,140 C840,105.333 960,105.333 1080,140 C1200,174.667 1320,174.667 1440,140 L1440,200 L0,200 Z',
    base: 140, amp: 34.667, opacity: 0.18, duration: '17s', direction: 'normal',
  },
];

/** The drift vars every form's layers share. */
const drift = (l: Layer, opacity: number): CSSProperties => ({
  '--wave-opacity': opacity,
  '--wave-duration': l.duration,
  '--wave-direction': l.direction,
} as CSSProperties);

/* ── Waves ────────────────────────────────────────────────────────────────── */

/** The swell as solid water: the three layers drift at different speeds and one runs backwards. */
function Waves() {
  return (
    <div className="backdrop-layer backdrop-waves">
      {LAYERS.map((l, i) => (
        <svg key={i} className="wave" viewBox="0 0 1440 200" preserveAspectRatio="none"
          style={drift(l, l.opacity)}>
          <path d={l.d} />
        </svg>
      ))}
    </div>
  );
}

/* ── Smoke ────────────────────────────────────────────────────────────────── */

/**
 * The same swell, blurred until the crests dissolve, with each layer slowly breathing.
 *
 * Blur spreads the ink thin, so these carry about twice the waves' opacity. Not much more than
 * that: three blurred layers pile up near the waterline, and at three times it stopped being
 * smoke and became a solid orange band along the bottom of the page.
 *
 * The breathe is a second transform, which is why it lives on an inner element: the outer one is
 * already using `transform` for the drift, and the two would overwrite each other.
 */
const BREATHE = ['19s', '15s', '23s'];

function Smoke() {
  return (
    <div className="backdrop-layer backdrop-smoke">
      {LAYERS.map((l, i) => (
        <span key={i} className="smoke" style={drift(l, l.opacity * 1.9)}>
          <svg className="smoke-art" viewBox="0 0 1440 200" preserveAspectRatio="none"
            style={{ '--breathe': BREATHE[i] } as CSSProperties}>
            <path d={l.d} />
          </svg>
        </span>
      ))}
    </div>
  );
}

/* ── Particles ────────────────────────────────────────────────────────────── */

/** Deterministic pseudo-random in [0,1). Same arrangement on every load. */
const frac = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Columns of motes per period. Two periods are drawn, so a layer holds twice this. */
const COLUMNS = 24;
/** Motes stacked under each column's crest. */
const DEPTH = 3;
/**
 * How much slower the spray drifts than the water. Spray is lighter than a wave and reads wrong
 * moving at the same speed — at the waves' pace a few hundred dots look like they are being
 * dragged sideways rather than hanging in the air.
 */
const SPRAY_SLOWDOWN = 2.4;

/**
 * The same swell again, this time as spray: motes scattered along each wave's curve, thickest at
 * the crest and thinning downwards, each wandering a little on its own.
 *
 * **Every per-mote number is seeded from `c % COLUMNS`, not from `c`.** The layer loops by
 * sliding one period, so the second period has to be pixel-identical to the first; seeding off
 * the absolute column would reshuffle the scatter halfway along and the loop would visibly jump.
 * That applies to the wander too — a mote and its counterpart one period away have to be at the
 * same point of the same wander when the layer jumps home, which they are, because they share a
 * seed and therefore a duration and a delay.
 */
function motesFor(l: Layer, layerIndex: number) {
  const out: {
    left: number; top: number; size: number; opacity: number; wander: CSSProperties;
  }[] = [];
  for (let c = 0; c < COLUMNS * 2; c += 1) {
    const x = (c / (COLUMNS * 2)) * 1440;
    const crest = l.base - l.amp * Math.sin((2 * Math.PI * x) / PERIOD);
    for (let k = 0; k < DEPTH; k += 1) {
      const seed = layerIndex * 997 + (c % COLUMNS) * 13 + k * 211;
      // Squared, so most motes hug the crest and a few trail below it.
      const drop = frac(seed) ** 2 * 86;
      const jitter = (frac(seed + 41) - 0.5) * (1440 / (COLUMNS * 2)) * 0.9;
      // Three waypoints, so the wander is a loop rather than a line it retraces. Vertical
      // reach is the larger of the two: the horizontal is already the layer's job, and the
      // motes only need to come unstuck from it.
      const way = (n: number, spread: number) => (frac(seed + n) - 0.5) * spread;
      out.push({
        left: ((x + jitter) / 1440) * 100,
        top: (crest + drop) / 2,
        size: 1.8 + frac(seed + 83) * 3.2,
        // Fainter than when there were a third as many: the same alpha turned the crest solid.
        opacity: 0.22 + frac(seed + 127) * 0.46,
        wander: {
          '--wx1': `${way(301, 22)}px`, '--wy1': `${way(307, 30)}px`,
          '--wx2': `${way(311, 22)}px`, '--wy2': `${way(313, 30)}px`,
          '--wx3': `${way(317, 22)}px`, '--wy3': `${way(331, 30)}px`,
          '--wd': `${9 + frac(seed + 337) * 13}s`,
          '--wdelay': `${-frac(seed + 347) * 22}s`,
        } as CSSProperties,
      });
    }
  }
  return out;
}

const MOTES = LAYERS.map(motesFor);

/** A layer's drift duration, stretched for the spray. */
const slower = (duration: string): string => `${parseFloat(duration) * SPRAY_SLOWDOWN}s`;

function Particles() {
  return (
    <div className="backdrop-layer backdrop-particles">
      {LAYERS.map((l, i) => (
        <span key={i} className="spray"
          style={{ ...drift(l, 1), '--wave-duration': slower(l.duration) } as CSSProperties}>
          {MOTES[i].map((m, j) => (
            <span key={j} className="mote" style={{
              left: `${m.left}%`, top: `${m.top}%`,
              width: `${m.size}px`, height: `${m.size}px`,
              '--o': m.opacity,
              ...m.wander,
            } as CSSProperties} />
          ))}
        </span>
      ))}
    </div>
  );
}
