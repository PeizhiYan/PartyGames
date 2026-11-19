import { afterEach, describe, expect, it } from 'vitest';
import { applyLanguage, t } from '.';
import { getGame } from '../games/registry';
import { uno, type UnoState } from '../games/uno/rules';
import { noteText as unoNote, cardName } from '../games/uno/messages';
import { reasonText } from '../games/chess/messages';
import { tileName } from '../games/mahjong/messages';
import { cardText } from '../games/monopoly/messages';
import { timeAgo, playersLabel } from '../lib/format';
import { GameRuleError, type GameContext } from '../types';

const players = [{ uid: 'a', name: 'Ann Lee', joinedAt: 1 }, { uid: 'b', name: 'Ben', joinedAt: 2 }];
const ctx = (actorUid: string): GameContext => ({ actorUid, ownerUid: 'a', players, now: 1 });

function dealtUno(): UnoState {
  const s = uno.onPlayersChanged!(uno.newState(ctx('a')), ctx('a'));
  return uno.reduce(s, { type: 'start', seed: 4 }, ctx('a'));
}

describe('languages', () => {
  afterEach(() => { applyLanguage('en'); });

  it('speaks English by default', () => {
    applyLanguage('en');
    expect(t.nav.play).toBe('Play');
    expect(getGame('mahjong').name).toBe('Mahjong');
    expect(playersLabel(getGame('yahtzee'))).toBe('1–6 players');
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe('5m ago');
    expect(t.common.list(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('switches the app, the games and the rule errors to Simplified Chinese', () => {
    applyLanguage('zh');
    expect(t.nav.play).toBe('游戏');
    expect(getGame('mahjong').name).toBe('麻将');
    expect(playersLabel(getGame('yahtzee'))).toBe('1–6 人');
    expect(tileName(31 * 4)).toBe('红中');
    expect(reasonText('Checkmate.')).toBe('将死。');
    expect(cardText('Advance to Go.')).toBe('前进到起点。');
    // A reducer refusing a move says so in the language of the device that made it.
    const s = dealtUno();
    const notMover = s.seats[(s.turn + 1) % 2].uid;
    expect(() => uno.reduce(s, { type: 'draw' }, ctx(notMover))).toThrow(new GameRuleError('还没轮到你。'));
  });

  it('switches to Japanese', () => {
    applyLanguage('ja');
    expect(t.settings.language).toBe('言語');
    expect(getGame('uno').soloTitle).toBe('コンピューターと遊ぶ');
    expect(t.common.players(4)).toBe('4人');
  });

  it('keeps shared game state free of words, so each player reads it in their own language', () => {
    applyLanguage('en');
    const s = dealtUno();
    // What just happened is stored as data …
    expect(typeof s.last).toBe('object');
    const name = (uid: string) => players.find((p) => p.uid === uid)!.name.split(' ')[0];
    const first = s.discard[0];
    // … and worded on each screen.
    expect(unoNote(s.last, name)).toBe(`${cardName(first)} turned up. ${name(s.seats[s.turn].uid)} starts.`);
    applyLanguage('zh');
    expect(unoNote(s.last, name)).toBe(`翻开了${cardName(first)}。${name(s.seats[s.turn].uid)}先出。`);
    // A room from before the change still shows its English sentence.
    expect(unoNote('Ann played Blue 7.', name)).toBe('Ann played Blue 7.');
  });
});
