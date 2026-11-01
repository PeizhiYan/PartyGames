/**
 * Every game's rules, and the only list the backend needs.
 *
 * Deliberately free of React: `src/adapters/*` run a game's reducer inside a transaction, so this
 * module has to stay importable from somewhere with no DOM — including, one day, a self-hosted
 * Node server. The screens live in a second registry (`./screens`) that only the UI imports.
 *
 * Typed as `Record<GameId, …>`, so adding an id to the union in `src/types.ts` makes this file
 * fail to compile until the game is registered. That is the forcing function: you cannot half-add
 * a game.
 */
import { GameRuleError, type GameContext, type GameDefinition, type GameId } from '../types';
import { gomoku } from './gomoku/rules';
import { monopoly } from './monopoly/rules';

/**
 * Games keep their own state and action types, but the room layer handles them all the same way,
 * so the registry is typed loosely at that boundary. Each game's own module keeps the precise
 * types, and its screen casts back to them.
 */
export type AnyGame = GameDefinition<never, never>;

export const GAMES_BY_ID = { gomoku, monopoly } as unknown as Record<GameId, AnyGame>;

/** In the order they appear on the home screen. */
export const GAMES: AnyGame[] = Object.values(GAMES_BY_ID);

export function findGame(id: string): AnyGame | undefined {
  return (GAMES_BY_ID as Record<string, AnyGame | undefined>)[id];
}

export function getGame(id: string): AnyGame {
  const game = findGame(id);
  if (!game) throw new GameRuleError(`There is no game called "${id}".`);
  return game;
}

export const isGameId = (id: string): id is GameId => findGame(id) !== undefined;

/** Runs a game's reducer on unknown state, for the room layer. Throws `GameRuleError`. */
export function applyGameAction(id: string, state: unknown, action: unknown, ctx: GameContext): unknown {
  return getGame(id).reduce(state as never, action as never, ctx);
}

/** Lets a game re-seat its players after someone joins or leaves. */
export function syncGamePlayers(id: string, state: unknown, ctx: GameContext): unknown {
  const game = getGame(id);
  return game.onPlayersChanged ? game.onPlayersChanged(state as never, ctx) : state;
}

export function newGameState(id: string, ctx: GameContext): unknown {
  return getGame(id).newState(ctx);
}
