import { Link } from 'react-router-dom';
import InstallCard from '../shell/InstallCard';
import ThemePicker from '../shell/ThemePicker';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { useCurrentUser } from '../hooks/useAuth';
import { APP_VERSION } from '../lib/version';
import { backend } from '../services';

export default function SettingsPage() {
  const { user, isAdmin } = useCurrentUser();

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

      <ThemePicker />

      <InstallCard />

      <section className="card">
        <h3>About</h3>
        <ul className="about">
          <li>Gomoku ported from Peizhi's original JavaScript version, computer opponent and all.</li>
          <li>Hanoi Tower brings Peizhi’s seven-disk puzzle and a shared leaderboard.</li>
          <li>Monopoly plays the whole board here, or just banks for the one on your table.</li>
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
