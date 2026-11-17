/**
 * The computer's Yahtzee: a list of rules rather than a search. It keeps groups, chases
 * straights when four of one are already there, takes the big boxes when they come up, and
 * zeroes the cheapest box it can when nothing fits. Good enough to beat a careless human and
 * lose to a careful one, which is the right place for a party opponent.
 */
import { UPPER, choices, type Category, type Dice, type Seat } from './rules';

const counts = (dice: Dice): number[] => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d] += 1;
  return c;
};
const open = (seat: Seat, c: Category): boolean => seat.card[c] === undefined;

/** Which dice to keep before the next roll. Returns five booleans. */
export function chooseHolds(dice: Dice, seat: Seat, rollsLeft: number): boolean[] {
  if (rollsLeft <= 0) return [true, true, true, true, true];
  const c = counts(dice);
  // The largest group, preferring the higher face, unless every box it could fill is gone.
  let bestFace = 0;
  for (let face = 6; face >= 1; face -= 1) {
    if (c[face] > (bestFace ? c[bestFace] : 0)) bestFace = face;
  }
  const groupUseful = bestFace > 0 && (open(seat, UPPER[bestFace - 1]) || open(seat, 'threeKind')
    || open(seat, 'fourKind') || open(seat, 'yahtzee') || open(seat, 'fullHouse') || open(seat, 'chance'));
  // Four to a straight with a straight box open: keep those four.
  const wantStraight = open(seat, 'largeStraight') || open(seat, 'smallStraight');
  if (wantStraight && (bestFace === 0 || c[bestFace] < 3)) {
    const have = new Set(dice);
    for (const run of [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]]) {
      if (run.every((f) => have.has(f))) {
        const kept = new Set<number>();
        return dice.map((d) => {
          if (!run.includes(d) || kept.has(d)) return false;
          kept.add(d);
          return true;
        });
      }
    }
  }
  if (groupUseful && c[bestFace] >= 2) return dice.map((d) => d === bestFace);
  // Nothing to build on: on the last roll before scoring, keep high dice for chance.
  if (rollsLeft === 1 && open(seat, 'chance')) return dice.map((d) => d >= 5);
  return [false, false, false, false, false];
}

/** Which box to score the final dice in. Always one of `choices()`. */
export function chooseCategory(seat: Seat, dice: Dice): Category {
  const options = choices(seat, dice);
  const score = (cat: Category) => options.find((o) => o.category === cat)?.score;
  const allowed = (cat: Category) => score(cat) !== undefined;
  const sum = dice.reduce((a, b) => a + b, 0);

  if (allowed('yahtzee') && score('yahtzee') === 50) return 'yahtzee';
  if (allowed('largeStraight') && score('largeStraight') === 40) return 'largeStraight';
  if (allowed('fullHouse') && score('fullHouse') === 25) return 'fullHouse';
  if (allowed('smallStraight') && score('smallStraight') === 30 && !allowed('largeStraight')) return 'smallStraight';
  // An upper box that keeps pace with the bonus (three of its face or better).
  for (let face = 6; face >= 1; face -= 1) {
    const cat = UPPER[face - 1];
    if (allowed(cat) && (score(cat) ?? 0) >= face * 3) return cat;
  }
  if (allowed('fourKind') && (score('fourKind') ?? 0) >= 25) return 'fourKind';
  if (allowed('threeKind') && (score('threeKind') ?? 0) >= 20) return 'threeKind';
  if (allowed('smallStraight') && score('smallStraight') === 30) return 'smallStraight';
  if (allowed('chance') && sum >= 22) return 'chance';
  // Anything that scores more than zero, best first.
  const positive = options.filter((o) => o.score > 0).sort((a, b) => b.score - a.score);
  if (positive.length && !(positive[0].category === 'chance' && positive.length > 1 && sum < 18)) return positive[0].category;
  // Nothing worth having: give up the box that costs least, cheapest first.
  const sacrifice: Category[] = ['ones', 'yahtzee', 'twos', 'threes', 'smallStraight', 'largeStraight', 'fourKind', 'fullHouse', 'threeKind', 'fours', 'fives', 'sixes', 'chance'];
  for (const cat of sacrifice) if (allowed(cat)) return cat;
  return options[0].category;
}

/** Names for the computer seats, in the order they are added. */
export const COMPUTER_NAMES = ['Dot', 'Pip', 'Ace'];
