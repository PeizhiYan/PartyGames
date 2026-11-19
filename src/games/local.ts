import { play } from '../lib/sound';
/**
 * A game played entirely on this device: the same `GameDefinition` a room would run, driven
 * locally, with the computer taking the other seats.
 *
 * This is what every "vs the computer" screen is built on. A solo mode is not a second rule
 * book — it is the room's reducer with a made-up room around it, so a game cannot behave one
 * way against a friend and another against the engine. `act` can play as any seat, which is how
 * an AI takes its turn and how a solo undo works (ask for the takeback as you, approve it as the
 * computer).
 *
 * Nothing here touches `src/services`: no network, no backend, works offline.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { GameRuleError, type GameContext, type GameDefinition, type RoomPlayer } from '../types';
import { COMPUTER_UID, computerUid, isComputer } from '../rooms/computers';

export { COMPUTER_UID, computerUid, isComputer };

/**
 * Somebody else playing on this device — passed the phone, or sitting across the table from
 * it. They have no account, so they get a made-up uid: `guest`, `guest-2`, …
 */
export const GUEST_UID = 'guest';
export const isGuest = (uid: string): boolean => uid.startsWith(GUEST_UID);
export const guestUid = (i: number): string => (i === 0 ? GUEST_UID : `${GUEST_UID}-${i + 1}`);

/** One seat after yours at a game on this device: the computer, or a person sharing it. */
export interface LocalSeat {
  kind: 'computer' | 'person';
  name: string;
}

/** A fake room's roster: you first, then the computer players in seat order. */
export function localPlayers(you: { uid: string; name: string; photoURL?: string }, computers: string[]): RoomPlayer[] {
  return localRoster(you, computers.map((name) => ({ kind: 'computer', name })));
}

/**
 * A fake room's roster with people and computers mixed: you first, then the others in the order
 * given. Computers are numbered among themselves (so the first is always Dot, wherever it sits),
 * and so are guests.
 */
export function localRoster(you: { uid: string; name: string; photoURL?: string }, others: LocalSeat[]): RoomPlayer[] {
  let computers = 0;
  let guests = 0;
  return [
    { uid: you.uid, name: you.name, photoURL: you.photoURL, joinedAt: 1 },
    ...others.map((seat, i) => ({
      uid: seat.kind === 'computer' ? computerUid(computers++) : guestUid(guests++),
      name: seat.name,
      joinedAt: 2 + i,
    })),
  ];
}

export function useLocalGame<S, A>(definition: GameDefinition<S, A>, players: RoomPlayer[], you: string) {
  const ctxFor = useCallback((actorUid: string): GameContext => ({
    actorUid, ownerUid: you, players, now: Date.now(),
  }), [players, you]);

  const fresh = useCallback((): S => {
    const base = definition.newState(ctxFor(you));
    return definition.onPlayersChanged ? definition.onPlayersChanged(base, ctxFor(you)) : base;
  }, [definition, ctxFor, you]);

  const [state, setState] = useState<S>(fresh);
  const [error, setError] = useState('');
  /**
   * The latest state, readable synchronously. React batches `setState`, so two actions in one
   * tick — a computer that acts straight after you — have to reduce from here, not from the
   * value the last render captured.
   */
  const latest = useRef(state);
  latest.current = state;
  /** Bumped on reset, so a computer reply already on its way can be thrown away. */
  const generation = useRef(0);

  /**
   * Plays an action as `asUid` (you, by default). Returns the new state, or null if the rules
   * refused it — in which case `error` carries the reason, written for a player.
   */
  const act = useCallback((action: A, asUid: string = you): S | null => {
    try {
      const next = definition.reduce(latest.current, action, ctxFor(asUid));
      latest.current = next;
      setState(next);
      setError('');
      return next;
    } catch (e) {
      if (!(e instanceof GameRuleError)) throw e;
      play('error');
      setError(e.message);
      return null;
    }
  }, [definition, ctxFor, you]);

  const reset = useCallback(() => {
    generation.current += 1;
    const next = fresh();
    latest.current = next;
    setError('');
    setState(next);
  }, [fresh]);

  return useMemo(() => ({ state, act, reset, error, generation }), [state, act, reset, error]);
}
