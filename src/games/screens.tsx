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
import HanoiArt from './hanoi/Art';
import HanoiSolo from './hanoi/Solo';
import HanoiLeaderboard from './hanoi/Leaderboard';
import XiangqiArt from './xiangqi/Art';
import XiangqiRoom from './xiangqi/Room';
import XiangqiSolo from './xiangqi/Solo';
import ChessArt from './chess/Art';
import ChessRoom from './chess/Room';
import ChessSolo from './chess/Solo';
import YahtzeeArt from './yahtzee/Art';
import YahtzeeRoom from './yahtzee/Room';
import YahtzeeSolo from './yahtzee/Solo';
import UnoArt from './uno/Art';
import UnoRoom from './uno/Room';
import UnoSolo from './uno/Solo';
import MahjongArt from './mahjong/Art';
import MahjongRoom from './mahjong/Room';
import MahjongSolo from './mahjong/Solo';

export interface GameScreens {
  /** The game itself, inside a room. */
  Room?: ComponentType<{ room: Room; uid: string }>;
  /** Optional game-specific content below the lobby's play choices. */
  LobbyExtra?: ComponentType;
  /** The one-player screen, for games whose definition sets `solo`. */
  Solo?: ComponentType;
  /** Cover art, drawn on the canvas described in `./art`. */
  Art: ComponentType;
  /**
   * Whether this room wants the full window rather than the usual reading-width column. Asked per
   * room, not per game, because Monopoly only needs it when it is actually showing a board.
   */
  wide?: (room: Room) => boolean;
}

export const SCREENS: Record<GameId, GameScreens> = {
  hanoi: { Solo: HanoiSolo, Art: HanoiArt, LobbyExtra: HanoiLeaderboard },
  gomoku: { Room: GomokuRoom, Solo: GomokuSolo, Art: GomokuArt },
  xiangqi: { Room: XiangqiRoom, Solo: XiangqiSolo, Art: XiangqiArt },
  chess: { Room: ChessRoom, Solo: ChessSolo, Art: ChessArt },
  yahtzee: { Room: YahtzeeRoom, Solo: YahtzeeSolo, Art: YahtzeeArt },
  uno: { Room: UnoRoom, Solo: UnoSolo, Art: UnoArt },
  // Four players' melds and discards need the room a phone does not have; on a desktop, use it.
  mahjong: { Room: MahjongRoom, Solo: MahjongSolo, Art: MahjongArt, wide: () => true },
  monopoly: {
    Room: MonopolyRoom,
    Art: MonopolyArt,
    // Bank mode is a column of cards and reads better narrow; the board wants the room.
    wide: (room) => (room.state as { settings?: { mode?: string } })?.settings?.mode === 'board',
  },
};

export const screensFor = (id: string): GameScreens | undefined =>
  (SCREENS as Record<string, GameScreens | undefined>)[id];

/** The cover for one game. Renders nothing for a game that has no art yet. */
export function GameArt({ game }: { game: GameId }) {
  const Art = screensFor(game)?.Art;
  return Art ? <Art /> : null;
}
