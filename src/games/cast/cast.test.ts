import { describe, expect, it } from 'vitest';
import { SPECIES, assignSpecies, computerIndex, speciesFor } from './cast';

describe('the cast', () => {
  it('computers keep their fixed looks', () => {
    expect(speciesFor('computer')).toBe('robot');
    expect(speciesFor('computer-2')).toBe('frog');
    expect(computerIndex('computer-3')).toBe(2);
    expect(computerIndex('abc')).toBe(-1);
  });

  it('gives everyone at a table a different character while there are enough', () => {
    for (let n = 0; n < 50; n += 1) {
      const uids = [`person-${n}`, `other-${n}`, 'computer', 'computer-2', 'computer-3'];
      const looks = assignSpecies(uids);
      expect(new Set(Object.values(looks)).size).toBe(uids.length);
      expect(looks.computer).toBe('robot');
    }
  });

  it('is stable for the same table, and falls back to repeats beyond eight', () => {
    const uids = ['a', 'b', 'c'];
    expect(assignSpecies(uids)).toEqual(assignSpecies(uids));
    const crowd = Array.from({ length: 10 }, (_, i) => `p${i}`);
    expect(Object.keys(assignSpecies(crowd))).toHaveLength(10);
    expect(new Set(Object.values(assignSpecies(crowd))).size).toBe(SPECIES.length);
  });
});
