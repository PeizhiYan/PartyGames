import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import Segmented from '../components/ui/Segmented';
import Sheet from '../components/ui/Sheet';
import { useToast } from '../components/ui/Toast';
import type { Member } from '../domain/types';
import { useCurrentUser } from '../hooks/useAuth';
import { shortDate } from '../lib/format';
import { backend } from '../services';
import { errorMessage } from '../services/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE = 10;

/** One row per email: someone invited, someone who has signed in, or both. */
interface UserRow {
  email: string;
  invited: boolean;
  member?: Member;
}

function merge(allowed: string[], members: Member[]): UserRow[] {
  const rows = new Map<string, UserRow>();
  for (const email of allowed) rows.set(email, { email, invited: true });
  for (const member of members) {
    const row = rows.get(member.email) ?? { email: member.email, invited: false };
    // If the same email somehow has two records, keep the one seen most recently.
    if (!row.member || member.lastSeen > row.member.lastSeen) row.member = member;
    rows.set(member.email, row);
  }
  return [...rows.values()].sort((a, b) => {
    const seen = (b.member?.lastSeen?.getTime() ?? 0) - (a.member?.lastSeen?.getTime() ?? 0);
    return seen !== 0 ? seen : a.email.localeCompare(b.email);
  });
}

export default function AdminPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState('');
  const [signupOpen, setSignupOpen] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [removing, setRemoving] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [allowed, members] = await Promise.all([backend.admin.listAllowed(), backend.admin.listMembers()]);
      setUsers(merge(allowed, members));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    backend.auth.isSignupOpen().then(setSignupOpen).catch((e) => setError(errorMessage(e)));
  }, []);

  async function changeSignup(open: boolean) {
    const previous = signupOpen;
    setSignupOpen(open);
    try {
      await backend.admin.setSignupOpen(open);
      toast({ message: open ? 'Anyone with a Google account can register.' : 'Registration closed — invites only.' });
    } catch (e) {
      setSignupOpen(previous);
      toast({ message: errorMessage(e), error: true });
    }
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!EMAIL_RE.test(target)) { setError('That is not an email address.'); return; }
    setError('');
    try {
      await backend.admin.allow(target);
      setEmail('');
      toast({ message: `${target} can sign in now.` });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function revoke(row: UserRow) {
    try {
      await backend.admin.revoke(row.email);
      await refresh();
      toast({
        message: `Invite for ${row.email} removed.`,
        action: { label: 'Undo', run: () => backend.admin.allow(row.email).then(refresh).catch(() => {}) },
      });
    } catch (err) {
      toast({ message: errorMessage(err), error: true });
    }
  }

  async function removeAccount(row: UserRow) {
    if (!row.member) return;
    setBusy(true);
    try {
      await backend.admin.removeAccount(row.member.uid, row.email);
      setRemoving(null);
      toast({ message: `${row.email} can no longer use the app.` });
      await refresh();
    } catch (err) {
      toast({ message: errorMessage(err), error: true });
    } finally {
      setBusy(false);
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter((u) => u.email.includes(q) || (u.member?.displayName ?? '').toLowerCase().includes(q));
  }, [users, query]);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = matches.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <>
      <header className="page-header"><h1>Users</h1></header>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h3>Registration</h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.92rem' }}>
          Open lets anyone with a Google account in. Invites only means just the people on this list
          (and you) can play.
        </p>
        {signupOpen === null ? <p className="muted">Loading…</p> : (
          <Segmented
            label="Registration"
            value={signupOpen ? 'open' : 'invite'}
            options={[{ id: 'invite', label: 'Invites only' }, { id: 'open', label: 'Open' }]}
            onChange={(v) => changeSignup(v === 'open')}
          />
        )}
      </section>

      <section className="card">
        <h3>Invite someone</h3>
        <form onSubmit={invite} className="field-row">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@gmail.com" aria-label="Email to invite" autoComplete="off" />
          <button type="submit" className="primary"><Icon name="plus" size={16} /> Invite</button>
        </form>
      </section>

      <section className="card">
        <h3>Everyone ({matches.length})</h3>
        <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          placeholder="Search by name or email" aria-label="Search users" style={{ marginBottom: 10 }} />
        {users === null ? <p className="empty">Loading…</p> : (
          <ul className="list">
            {shown.map((row) => {
              const disabled = row.member?.disabled === true;
              const isMe = row.email === user.email;
              return (
                <li key={row.email}>
                  <span className="row grow" style={{ gap: 10, minWidth: 0 }}>
                    <Avatar name={row.member?.displayName || row.email} photoURL={row.member?.photoURL} size={34} />
                    <span className="col grow" style={{ gap: 0, minWidth: 0 }}>
                      <span className="truncate" style={{ fontWeight: 600 }}>
                        {row.member?.displayName || row.email}
                      </span>
                      <small className="muted truncate">
                        {row.member
                          ? `${row.email} · ${row.member.visits ?? 1} visit${(row.member.visits ?? 1) === 1 ? '' : 's'} · last ${shortDate(row.member.lastSeen)}`
                          : `${row.email} · invited, never signed in`}
                      </small>
                    </span>
                  </span>
                  <span className="row" style={{ gap: 6 }}>
                    {disabled && <span className="badge">Removed</span>}
                    {row.invited && !disabled && <span className="badge badge-accent">Invited</span>}
                    {isMe ? <span className="badge badge-gold">You</span> : (
                      <>
                        {row.invited && (
                          <button type="button" className="small" onClick={() => revoke(row)}>Uninvite</button>
                        )}
                        {row.member && !disabled && (
                          <button type="button" className="icon-button" aria-label={`Remove ${row.email}`}
                            onClick={() => setRemoving(row)}>
                            <Icon name="trash" size={18} />
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
            {shown.length === 0 && <li><p className="empty">Nobody yet.</p></li>}
          </ul>
        )}
        {pages > 1 && (
          <div className="pager">
            <button type="button" className="icon-button" aria-label="Previous page"
              disabled={current === 0} onClick={() => setPage(current - 1)}><Icon name="left" /></button>
            <span>{current + 1} / {pages}</span>
            <button type="button" className="icon-button" aria-label="Next page"
              disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><Icon name="right" /></button>
          </div>
        )}
      </section>

      <Sheet open={removing !== null} title="Remove this account?" onClose={() => setRemoving(null)}>
        {removing && (
          <div className="col">
            <p style={{ margin: 0 }}>
              <strong>{removing.member?.displayName || removing.email}</strong> will be locked out of
              PartyGames. Their invite and their rooms go too.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Their Google account itself is not touched — that lives with Google. To delete the
              sign-in record as well, see the Firebase Auth note in the README.
            </p>
            <button type="button" className="danger-fill block" disabled={busy}
              onClick={() => removeAccount(removing)}>
              {busy ? 'Removing…' : 'Remove the account'}
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
