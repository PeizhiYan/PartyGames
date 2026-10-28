import type { CSSProperties } from 'react';
import './Waves.css';

/**
 * The live band of waves along the bottom of every screen.
 *
 * Three layers tinted with `--accent`, so the decoration follows whichever highlight colour is
 * chosen rather than being a fixed brand colour. Each layer holds exactly two periods of the same
 * wave and is twice the viewport wide, so sliding it by one period loops seamlessly; the three
 * drift at different speeds and one runs backwards, which is what keeps the repeat from being
 * noticeable. Purely decorative: fixed, behind everything, and invisible to assistive tech.
 */
export default function Waves() {
  return (
    <div className="app-waves" aria-hidden>
      <svg className="wave wave-back" viewBox="0 0 1440 200" preserveAspectRatio="none" style={{
        '--wave-opacity': 0.08, '--wave-duration': '34s', '--wave-direction': 'normal',
      } as CSSProperties}>
        <path d="M0,74 C120,42 240,42 360,74 C480,106 600,106 720,74 C840,42 960,42 1080,74 C1200,106 1320,106 1440,74 L1440,200 L0,200 Z" />
      </svg>
      <svg className="wave wave-mid" viewBox="0 0 1440 200" preserveAspectRatio="none" style={{
        '--wave-opacity': 0.12, '--wave-duration': '24s', '--wave-direction': 'reverse',
      } as CSSProperties}>
        <path d="M0,106 C120,63.3333 240,63.3333 360,106 C480,148.667 600,148.667 720,106 C840,63.3333 960,63.3333 1080,106 C1200,148.667 1320,148.667 1440,106 L1440,200 L0,200 Z" />
      </svg>
      <svg className="wave wave-front" viewBox="0 0 1440 200" preserveAspectRatio="none" style={{
        '--wave-opacity': 0.18, '--wave-duration': '17s', '--wave-direction': 'normal',
      } as CSSProperties}>
        <path d="M0,140 C120,105.333 240,105.333 360,140 C480,174.667 600,174.667 720,140 C840,105.333 960,105.333 1080,140 C1200,174.667 1320,174.667 1440,140 L1440,200 L0,200 Z" />
      </svg>
    </div>
  );
}
