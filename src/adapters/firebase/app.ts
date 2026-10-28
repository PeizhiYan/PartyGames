import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

/**
 * All PartyGames data lives under this document, so it can share a Firebase project (and its
 * sign-in) with other apps — CoffeeGlass sits next to it under /apps/coffeeglass. Must match the
 * `match /apps/partygames` block in firestore.rules.
 */
export const ROOT = 'apps/partygames';

export interface FirebaseContext {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

export function initFirebase(): FirebaseContext {
  const env = import.meta.env;
  if (!env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_PROJECT_ID) {
    throw new Error('Firebase is not configured. Copy .env.example to .env and fill in your Firebase web app config, or run `npm run dev:memory` to try the app without a cloud backend.');
  }
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  // Multi-tab persistent cache: two tabs (or a tab and the installed app) share one connection.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  if (env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return { app, auth, db };
}
