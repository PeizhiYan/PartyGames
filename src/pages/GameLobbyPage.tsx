import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GameArt, screensFor } from '../games/screens';
import OfflineNotice from '../shell/OfflineNotice';
import RoomList from '../rooms/RoomList';
import Icon from '../ui/Icon';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { findGame } from '../games/registry';
import { CODE_LENGTH, defaultRoomName, isPlayer, normalizeCode } from '../rooms/rules';
import { useCurrentUser } from '../hooks/useAuth';
import { useOnline } from '../hooks/useOnline';
import { useRooms } from '../rooms/useRooms';
import { backend } from '../services';
import { errorMessage } from '../services/errors';
import { playersLabel } from '../lib/format';
import { t } from '../i18n';

/** One game's lobby: the rooms that are open, plus the ways in. */
export default function GameLobbyPage() {
  const { game: gameParam } = useParams();
  const game = findGame(gameParam ?? '');
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const { rooms, error } = useRooms(game?.multiplayer ? game.id : undefined, user.uid);
  const Extra = game ? screensFor(game.id)?.LobbyExtra : undefined;
  const online = useOnline();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  if (!game) {
    return (
      <>
        <h1>{t.lobby.noGame}</h1>
        <p className="muted">{t.lobby.noGameBody}<Link to="/">{t.lobby.backToGames}</Link></p>
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
      if (!room) { setCodeError(t.lobby.noCode); return; }
      if (isPlayer(room, user.uid)) {
        navigate(`/g/${room.game}/${room.id}`);
        return;
      }
      await backend.rooms.requestJoin(room.id);
      setCode('');
      toast({ message: t.lobby.asked(room.name) });
    } catch (e) {
      setCodeError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="lobby-head">
        <Link to="/" className="icon-button" aria-label={t.lobby.backToGames}><Icon name="left" /></Link>
        <h1 className="grow">{game.name}</h1>
        {game.multiplayer && <button type="button" className="primary" disabled={!online} onClick={() => setCreating(true)}>
          <Icon name="plus" /> {t.lobby.newRoom}
        </button>}
      </header>

      {game.multiplayer && <OfflineNotice suggestSolo={!game.solo} />}

      <div className="lobby-art">
        <GameArt game={game.id} />
      </div>
      <p className="lobby-tagline">
        {game.tagline}
        {' · '}
        {playersLabel(game)}
      </p>

      {game.solo && (
        <Link to={`/g/${game.id}/solo`} className="card row between" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="row grow" style={{ flexWrap: 'nowrap' }}>
            <span className="game-card-emoji" style={{ width: 40, height: 40, fontSize: '1.1rem', margin: 0 }} aria-hidden>{game.multiplayer ? '🤖' : game.emoji}</span>
            <span className="col grow" style={{ gap: 0 }}>
              <strong>{game.soloTitle ?? t.lobby.playSolo}</strong>
              <small className="muted">{game.soloDescription ?? t.lobby.noRoomNeeded}</small>
            </span>
          </span>
          <Icon name="right" />
        </Link>
      )}

      {game.multiplayer && (
        <>
          <section className="card">
            <h3>{t.lobby.joinWithCode}</h3>
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
                aria-label={t.lobby.roomCode}
              />
              <button
                type="button"
                className="primary"
                disabled={busy || !online || normalizeCode(code).length < CODE_LENGTH}
                onClick={joinByCode}
              >
                {t.lobby.join}
              </button>
            </div>
            {codeError && <p className="error" style={{ marginBottom: 0 }}>{codeError}</p>}
          </section>

          <section className="card">
            <h3>{t.lobby.openRooms}</h3>
            {error && <p className="error">{error}</p>}
            {rooms === null ? <p className="empty">{t.lobby.looking}</p> : <RoomList rooms={rooms} uid={user.uid} />}
          </section>

          <Sheet open={creating} title={t.lobby.newRoomTitle(game.name)} onClose={() => setCreating(false)}>
            <div className="col">
              <label className="field">
                <span>{t.lobby.roomName}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder={defaultRoomName(user.displayName)}
                  autoFocus
                />
              </label>
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                {t.lobby.newRoomHelp}
              </p>
              <button type="button" className="primary block" disabled={busy} onClick={createRoom}>
                {busy ? t.lobby.opening : t.lobby.open}
              </button>
            </div>
          </Sheet>
        </>
      )}
      {Extra && <Extra />}
    </>
  );
}
