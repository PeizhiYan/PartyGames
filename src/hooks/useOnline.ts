import { useEffect, useState } from 'react';

/**
 * Whether the browser thinks it has a connection.
 *
 * `navigator.onLine` is only ever a hint — it says the device has *a* network, not that Firestore
 * is reachable — so it is used to explain and to disable, never to decide whether something
 * worked. The things that genuinely need the server report their own errors regardless.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
