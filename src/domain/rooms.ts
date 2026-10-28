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
export const PRESENCE_TIMEOUT_MS = 90_000;
export const PRESENCE_INTERVAL_MS = 25_000;

export function isStale(room: RoomSummary, now = Date.now()): boolean {
  const beats = Object.values(room.presence ?? {});
  if (beats.length === 0) {
    // A room nobody has checked into yet: give it the same grace period from when it was made.
    return now - room.createdAt.getTime() > PRESENCE_TIMEOUT_MS;
  }
  return beats.every((at) => now - at.getTime() > PRESENCE_TIMEOUT_MS);
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
