/**
 * What Yahtzee's computer players do, for a solo game and a room alike. Pure apart from the dice.
 */
import type { ComputerMove, ComputerPolicy } from '../turns';
import { isComputer } from '../../rooms/computers';
import { chooseCategory, chooseHolds } from './ai';
import { ROLLS_PER_TURN, currentSeat, throwFive, type YahtzeeAction, type YahtzeeState } from './rules';

/** How long a computer waits between its actions, so a turn can be followed. */
export const BEAT_MS = 800;

/** One beat of the computer's turn: roll; keep what it likes and roll again; or score. */
export const yahtzeeComputers: ComputerPolicy<YahtzeeState, YahtzeeAction> = (state, random) => {
  const seat = currentSeat(state);
  if (state.phase !== 'playing' || !seat || !isComputer(seat.uid)) return [];
  const beat = (actions: YahtzeeAction[]): ComputerMove<YahtzeeAction>[] => [{ as: seat.uid, actions, delay: BEAT_MS }];
  if (state.rolls === 0) return beat([{ type: 'roll', dice: throwFive(random) }]);
  const rollsLeft = ROLLS_PER_TURN - state.rolls;
  const holds = rollsLeft > 0 ? chooseHolds(state.dice, seat, rollsLeft) : [true, true, true, true, true];
  if (rollsLeft > 0 && !holds.every(Boolean)) {
    const changes: YahtzeeAction[] = [];
    holds.forEach((held, index) => { if (held !== state.held[index]) changes.push({ type: 'hold', index, held }); });
    return beat([...changes, { type: 'roll', dice: throwFive(random) }]);
  }
  return beat([{ type: 'score', category: chooseCategory(seat, state.dice) }]);
};
