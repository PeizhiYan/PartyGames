import { useState } from 'react';
import { useInstall } from '../hooks/useInstall';
import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { t } from '../i18n';

/** The iOS share glyph, so the instructions point at the button people are actually looking for. */
const SHARE_GLYPH = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ verticalAlign: '-3px', margin: '0 2px' }}>
    <path d="M12 15V3 M8 7l4-4 4 4 M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
  </svg>
);

const DISMISSED = 'partygames:install-dismissed';

const wasDismissed = (): boolean => {
  try { return localStorage.getItem(DISMISSED) === '1'; } catch { return false; }
};

/**
 * Offers to install the app. Chrome and Edge get a button that opens their install dialog; iOS
 * Safari, which has no such dialog, gets the two steps to do it by hand. Renders nothing when the
 * app is already installed or the browser can't do it at all.
 *
 * `compact` is the home-page copy: shorter, and it can be waved away for good.
 */
export default function InstallCard({ compact }: { compact?: boolean }) {
  const state = useInstall();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Only the home-page copy can be dismissed; Settings always offers it.
  const [hidden, setHidden] = useState(() => compact === true && wasDismissed());

  if (state.kind === 'installed' || state.kind === 'unavailable' || hidden) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISSED, '1'); } catch { /* storage unavailable */ }
    setHidden(true);
  }

  async function install() {
    if (state.kind !== 'prompt') return;
    setBusy(true);
    try {
      await state.install();
    } catch {
      toast({ message: t.install.failed, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card install-card">
      <div className="row between">
        <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
          <strong>{t.install.title}</strong>
          <small className="muted">
            {compact ? t.install.short : t.install.long}
          </small>
        </div>
        {state.kind === 'prompt' && (
          <button type="button" className="primary" disabled={busy} onClick={install}>
            <Icon name="plus" size={16} /> {t.install.install}
          </button>
        )}
        {compact && (
          <button type="button" className="icon-button" aria-label={t.install.notNow} onClick={dismiss}>
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      {state.kind === 'manual' && (
        <ol className="install-steps">
          <li>{t.install.stepShareBefore}{SHARE_GLYPH} <strong>{t.install.share}</strong>{t.install.stepShareAfter}</li>
          <li>{t.install.stepAddBefore}<strong>{t.install.addToHome}</strong>{t.install.stepAddAfter}</li>
        </ol>
      )}
    </section>
  );
}
