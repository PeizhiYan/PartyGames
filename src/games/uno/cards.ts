/**
 * The 108-card UNO deck. A card is referred to everywhere by its id — its index in `DECK` — so
 * the room document holds small arrays of numbers rather than objects, and two copies of the
 * same face are still two different cards.
 */

export const COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type Color = (typeof COLORS)[number];
export type Kind = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface Card {
  id: number;
  color: Color | 'wild';
  kind: Kind;
}

/** Per colour: one 0, two each of 1-9, skip, reverse and draw-two. Then four wilds and four wild draw-fours. */
function buildDeck(): Card[] {
  const cards: Omit<Card, 'id'>[] = [];
  for (const color of COLORS) {
    cards.push({ color, kind: '0' });
    for (const kind of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'] as Kind[]) {
      cards.push({ color, kind }, { color, kind });
    }
  }
  for (let i = 0; i < 4; i += 1) cards.push({ color: 'wild', kind: 'wild' });
  for (let i = 0; i < 4; i += 1) cards.push({ color: 'wild', kind: 'wild4' });
  return cards.map((c, id) => ({ ...c, id }));
}

export const DECK: readonly Card[] = buildDeck();
export const DECK_SIZE = DECK.length;

export const cardOf = (id: number): Card => DECK[id];
export const isWild = (id: number): boolean => DECK[id].color === 'wild';
export const isNumber = (id: number): boolean => /^[0-9]$/.test(DECK[id].kind);
export const isColor = (c: unknown): c is Color => typeof c === 'string' && (COLORS as readonly string[]).includes(c);

/** What a card left in a loser's hand is worth to the winner. */
export function points(id: number): number {
  const { kind } = DECK[id];
  if (isNumber(id)) return Number(kind);
  if (kind === 'wild' || kind === 'wild4') return 50;
  return 20;
}

export const KIND_LABEL: Record<Kind, string> = {
  0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  skip: 'Skip', reverse: 'Reverse', draw2: 'Draw two', wild: 'Wild', wild4: 'Wild draw four',
};

export const describe = (id: number): string => {
  const c = DECK[id];
  return c.color === 'wild' ? KIND_LABEL[c.kind] : `${c.color[0].toUpperCase()}${c.color.slice(1)} ${KIND_LABEL[c.kind].toLowerCase()}`;
};
