import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import GameArt from '../components/art/GameArt';
import RoomList from '../components/RoomList';
import Icon from '../components/ui/Icon';
import Sheet from '../components/ui/Sheet';
import { useToast } from '../components/ui/Toast';
import { findGame } from '../domain/games';
import { CODE_LENGTH, defaultRoomName, isPlayer, normalizeCode } from '../domain/rooms';
import type { GameId } from '../domain/types';
import { useCurrentUser } from '../hooks/useAuth';
import { useRooms } from '../hooks/useRooms';
import { backend } from '../services';
import { errorMessage } from '../services/errors';

/** One game's lobby: the rooms that are open, plus the ways in. */
export default function GameLobbyPage() {
  const { game: gameParam } = useParams();
  const game = findGame(gameParam ?? '');
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const { rooms, error } = useRooms((game?.id ?? 'gomoku') as GameId, user.uid);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  if (!game) {
    return (
      <>
        <h1>No such game</h1>
        <p className="muted">That game isn't in this app. <Link to="/">Back to the games</Link>.</p>
      </>
    );
  }

  async function createRoom() {
    setBusy(true);
    try {
      const id = await backend.rooms.create(game!.id, name.trim() || defaultRoomName(user.displayName));
      setCreating(false);
      setName('');
      navigate(`/g/${game!.id}/${id}`);
    } catch (e) {
      toast({ message: errorMessage(e), error: true });
    } finally {
      setBusy(false);
    }
  }

  async function joinByCode() {
    const wanted = normalizeCode(code);
    setCodeError('');
    setBusy(true);
    try {
      const room = await backend.rooms.findByCode(wanted);
      if (!room) { setCodeError('No open room with that code.'); return; }
      if (isPlayer(room, user.uid)) {
        navigate(`/g/${room.game}/${room.id}`);
        return;
      }
      await backend.rooms.requestJoin(room.id);
      setCode('');
      toast({ message: `Asked to join ${room.name}. The host has to let you in.` });
    } catch (e) {
      setCodeError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="lobby-head">
        <Link to="/" className="icon-button" aria-label="Back to the games"><Icon name="left" /></Link>
        <h1 className="grow">{game.name}</h1>
        <button type="button" className="primary" onClick={() => setCreating(true)}>
          <Icon name="plus" /> New room
        </button>
      </header>

      <div className="lobby-art">
        <GameArt game={game.id} />
      </div>
      <p className="lobby-tagline">
        {game.tagline}
        {' · '}
        {game.minPlayers === game.maxPlayers
          ? `${game.maxPlayers} players`
          : `${game.solo ? 1 : game.minPlayers}–${game.maxPlayers} players`}
      </p>

      {game.solo && (
        <Link to={`/g/${game.id}/solo`} className="card row between" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="row">
            <span className="game-card-emoji" style={{ width: 40, height: 40, fontSize: '1.1rem', margin: 0 }} aria-hidden>🤖</span>
            <span className="col" style={{ gap: 0 }}>
              <strong>Play the computer</strong>
              <small className="muted">No room needed. Three difficulties.</small>
            </span>
          </span>
          <Icon name="right" />
        </Link>
      )}

      <section className="card">
        <h3>Join with a code</h3>
        <div className="field-row">
          <input
            className="code-input"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(''); }}
            maxLength={CODE_LENGTH}
            placeholder="ABCD"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Room code"
          />
          <button
            type="button"
            className="primary"
            disabled={busy || normalizeCode(code).length < CODE_LENGTH}
            onClick={joinByCode}
          >
            Join
          </button>
        </div>
        {codeError && <p className="error" style={{ marginBottom: 0 }}>{codeError}</p>}
      </section>

      <section className="card">
        <h3>Open rooms</h3>
        {error && <p className="error">{error}</p>}
        {rooms === null ? <p className="empty">Looking for rooms…</p> : <RoomList rooms={rooms} uid={user.uid} />}
      </section>

      <Sheet open={creating} title={`New ${game.name} room`} onClose={() => setCreating(false)}>
        <div className="col">
          <label className="field">
            <span>Room name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={defaultRoomName(user.displayName)}
              autoFocus
            />
          </label>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            You'll get a short code to share. Friends ask to join and you let them in.
            The room disappears once everyone has left.
          </p>
          <button type="button" className="primary block" disabled={busy} onClick={createRoom}>
            {busy ? 'Opening…' : 'Open the room'}
          </button>
        </div>
      </Sheet>
    </>
  );
}
