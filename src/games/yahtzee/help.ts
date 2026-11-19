/**
 * The example roll for each box on the card. What each box means, in words, is in
 * `messages.ts` (`help`), in every language; this is the part that is the same in all of them.
 */
import type { Category } from './rules';

export const EXAMPLES: Record<Category, { example: number[]; scores: number }> = {
  ones: { example: [1, 1, 1, 4, 6], scores: 3 },
  twos: { example: [2, 2, 5, 2, 3], scores: 6 },
  threes: { example: [3, 3, 3, 1, 6], scores: 9 },
  fours: { example: [4, 4, 4, 4, 2], scores: 16 },
  fives: { example: [5, 5, 5, 3, 1], scores: 15 },
  sixes: { example: [6, 6, 6, 2, 4], scores: 18 },
  threeKind: { example: [4, 4, 4, 2, 6], scores: 20 },
  fourKind: { example: [5, 5, 5, 5, 2], scores: 22 },
  fullHouse: { example: [3, 3, 3, 6, 6], scores: 25 },
  smallStraight: { example: [1, 2, 3, 4, 6], scores: 30 },
  largeStraight: { example: [2, 3, 4, 5, 6], scores: 40 },
  yahtzee: { example: [5, 5, 5, 5, 5], scores: 50 },
  chance: { example: [6, 5, 4, 3, 6], scores: 24 },
};
