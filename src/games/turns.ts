/**
 * Playing the computers' turns, the same way in a solo game and in a room.
 *
 * Each game with computer players writes a `ComputerPolicy`: a pure function from the state to
 * the moves its computers would like to make now. `useComputerTurns` asks it after every change,
 * waits out the soonest move's delay so a person can follow the table, and plays it through
 * `run` — the local reducer on this device, or the room's backend as that computer. `run` says
 * an action was refused by throwing or by returning `null`/`false`, and the rest of that move
 * is then dropped.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

export interface ComputerMove<A> {
  /** The computer player making it. */
  as: string;
  /** Played in order, as one beat — say, keeping three dice and rolling again. */
  actions: A[];
  /** How long to wait before playing it, in ms. */
  delay: number;
  /**
   * A move the computer only sometimes makes, like catching someone who forgot to call UNO.
   * Decided once when the move first becomes possible, not again on every change while it stays
   * possible, or something it decided against would keep being re-rolled until it happened.
   */
  chance?: number;
}

/** What the computers would do in this state, soonest first or not; empty when nothing. */
export type ComputerPolicy<S, A> = (state: S, random: () => number) => ComputerMove<A>[];

/** A move's identity while it stays on offer: who, and what, with the dice of a roll left out. */
const moveKey = (m: ComputerMove<unknown>): string => `${m.as}:${JSON.stringify(m.actions, (k, v) => (k === 'dice' || k === 'seed' ? undefined : v))}`;

/**
 * Plays the computers' moves while `enabled`. `run` may be asynchronous (a room's backend), and
 * nothing more is planned while a move is being played.
 *
 * A move keeps its place in the queue while it stays on offer: its delay runs from the first time
 * the policy proposed it, so a slow move (a catch, after a moment's grace) is not pushed back by
 * every quick move other computers make in the meantime.
 */
export function useComputerTurns<S, A>(
  state: S,
  policy: ComputerPolicy<S, A>,
  run: (as: string, action: A) => unknown,
  enabled = true,
): void {
  // Rooms hand over a fresh state object on every snapshot, heartbeats included, so changes are
  // noticed by content.
  const key = useMemo(() => JSON.stringify(state), [state]);
  const [tick, setTick] = useState(0);
  const running = useRef(false);
  /** The state the last move was planned from; nothing more is planned until it changes. */
  const played = useRef<string | null>(null);
  /** When each move on offer was first proposed, and whether its `chance` came up. */
  const offered = useRef(new Map<string, { at: number; go: boolean }>());
  const latest = useRef({ state, policy, run });
  latest.current = { state, policy, run };

  useEffect(() => {
    if (!enabled || running.current || played.current === key) return;
    const { state: now, policy: decide } = latest.current;
    const moves = decide(now, Math.random);
    const seen = offered.current;
    const t = Date.now();
    const keys = new Set<string>();
    let next: { move: ComputerMove<A>; due: number } | null = null;
    for (const move of moves) {
      const k = moveKey(move as ComputerMove<unknown>);
      keys.add(k);
      if (!seen.has(k)) seen.set(k, { at: t, go: move.chance === undefined || Math.random() < move.chance });
      const entry = seen.get(k)!;
      if (!entry.go) continue;
      const due = entry.at + move.delay;
      if (!next || due < next.due) next = { move, due };
    }
    // Forget moves no longer on offer, so the same move offered again later starts afresh.
    for (const k of [...seen.keys()]) if (!keys.has(k)) seen.delete(k);
    if (!next) return;
    const { move } = next;
    const timer = window.setTimeout(async () => {
      running.current = true;
      played.current = key;
      try {
        for (const action of move.actions) {
          const done = await latest.current.run(move.as, action);
          if (done === null || done === false) break;
        }
      } catch {
        // Someone else moved first; the next state decides again.
      } finally {
        running.current = false;
        offered.current.delete(moveKey(move as ComputerMove<unknown>));
        setTick((n) => n + 1);
      }
    }, Math.max(0, next.due - t));
    return () => window.clearTimeout(timer);
  }, [enabled, key, tick]);
}
