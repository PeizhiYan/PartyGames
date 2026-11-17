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

/** The first computer seat's uid; further ones are `computer-2`, `computer-3`, … */
export const COMPUTER_UID = 'computer';

export const isComputer = (uid: string): boolean => uid.startsWith(COMPUTER_UID);

/** A fake room's roster: you first, then the computer players in seat order. */
export function localPlayers(you: { uid: string; name: string; photoURL?: string }, computers: string[]): RoomPlayer[] {
  return [
    { uid: you.uid, name: you.name, photoURL: you.photoURL, joinedAt: 1 },
    ...computers.map((name, i) => ({ uid: i === 0 ? COMPUTER_UID : `${COMPUTER_UID}-${i + 1}`, name, joinedAt: 2 + i })),
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
