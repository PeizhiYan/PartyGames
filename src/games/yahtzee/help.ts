/**
 * What each box on the card means, in plain words, with an example. Shown inline on a wide
 * screen (`short`) and in a sheet when a box's name is tapped (`long` + `example`).
 */
import type { Category } from './rules';

export interface Help {
  short: string;
  long: string;
  example: number[];
  /** What the example scores in this box. */
  scores: number;
}

export const HELP: Record<Category, Help> = {
  ones: { short: 'Add up the 1s', long: 'Add up only the dice showing 1. The other dice count for nothing here.', example: [1, 1, 1, 4, 6], scores: 3 },
  twos: { short: 'Add up the 2s', long: 'Add up only the dice showing 2.', example: [2, 2, 5, 2, 3], scores: 6 },
  threes: { short: 'Add up the 3s', long: 'Add up only the dice showing 3.', example: [3, 3, 3, 1, 6], scores: 9 },
  fours: { short: 'Add up the 4s', long: 'Add up only the dice showing 4.', example: [4, 4, 4, 4, 2], scores: 16 },
  fives: { short: 'Add up the 5s', long: 'Add up only the dice showing 5.', example: [5, 5, 5, 3, 1], scores: 15 },
  sixes: { short: 'Add up the 6s', long: 'Add up only the dice showing 6.', example: [6, 6, 6, 2, 4], scores: 18 },
  threeKind: { short: '3 alike · total of all dice', long: 'At least three dice show the same number. Scores the total of all five dice, not just the three.', example: [4, 4, 4, 2, 6], scores: 20 },
  fourKind: { short: '4 alike · total of all dice', long: 'At least four dice show the same number. Scores the total of all five dice.', example: [5, 5, 5, 5, 2], scores: 22 },
  fullHouse: { short: '3 alike + 2 alike · 25', long: 'Three of one number and two of another — like a pair and a three of a kind together. Always worth 25, whatever the numbers.', example: [3, 3, 3, 6, 6], scores: 25 },
  smallStraight: { short: '4 in a row · 30', long: 'Four numbers in a row, like 1-2-3-4, 2-3-4-5 or 3-4-5-6. The fifth die can be anything. Always 30.', example: [1, 2, 3, 4, 6], scores: 30 },
  largeStraight: { short: '5 in a row · 40', long: 'All five in a row: 1-2-3-4-5 or 2-3-4-5-6. Always 40.', example: [2, 3, 4, 5, 6], scores: 40 },
  yahtzee: { short: '5 alike · 50', long: 'All five dice the same. 50 points — and every extra Yahtzee after that earns a 100-point bonus.', example: [5, 5, 5, 5, 5], scores: 50 },
  chance: { short: 'Anything · total of all dice', long: 'Any five dice at all. Scores their total. Your safety net when nothing else fits.', example: [6, 5, 4, 3, 6], scores: 24 },
};

export const BONUS_HELP = 'Score 63 or more across the top six boxes — three of each number does it — and get 35 extra.';
export const ZERO_HELP = 'Nothing fits? You still have to fill a box each turn. Choose one to score 0 in — usually Ones, or a big box you were unlikely to make.';
