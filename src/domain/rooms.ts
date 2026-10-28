// Room rules that do not depend on any backend: join codes, who may do what, and when a room
// counts as abandoned.
import type { Room, RoomSummary } from './types';

/** Letters and digits that can't be mistaken for each other when read out loud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export function newRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export const normalizeCode = (code: string): string => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * How long a room survives with nobody in it. Every open room gets a heartbeat from each player's
 * device every PRESENCE_INTERVAL_MS; once every heartbeat is older than this, the room is empty
 * (everyone closed the tab or lost signal) and the next client to notice deletes it. That keeps
 * cleanup in the client, so the app needs no server-side scheduler and runs on any backend.
 */
export const PRESENCE_INTERVAL_MS = 25_000;
/** After this long without a check-in, a player is shown as away. Display only. */
export const PRESENCE_TIMEOUT_MS = 90_000;
/**
 * How long a room with no sign of life survives before any client may delete it.
 *
 * Deliberately far longer than PRESENCE_TIMEOUT_MS, which is only about the "2 online" label. A
 * phone that is locked, or whose browser is in the background, stops running timers altogether, so
 * a host who opens Messages to send someone the code stops checking in within seconds. Deleting
 * the room on that timescale means the room is gone before the invitation arrives — which is
 * exactly what it looked like from the other end: no room in the list, and the code not found.
 */
export const ABANDONED_AFTER_MS = 15 * 60_000;

/** The last moment anything happened in this room, or null if nothing can be dated. */
function lastSignOfLife(room: RoomSummary): number | null {
  const times = [
    ...Object.values(room.presence ?? {}),
    room.updatedAt,
    room.createdAt,
  ]
    .map((at) => at?.getTime() ?? 0)
    // A server timestamp that has not landed yet reads as epoch 0; it means "don't know",
    // never "very old".
    .filter((t) => t > 0);
  return times.length > 0 ? Math.max(...times) : null;
}

/**
 * True when a room looks abandoned and may be deleted. A move or a join counts as life just as
 * much as a check-in does, so a game being played in a backgrounded tab is never reaped.
 */
export function isStale(room: RoomSummary, now = Date.now()): boolean {
  const alive = lastSignOfLife(room);
  // Nothing to go on: leave it alone rather than delete someone's game.
  if (alive === null) return false;
  return now - alive > ABANDONED_AFTER_MS;
}

/** Who is actually on the room's screen right now. */
export function activePlayers(room: RoomSummary, now = Date.now()): string[] {
  return room.playerUids.filter((uid) => {
    const beat = room.presence?.[uid];
    return beat !== undefined && now - beat.getTime() <= PRESENCE_TIMEOUT_MS;
  });
}

export const isOwner = (room: RoomSummary, uid: string): boolean => room.ownerUid === uid;
export const isPlayer = (room: RoomSummary, uid: string): boolean => room.playerUids.includes(uid);
export const hasRequested = (room: RoomSummary, uid: string): boolean =>
  room.requests.some((r) => r.uid === uid);

export const roomIsFull = (room: RoomSummary, maxPlayers: number): boolean =>
  room.playerUids.length >= maxPlayers;

/** What the current user can do with a room, for the room list. */
export type RoomStanding = 'owner' | 'player' | 'requested' | 'joinable' | 'full';

export function standing(room: RoomSummary, uid: string, maxPlayers: number): RoomStanding {
  if (isOwner(room, uid)) return 'owner';
  if (isPlayer(room, uid)) return 'player';
  if (hasRequested(room, uid)) return 'requested';
  return roomIsFull(room, maxPlayers) ? 'full' : 'joinable';
}

export const defaultRoomName = (ownerName: string): string => `${ownerName.split(' ')[0]}'s room`;

/** Rooms sorted the way the list shows them: the ones you're in first, then newest. */
export function sortRooms(rooms: RoomSummary[], uid: string): RoomSummary[] {
  return [...rooms].sort((a, b) => {
    const mine = Number(isPlayer(b, uid)) - Number(isPlayer(a, uid));
    return mine !== 0 ? mine : b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export type { Room, RoomSummary };
