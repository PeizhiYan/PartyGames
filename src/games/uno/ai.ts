/**
 * The computer's UNO: rules of thumb, not a search. It stacks draw cards when it can, hits the
 * next player hard when they are close to going out, sheds the colour it holds most of, plays
 * number cards before wilds and keeps the draw-four for when nothing else fits.
 *
 * It only ever looks at its own hand and at public things (the pile, card counts), which is the
 * same view a person at the table has.
 */
import { COLORS, cardOf, isWild, type Color } from './cards';
import { canPlay, handOf, nextSeatIndex, type UnoAction, type UnoState } from './rules';

/** The colour this hand has most of (wilds aside); red if it has none. */
export function favouriteColor(hand: number[]): Color {
  const tally: Record<Color, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const id of hand) {
    const c = cardOf(id).color;
    if (c !== 'wild') tally[c] += 1;
  }
  return COLORS.reduce((best, c) => (tally[c] > tally[best] ? c : best), 'red' as Color);
}

/** What the computer does on its turn. Always a legal action for the player to move. */
export function chooseAction(state: UnoState, uid: string): UnoAction {
  const hand = handOf(state, uid);
  const playable = hand.filter((id) => canPlay(state, id));
  if (playable.length === 0) return state.drawn !== null ? { type: 'pass' } : { type: 'draw' };

  const nextUid = state.seats[nextSeatIndex(state)]?.uid;
  const nextIsClose = nextUid !== undefined && nextUid !== uid && handOf(state, nextUid).length <= 2;
  const rest = (id: number) => hand.filter((x) => x !== id);
  const colorCount = (color: string) => hand.filter((id) => cardOf(id).color === color).length;

  const score = (id: number): number => {
    const c = cardOf(id);
    const attack = c.kind === 'draw2' || c.kind === 'skip' || c.kind === 'reverse' || c.kind === 'wild4';
    if (c.kind === 'wild4') return nextIsClose ? 60 : -50;
    if (c.kind === 'wild') return nextIsClose ? 5 : -20;
    let s = colorCount(c.color) * 4;
    if (attack) s += nextIsClose ? 40 : 3;
    // Shedding high numbers first keeps the hand cheap if someone else goes out.
    if (/^[0-9]$/.test(c.kind)) s += Number(c.kind) * 0.3;
    return s;
  };

  const best = playable.reduce((a, b) => (score(b) > score(a) ? b : a));
  return isWild(best) ? { type: 'play', card: best, color: favouriteColor(rest(best)) } : { type: 'play', card: best };
}

/** Names for the computer seats, in the order they are added. */
export const COMPUTER_NAMES = ['Dot', 'Pip', 'Ace'];
