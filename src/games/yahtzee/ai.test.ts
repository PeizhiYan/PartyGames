import { describe, expect, it } from 'vitest';
import { chooseCategory, chooseHolds } from './ai';
import { CATEGORIES, choices, type Dice, type Seat } from './rules';

const d = (...n: number[]) => n as Dice;
const seat = (card: Seat['card'] = {}): Seat => ({ uid: 'c', name: 'Dot', card, yahtzeeBonuses: 0 });

describe('yahtzee computer', () => {
  it('always picks a box it may use', () => {
    let s = seat();
    // Fill the card in any order with whatever the AI picks for a fixed set of dice.
    for (let i = 0; i < 13; i += 1) {
      const dice = d(1 + (i % 6), 1 + ((i * 2) % 6), 1 + ((i * 3) % 6), 1 + ((i * 5) % 6), 6);
      const pick = chooseCategory(s, dice);
      expect(choices(s, dice).map((c) => c.category)).toContain(pick);
      s = seat({ ...s.card, [pick]: 0 });
    }
    expect(CATEGORIES.every((c) => s.card[c] !== undefined)).toBe(true);
  });

  it('takes the big boxes when they are there', () => {
    expect(chooseCategory(seat(), d(2, 2, 2, 2, 2))).toBe('yahtzee');
    expect(chooseCategory(seat(), d(2, 3, 4, 5, 6))).toBe('largeStraight');
    expect(chooseCategory(seat(), d(3, 3, 3, 5, 5))).toBe('fullHouse');
    expect(chooseCategory(seat(), d(6, 6, 6, 1, 2))).toBe('sixes');
  });

  it('holds the largest group, or four to a straight', () => {
    expect(chooseHolds(d(4, 4, 1, 4, 2), seat(), 2)).toEqual([true, true, false, true, false]);
    expect(chooseHolds(d(2, 3, 4, 5, 5), seat(), 2)).toEqual([true, true, true, true, false]);
    expect(chooseHolds(d(1, 2, 3, 4, 5), seat(), 0)).toEqual([true, true, true, true, true]);
    expect(chooseHolds(d(1, 2, 4, 6, 3), seat({ smallStraight: 0, largeStraight: 0 }), 2)).toEqual([false, false, false, false, false]);
  });
});
