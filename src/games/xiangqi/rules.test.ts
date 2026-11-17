import { describe, expect, it } from 'vitest';
import { GameRuleError, type GameContext } from '../../types';
import { COORD_XY, MOVE, Position } from './engine';
import { positionOf, seatOf, settle, sideToMove, xiangqi, type XiangqiState } from './rules';

const players = [
  { uid: 'a', name: 'Ann', joinedAt: 1 },
  { uid: 'b', name: 'Ben', joinedAt: 2 },
];
const ctx = (actorUid: string): GameContext => ({ actorUid, ownerUid: 'a', players, now: 1000 });
const seated = (): XiangqiState => xiangqi.onPlayersChanged!(xiangqi.newState(ctx('a')), ctx('a'));
/** Red's cannon in front of the palace, a standard opening. */
const CANNON_CENTRE = MOVE(COORD_XY(4, 10), COORD_XY(7, 10));
/** Black mirrors it. */
const BLACK_CANNON_CENTRE = MOVE(COORD_XY(10, 5), COORD_XY(7, 5));

describe('xiangqi room rules', () => {
  it('seats the first two arrivals as red then black, red to move', () => {
    const s = seated();
    expect(seatOf(s, 'a')).toBe(1);
    expect(seatOf(s, 'b')).toBe(2);
    expect(sideToMove(s.moves)).toBe(1);
  });

  it('plays a legal move and hands the turn over', () => {
    const s = xiangqi.reduce(seated(), { type: 'move', mv: CANNON_CENTRE }, ctx('a'));
    expect(s.moves).toEqual([CANNON_CENTRE]);
    expect(sideToMove(s.moves)).toBe(2);
    expect(positionOf(s.moves).squares[COORD_XY(7, 10)]).toBe(8 + 5);
  });

  it('refuses moves out of turn, by spectators, and ones the engine calls illegal', () => {
    const s = seated();
    expect(() => xiangqi.reduce(s, { type: 'move', mv: BLACK_CANNON_CENTRE }, ctx('b'))).toThrow(GameRuleError);
    expect(() => xiangqi.reduce(s, { type: 'move', mv: CANNON_CENTRE }, ctx('zed'))).toThrow(GameRuleError);
    // A rook jumping over its own knight.
    expect(() => xiangqi.reduce(s, { type: 'move', mv: MOVE(COORD_XY(3, 12), COORD_XY(3, 8)) }, ctx('a'))).toThrow(/cannot move there/);
  });

  it('takeback needs the opponent, and unplays back to the asker\'s move', () => {
    let s = xiangqi.reduce(seated(), { type: 'move', mv: CANNON_CENTRE }, ctx('a'));
    s = xiangqi.reduce(s, { type: 'move', mv: BLACK_CANNON_CENTRE }, ctx('b'));
    s = xiangqi.reduce(s, { type: 'requestTakeback' }, ctx('a'));
    expect(s.takeback?.by).toBe('a');
    expect(() => xiangqi.reduce(s, { type: 'respondTakeback', approve: true }, ctx('a'))).toThrow(/opponent/);
    s = xiangqi.reduce(s, { type: 'respondTakeback', approve: true }, ctx('b'));
    expect(s.moves).toEqual([]);
    expect(s.takeback).toBeNull();
  });

  it('resigning credits the other side; a rematch needs both and swaps colours', () => {
    let s = xiangqi.reduce(seated(), { type: 'resign' }, ctx('a'));
    expect(s.outcome).toBe(2);
    expect(s.wins).toEqual({ b: 1 });
    s = xiangqi.reduce(s, { type: 'rematch' }, ctx('a'));
    expect(s.outcome).toBe(2);
    s = xiangqi.reduce(s, { type: 'rematch' }, ctx('b'));
    expect(s.outcome).toBe(0);
    expect(s.round).toBe(1);
    expect(seatOf(s, 'a')).toBe(2);
    expect(seatOf(s, 'b')).toBe(1);
  });

  it('settles a mate for the mover, a bare board as a draw, and nothing mid-game', () => {
    // Black to move, boxed in by two red rooks: red (the mover) has mated.
    expect(settle(Position.fromFen('3k5/4R4/3R5/9/9/9/9/9/9/4K4 b'), 1)).toEqual({ outcome: 1, reason: 'Checkmate.' });
    // Red's general takes black's last rook, leaving only the two generals. (The black general
    // sits off red's file: generals facing each other is itself illegal, and a rook that stayed
    // on the board would still count as attacking material — the rule is about *both* sides.)
    const bare = Position.fromFen('3k5/9/9/9/9/9/9/9/4r4/4K4 w');
    expect(bare.makeMove(MOVE(COORD_XY(7, 12), COORD_XY(7, 11)))).toBe(true);
    expect(settle(bare, 1)).toEqual({ outcome: 3, reason: 'Draw — neither side can give mate.' });
    // One opening move: nothing to settle.
    expect(settle(positionOf([CANNON_CENTRE]), 1)).toBeNull();
  });
});
