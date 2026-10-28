import { FirebaseError } from 'firebase/app';
import {
  getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect,
  signOut, type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { AppUser } from '../../domain/types';
import type { AuthService } from '../../services/types';
import { ROOT, type FirebaseContext } from './app';
import { mapError, wrap } from './errors';

function toAppUser(u: User): AppUser {
  return {
    uid: u.uid,
    email: (u.email ?? '').toLowerCase(),
    displayName: u.displayName ?? u.email ?? 'Player',
    photoURL: u.photoURL ?? undefined,
  };
}

export function createAuthService({ auth, db }: FirebaseContext): AuthService {
  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL ?? '').toLowerCase();
  // Completes a redirect sign-in (used when popups are blocked). Success arrives via onChange.
  getRedirectResult(auth).catch((e) => console.error('PartyGames: redirect sign-in failed', e));

  const signupOpen = async () => (await getDoc(doc(db, ROOT, 'config', 'access'))).data()?.openSignup === true;

  return {
    isSignupOpen: () => wrap(signupOpen),

    onChange(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? toAppUser(u) : null));
    },

    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        // Popups are often blocked in installed PWAs / some mobile browsers.
        const code = (e as { code?: string }).code;
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return;
        }
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        throw mapError(e);
      }
    },

    signOut: () => wrap(() => signOut(auth)),

    async getAccess(user) {
      const isAdmin = user.email === adminEmail;
      if (isAdmin) return { allowed: true, isAdmin };
      try {
        // A member record marked `disabled` is how the admin locks someone out without
        // waiting for their allowlist entry to matter again.
        const member = await getDoc(doc(db, ROOT, 'members', user.uid));
        if (member.data()?.disabled === true) return { allowed: false, isAdmin };
        if (await signupOpen()) return { allowed: true, isAdmin };
        const entry = await getDoc(doc(db, ROOT, 'allowlist', user.email));
        return { allowed: entry.exists(), isAdmin };
      } catch (e) {
        if (e instanceof FirebaseError && e.code === 'permission-denied') return { allowed: false, isAdmin };
        // Offline with nothing cached, etc.: let the caller decide (it may use the last answer).
        throw mapError(e);
      }
    },
  };
}
