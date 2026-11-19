import { useEffect, useRef, useSyncExternalStore } from 'react';
import { play, soundEnabled, subscribeSound, type SoundName } from '../lib/sound';
import { hapticsEnabled, subscribeHaptics } from '../lib/haptics';

/** Whether sound is on, kept in step across every toggle on the page. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribeSound, soundEnabled, () => false);
}

/** Whether haptics are on, kept in step with Settings. */
export function useHapticsEnabled(): boolean {
  return useSyncExternalStore(subscribeHaptics, hapticsEnabled, () => false);
}

/**
 * Plays `sound` (and its buzz) whenever `key` changes — a move count, a roll's timestamp, the last card on the
 * pile. Not on the first render, so opening a game mid-way is silent, and not when `sound` is
 * null, so a caller can decide per change ("a capture, or just a move?").
 */
export function useSoundOn(key: unknown, sound: SoundName | null | ((key: unknown) => SoundName | null)): void {
  const first = useRef(true);
  const last = useRef(key);
  const pick = useRef(sound);
  pick.current = sound;
  useEffect(() => {
    if (first.current) { first.current = false; last.current = key; return; }
    if (Object.is(last.current, key)) return;
    last.current = key;
    const chosen = typeof pick.current === 'function' ? pick.current(key) : pick.current;
    if (chosen) play(chosen);
  }, [key]);
}
