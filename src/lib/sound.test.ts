/**
 * The on/off switch. The sounds themselves need a browser's audio and are checked by ear; what can
 * be checked here is that the choice is kept and announced, and that playing never throws where
 * there is no audio at all (tests, an old browser).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});
vi.stubGlobal('window', { addEventListener: () => {} });
vi.stubGlobal('document', { hidden: false });

const sound = await import('./sound');

describe('sound', () => {
  beforeEach(() => { store.clear(); });

  it('is on by default, and remembers being turned off', () => {
    expect(sound.soundEnabled()).toBe(true);
    sound.setSoundEnabled(false);
    expect(sound.soundEnabled()).toBe(false);
    expect(store.get('partygames:sound')).toBe('off');
    sound.setSoundEnabled(true);
    expect(store.get('partygames:sound')).toBe('on');
  });

  it('tells every toggle on the page', () => {
    const heard = vi.fn();
    const stop = sound.subscribeSound(heard);
    sound.setSoundEnabled(false);
    sound.setSoundEnabled(true);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
  });

  it('plays nothing, and does not throw, with no audio to play it on', () => {
    expect(() => sound.play('dice')).not.toThrow();
  });
});
