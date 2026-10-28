// Core types shared by the whole app. Pure data: no React, no backend, no `firebase`.

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

/** Every game in the app. Used as the room's `game` field and in URLs. */
export type GameId = 'gomoku' | 'monopoly';

export interface RoomPlayer {
  uid: string;
  name: string;
  photoURL?: string;
  /** Epoch ms, so game state stays plain JSON that any backend can store. */
  joinedAt: number;
}

/** Someone who tapped "Ask to join" and is waiting for the owner's approval. */
export interface JoinRequest {
  uid: string;
  name: string;
  photoURL?: string;
  at: number;
}

export interface Room<S = unknown> {
  id: string;
  game: GameId;
  /** Shown in the room list; defaults to "<owner>'s room". */
  name: string;
  /** Short code friends can type instead of hunting through the list. */
  code: string;
  ownerUid: string;
  players: RoomPlayer[];
  /** The uids in `players`, duplicated as a flat array so the backend can index/secure on it. */
  playerUids: string[];
  requests: JoinRequest[];
  /** Game-specific state, owned by the game's reducer in src/domain/<game>/. */
  state: S;
  createdAt: Date;
  updatedAt: Date;
  /** uid -> when that player's device last said it was still here (for reaping empty rooms). */
  presence: Record<string, Date>;
}

/** A room as the list shows it, without the (possibly large) game state. */
export type RoomSummary = Omit<Room, 'state'>;

export interface Member {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  firstSeen: Date;
  lastSeen: Date;
  visits?: number;
  installed?: boolean;
  /** Set when the admin removed this account: they can no longer use the app. */
  disabled?: boolean;
}

/** What a game reducer is told about the room it is running in. */
export interface GameContext {
  actorUid: string;
  ownerUid: string;
  players: RoomPlayer[];
  /** Epoch ms. Passed in (never read from the clock) so reducers stay pure and testable. */
  now: number;
}

/**
 * One game, as the rest of the app sees it: how to start it, how to change it, and how it reacts
 * when players come and go. State and actions are plain JSON so any backend can store them.
 */
export interface GameDefinition<S, A> {
  id: GameId;
  name: string;
  tagline: string;
  /** Emoji shown on the game console's screen. */
  emoji: string;
  minPlayers: number;
  maxPlayers: number;
  /** True if this game can also be played alone (against the computer) with no room. */
  solo: boolean;
  newState(ctx: GameContext): S;
  /** Must be pure. Throws `GameRuleError` if the action isn't allowed. */
  reduce(state: S, action: A, ctx: GameContext): S;
  /** Called after someone joins or leaves, so the game can seat or drop them. */
  onPlayersChanged?(state: S, ctx: GameContext): S;
}

/** A move the rules reject (not someone's turn, not enough money...). Shown to the player as-is. */
export class GameRuleError extends Error {}
