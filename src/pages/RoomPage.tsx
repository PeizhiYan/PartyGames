import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import GomokuRoom from '../components/gomoku/GomokuRoom';
import MonopolyRoom from '../components/monopoly/MonopolyRoom';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import Sheet from '../components/ui/Sheet';
import { useToast } from '../components/ui/Toast';
import { findGame } from '../domain/games';
import { hasRequested, isOwner, isPlayer } from '../domain/rooms';
import type { Room } from '../domain/types';
import { useCurrentUser } from '../hooks/useAuth';
import { useRoom } from '../hooks/useRooms';
import { firstName } from '../lib/format';
import { backend } from '../services';
import { errorMessage } from '../services/errors';

/**
 * One room, full screen. Decides what the visitor sees — the game, the waiting room, or the "ask
 * to join" screen — and hands the game state to the right game component.
 */
export default function RoomPage() {
  const { game: gameParam, roomId } = useParams();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const game = findGame(gameParam ?? '');
  const { room, error } = useRoom(roomId, user.uid);
  const [busy, setBusy] = useState(false);

  if (!game) return <Gone message="That game isn't in this app." />;
  if (room === undefined) {
    return (
      <div className="center-screen">
        <img src="/icon.svg" alt="Opening the room" width={64} height={64} className="pulse" />
      </div>
    );
  }
  if (room === null) {
    return <Gone message={error || 'That room is closed — everyone left.'} game={gameParam} />;
  }

  const mine = isPlayer(room, user.uid);

  if (!mine) {
    const waiting = hasRequested(room, user.uid);
    const full = room.playerUids.length >= game.maxPlayers;

    async function ask() {
      setBusy(true);
      try {
        await backend.rooms.requestJoin(room!.id);
      } catch (e) {
        toast({ message: errorMessage(e), error: true });
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="center-screen">
        <div className="narrow col">
          <span className="game-card-emoji" style={{ margin: '0 auto' }} aria-hidden>{game.emoji}</span>
          <h1>{room.name}</h1>
          <p className="muted">
            {game.name} · <span className="room-code">{room.code}</span>
            <br />
            {room.players.map((p) => firstName(p.name)).join(', ') || 'Nobody'} in the room.
          </p>
          {waiting ? (
            <p className="row center"><span className="badge badge-accent">Waiting for the host to let you in…</span></p>
          ) : full ? (
            <p className="muted">This room is full.</p>
          ) : (
            <button type="button" className="primary" disabled={busy} onClick={ask}>Ask to join</button>
          )}
          <div className="row center">
            {waiting && (
              <button type="button" className="small" onClick={() => backend.rooms.cancelRequest(room.id, user.uid)}>
                Cancel
              </button>
            )}
            <Link to={`/g/${game.id}`} className="button small">Back to the lobby</Link>
          </div>
        </div>
      </div>
    );
  }

  const Game = game.id === 'gomoku' ? GomokuRoom : MonopolyRoom;

  return (
    <div className="room-screen">
      <RoomHeader room={room} uid={user.uid} onLeave={() => navigate(`/g/${game.id}`)} />
      <Game room={room} uid={user.uid} />
    </div>
  );
}

function Gone({ message, game }: { message: string; game?: string }) {
  return (
    <div className="center-screen">
      <div className="narrow col">
        <h1>Room closed</h1>
        <p className="muted">{message}</p>
        <Link to={game ? `/g/${game}` : '/'} className="button primary">Back to the lobby</Link>
      </div>
    </div>
  );
}

/** The bar above every game: who's here, the code to share, join requests, and the way out. */
function RoomHeader({ room, uid, onLeave }: { room: Room; uid: string; onLeave: () => void }) {
  const toast = useToast();
  const owner = isOwner(room, uid);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(what: 'leave' | 'close') {
    setBusy(true);
    try {
      if (what === 'leave') await backend.rooms.leave(room.id);
      else await backend.rooms.close(room.id);
      onLeave();
    } catch (e) {
      toast({ message: errorMessage(e), error: true });
    } finally {
      setBusy(false);
      setMenu(false);
    }
  }

  async function decide(who: string, approve: boolean) {
    try {
      if (approve) await backend.rooms.approve(room.id, who);
      else await backend.rooms.cancelRequest(room.id, who);
    } catch (e) {
      toast({ message: errorMessage(e), error: true });
    }
  }

  async function share() {
    const text = `Join my ${room.name} room in PartyGames — code ${room.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'PartyGames', text, url: window.location.href });
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        toast({ message: 'Invite copied.' });
      }
    } catch { /* the share sheet was dismissed */ }
  }

  return (
    <>
      <header className="room-bar">
        <button type="button" className="icon-button" aria-label="Leave the room" onClick={() => setMenu(true)}>
          <Icon name="left" />
        </button>
        <div className="grow col" style={{ gap: 0, minWidth: 0 }}>
          <strong className="truncate">{room.name}</strong>
          <button type="button" className="link-button row" style={{ gap: 6 }} onClick={share}>
            <span className="room-code">{room.code}</span>
            <Icon name="copy" size={14} />
          </button>
        </div>
        <span className="faces" aria-label={`${room.players.length} in the room`}>
          {room.players.map((p) => <Avatar key={p.uid} name={p.name} photoURL={p.photoURL} size={30} />)}
        </span>
      </header>

      {owner && room.requests.length > 0 && (
        <div className="room-banner">
          <div className="grow col" style={{ gap: 6 }}>
            <strong style={{ fontSize: '0.95rem' }}>
              {room.requests.length === 1 ? 'Someone wants in' : `${room.requests.length} want in`}
            </strong>
            {room.requests.map((r) => (
              <div key={r.uid} className="row" style={{ gap: 8 }}>
                <Avatar name={r.name} photoURL={r.photoURL} size={28} />
                <span className="grow truncate">{r.name}</span>
                <button type="button" className="small success-fill" onClick={() => decide(r.uid, true)}>
                  <Icon name="check" size={16} /> Let in
                </button>
                <button type="button" className="small" aria-label={`Turn down ${r.name}`} onClick={() => decide(r.uid, false)}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={menu} title="Leave the room" onClose={() => setMenu(false)}>
        <div className="col">
          <p className="muted" style={{ margin: 0 }}>
            {owner
              ? 'If you leave, the next player becomes the host. Closing the room ends it for everyone.'
              : 'You can come back with the room code, as long as somebody is still in there.'}
          </p>
          <button type="button" className="block" disabled={busy} onClick={() => act('leave')}>Leave</button>
          {owner && (
            <button type="button" className="block danger-fill" disabled={busy} onClick={() => act('close')}>
              Close the room for everyone
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
}
