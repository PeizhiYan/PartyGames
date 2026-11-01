/**
 * Every game's screens. The UI half of the registry; `./registry` is the pure half.
 *
 * Kept apart so the backend adapters, which import the rules to run a reducer inside a
 * transaction, never pull React in with them.
 *
 * `Record<GameId, …>` again: add an id to the union in `src/types.ts` and this file stops
 * compiling until the game has screens.
 */
import type { ComponentType } from 'react';
import type { GameId, Room } from '../types';
import GomokuArt from './gomoku/Art';
import GomokuRoom from './gomoku/Room';
import GomokuSolo from './gomoku/Solo';
import MonopolyArt from './monopoly/Art';
import MonopolyRoom from './monopoly/Room';

export interface GameScreens {
  /** The game itself, inside a room. */
  Room: ComponentType<{ room: Room; uid: string }>;
  /** The one-player screen, for games whose definition sets `solo`. */
  Solo?: ComponentType;
  /** Cover art, drawn on the canvas described in `./art`. */
  Art: ComponentType;
}

export const SCREENS: Record<GameId, GameScreens> = {
  gomoku: { Room: GomokuRoom, Solo: GomokuSolo, Art: GomokuArt },
  monopoly: { Room: MonopolyRoom, Art: MonopolyArt },
};

export const screensFor = (id: string): GameScreens | undefined =>
  (SCREENS as Record<string, GameScreens | undefined>)[id];

/** The cover for one game. Renders nothing for a game that has no art yet. */
export function GameArt({ game }: { game: GameId }) {
  const Art = screensFor(game)?.Art;
  return Art ? <Art /> : null;
}
