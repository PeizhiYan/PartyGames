import { useAuth } from '../hooks/useAuth';
import { backend } from '../services';
import { t } from '../i18n';

/** Signed in with Google, but not allowed in (sign-ups closed, or the account was removed). */
export default function NoAccessPage({ email, error }: { email: string; error?: string }) {
  const { recheck } = useAuth();
  return (
    <div className="center-screen">
      <div className="narrow col">
        <img src="/icon.svg" alt="" width={84} height={84} style={{ margin: '0 auto' }} />
        <h1>{error ? t.noAccess.checkFailed : t.noAccess.notListed}</h1>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <p className="muted">
            {t.noAccess.signedInAs}<strong>{email}</strong>{t.noAccess.inviteOnly}
          </p>
        )}
        <div className="row center">
          <button type="button" className="primary" onClick={recheck}>{t.common.tryAgain}</button>
          <button type="button" onClick={() => backend.auth.signOut()}>{t.common.signOut}</button>
        </div>
      </div>
    </div>
  );
}
