import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findGame } from '../games/registry';
import { activePlayers, standing } from './rules';
import type { RoomSummary } from '../types';
import { useOnline } from '../hooks/useOnline';
import { backend } from '../services';
import { errorMessage } from '../services/errors';
import { timeAgo } from '../lib/format';
import Avatar from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import { t } from '../i18n';

const labels = () => ({
  owner: t.rooms.yours,
  player: t.rooms.youreIn,
  requested: t.rooms.waitingHost,
  joinable: '',
  full: t.rooms.full,
});

/** One tappable row per room. Used by a game's lobby and by the Rooms tab. */
export default function RoomList({ rooms, uid, showGame }: {
  rooms: RoomSummary[];
  uid: string;
  /** Include which game each room is for (the Rooms tab mixes them). */
  showGame?: boolean;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const online = useOnline();

  async function ask(room: RoomSummary) {
    setBusy(room.id);
    try {
      await backend.rooms.requestJoin(room.id);
      toast({ message: t.rooms.asked });
    } catch (e) {
      toast({ message: errorMessage(e), error: true });
    } finally {
      setBusy('');
    }
  }

  return (
    <ul className="list">
      {rooms.map((room) => {
        const game = findGame(room.game);
        const where = standing(room, uid, game?.maxPlayers ?? 8);
        const inside = where === 'owner' || where === 'player';
        const here = activePlayers(room).length;
        return (
          <li key={room.id}>
            <button
              type="button"
              className="room-row grow"
              disabled={busy === room.id || where === 'full' || where === 'requested' || (!inside && !online)}
              onClick={() => (inside ? navigate(`/g/${room.game}/${room.id}`) : ask(room))}
            >
              <span className="game-card-emoji" style={{ width: 40, height: 40, fontSize: '1.2rem', margin: 0 }} aria-hidden>
                {game?.emoji ?? '🎮'}
              </span>
              <span className="grow col" style={{ gap: 2 }}>
                <span className="room-name truncate">{room.name}</span>
                <span className="muted" style={{ fontSize: '0.82rem' }}>
                  {showGame && game ? `${game.name} · ` : ''}
                  <span className="room-code">{room.code}</span>
                  {' · '}
                  {t.common.players(room.playerUids.length)}
                  {here < room.playerUids.length ? t.rooms.online(here) : ''}
                  {room.requests.length > 0 && where === 'owner'
                    ? ` · ${t.rooms.waiting(room.requests.length)}`
                    : ` · ${timeAgo(room.updatedAt)}`}
                </span>
              </span>
              <span className="faces" aria-hidden>
                {room.players.slice(0, 3).map((p) => (
                  <Avatar key={p.uid} name={p.name} photoURL={p.photoURL} size={28} />
                ))}
              </span>
              {labels()[where] ? (
                <span className={`badge${where === 'owner' || where === 'player' ? ' badge-live' : ''}`}>
                  {labels()[where]}
                </span>
              ) : (
                <span className="badge badge-accent">{t.rooms.askToJoin}</span>
              )}
            </button>
          </li>
        );
      })}
      {rooms.length === 0 && <li><p className="empty">{t.rooms.none}</p></li>}
    </ul>
  );
}

