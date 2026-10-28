/**
 * An in-browser backend, so the app can be developed and demoed with no cloud at all:
 * `npm run dev:memory`.
 *
 * Rooms live in localStorage and changes are announced over a BroadcastChannel, which means two
 * browser tabs really can play each other — the first tab signs in as the admin, each later tab as
 * another player — and the whole multiplayer flow (ask to join, approve, play, leave, reap) can be
 * exercised without a Firebase project.
 */
import { applyGameAction, getGame, syncGamePlayers } from '../../domain/games';
import { defaultRoomName, isStale, newRoomCode, normalizeCode } from '../../domain/rooms';
import {
  GameRuleError, type AppUser, type GameContext, type GameId, type JoinRequest, type Member,
  type Room, type RoomPlayer, type RoomSummary,
} from '../../domain/types';
import { NotFoundError, NotSignedInError } from '../../services/errors';
import type { Backend, RoomRepo, Unsubscribe } from '../../services/types';

const KEY = 'partygames:memory';
const IDENTITY_KEY = 'partygames:memory:me';
const CHANNEL = 'partygames:memory';

interface Store {
  rooms: Record<string, Room>;
  members: Record<string, Member>;
  allowlist: string[];
  openSignup: boolean;
  /** How many identities have been handed out, so each tab gets a different player. */
  identities: number;
}

const emptyStore = (): Store => ({ rooms: {}, members: {}, allowlist: [], openSignup: true, identities: 0 });

/** localStorage holds JSON, so Dates come back as strings and have to be revived. */
function reviveDates<T>(value: T): T {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value) as unknown as T;
  if (Array.isArray(value)) return value.map(reviveDates) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = reviveDates(v);
    return out as T;
  }
  return value;
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyStore(), ...reviveDates(JSON.parse(raw) as Store) } : emptyStore();
  } catch {
    return emptyStore();
  }
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
const listeners = new Set<() => void>();

function write(store: Store): void {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage unavailable */ }
  channel?.postMessage('changed');
  for (const l of [...listeners]) l();
}

channel?.addEventListener('message', () => { for (const l of [...listeners]) l(); });
if (typeof window !== 'undefined') {
  // A fallback for browsers without BroadcastChannel: the storage event fires in other tabs.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) for (const l of [...listeners]) l();
  });
}

function subscribe(cb: () => void): Unsubscribe {
  listeners.add(cb);
  cb();
  return () => listeners.delete(cb);
}

function update(change: (store: Store) => void): void {
  const store = read();
  change(store);
  write(store);
}

export function createMemoryBackend(): Backend {
  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
  let user: AppUser | null = null;
  const authListeners = new Set<(u: AppUser | null) => void>();

  /** One identity per tab, kept in sessionStorage: the first tab is the admin. */
  function identity(): AppUser {
    const saved = sessionStorage.getItem(IDENTITY_KEY);
    if (saved) return JSON.parse(saved) as AppUser;
    const store = read();
    const n = store.identities;
    update((s) => { s.identities = n + 1; });
    const fresh: AppUser = n === 0
      ? { uid: 'admin', email: adminEmail, displayName: 'Admin (you)' }
      : { uid: `player${n + 1}`, email: `player${n + 1}@example.com`, displayName: `Player ${n + 1}` };
    sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(fresh));
    return fresh;
  }

  const requireUser = (): AppUser => {
    if (!user) throw new NotSignedInError();
    return user;
  };

  const asPlayer = (u: AppUser): RoomPlayer => ({ uid: u.uid, name: u.displayName, joinedAt: Date.now() });

  const contextOf = (room: Room, actorUid: string, players = room.players): GameContext => ({
    actorUid, ownerUid: room.ownerUid, players, now: Date.now(),
  });

  function editRoom(roomId: string, change: (room: Room, store: Store) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        update((store) => {
          const room = store.rooms[roomId];
          if (!room) throw new NotFoundError();
          change(room, store);
          room.updatedAt = new Date();
        });
        resolve();
      } catch (e) {
        reject(e as Error);
      }
    });
  }

  const setPlayers = (room: Room, players: RoomPlayer[], actorUid: string): void => {
    room.players = players;
    room.playerUids = players.map((p) => p.uid);
    room.state = syncGamePlayers(room.game, room.state, contextOf(room, actorUid, players));
  };

  const rooms: RoomRepo = {
    watchRooms(game, cb) {
      return subscribe(() => {
        const all = Object.values(read().rooms).filter((r) => r.game === game);
        cb(all as RoomSummary[]);
      });
    },

    watchRoom(roomId, cb) {
      return subscribe(() => cb(read().rooms[roomId] ?? null));
    },

    async create(game: GameId, name: string) {
      const owner = requireUser();
      const definition = getGame(game);
      const id = `room-${Math.random().toString(36).slice(2, 10)}`;
      const player = asPlayer(owner);
      update((store) => {
        store.rooms[id] = {
          id,
          game,
          name: name.trim().slice(0, 40) || defaultRoomName(owner.displayName),
          code: newRoomCode(),
          ownerUid: owner.uid,
          players: [player],
          playerUids: [owner.uid],
          requests: [],
          state: definition.newState({ actorUid: owner.uid, ownerUid: owner.uid, players: [player], now: Date.now() }),
          createdAt: new Date(),
          updatedAt: new Date(),
          presence: { [owner.uid]: new Date() },
        };
      });
      return id;
    },

    async findByCode(code) {
      const wanted = normalizeCode(code);
      if (!wanted) return null;
      return (Object.values(read().rooms).find((r) => r.code === wanted) as RoomSummary) ?? null;
    },

    requestJoin: (roomId) => editRoom(roomId, (room) => {
      const asker = requireUser();
      if (room.playerUids.includes(asker.uid)) return;
      if (room.playerUids.length >= getGame(room.game).maxPlayers) throw new GameRuleError('That room is full.');
      if (room.requests.some((r) => r.uid === asker.uid)) return;
      const request: JoinRequest = { uid: asker.uid, name: asker.displayName, at: Date.now() };
      room.requests = [...room.requests, request];
    }),

    cancelRequest: (roomId, who) => editRoom(roomId, (room) => {
      const actor = requireUser();
      if (who !== actor.uid && room.ownerUid !== actor.uid) {
        throw new GameRuleError('Only the host can turn someone down.');
      }
      room.requests = room.requests.filter((r) => r.uid !== who);
    }),

    approve: (roomId, who) => editRoom(roomId, (room) => {
      if (room.ownerUid !== requireUser().uid) throw new GameRuleError('Only the host can let people in.');
      const request = room.requests.find((r) => r.uid === who);
      if (!request) return;
      if (room.playerUids.length >= getGame(room.game).maxPlayers) throw new GameRuleError('The room is full.');
      room.requests = room.requests.filter((r) => r.uid !== who);
      setPlayers(room, [...room.players, { uid: request.uid, name: request.name, joinedAt: Date.now() }], room.ownerUid);
    }),

    async leave(roomId) {
      const actor = requireUser();
      update((store) => {
        const room = store.rooms[roomId];
        if (!room) return;
        const players = room.players.filter((p) => p.uid !== actor.uid);
        if (players.length === 0) { delete store.rooms[roomId]; return; }
        if (room.ownerUid === actor.uid) {
          room.ownerUid = [...players].sort((a, b) => a.joinedAt - b.joinedAt)[0].uid;
        }
        room.requests = room.requests.filter((r) => r.uid !== actor.uid);
        delete room.presence[actor.uid];
        setPlayers(room, players, actor.uid);
        room.updatedAt = new Date();
      });
    },

    async close(roomId) {
      const actor = requireUser();
      update((store) => {
        const room = store.rooms[roomId];
        if (!room) return;
        if (room.ownerUid !== actor.uid) throw new GameRuleError('Only the host can close the room.');
        delete store.rooms[roomId];
      });
    },

    act: (roomId, action) => editRoom(roomId, (room) => {
      const actor = requireUser();
      if (!room.playerUids.includes(actor.uid)) throw new GameRuleError('You are not in this room.');
      room.state = applyGameAction(room.game, room.state, action, contextOf(room, actor.uid));
    }),

    async heartbeat(roomId) {
      const actor = requireUser();
      update((store) => {
        const room = store.rooms[roomId];
        if (room) room.presence[actor.uid] = new Date();
      });
    },

    async reap(game) {
      update((store) => {
        for (const room of Object.values(store.rooms)) {
          if (room.game === game && isStale(room)) delete store.rooms[room.id];
        }
      });
    },
  };

  return {
    name: 'memory',
    auth: {
      onChange(cb) {
        authListeners.add(cb);
        cb(user);
        return () => authListeners.delete(cb);
      },
      async signInWithGoogle() {
        user = identity();
        for (const l of authListeners) l(user);
      },
      async signOut() {
        user = null;
        for (const l of authListeners) l(null);
      },
      async getAccess(u) {
        const store = read();
        const isAdmin = u.email === adminEmail;
        if (isAdmin) return { allowed: true, isAdmin };
        if (store.members[u.uid]?.disabled) return { allowed: false, isAdmin };
        return { allowed: store.openSignup || store.allowlist.includes(u.email), isAdmin };
      },
      async isSignupOpen() {
        return read().openSignup;
      },
    },
    rooms,
    admin: {
      async listMembers() {
        return Object.values(read().members).sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
      },
      async listAllowed() {
        return [...read().allowlist].sort((a, b) => a.localeCompare(b));
      },
      async allow(email) {
        const target = email.trim().toLowerCase();
        update((s) => { if (!s.allowlist.includes(target)) s.allowlist.push(target); });
      },
      async revoke(email) {
        const target = email.trim().toLowerCase();
        update((s) => { s.allowlist = s.allowlist.filter((e) => e !== target); });
      },
      async removeAccount(uid, email) {
        const target = email.trim().toLowerCase();
        update((s) => {
          s.allowlist = s.allowlist.filter((e) => e !== target);
          if (s.members[uid]) s.members[uid] = { ...s.members[uid], disabled: true };
          for (const room of Object.values(s.rooms)) if (room.ownerUid === uid) delete s.rooms[room.id];
        });
      },
      async setSignupOpen(open) {
        update((s) => { s.openSignup = open; });
      },
    },
    account: {
      async recordVisit(info) {
        const u = requireUser();
        update((s) => {
          const previous = s.members[u.uid];
          s.members[u.uid] = {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            firstSeen: previous?.firstSeen ?? new Date(),
            lastSeen: new Date(),
            visits: (previous?.visits ?? 0) + 1,
            installed: info.installed,
          };
        });
      },
    },
  };
}
