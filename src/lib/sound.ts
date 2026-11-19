import { buzz } from './haptics';
/**
 * Sound effects, synthesised with the Web Audio API — no audio files, so they cost nothing to
 * download, work offline, and can be tuned in code.
 *
 * Each sound is a few oscillators and bursts of filtered noise with short envelopes: wood for
 * stones and pieces, a rattle for dice, a swish for cards, a clack for mahjong tiles, a few notes
 * for coins, calls and fanfares. All of them are quiet and short; this is a game between friends
 * at a table, not an arcade.
 *
 * On or off is per device (localStorage), default on. Browsers keep audio silent until the person
 * has tapped something, so the first tap anywhere unlocks it.
 */

export type SoundName =
  | 'tap' | 'dice' | 'card' | 'deal' | 'tile' | 'stone' | 'piece' | 'capture'
  | 'coin' | 'win' | 'lose' | 'turn' | 'call' | 'uno' | 'error';

const STORAGE_KEY = 'partygames:sound';
const listeners = new Set<() => void>();

function stored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

let enabled = typeof window === 'undefined' ? false : stored();

export const soundEnabled = (): boolean => enabled;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch { /* the choice lasts until reload */ }
  for (const listener of listeners) listener();
  if (on) play('tap');
}

/** For `useSyncExternalStore`: the toggle and Settings stay in step. */
export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/* ── The audio graph ──────────────────────────────────────────────────────── */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** One second of white noise per context, reused by every rattle, swish and click. */
const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseFor(c: BaseAudioContext): AudioBuffer {
  let buffer = noises.get(c);
  if (!buffer) {
    buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    noises.set(c, buffer);
  }
  return buffer;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  return ctx;
}

// A tap anywhere is what lets a browser make sound at all; unlock on the first one.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = audio();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

interface Tone {
  type?: OscillatorType;
  freq: number;
  /** Where the pitch glides to by the end. */
  to?: number;
  at?: number;
  dur: number;
  gain?: number;
}

function tone(c: BaseAudioContext, out: AudioNode, { type = 'sine', freq, to, at = 0, dur, gain = 0.3 }: Tone): void {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

interface Burst {
  at?: number;
  dur: number;
  /** Band-pass centre, swept to `to` if given. */
  freq: number;
  to?: number;
  q?: number;
  gain?: number;
}

function burst(c: BaseAudioContext, out: AudioNode, { at = 0, dur, freq, to, q = 1.2, gain = 0.3 }: Burst): void {
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseFor(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t0);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(env).connect(out);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

/** A woody knock: a falling triangle with a click on top. */
const knock = (c: BaseAudioContext, o: AudioNode, at: number, pitch: number, gain = 0.35) => {
  tone(c, o, { type: 'triangle', freq: pitch, to: pitch * 0.55, at, dur: 0.09, gain });
  burst(c, o, { at, dur: 0.025, freq: 3200, q: 0.8, gain: gain * 0.6 });
};

const NOTES = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, G4: 392, E4: 329.63, C4: 261.63, B5: 987.77, E6: 1318.5 };

const RECIPES: Record<SoundName, (c: BaseAudioContext, o: AudioNode) => void> = {
  tap: (c, o) => tone(c, o, { freq: 880, dur: 0.05, gain: 0.2 }),
  dice: (c, o) => {
    // A handful of hard little clicks, unevenly spaced, then the dice settling.
    [0, 0.05, 0.11, 0.16, 0.24, 0.31].forEach((at, i) => burst(c, o, { at: at + Math.random() * 0.02, dur: 0.035, freq: 2600 + i * 180, q: 2, gain: 0.6 - i * 0.06 }));
    knock(c, o, 0.36, 420, 0.18);
  },
  card: (c, o) => burst(c, o, { dur: 0.14, freq: 1400, to: 4200, q: 0.9, gain: 0.6 }),
  deal: (c, o) => burst(c, o, { dur: 0.08, freq: 2200, to: 5000, q: 1, gain: 0.4 }),
  tile: (c, o) => {
    // Bone on felt: a bright clack and a low tap underneath.
    burst(c, o, { dur: 0.035, freq: 2500, q: 3, gain: 0.38 });
    tone(c, o, { type: 'triangle', freq: 320, to: 210, dur: 0.06, gain: 0.25 });
  },
  stone: (c, o) => knock(c, o, 0, 760, 0.4),
  piece: (c, o) => knock(c, o, 0, 300, 0.4),
  capture: (c, o) => { knock(c, o, 0, 300, 0.4); knock(c, o, 0.07, 240, 0.32); },
  coin: (c, o) => {
    tone(c, o, { type: 'square', freq: NOTES.B5, dur: 0.07, gain: 0.14 });
    tone(c, o, { type: 'square', freq: NOTES.E6, at: 0.07, dur: 0.28, gain: 0.14 });
  },
  win: (c, o) => {
    [NOTES.C5, NOTES.E5, NOTES.G5].forEach((freq, i) => tone(c, o, { type: 'triangle', freq, at: i * 0.1, dur: 0.18, gain: 0.25 }));
    tone(c, o, { type: 'triangle', freq: NOTES.C6, at: 0.3, dur: 0.6, gain: 0.28 });
  },
  lose: (c, o) => [NOTES.G4, NOTES.E4, NOTES.C4].forEach((freq, i) => tone(c, o, { type: 'sine', freq, at: i * 0.16, dur: 0.3, gain: 0.2 })),
  turn: (c, o) => {
    tone(c, o, { freq: 660, dur: 0.18, gain: 0.16 });
    tone(c, o, { freq: 990, at: 0.09, dur: 0.32, gain: 0.14 });
  },
  call: (c, o) => {
    tone(c, o, { type: 'square', freq: NOTES.C5, dur: 0.08, gain: 0.15 });
    tone(c, o, { type: 'square', freq: NOTES.G5, at: 0.08, dur: 0.18, gain: 0.15 });
    burst(c, o, { dur: 0.04, freq: 2500, q: 3, gain: 0.3 });
  },
  uno: (c, o) => [NOTES.E5, NOTES.G5, NOTES.C6].forEach((freq, i) => tone(c, o, { type: 'square', freq, at: i * 0.06, dur: 0.12, gain: 0.15 })),
  error: (c, o) => tone(c, o, { type: 'square', freq: 150, to: 120, dur: 0.14, gain: 0.07 }),
};

/**
 * Plays an event's feedback now: its sound, if sound is on and the page can be heard, and its buzz
 * (`./haptics`), if haptics are on — each with its own switch. Never throws.
 */
export function play(name: SoundName): void {
  if (typeof document === 'undefined') return;
  buzz(name);
  if (!enabled || document.hidden) return;
  try {
    const c = audio();
    if (!c || !master) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    RECIPES[name](c, master);
  } catch {
    // Audio is a nicety; a device that cannot make it simply stays quiet.
  }
}

/** Schedules one sound into any context and output — for rendering it offline, to check it. */
export function renderSound(c: BaseAudioContext, out: AudioNode, name: SoundName): void {
  RECIPES[name](c, out);
}

export const SOUND_NAMES = Object.keys(RECIPES) as SoundName[];
