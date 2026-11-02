import type { CSSProperties } from 'react';
import './Backdrop.css';

/**
 * The live band along the bottom of every screen, in whichever form the Appearance setting asks
 * for. Purely decorative: fixed, behind everything, and invisible to assistive tech.
 *
 * All three forms are rendered and the CSS shows one, keyed off `data-backdrop` on <html> — the
 * same trick the accent and light/dark settings use, so switching needs no React state and no
 * re-render. A hidden one is `display: none`, which stops its animations dead, so the two you
 * are not looking at cost a few dozen empty elements and nothing else.
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

/**
 * Three layers of swell.
 *
 * Each layer holds exactly two periods of the same wave and is twice the viewport wide, so
 * sliding it by one period loops seamlessly; the three drift at different speeds and one runs
 * backwards, which is what keeps the repeat from being noticeable. Change a period and the
 * animation has to change with it.
 */
function Waves() {
  return (
    <div className="backdrop-layer backdrop-waves">
      <svg className="wave" viewBox="0 0 1440 200" preserveAspectRatio="none" style={{
        '--wave-opacity': 0.08, '--wave-duration': '34s', '--wave-direction': 'normal',
      } as CSSProperties}>
        <path d="M0,74 C120,42 240,42 360,74 C480,106 600,106 720,74 C840,42 960,42 1080,74 C1200,106 1320,106 1440,74 L1440,200 L0,200 Z" />
      </svg>
      <svg className="wave" viewBox="0 0 1440 200" preserveAspectRatio="none" style={{
        '--wave-opacity': 0.12, '--wave-duration': '24s', '--wave-direction': 'reverse',
      } as CSSProperties}>
        <path d="M0,106 C120,63.3333 240,63.3333 360,106 C480,148.667 600,148.667 720,106 C840,63.3333 960,63.3333 1080,106 C1200,148.667 1320,148.667 1440,106 L1440,200 L0,200 Z" />
      </svg>
      <svg className="wave" viewBox="0 0 1440 200" preserveAspectRatio="none" style={{
        '--wave-opacity': 0.18, '--wave-duration': '17s', '--wave-direction': 'normal',
      } as CSSProperties}>
        <path d="M0,140 C120,105.333 240,105.333 360,140 C480,174.667 600,174.667 720,140 C840,105.333 960,105.333 1080,140 C1200,174.667 1320,174.667 1440,140 L1440,200 L0,200 Z" />
      </svg>
    </div>
  );
}

/**
 * Soft blurred clouds, each drifting and swelling on its own clock.
 *
 * `alternate` rather than a loop back to the start: a cloud that teleports home is the one thing
 * that gives this away as a short animation on repeat. Sized in percentages of the band so the
 * same five clouds work on a phone and on a monitor.
 */
const CLOUDS = [
  { left: '-12%', width: '46%', duration: '26s', delay: '0s', opacity: 0.4, drift: '18%' },
  { left: '16%', width: '32%', duration: '34s', delay: '-9s', opacity: 0.35, drift: '-15%' },
  { left: '40%', width: '50%', duration: '29s', delay: '-17s', opacity: 0.38, drift: '14%' },
  { left: '66%', width: '36%', duration: '38s', delay: '-5s', opacity: 0.32, drift: '-20%' },
  { left: '82%', width: '44%', duration: '31s', delay: '-13s', opacity: 0.35, drift: '16%' },
  { left: '-5%', width: '90%', duration: '46s', delay: '-22s', opacity: 0.2, drift: '10%' },
];

function Smoke() {
  return (
    <div className="backdrop-layer backdrop-smoke">
      {CLOUDS.map((c, i) => (
        <span key={i} className="cloud" style={{
          '--left': c.left, '--w': c.width, '--d': c.duration,
          '--delay': c.delay, '--o': c.opacity, '--drift': c.drift,
        } as CSSProperties} />
      ))}
    </div>
  );
}

/**
 * Motes rising and fading out.
 *
 * The scatter is computed from each mote's index rather than `Math.random()`, so the same
 * arrangement comes back every load instead of the band rearranging itself on every navigation.
 * Negative delays start them part-way up, so the band is already full on the first frame rather
 * than filling from empty.
 */
const frac = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/*
 * The rise is in pixels, not percent. A percentage in `translate` resolves against the element's
 * own box, and a mote is 4px across — the first version asked them to travel 60% and they moved
 * three pixels. The band is 140-260px tall, so these carry a mote out of the top of it.
 */
const MOTES = Array.from({ length: 34 }, (_, i) => ({
  left: `${frac(i) * 100}%`,
  size: `${3 + frac(i + 50) * 5}px`,
  duration: `${12 + frac(i + 100) * 15}s`,
  delay: `${-frac(i + 150) * 27}s`,
  rise: `${150 + frac(i + 200) * 150}px`,
  sway: `${(frac(i + 250) - 0.5) * 80}px`,
  opacity: 0.22 + frac(i + 300) * 0.32,
}));

function Particles() {
  return (
    <div className="backdrop-layer backdrop-particles">
      {MOTES.map((m, i) => (
        <span key={i} className="mote" style={{
          '--left': m.left, '--s': m.size, '--d': m.duration,
          '--delay': m.delay, '--rise': m.rise, '--sway': m.sway, '--o': m.opacity,
        } as CSSProperties} />
      ))}
    </div>
  );
}
