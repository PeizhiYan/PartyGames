/**
 * Computer players: seats played by the computer rather than a person, in a solo game or a room.
 *
 * A computer is an ordinary `RoomPlayer` whose uid starts with `computer`, so every game seats it
 * without knowing it is one. Pure and backend-free: the adapters, the room layer and the tables
 * all import it.
 */
import { PRESENCE_TIMEOUT_MS } from './rules';
import { t } from '../i18n';
import { GameRuleError, type GameDefinition, type RoomPlayer, type RoomSummary } from '../types';

/** The most players `firestore.rules` lets a room hold, whatever the game would allow. */
export const ROOM_LIMIT = 8;

/** The first computer seat's uid; further ones are `computer-2`, `computer-3`, … */
export const COMPUTER_UID = 'computer';

export const isComputer = (uid: string): boolean => uid.startsWith(COMPUTER_UID);

/** The uid of the `i`th computer (from 0), which is also its place in the cast. */
export const computerUid = (i: number): string => (i === 0 ? COMPUTER_UID : `${COMPUTER_UID}-${i + 1}`);

/** How many people, not computers, are in a room. */
export const peopleIn = (room: Pick<RoomSummary, 'playerUids'>): string[] => room.playerUids.filter((u) => !isComputer(u));

/** The first computer uid not already in use, by cast order. */
export function nextComputerUid(taken: readonly string[]): string {
  for (let i = 0; ; i++) {
    const uid = computerUid(i);
    if (!taken.includes(uid)) return uid;
  }
}

/**
 * Which device plays the computers' turns. Exactly one should, or a turn would be played twice.
 *
 * The host's, while the host is here. A host whose phone is locked stops running timers, and the
 * table would sit waiting for a computer to move, so after `PRESENCE_TIMEOUT_MS` without a
 * check-in the longest-standing person who *is* here takes over. A room where nobody has checked
 * in yet (the first heartbeat still on its way) stays with the host.
 */
export function computerDriver(room: RoomSummary, now = Date.now()): string {
  const here = (uid: string) => {
    const beat = room.presence?.[uid];
    return beat !== undefined && now - beat.getTime() <= PRESENCE_TIMEOUT_MS;
  };
  if (here(room.ownerUid)) return room.ownerUid;
  const stand = [...room.players]
    .filter((p) => !isComputer(p.uid))
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .find((p) => here(p.uid));
  return stand?.uid ?? room.ownerUid;
}

/**
 * The checks for seating a computer, shared by every adapter: the host asks, the game has
 * computer players, and there is a place. Returns the new player, named by `nameOf`.
 */
export function seatComputer(
  room: RoomSummary,
  actorUid: string,
  game: Pick<GameDefinition<unknown, unknown>, 'computerPlayers' | 'maxPlayers'>,
  nameOf: (uid: string) => string,
  now: number,
): RoomPlayer {
  if (room.ownerUid !== actorUid) throw new GameRuleError(t.errors.hostSeats);
  if (!game.computerPlayers) throw new GameRuleError(t.errors.noComputers);
  if (room.playerUids.length >= Math.min(game.maxPlayers, ROOM_LIMIT)) throw new GameRuleError(t.errors.roomFull);
  const uid = nextComputerUid(room.playerUids);
  return { uid, name: nameOf(uid), joinedAt: now };
}

/** The checks for taking a computer out again. Returns who stays. */
export function unseatComputer(room: Pick<RoomSummary, 'ownerUid' | 'players'>, actorUid: string, uid: string): RoomPlayer[] {
  if (room.ownerUid !== actorUid) throw new GameRuleError(t.errors.hostOnly);
  if (!isComputer(uid)) throw new GameRuleError(t.errors.onlyComputers);
  return room.players.filter((p) => p.uid !== uid);
}

/**
 * Who an action is played as: the signed-in user, or — with `as` — a computer player in the
 * same room. Throws if neither is allowed.
 */
export function actingAs(room: Pick<RoomSummary, 'playerUids'>, actorUid: string, as?: string): string {
  if (!room.playerUids.includes(actorUid)) throw new GameRuleError(t.errors.notInRoom);
  if (as === undefined || as === actorUid) return actorUid;
  if (!isComputer(as) || !room.playerUids.includes(as)) {
    throw new GameRuleError(t.errors.playForComputer);
  }
  return as;
}

/**
 * Who is left after someone leaves, and who hosts. Null when only computers would remain:
 * computers cannot keep a room going, so the last person out still turns off the lights.
 */
export function afterLeaving(room: Pick<RoomSummary, 'ownerUid' | 'players'>, actorUid: string): { players: RoomPlayer[]; ownerUid: string } | null {
  const players = room.players.filter((p) => p.uid !== actorUid);
  const people = players.filter((p) => !isComputer(p.uid)).sort((a, b) => a.joinedAt - b.joinedAt);
  if (people.length === 0) return null;
  // The owner handing over: the next-longest-standing person (never a computer) takes the room.
  const ownerUid = room.ownerUid === actorUid ? people[0].uid : room.ownerUid;
  return { players, ownerUid };
}
