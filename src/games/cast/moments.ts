/**
 * Moments: short-lived things that just happened — a card played, a call made, a big score —
 * derived by comparing the state before and after a change.
 *
 * Reducers know nothing about animation, and should not: the same state arrives from a friend's
 * device over the network. So the screen works out what changed itself, and each moment lives for
 * a second or two to drive a bubble, a face or a flying card, then goes away.
 */
import { useEffect, useRef, useState } from 'react';
import type { Expression } from './cast';

export interface Moment {
  id: number;
  kind: string;
  /** Whose moment it is, if anyone's. */
  uid?: string;
  /** Text for a bubble. */
  text?: string;
  tone?: 'hot' | 'gold';
  /** How the face of `uid` should look while it lasts. */
  expression?: Expression;
  /** Anything else the animation needs (a card id, a seat to fly from…). */
  data?: Record<string, unknown>;
  /** How long it lasts, ms. */
  ttl?: number;
}

export type Detect<S> = (prev: S, next: S) => Omit<Moment, 'id'>[];

let nextId = 1;

export function useMoments<S>(state: S, detect: Detect<S>): Moment[] {
  const prev = useRef(state);
  const [moments, setMoments] = useState<Moment[]>([]);
  const detectRef = useRef(detect);
  detectRef.current = detect;

  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (before === state) return;
    const found = detectRef.current(before, state).map((m) => ({ ...m, id: nextId++ }));
    if (!found.length) return;
    setMoments((list) => [...list, ...found]);
    const timers = found.map((m) => window.setTimeout(() => {
      setMoments((list) => list.filter((x) => x.id !== m.id));
    }, m.ttl ?? 1800));
    // Deliberately not cleared on the next change: a moment outlives the state that made it.
    void timers;
  }, [state]);

  return moments;
}

/** The latest bubble for a seat, if one is showing. */
export function bubbleFor(moments: Moment[], uid: string): { text: string; tone?: 'hot' | 'gold'; key: number } | null {
  for (let i = moments.length - 1; i >= 0; i -= 1) {
    const m = moments[i];
    if (m.uid === uid && m.text) return { text: m.text, tone: m.tone, key: m.id };
  }
  return null;
}

/** How a seat's face looks: the latest moment's expression, else `base`. */
export function expressionFor(moments: Moment[], uid: string, base: Expression = 'idle'): Expression {
  for (let i = moments.length - 1; i >= 0; i -= 1) {
    const m = moments[i];
    if (m.uid === uid && m.expression) return m.expression;
  }
  return base;
}
