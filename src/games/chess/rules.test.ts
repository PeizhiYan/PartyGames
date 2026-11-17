import { describe, expect, it } from 'vitest';
import { GameRuleError, type GameContext } from '../../types';
import { Board, makeMoveCode, square } from './engine';
import { chess, seatOf, settle, sideToMove, type ChessState } from './rules';

const players = [{ uid: 'a', name: 'Ann', joinedAt: 1 }, { uid: 'b', name: 'Ben', joinedAt: 2 }];
const ctx = (actorUid: string): GameContext => ({ actorUid, ownerUid: 'a', players, now: 1000 });
const seated = (): ChessState => chess.onPlayersChanged!(chess.newState(ctx('a')), ctx('a'));
const sq = (name: string) => square(name.charCodeAt(0) - 97, name.charCodeAt(1) - 49);
const mv = (from: string, to: string, promo = 0) => makeMoveCode(sq(from), sq(to), promo);

/** Plays moves alternately from the seated start; whoever is to move is the actor. */
function play(moves: number[]): ChessState {
  let s = seated();
  for (const m of moves) s = chess.reduce(s, { type: 'move', mv: m }, ctx(sideToMove(s.moves) === 1 ? 'a' : 'b'));
  return s;
}

describe('chess room rules', () => {
  it('seats white then black and plays legal moves', () => {
    const s = play([mv('e2', 'e4'), mv('e7', 'e5')]);
    expect(seatOf(s, 'a')).toBe(1);
    expect(seatOf(s, 'b')).toBe(2);
    expect(s.moves).toHaveLength(2);
    expect(sideToMove(s.moves)).toBe(1);
  });

  it('refuses out-of-turn, spectator, and illegal moves', () => {
    const s = seated();
    expect(() => chess.reduce(s, { type: 'move', mv: mv('e7', 'e5') }, ctx('b'))).toThrow(GameRuleError);
    expect(() => chess.reduce(s, { type: 'move', mv: mv('e2', 'e4') }, ctx('zed'))).toThrow(GameRuleError);
    expect(() => chess.reduce(s, { type: 'move', mv: mv('e2', 'e5') }, ctx('a'))).toThrow(/not allowed/);
  });

  it("fool's mate ends the game for black", () => {
    const s = play([mv('f2', 'f3'), mv('e7', 'e5'), mv('g2', 'g4'), mv('d8', 'h4')]);
    expect(s.outcome).toBe(2);
    expect(s.reason).toBe('Checkmate.');
    expect(s.wins).toEqual({ b: 1 });
  });

  it('a pawn on the last rank must say what it becomes', () => {
    const s = play([mv('a2', 'a4'), mv('h7', 'h5'), mv('a4', 'a5'), mv('h5', 'h4'), mv('a5', 'a6'), mv('h4', 'h3'),
      mv('a6', 'b7'), mv('h3', 'g2')]);
    expect(() => chess.reduce(s, { type: 'move', mv: mv('b7', 'a8') }, ctx('a'))).toThrow(/not allowed/);
    const promoted = chess.reduce(s, { type: 'move', mv: mv('b7', 'a8', 5) }, ctx('a'));
    expect(promoted.moves).toHaveLength(9);
  });

  it('settles stalemate, threefold and fifty-move draws', () => {
    expect(settle(Board.fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), [], 1)).toEqual({ outcome: 3, reason: 'Stalemate.' });
    const k = 'same';
    expect(settle(Board.fromFen('4k3/8/8/8/8/8/8/4K2R w - - 0 1'), [k, 'x', k, 'y', k], 1)?.reason).toMatch(/threefold/);
    expect(settle(Board.fromFen('4k3/8/8/8/8/8/8/4K2R w - - 100 60'), ['z'], 1)?.reason).toMatch(/fifty/);
    expect(settle(Board.fromFen('4k3/8/8/8/8/8/8/4K2R w - - 10 60'), ['z'], 1)).toBeNull();
  });

  it('takeback needs the opponent; rematch needs both and swaps colours', () => {
    let s = play([mv('e2', 'e4'), mv('e7', 'e5')]);
    s = chess.reduce(s, { type: 'requestTakeback' }, ctx('a'));
    expect(() => chess.reduce(s, { type: 'respondTakeback', approve: true }, ctx('a'))).toThrow(/opponent/);
    s = chess.reduce(s, { type: 'respondTakeback', approve: true }, ctx('b'));
    expect(s.moves).toEqual([]);
    s = chess.reduce(s, { type: 'resign' }, ctx('a'));
    s = chess.reduce(s, { type: 'rematch' }, ctx('a'));
    s = chess.reduce(s, { type: 'rematch' }, ctx('b'));
    expect(s.outcome).toBe(0);
    expect(seatOf(s, 'b')).toBe(1);
  });
});
