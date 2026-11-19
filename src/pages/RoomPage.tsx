import SoundToggle from '../ui/SoundToggle';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import OfflineNotice from '../shell/OfflineNotice';
import Avatar from '../ui/Avatar';
import Character from '../games/cast/Character';
import { isComputer } from '../rooms/computers';
import Icon from '../ui/Icon';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { findGame } from '../games/registry';
import { screensFor } from '../games/screens';
import { hasRequested, isOwner, isPlayer } from '../rooms/rules';
import type { Room } from '../types';
import { useCurrentUser } from '../hooks/useAuth';
import { useRoom } from '../rooms/useRooms';
import { firstName } from '../lib/format';
import { backend } from '../services';
import { errorMessage } from '../services/errors';
import { t } from '../i18n';

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

  if (!game) return <Gone message={t.room.noGame} />;
  if (room === undefined) {
    return (
      <div className="center-screen">
        <img src="/icon.svg" alt={t.room.opening} width={64} height={64} className="pulse" />
      </div>
    );
  }
  if (room === null) {
    return <Gone message={error || t.room.gone} game={gameParam} />;
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
            {t.room.inTheRoom(t.common.list(room.players.map((p) => firstName(p.name))))}
          </p>
          {waiting ? (
            <p className="row center"><span className="badge badge-accent">{t.room.waitingHost}</span></p>
          ) : full ? (
            <p className="muted">{t.room.full}</p>
          ) : (
            <button type="button" className="primary" disabled={busy} onClick={ask}>{t.room.askToJoin}</button>
          )}
          <div className="row center">
            {waiting && (
              <button type="button" className="small" onClick={() => backend.rooms.cancelRequest(room.id, user.uid)}>
                {t.room.cancel}
              </button>
            )}
            <Link to={`/g/${game.id}`} className="button small">{t.room.backToLobby}</Link>
          </div>
        </div>
      </div>
    );
  }

  const screens = screensFor(game.id);
  const Game = screens?.Room;
  const wide = screens?.wide?.(room) === true;
  if (!Game) return <Gone message={t.room.noScreen} game={game.id} />;

  return (
    <div className={`room-screen${wide ? ' wide' : ''}`}>
      <RoomHeader room={room} uid={user.uid} onLeave={() => navigate(`/g/${game.id}`)} />
      <OfflineNotice suggestSolo={false} />
      <Game room={room} uid={user.uid} />
    </div>
  );
}

function Gone({ message, game }: { message: string; game?: string }) {
  return (
    <div className="center-screen">
      <div className="narrow col">
        <h1>{t.room.closed}</h1>
        <p className="muted">{message}</p>
        <Link to={game ? `/g/${game}` : '/'} className="button primary">{t.room.backToLobby}</Link>
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
    const text = t.room.invite(room.name, room.code);
    try {
      if (navigator.share) await navigator.share({ title: 'PartyGames', text, url: window.location.href });
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        toast({ message: t.room.inviteCopied });
      }
    } catch { /* the share sheet was dismissed */ }
  }

  return (
    <>
      <header className="room-bar">
        <button type="button" className="icon-button" aria-label={t.room.leaveRoom} onClick={() => setMenu(true)}>
          <Icon name="left" />
        </button>
        <div className="grow col" style={{ gap: 0, minWidth: 0 }}>
          <strong className="truncate">{room.name}</strong>
          <button type="button" className="link-button row" style={{ gap: 6 }} title={t.room.copyCode} onClick={share}>
            <span className="room-code">{room.code}</span>
            <Icon name="copy" size={14} />
          </button>
        </div>
        <SoundToggle />
        <span className="faces" aria-label={t.room.inRoom(room.players.length)}>
          {room.players.map((p) => (isComputer(p.uid)
            ? <span key={p.uid} className="avatar-computer" title={t.room.computer(p.name)}><Character uid={p.uid} size={30} /></span>
            : <Avatar key={p.uid} name={p.name} photoURL={p.photoURL} size={30} />))}
        </span>
      </header>

      {owner && room.requests.length > 0 && (
        <div className="room-banner">
          <div className="grow col" style={{ gap: 6 }}>
            <strong style={{ fontSize: '0.95rem' }}>
              {room.requests.length === 1 ? t.room.wantsIn : t.room.wantIn(room.requests.length)}
            </strong>
            {room.requests.map((r) => (
              <div key={r.uid} className="row" style={{ gap: 8 }}>
                <Avatar name={r.name} photoURL={r.photoURL} size={28} />
                <span className="grow truncate">{r.name}</span>
                <button type="button" className="small success-fill" onClick={() => decide(r.uid, true)}>
                  <Icon name="check" size={16} /> {t.room.letIn}
                </button>
                <button type="button" className="small" aria-label={t.room.turnDown(r.name)} onClick={() => decide(r.uid, false)}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={menu} title={t.room.leaveRoom} onClose={() => setMenu(false)}>
        <div className="col">
          <p className="muted" style={{ margin: 0 }}>
            {owner
              ? t.room.leaveHost
              : t.room.leaveGuest}
          </p>
          <button type="button" className="block" disabled={busy} onClick={() => act('leave')}>{t.room.leave}</button>
          {owner && (
            <button type="button" className="block danger-fill" disabled={busy} onClick={() => act('close')}>
              {t.room.closeForAll}
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
}
