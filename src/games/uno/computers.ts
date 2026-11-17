/**
 * What UNO's computer players do, for a solo game and a room alike.
 *
 * They are given human flaws on purpose: they call UNO only most of the time, so you can catch
 * them, and they catch a person who forgot only some of the time, after a moment's grace.
 */
import type { ComputerMove, ComputerPolicy } from '../turns';
import { isComputer } from '../../rooms/computers';
import { chooseAction } from './ai';
import { catchable, currentSeat, handOf, type UnoAction, type UnoState } from './rules';

/** How long a computer takes over its turn, so a turn can be followed. */
export const BEAT_MS = 1000;
/** How long a person has to call UNO before a computer may catch them. */
export const GRACE_MS = 2500;
export const COMPUTER_CALLS_UNO = 0.85;
export const COMPUTER_CATCHES = 0.6;

export const unoComputers: ComputerPolicy<UnoState, UnoAction> = (state, random) => {
  if (state.phase !== 'playing') return [];
  const moves: ComputerMove<UnoAction>[] = [];

  const seat = currentSeat(state);
  if (seat && !seat.absent && isComputer(seat.uid)) {
    const cpu = seat.uid;
    const actions: UnoAction[] = [];
    if (handOf(state, cpu).length <= 2 && !state.uno[cpu] && random() < COMPUTER_CALLS_UNO) actions.push({ type: 'callUno' });
    actions.push(chooseAction(state, cpu));
    moves.push({ as: cpu, actions, delay: BEAT_MS });
  }

  // A person on one card who has not called it can be caught — by the first computer at the table.
  const catcher = state.seats.find((s) => isComputer(s.uid) && !s.absent)?.uid;
  if (catcher) {
    for (const s of state.seats) {
      if (isComputer(s.uid) || s.absent || !catchable(state, s.uid)) continue;
      moves.push({ as: catcher, actions: [{ type: 'catch', uid: s.uid }], delay: GRACE_MS, chance: COMPUTER_CATCHES });
    }
  }
  return moves;
};
