import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findGame } from '../domain/games';
import { activePlayers, standing } from '../domain/rooms';
import type { RoomSummary } from '../domain/types';
import { useOnline } from '../hooks/useOnline';
import { backend } from '../services';
import { errorMessage } from '../services/errors';
import { timeAgo } from '../lib/format';
import Avatar from './ui/Avatar';
import { useToast } from './ui/Toast';

const LABELS = {
  owner: 'Your room',
  player: "You're in",
  requested: 'Waiting for the host',
  joinable: '',
  full: 'Full',
} as const;

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
      toast({ message: 'Asked to join — the host has to let you in.' });
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
                  {room.playerUids.length} {room.playerUids.length === 1 ? 'player' : 'players'}
                  {here < room.playerUids.length ? ` (${here} online)` : ''}
                  {room.requests.length > 0 && where === 'owner'
                    ? ` · ${room.requests.length} waiting`
                    : ` · ${timeAgo(room.updatedAt)}`}
                </span>
              </span>
              <span className="faces" aria-hidden>
                {room.players.slice(0, 3).map((p) => (
                  <Avatar key={p.uid} name={p.name} photoURL={p.photoURL} size={28} />
                ))}
              </span>
              {LABELS[where] ? (
                <span className={`badge${where === 'owner' || where === 'player' ? ' badge-live' : ''}`}>
                  {LABELS[where]}
                </span>
              ) : (
                <span className="badge badge-accent">Ask to join</span>
              )}
            </button>
          </li>
        );
      })}
      {rooms.length === 0 && <li><p className="empty">No rooms open. Start one.</p></li>}
    </ul>
  );
}

