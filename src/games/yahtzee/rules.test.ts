import { describe, expect, it } from 'vitest';
import { GameRuleError, type GameContext } from '../../types';
import {
  CATEGORIES, choices, grandTotal, jokerState, ranking, scoreFor, yahtzee, type Dice, type Seat, type YahtzeeState,
} from './rules';

const players = [{ uid: 'a', name: 'Ann', joinedAt: 1 }, { uid: 'b', name: 'Ben', joinedAt: 2 }];
const ctx = (actorUid: string): GameContext => ({ actorUid, ownerUid: 'a', players, now: 1 });
const d = (...n: number[]) => n as Dice;
const seat = (card: Seat['card'] = {}, yahtzeeBonuses = 0): Seat => ({ uid: 'a', name: 'Ann', card, yahtzeeBonuses });

function started(): YahtzeeState {
  const s = yahtzee.onPlayersChanged!(yahtzee.newState(ctx('a')), ctx('a'));
  return yahtzee.reduce(s, { type: 'start' }, ctx('a'));
}

describe('yahtzee scoring', () => {
  it('scores every category', () => {
    expect(scoreFor('ones', d(1, 1, 2, 3, 1))).toBe(3);
    expect(scoreFor('sixes', d(6, 6, 6, 6, 1))).toBe(24);
    expect(scoreFor('threeKind', d(4, 4, 4, 2, 1))).toBe(15);
    expect(scoreFor('threeKind', d(4, 4, 3, 2, 1))).toBe(0);
    expect(scoreFor('fourKind', d(2, 2, 2, 2, 5))).toBe(13);
    expect(scoreFor('fullHouse', d(3, 3, 3, 5, 5))).toBe(25);
    expect(scoreFor('fullHouse', d(3, 3, 3, 3, 5))).toBe(0);
    expect(scoreFor('threeKind', d(3, 3, 3, 5, 5))).toBe(19); // a full house is also three of a kind
    expect(scoreFor('smallStraight', d(1, 2, 3, 4, 6))).toBe(30);
    expect(scoreFor('smallStraight', d(2, 3, 4, 4, 5))).toBe(30);
    expect(scoreFor('smallStraight', d(1, 2, 3, 5, 6))).toBe(0);
    expect(scoreFor('largeStraight', d(2, 3, 4, 5, 6))).toBe(40);
    expect(scoreFor('largeStraight', d(1, 2, 3, 4, 6))).toBe(0);
    expect(scoreFor('yahtzee', d(5, 5, 5, 5, 5))).toBe(50);
    expect(scoreFor('chance', d(1, 2, 3, 4, 5))).toBe(15);
  });

  it('applies the joker and the bonus on a second yahtzee', () => {
    const open = seat({ yahtzee: 50 });
    expect(jokerState(open, d(4, 4, 4, 4, 4))).toEqual({ joker: true, mustUse: 'fours' });
    expect(choices(open, d(4, 4, 4, 4, 4)).map((c) => c.category)).toEqual(['fours']);
    const foursGone = seat({ yahtzee: 50, fours: 12 });
    const opts = choices(foursGone, d(4, 4, 4, 4, 4));
    expect(opts.find((o) => o.category === 'fullHouse')?.score).toBe(25);
    expect(opts.find((o) => o.category === 'largeStraight')?.score).toBe(40);
    expect(opts.find((o) => o.category === 'ones')?.score).toBe(0);
    // Not a yahtzee: no joker.
    expect(jokerState(foursGone, d(4, 4, 4, 4, 5)).joker).toBe(false);
  });

  it('totals the upper bonus and yahtzee bonuses', () => {
    const s = seat({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18, chance: 20 }, 2);
    expect(grandTotal(s)).toBe(63 + 35 + 20 + 200);
  });
});

describe('yahtzee play', () => {
  it('seats both, host starts, holds are refused before a roll', () => {
    const s = started();
    expect(s.seats.map((x) => x.uid)).toEqual(['a', 'b']);
    expect(s.phase).toBe('playing');
    expect(() => yahtzee.reduce(s, { type: 'hold', index: 0, held: true }, ctx('a'))).toThrow(/Roll first/);
    expect(() => yahtzee.reduce(s, { type: 'roll', dice: [1, 2, 3, 4, 5] }, ctx('b'))).toThrow(GameRuleError);
  });

  it('a roll replaces only the dice that are not held, three times at most', () => {
    let s = yahtzee.reduce(started(), { type: 'roll', dice: [1, 2, 3, 4, 5] }, ctx('a'));
    s = yahtzee.reduce(s, { type: 'hold', index: 0, held: true }, ctx('a'));
    s = yahtzee.reduce(s, { type: 'hold', index: 4, held: true }, ctx('a'));
    s = yahtzee.reduce(s, { type: 'roll', dice: [6, 6, 6, 6, 6] }, ctx('a'));
    expect(s.dice).toEqual([1, 6, 6, 6, 5]);
    s = yahtzee.reduce(s, { type: 'roll', dice: [2, 2, 2, 2, 2] }, ctx('a'));
    expect(s.dice).toEqual([1, 2, 2, 2, 5]);
    expect(() => yahtzee.reduce(s, { type: 'roll', dice: [2, 2, 2, 2, 2] }, ctx('a'))).toThrow(/No rolls left/);
    expect(() => yahtzee.reduce(s, { type: 'roll', dice: [7, 2, 2, 2, 2] }, ctx('a'))).toThrow(GameRuleError);
  });

  it('scoring fills the box, passes the turn, resets holds, and ends in results', () => {
    let s = yahtzee.reduce(started(), { type: 'roll', dice: [5, 5, 5, 5, 5] }, ctx('a'));
    s = yahtzee.reduce(s, { type: 'hold', index: 0, held: true }, ctx('a'));
    s = yahtzee.reduce(s, { type: 'score', category: 'yahtzee' }, ctx('a'));
    expect(s.seats[0].card.yahtzee).toBe(50);
    expect(s.turn).toBe(1);
    expect(s.rolls).toBe(0);
    expect(s.held).toEqual([false, false, false, false, false]);
    expect(() => yahtzee.reduce(s, { type: 'score', category: 'chance' }, ctx('b'))).toThrow(/Roll first/);

    // Play the rest out: everyone chances their way through every box.
    let actor = 'b';
    while (s.phase === 'playing') {
      s = yahtzee.reduce(s, { type: 'roll', dice: [1, 2, 3, 4, 6] }, ctx(actor));
      const me = s.seats[s.turn];
      const next = CATEGORIES.find((c) => me.card[c] === undefined)!;
      s = yahtzee.reduce(s, { type: 'score', category: next }, ctx(actor));
      actor = s.seats[s.turn].uid;
    }
    expect(s.phase).toBe('results');
    expect(ranking(s)[0].uid).toBe('a'); // the 50 carries it
    expect(() => yahtzee.reduce(s, { type: 'again' }, ctx('b'))).toThrow(/host/);
    const fresh = yahtzee.reduce(s, { type: 'again' }, ctx('a'));
    expect(fresh.phase).toBe('lobby');
    expect(fresh.seats.every((x) => Object.keys(x.card).length === 0)).toBe(true);
  });

  it('a second yahtzee pays the bonus and must use the open upper box', () => {
    let s = yahtzee.reduce(started(), { type: 'roll', dice: [3, 3, 3, 3, 3] }, ctx('a'));
    s = yahtzee.reduce(s, { type: 'score', category: 'yahtzee' }, ctx('a'));
    s = yahtzee.reduce(s, { type: 'roll', dice: [1, 1, 1, 1, 1] }, ctx('b'));
    s = yahtzee.reduce(s, { type: 'score', category: 'ones' }, ctx('b'));
    s = yahtzee.reduce(s, { type: 'roll', dice: [3, 3, 3, 3, 3] }, ctx('a'));
    expect(() => yahtzee.reduce(s, { type: 'score', category: 'chance' }, ctx('a'))).toThrow(/matching upper box/);
    s = yahtzee.reduce(s, { type: 'score', category: 'threes' }, ctx('a'));
    expect(s.seats[0].card.threes).toBe(15);
    expect(s.seats[0].yahtzeeBonuses).toBe(1);
  });
});
