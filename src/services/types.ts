// The backend contract. The app depends ONLY on these interfaces; each adapter in src/adapters/*
// implements them for one backend (Firebase today; a REST API over Postgres, Supabase, a
// self-hosted Node server... would be another folder here and one line in index.ts).
import type { AppUser, GameId, Member, Room, RoomSummary } from '../domain/types';

export type Unsubscribe = () => void;

export interface Access {
  allowed: boolean;
  isAdmin: boolean;
}

export interface AuthService {
  /** Called immediately with the current user (or null), then on every change. */
  onChange(cb: (user: AppUser | null) => void): Unsubscribe;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** Whether the signed-in user may use the app: the admin, anyone while sign-up is open, else the allowlist. */
  getAccess(user: AppUser): Promise<Access>;
  /** Whether anyone with a Google account can register (readable before sign-in). */
  isSignupOpen(): Promise<boolean>;
}

export interface RoomRepo {
  /** Live list of open rooms for one game, without their game state. */
  watchRooms(game: GameId, cb: (rooms: RoomSummary[]) => void, onError?: (e: Error) => void): Unsubscribe;
  /** Live view of one room including its game state. `null` once the room is gone. */
  watchRoom(roomId: string, cb: (room: Room | null) => void, onError?: (e: Error) => void): Unsubscribe;
  /** Opens a room for `game` with the signed-in user as owner and first player. Returns its id. */
  create(game: GameId, name: string): Promise<string>;
  /** Finds an open room by its short code. */
  findByCode(code: string): Promise<RoomSummary | null>;
  /** Asks the owner for a place in the room. */
  requestJoin(roomId: string): Promise<void>;
  /** Withdraws a join request (the asker, or the owner turning someone down). */
  cancelRequest(roomId: string, uid: string): Promise<void>;
  /** Owner only: lets someone in. */
  approve(roomId: string, uid: string): Promise<void>;
  /** Leaves the room. The last player out deletes it. */
  leave(roomId: string): Promise<void>;
  /** Owner only: closes the room for everyone. */
  close(roomId: string): Promise<void>;
  /**
   * Runs one game action against the room's state. The reducer lives in src/domain, so every
   * adapter applies the same rules; this method's job is to do it without losing a simultaneous
   * move (a transaction, a compare-and-set, a server-side handler...).
   */
  act(roomId: string, action: unknown): Promise<void>;
  /** Says this player's device is still on the room's screen, so the room isn't reaped. */
  heartbeat(roomId: string): Promise<void>;
  /** Deletes rooms everybody has left. Safe to call from any client, and a no-op if none are. */
  reap(game: GameId): Promise<void>;
}

export interface AdminRepo {
  /** Everyone who has signed in, for the admin's user list. */
  listMembers(): Promise<Member[]>;
  listAllowed(): Promise<string[]>;
  allow(email: string): Promise<void>;
  revoke(email: string): Promise<void>;
  /**
   * Removes someone's account from this app: their allowlist entry, their member record and their
   * rooms. Their Google sign-in itself lives with the identity provider; see README.
   */
  removeAccount(uid: string, email: string): Promise<void>;
  setSignupOpen(open: boolean): Promise<void>;
}

export interface AccountRepo {
  /** Records that the signed-in user opened the app, so the admin can see who uses it. */
  recordVisit(info: { installed: boolean }): Promise<void>;
}

export interface Backend {
  name: string;
  auth: AuthService;
  rooms: RoomRepo;
  admin: AdminRepo;
  account: AccountRepo;
}
