// The single switch point: picks which backend adapter the whole app uses.
// To add a backend (e.g. a REST API over your own server), implement `Backend` in
// src/adapters/<name>/ and add it here.
import type { Backend } from './types';
import { createFirebaseBackend } from '../adapters/firebase';
import { createMemoryBackend } from '../adapters/memory';

function createBackend(): Backend {
  const kind = import.meta.env.VITE_BACKEND ?? 'firebase';
  switch (kind) {
    case 'memory':
      return createMemoryBackend();
    case 'firebase':
      return createFirebaseBackend();
    default:
      throw new Error(`Unknown VITE_BACKEND "${kind}". Use "firebase" or "memory".`);
  }
}

let created: Backend | Error;
try {
  created = createBackend();
} catch (e) {
  created = e instanceof Error ? e : new Error(String(e));
}

/** Set when the backend could not start (e.g. missing config). main.tsx shows it instead of the app. */
export const backendInitError: Error | null = created instanceof Error ? created : null;
export const backend: Backend = created as Backend;
export type * from './types';
