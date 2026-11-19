/**
 * Haptics on both kinds of phone, with the browser faked: Android's Vibration API, and the hidden
 * switch iPhone ticks for. The module decides which it has when it loads, so each case loads it
 * afresh.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SOUND_NAMES } from './sound';

const store = new Map<string, string>();
const storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};

async function load(nav: Partial<Navigator>, doc: Partial<Document> = { hidden: false }) {
  vi.resetModules();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('navigator', { userAgent: 'test', maxTouchPoints: 0, ...nav });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', { setTimeout: (f: () => void) => { f(); return 0; } });
  return import('./haptics');
}

afterEach(() => { vi.unstubAllGlobals(); store.clear(); });

describe('haptics', () => {
  it('has a short pattern for every event that makes a sound', async () => {
    const { PATTERNS } = await load({});
    for (const name of SOUND_NAMES) {
      expect(PATTERNS[name].length, name).toBeGreaterThan(0);
      expect(PATTERNS[name].reduce((a, b) => a + b, 0), name).toBeLessThan(400);
    }
  });

  it('vibrates where the Vibration API exists, and stops when turned off', async () => {
    const vibrate = vi.fn(() => true);
    const h = await load({ vibrate, maxTouchPoints: 5 } as Partial<Navigator>);
    expect(h.hapticsSupported()).toBe(true);
    h.buzz('dice');
    expect(vibrate).toHaveBeenLastCalledWith(h.PATTERNS.dice);
    h.setHapticsEnabled(false);
    vibrate.mockClear();
    h.buzz('win');
    expect(vibrate).not.toHaveBeenCalled();
    expect(store.get('partygames:haptics')).toBe('off');
  });

  it('on an iPhone, clicks a hidden switch once per pulse', async () => {
    const click = vi.fn();
    const made: Record<string, unknown>[] = [];
    const doc = {
      hidden: false,
      body: { appendChild: vi.fn() },
      createElement: (tag: string) => {
        const el: Record<string, unknown> = { tag, style: {}, setAttribute: vi.fn(), appendChild: vi.fn(), click };
        made.push(el);
        return el;
      },
    } as unknown as Partial<Document>;
    const h = await load({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }, doc);
    expect(h.hapticsSupported()).toBe(true);
    h.buzz('turn'); // two pulses
    expect(click).toHaveBeenCalledTimes(2);
    expect(made.some((el) => el.tag === 'input' && el.type === 'checkbox')).toBe(true);
  });

  it('stays still on a desktop, even one whose browser has the Vibration API', async () => {
    const h = await load({ userAgent: 'Desktop', maxTouchPoints: 0, vibrate: () => true } as Partial<Navigator>);
    expect(h.hapticsSupported()).toBe(false);
    expect(h.hapticsEnabled()).toBe(false);
    expect(() => h.buzz('win')).not.toThrow();
  });
});
