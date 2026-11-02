import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { hasDevTools } from '../adapters/memory';
import { backend } from '../services';
import Icon from '../ui/Icon';
import { firstName } from '../lib/format';

/**
 * Styles live here rather than in a .css file on purpose. A static CSS import is bundled whether
 * or not the component ever renders, so a dev-only widget would ship its stylesheet to everyone;
 * as a string inside the component it is dead-code-eliminated along with the rest of it.
 */
const STYLES = `
.dev-bar {
  position: fixed;
  left: 10px;
  bottom: 10px;
  z-index: 200;
  display: flex;
  flex-direction: column-reverse;
  gap: 6px;
  align-items: flex-start;
  font-size: 0.8rem;
}
.dev-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.2);
  font: inherit;
  cursor: pointer;
}
.dev-who { font-weight: 700; }
.dev-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 220px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.25);
}
.dev-people { display: flex; flex-wrap: wrap; gap: 6px; }
.dev-bar .small { min-height: 28px; padding: 2px 10px; font-size: 0.8rem; }

/* Out of the way of the phone tab bar. */
@media (max-width: 720px) {
  .dev-bar { bottom: calc(76px + env(safe-area-inset-bottom)); }
}
`;

/** `/g/<game>/<roomId>` → the room id, or null anywhere else. "solo" is not a room. */
function roomIdFrom(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'g' || parts.length < 3 || parts[2] === 'solo') return null;
  return parts[2];
}

/**
 * Playtesting bar. Only in `npm run dev:memory`, and stripped from any production build.
 *
 * A two-player game normally means two browser tabs and the whole ask-to-join dance before you
 * can look at anything, and Monopoly wants four. This invents the other players, seats them in
 * the room you are looking at, and lets one tab act as each in turn — so the whole game is
 * testable on one screen, without deploying.
 */
export default function DevBar() {
  const { pathname } = useLocation();
  const [, bump] = useState(0);
  const [open, setOpen] = useState(false);

  // The identity lives outside React, so a switch has to be told to repaint.
  useEffect(() => backend.auth.onChange(() => bump((n) => n + 1)), []);

  if (!import.meta.env.DEV || !hasDevTools(backend)) return null;
  const dev = backend.dev;
  const me = dev.current();
  const roomId = roomIdFrom(pathname);
  const people = dev.people();

  return (
    <div className={`dev-bar${open ? ' open' : ''}`}>
      <style>{STYLES}</style>
      <button type="button" className="dev-toggle" onClick={() => setOpen(!open)} title="Playtest tools">
        <span aria-hidden>🧪</span>
        <span className="dev-who">{me ? firstName(me.displayName) : 'signed out'}</span>
        <Icon name={open ? 'close' : 'right'} size={14} />
      </button>

      {open && (
        <div className="dev-panel">
          <small className="muted">Acting as</small>
          <div className="dev-people">
            {people.length === 0 && <small className="muted">Sign in first.</small>}
            {people.map((p) => (
              <button
                key={p.uid}
                type="button"
                className={`small${p.uid === me?.uid ? ' primary' : ''}`}
                onClick={() => dev.actAs(p.uid)}
              >
                {firstName(p.displayName)}
              </button>
            ))}
          </div>

          <button type="button" className="small block" onClick={() => dev.addPerson()}>
            <Icon name="plus" size={14} /> Invent another player
          </button>

          {roomId ? (
            <button
              type="button"
              className="small block"
              onClick={() => {
                // Straight into the room: no request, no approval. That dance is tested
                // elsewhere and is pure friction when you are trying to look at a board.
                const person = people.find((p) => p.uid !== me?.uid) ?? dev.addPerson();
                dev.seat(roomId, person);
              }}
            >
              <Icon name="users" size={14} /> Seat someone in this room
            </button>
          ) : (
            <small className="muted">Open a room to seat players in it.</small>
          )}
        </div>
      )}
    </div>
  );
}
