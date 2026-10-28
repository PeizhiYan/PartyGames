/**
 * Installing the app to the home screen.
 *
 * The page already meets the install criteria (manifest, icons, service worker, HTTPS), but
 * browsers differ in what they do about it: Chrome and Edge fire `beforeinstallprompt` and expect
 * the page to hold on to it and ask later, while Safari on iOS and iPadOS never offers anything —
 * the only way in is Share → Add to Home Screen, which people have to be told about.
 *
 * `beforeinstallprompt` fires once, early, and often before React has mounted, so the listeners go
 * on at module load (main.tsx imports this for the side effect) and the result is handed to React
 * through a subscription.
 */
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * iPhone and iPad, including iPadOS 13+, which reports itself as a Mac and has to be told apart by
 * the fact that it has a touchscreen.
 */
function isIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Only Safari can add to the home screen on iOS. Every iOS browser runs WebKit, so they all look
 * like Safari; the other ones give themselves away with their own token in the user agent.
 */
function isIOSSafari(): boolean {
  return isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(navigator.userAgent);
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = isStandalone();
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };

window.addEventListener('beforeinstallprompt', (e) => {
  // Without this the browser shows its own mini-infobar and never tells us again.
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  emit();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  installed = true;
  emit();
});

export type Installability =
  /** Already running as an installed app. */
  | { kind: 'installed' }
  /** The browser will show its install dialog when asked. */
  | { kind: 'prompt'; install: () => Promise<boolean> }
  /** iOS Safari: possible, but only by hand through the share sheet. */
  | { kind: 'manual' }
  /** No way to install here (an iOS browser that isn't Safari, an old browser, a desktop one). */
  | { kind: 'unavailable' };

function read(): Installability {
  if (installed) return { kind: 'installed' };
  if (deferred) {
    return {
      kind: 'prompt',
      install: async () => {
        const event = deferred;
        if (!event) return false;
        // The event is single-use, whatever the person chooses.
        deferred = null;
        await event.prompt();
        const { outcome } = await event.userChoice;
        if (outcome !== 'accepted') emit(); // let the UI drop the button again
        return outcome === 'accepted';
      },
    };
  }
  return isIOSSafari() ? { kind: 'manual' } : { kind: 'unavailable' };
}

export function useInstall(): Installability {
  const [state, setState] = useState<Installability>(read);
  useEffect(() => {
    const update = () => setState(read());
    listeners.add(update);
    // Installing from the browser's own menu doesn't always fire `appinstalled`, but coming back
    // to a page that is now standalone does show up here.
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener('change', update);
    update();
    return () => {
      listeners.delete(update);
      media.removeEventListener('change', update);
    };
  }, []);
  return state;
}
