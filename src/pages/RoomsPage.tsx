import OfflineNotice from '../shell/OfflineNotice';
import RoomList from '../rooms/RoomList';
import { GAMES } from '../games/registry';
import type { GameId } from '../types';
import { useCurrentUser } from '../hooks/useAuth';
import { useAllRooms } from '../rooms/useRooms';

const ALL_GAMES = GAMES.map((g) => g.id) as GameId[];

/** Every room that's open right now, whatever the game. */
export default function RoomsPage() {
  const { user } = useCurrentUser();
  const { rooms, error } = useAllRooms(ALL_GAMES, user.uid);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Rooms</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>What's going on right now.</p>
        </div>
      </header>
      <OfflineNotice />

      <section className="card">
        {error && <p className="error">{error}</p>}
        {rooms === null
          ? <p className="empty">Looking for rooms…</p>
          : <RoomList rooms={rooms} uid={user.uid} showGame />}
      </section>
    </>
  );
}
