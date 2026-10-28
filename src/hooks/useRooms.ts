import { useEffect, useMemo, useRef, useState } from 'react';
import { PRESENCE_INTERVAL_MS, sortRooms } from '../domain/rooms';
import type { GameId, Room, RoomSummary } from '../domain/types';
import { backend } from '../services';
import { errorMessage } from '../services/errors';

/** Live list of the open rooms for one game, newest first, with the ones you're in on top. */
export function useRooms(game: GameId, uid: string) {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setRooms(null);
    const stop = backend.rooms.watchRooms(game, setRooms, (e) => setError(errorMessage(e)));
    // Clear out rooms everyone has left. Any client may do it, so a visit to the list is enough.
    backend.rooms.reap(game).catch(() => {});
    return stop;
  }, [game]);

  const sorted = useMemo(() => (rooms ? sortRooms(rooms, uid) : null), [rooms, uid]);
  return { rooms: sorted, error };
}

/**
 * Live view of one room, plus the heartbeat that says "someone is still here". Without the
 * heartbeat the room would look abandoned and be deleted from under the players.
 */
export function useRoom(roomId: string | undefined, uid: string) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomId) return;
    setRoom(undefined);
    return backend.rooms.watchRoom(roomId, setRoom, (e) => setError(errorMessage(e)));
  }, [roomId]);

  // Only a player in the room may check in; someone still waiting on the host has nothing to
  // say yet (and the backend would refuse them).
  const shouldBeat = room?.playerUids.includes(uid) === true;
  useEffect(() => {
    if (!roomId || !shouldBeat) return;
    const tick = () => { backend.rooms.heartbeat(roomId).catch(() => {}); };
    tick();
    const timer = window.setInterval(tick, PRESENCE_INTERVAL_MS);
    // Coming back from a locked phone: check in at once rather than waiting for the next tick.
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [roomId, shouldBeat]);

  return { room, error };
}

/**
 * Sends a game action and hands back whatever the rules said if they refused it. Actions are
 * applied by the backend inside a transaction, so two players acting at once can't clash.
 */
export function useGameAction(roomId: string | undefined) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // A late failure from an abandoned action must not overwrite a newer message.
  const run = useRef(0);

  const act = async (action: unknown): Promise<boolean> => {
    if (!roomId) return false;
    const current = ++run.current;
    setBusy(true);
    setError('');
    try {
      await backend.rooms.act(roomId, action);
      return true;
    } catch (e) {
      if (current === run.current) setError(errorMessage(e));
      return false;
    } finally {
      if (current === run.current) setBusy(false);
    }
  };

  return { act, error, busy, clearError: () => setError('') };
}

/** Live list of every open room across all games, for the Rooms tab. */
export function useAllRooms(games: GameId[], uid: string) {
  const [byGame, setByGame] = useState<Record<string, RoomSummary[]>>({});
  const [error, setError] = useState('');
  // The list of games never changes at runtime, but joining it keeps the effect from
  // resubscribing on every render.
  const key = games.join(',');

  useEffect(() => {
    const ids = key.split(',') as GameId[];
    const stops = ids.map((game) => backend.rooms.watchRooms(
      game,
      (rooms) => setByGame((prev) => ({ ...prev, [game]: rooms })),
      (e) => setError(errorMessage(e)),
    ));
    for (const game of ids) backend.rooms.reap(game).catch(() => {});
    return () => { for (const stop of stops) stop(); };
  }, [key]);

  const rooms = useMemo(
    () => sortRooms(Object.values(byGame).flat(), uid),
    [byGame, uid],
  );
  const loaded = Object.keys(byGame).length === games.length;
  return { rooms: loaded ? rooms : null, error };
}
