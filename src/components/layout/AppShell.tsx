import type { CSSProperties } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useAuth';
import { APP_VERSION } from '../../lib/version';
import Icon, { type IconName } from '../ui/Icon';
import './AppShell.css';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Play', icon: 'gamepad' },
  { to: '/rooms', label: 'Rooms', icon: 'users' },
  { to: '/settings', label: 'Settings', icon: 'sliders' },
];

// Desktop: floating glass sidebar on the left. Mobile: floating glass tab bar at the bottom.
// Same markup, switched by CSS; in both, a glass lens slides to the current page.
export default function AppShell() {
  const { isAdmin } = useCurrentUser();
  const items = isAdmin ? [...NAV, { to: '/admin', label: 'Users', icon: 'lock' as IconName }] : NAV;
  const { pathname } = useLocation();
  // Which item the lens sits under ('/' only matches exactly, like NavLink's `end`).
  const active = items.findIndex((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));

  return (
    <div className="shell">
      <nav className="shell-nav" aria-label="Main"
        style={{ '--tabs': items.length, '--active': Math.max(active, 0) } as CSSProperties}>
        <div className="shell-brand">
          <img src="/icon.svg" alt="" width={32} height={32} />
          <span>PartyGames</span>
        </div>
        <div className="shell-tabs">
          {active >= 0 && <span className="shell-lens" aria-hidden />}
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="shell-link">
              <Icon name={item.icon} size={22} />
              <span className="shell-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
        <small className="shell-version">v{APP_VERSION}</small>
      </nav>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
