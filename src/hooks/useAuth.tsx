import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppUser } from '../domain/types';
import { backend, type Access } from '../services';
import { errorMessage } from '../services/errors';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'denied'; user: AppUser }
  | { status: 'error'; user: AppUser; message: string }
  | { status: 'ready'; user: AppUser; isAdmin: boolean };

interface AuthContextValue {
  state: AuthState;
  /** Check again (e.g. after the admin let you in). */
  recheck(): void;
}

const AuthContext = createContext<AuthContextValue>({ state: { status: 'loading' }, recheck: () => {} });

// The last access answer is remembered per user so the installed app still opens offline.
// This only affects what the UI shows; the backend enforces access on every request.
const accessKey = (uid: string) => `partygames:access:${uid}`;
function rememberAccess(uid: string, access: Access) {
  try { localStorage.setItem(accessKey(uid), JSON.stringify(access)); } catch { /* storage unavailable */ }
}
function lastKnownAccess(uid: string): Access | null {
  try { return JSON.parse(localStorage.getItem(accessKey(uid)) ?? 'null'); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const run = useRef(0);

  useEffect(() => backend.auth.onChange(setUser), []);

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) { setState({ status: 'signedOut' }); return; }
    const current = ++run.current; // ignore stale checks if the user changes quickly
    setState({ status: 'loading' });
    backend.auth.getAccess(user).then(
      (access) => {
        if (current !== run.current) return;
        rememberAccess(user.uid, access);
        setState(access.allowed ? { status: 'ready', user, isAdmin: access.isAdmin } : { status: 'denied', user });
      },
      (e) => {
        if (current !== run.current) return;
        const cached = lastKnownAccess(user.uid);
        if (cached?.allowed) setState({ status: 'ready', user, isAdmin: cached.isAdmin });
        else setState({ status: 'error', user, message: errorMessage(e) });
      },
    );
  }, [user, attempt]);

  const recheck = useCallback(() => setAttempt((a) => a + 1), []);

  return <AuthContext.Provider value={{ state, recheck }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/** For pages rendered inside the signed-in app shell. */
export function useCurrentUser() {
  const { state } = useAuth();
  if (state.status !== 'ready') throw new Error('useCurrentUser used outside a signed-in route');
  return state;
}
