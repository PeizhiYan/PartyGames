/**
 * Computer players in a room: the host's seating controls, and the device that plays their turns.
 */
import { useCallback } from 'react';
import { useComputerTurns, type ComputerPolicy } from './turns';
import type { Seating } from './cast/Seating';
import { getGame } from './registry';
import { ROOM_LIMIT, computerDriver, isComputer } from '../rooms/computers';
import type { Room } from '../types';
import { backend } from '../services';
import { errorMessage } from '../services/errors';
import { useToast } from '../ui/Toast';

/**
 * Plays the room's computers from this device when it is the one chosen to (`computerDriver`),
 * and returns the seating controls when `uid` hosts a game that has computer players.
 */
export function useRoomComputers<S, A>(room: Room, uid: string, policy: ComputerPolicy<S, A>): Seating | undefined {
  const toast = useToast();
  const hasComputers = room.playerUids.some(isComputer);
  const driving = hasComputers && computerDriver(room) === uid;
  const run = useCallback((as: string, action: A) => backend.rooms.act(room.id, action, as), [room.id]);
  useComputerTurns(room.state as S, policy, run, driving);

  const game = getGame(room.game);
  if (room.ownerUid !== uid || !game.computerPlayers) return undefined;
  const report = (e: unknown) => toast({ message: errorMessage(e), error: true });
  const full = room.playerUids.length >= Math.min(game.maxPlayers, ROOM_LIMIT);
  return {
    add: full ? undefined : () => { backend.rooms.addComputer(room.id).catch(report); },
    remove: (who) => { backend.rooms.removeComputer(room.id, who).catch(report); },
  };
}
