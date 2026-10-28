import { Link } from 'react-router-dom';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import { useCurrentUser } from '../hooks/useAuth';
import { APP_VERSION } from '../lib/version';
import { backend } from '../services';

export default function SettingsPage() {
  const { user, isAdmin } = useCurrentUser();
  const installed = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return (
    <>
      <header className="page-header"><h1>Settings</h1></header>

      <section className="card">
        <div className="account">
          <Avatar name={user.displayName} photoURL={user.photoURL} size={52} />
          <div className="grow" style={{ minWidth: 0 }}>
            <strong className="truncate" style={{ display: 'block' }}>{user.displayName}</strong>
            <small className="muted truncate" style={{ display: 'block' }}>{user.email}</small>
          </div>
          {isAdmin && <span className="badge badge-accent">Admin</span>}
        </div>
        <button type="button" className="block" onClick={() => backend.auth.signOut()}>
          <Icon name="logout" size={18} /> Sign out
        </button>
      </section>

      {!installed && (
        <section className="card">
          <h3>Install it</h3>
          <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
            Add PartyGames to your home screen and it opens like a normal app, without the browser
            bars. On iPhone or iPad: Share, then <strong>Add to Home Screen</strong>. On Android:
            the browser menu, then <strong>Install app</strong>.
          </p>
        </section>
      )}

      <section className="card">
        <h3>About</h3>
        <ul className="about">
          <li>Gomoku ported from Peizhi's original JavaScript version, computer opponent and all.</li>
          <li>MonopolyBuddy ported from the Socket.io app, now running on the same rooms as everything else.</li>
          <li>Rooms vanish once everybody has left them.</li>
        </ul>
        <p className="row between" style={{ marginBottom: 0 }}>
          <Link to="/privacy">Privacy</Link>
          <small className="muted">Version {APP_VERSION} · {backend.name} backend</small>
        </p>
      </section>
    </>
  );
}
