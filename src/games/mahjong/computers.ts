/**
 * What Mahjong's computer players do, for a solo game and a room alike: answer a call when a
 * discard could be theirs, and draw-and-discard on their turn.
 */
import type { ComputerMove, ComputerPolicy } from '../turns';
import { isComputer } from '../../rooms/computers';
import { chooseClaim, chooseTurn } from './ai';
import { currentSeat, type MahjongAction, type MahjongState } from './rules';

/** How long the computers take over a move, so the table can be followed. */
export const BEAT_MS = 750;

export const mahjongComputers: ComputerPolicy<MahjongState, MahjongAction> = (state) => {
  if (state.phase !== 'playing') return [];
  const moves: ComputerMove<MahjongAction>[] = [];
  if (state.stage === 'claims' && state.claim) {
    for (const [uid, answer] of Object.entries(state.claim.responses)) {
      if (answer !== null || !isComputer(uid)) continue;
      const choice = chooseClaim(state, uid);
      moves.push({ as: uid, actions: [choice === 'pass' ? { type: 'pass' } : { type: 'claim', claim: choice }], delay: BEAT_MS });
    }
  }
  const seat = currentSeat(state);
  if (state.stage === 'discard' && seat && !seat.absent && isComputer(seat.uid)) {
    moves.push({ as: seat.uid, actions: [chooseTurn(state, seat.uid)], delay: BEAT_MS });
  }
  return moves;
};
