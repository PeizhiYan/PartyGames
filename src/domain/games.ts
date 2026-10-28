// The list of games the app offers. Adding a game means writing its reducer under
// src/domain/<game>/, its screen under src/components/<game>/, and adding it here.
import { gomoku } from './gomoku/game';
import { monopoly } from './monopoly/game';
import { GameRuleError, type GameContext, type GameDefinition, type GameId } from './types';

/**
 * Games are stored with their own state and action types, but the room layer handles them all the
 * same way, so the registry is typed loosely at that boundary. Each game's own module keeps the
 * precise types, and its screen casts the room's state back to them.
 */
export type AnyGame = GameDefinition<never, never>;

export const GAMES = [gomoku, monopoly] as unknown as AnyGame[];

export function findGame(id: string): AnyGame | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getGame(id: string): AnyGame {
  const game = findGame(id);
  if (!game) throw new GameRuleError(`There is no game called "${id}".`);
  return game;
}

export const isGameId = (id: string): id is GameId => findGame(id) !== undefined;

/** Runs a game's reducer on unknown state, for the room layer. Throws `GameRuleError`. */
export function applyGameAction(id: string, state: unknown, action: unknown, ctx: GameContext): unknown {
  const game = getGame(id);
  return game.reduce(state as never, action as never, ctx);
}

/** Lets a game re-seat its players after someone joins or leaves. */
export function syncGamePlayers(id: string, state: unknown, ctx: GameContext): unknown {
  const game = getGame(id);
  return game.onPlayersChanged ? game.onPlayersChanged(state as never, ctx) : state;
}

export function newGameState(id: string, ctx: GameContext): unknown {
  return getGame(id).newState(ctx);
}
