import { useAuth } from '../hooks/useAuth';
import { backend } from '../services';

/** Signed in with Google, but not allowed in (sign-ups closed, or the account was removed). */
export default function NoAccessPage({ email, error }: { email: string; error?: string }) {
  const { recheck } = useAuth();
  return (
    <div className="center-screen">
      <div className="narrow col">
        <img src="/icon.svg" alt="" width={84} height={84} style={{ margin: '0 auto' }} />
        <h1>{error ? 'Could not check your access' : 'Not on the guest list'}</h1>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <p className="muted">
            You are signed in as <strong>{email}</strong>, but this app is invite-only right now.
            Ask the admin to add you, then tap Try again.
          </p>
        )}
        <div className="row center">
          <button type="button" className="primary" onClick={recheck}>Try again</button>
          <button type="button" onClick={() => backend.auth.signOut()}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
