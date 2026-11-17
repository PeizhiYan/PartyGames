import { describe, expect, it } from 'vitest';
import { shuffle } from './shuffle';

describe('seeded shuffle', () => {
  const items = Array.from({ length: 52 }, (_, i) => i);
  it('is a permutation', () => {
    expect([...shuffle(items, 7)].sort((a, b) => a - b)).toEqual(items);
  });
  it('is the same for the same seed and different for another', () => {
    expect(shuffle(items, 42)).toEqual(shuffle(items, 42));
    expect(shuffle(items, 42)).not.toEqual(shuffle(items, 43));
  });
  it('does not touch its input', () => {
    const copy = items.slice();
    shuffle(items, 1);
    expect(items).toEqual(copy);
  });
});
