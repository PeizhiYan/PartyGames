/**
 * Haptics: a small buzz under your thumb on the same events that make a sound — a stone set down,
 * dice rattling, your turn, a win.
 *
 * Phones differ:
 * - **Android** (Chrome, Edge, Samsung Internet) has the Vibration API, so each event gets its own
 *   pattern — a tick for a move, a rattle for dice, a flourish for a win.
 * - **iPhone** has no Vibration API. What iOS 18 does have is a haptic tick whenever a switch-style
 *   checkbox (`<input type="checkbox" switch>`) is toggled, so a hidden one is clicked instead —
 *   once per pulse of the pattern. iOS only allows it while handling the person's own tap, so on an
 *   iPhone you feel your own moves and the results of them, not other players' moves arriving.
 * - Anything else stays still.
 *
 * On or off is per device (localStorage), default on, and independent of sound: some people want
 * the buzz with the sound off.
 */
import type { SoundName } from './sound';

const STORAGE_KEY = 'partygames:haptics';
const listeners = new Set<() => void>();

/** Milliseconds: buzz, pause, buzz… Kept short and light; this is a nudge, not an alarm. */
export const PATTERNS: Record<SoundName, number[]> = {
  tap: [8],
  dice: [10, 40, 10, 40, 10, 60, 18],
  card: [10],
  deal: [8],
  tile: [14],
  stone: [16],
  piece: [16],
  capture: [18, 50, 24],
  coin: [10, 50, 10],
  win: [30, 60, 30, 60, 90],
  lose: [70],
  turn: [14, 90, 14],
  call: [20, 40, 30],
  uno: [14, 40, 14, 40, 14],
  error: [40, 60, 40],
};

type Engine = 'vibrate' | 'ios' | null;

function detect(): Engine {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return null;
  // Desktop Chrome has `vibrate` too, with nothing to vibrate: only a touch screen counts.
  if (typeof navigator.vibrate === 'function' && navigator.maxTouchPoints > 0) return 'vibrate';
  // iPhone and iPad (an iPad says it is a Mac, but a Mac has no touch screen).
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : null;
}

const engine = detect();

/** Whether this device can buzz at all — the Settings card is only offered where it can. */
export const hapticsSupported = (): boolean => engine !== null;

function stored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

let enabled = engine !== null && stored();

export const hapticsEnabled = (): boolean => enabled;

export function setHapticsEnabled(on: boolean): void {
  enabled = on && engine !== null;
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch { /* the choice lasts until reload */ }
  for (const listener of listeners) listener();
  if (enabled) buzz('tap');
}

export function subscribeHaptics(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The hidden switch iOS ticks for. Made once, on first use. */
let iosSwitch: HTMLLabelElement | null = null;

function tickIos(): void {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-10px;top:-10px';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

/** Buzzes for this event, if haptics are on and the device can. Never throws. */
export function buzz(name: SoundName): void {
  if (!enabled || document.hidden) return;
  const pattern = PATTERNS[name];
  try {
    if (engine === 'vibrate') {
      navigator.vibrate(pattern);
    } else if (engine === 'ios') {
      // One tick per pulse, at the pulse's start.
      let at = 0;
      pattern.forEach((ms, i) => {
        if (i % 2 === 0) {
          if (at === 0) tickIos();
          else window.setTimeout(tickIos, at);
        }
        at += ms;
      });
    }
  } catch {
    // A device that refuses simply stays still.
  }
}
