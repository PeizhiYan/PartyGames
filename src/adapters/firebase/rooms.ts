import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, onSnapshot, query,
  runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where,
  type DocumentData, type DocumentSnapshot,
} from 'firebase/firestore';
import { applyGameAction, getGame, syncGamePlayers } from '../../domain/games';
import { defaultRoomName, isStale, newRoomCode, normalizeCode } from '../../domain/rooms';
import {
  GameRuleError, type GameContext, type GameId, type JoinRequest, type Room, type RoomPlayer,
  type RoomSummary,
} from '../../domain/types';
import { NotFoundError, NotSignedInError } from '../../services/errors';
import type { RoomRepo } from '../../services/types';
import { ROOT, type FirebaseContext } from './app';
import { mapError, wrap } from './errors';

const asDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : new Date(0));

function presenceOf(raw: unknown): Record<string, Date> {
  const out: Record<string, Date> = {};
  for (const [uid, at] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    if (at instanceof Timestamp) out[uid] = at.toDate();
  }
  return out;
}

function toRoom(snap: DocumentSnapshot): Room | null {
  const data = snap.data();
  if (!data) return null;
  return {
    id: snap.id,
    game: data.game as GameId,
    name: data.name ?? '',
    code: data.code ?? '',
    ownerUid: data.ownerUid ?? '',
    players: (data.players ?? []) as RoomPlayer[],
    playerUids: (data.playerUids ?? []) as string[],
    requests: (data.requests ?? []) as JoinRequest[],
    state: data.state,
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    presence: presenceOf(data.presence),
  };
}

/** Firestore refuses `undefined`, so optional fields are dropped rather than written as undefined. */
function clean<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createRoomRepo({ auth, db }: FirebaseContext): RoomRepo {
  const rooms = collection(db, ROOT, 'rooms');
  const roomRef = (id: string) => doc(rooms, id);

  const me = (): RoomPlayer => {
    const user = auth.currentUser;
    if (!user) throw new NotSignedInError();
    const player: RoomPlayer = {
      uid: user.uid,
      name: user.displayName ?? user.email ?? 'Player',
      joinedAt: Date.now(),
    };
    if (user.photoURL) player.photoURL = user.photoURL;
    return player;
  };
  const uid = (): string => {
    const id = auth.currentUser?.uid;
    if (!id) throw new NotSignedInError();
    return id;
  };

  /**
   * Reads the room, lets `change` produce the fields to write, and retries if someone else got
   * there first. Every change to a room goes through here, so two players tapping at the same
   * moment can't overwrite each other.
   */
  const edit = (id: string, change: (room: Room) => DocumentData | null) => wrap(() =>
    runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef(id));
      const room = toRoom(snap);
      if (!room) throw new NotFoundError();
      const patch = change(room);
      if (patch === null) return;
      tx.update(roomRef(id), { ...patch, updatedAt: serverTimestamp() });
    }));

  /** What the game reducers are told about the room they're running in. */
  const contextOf = (room: Room, actorUid: string): GameContext => ({
    actorUid,
    ownerUid: room.ownerUid,
    players: room.players,
    now: Date.now(),
  });

  /** Adds or drops a player and lets the game re-seat everyone in the same write. */
  const withPlayers = (room: Room, players: RoomPlayer[], actorUid: string): DocumentData => ({
    players: clean(players),
    playerUids: players.map((p) => p.uid),
    state: clean({ value: syncGamePlayers(room.game, room.state, { ...contextOf(room, actorUid), players }) }).value,
  });

  return {
    watchRooms(game, cb, onError) {
      return onSnapshot(
        query(rooms, where('game', '==', game)),
        (snap) => cb(snap.docs.map((d) => toRoom(d)).filter((r): r is Room => r !== null) as RoomSummary[]),
        (e) => onError?.(mapError(e)),
      );
    },

    watchRoom(roomId, cb, onError) {
      return onSnapshot(
        roomRef(roomId),
        (snap) => cb(toRoom(snap)),
        (e) => onError?.(mapError(e)),
      );
    },

    create: (game, name) => wrap(async () => {
      const definition = getGame(game);
      const owner = me();
      const ref = doc(rooms); // the id is generated locally, so this needs no round trip
      const ctx: GameContext = { actorUid: owner.uid, ownerUid: owner.uid, players: [owner], now: Date.now() };
      await setDoc(ref, {
        // `clean` runs over the plain data only: serverTimestamp() is a sentinel, not a value,
        // and would not survive a JSON round trip.
        ...clean({
          game,
          name: name.trim().slice(0, 40) || defaultRoomName(owner.name),
          code: newRoomCode(),
          ownerUid: owner.uid,
          players: [owner],
          playerUids: [owner.uid],
          requests: [],
          state: definition.newState(ctx),
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        presence: { [owner.uid]: serverTimestamp() },
      });
      return ref.id;
    }),

    findByCode: (code) => wrap(async () => {
      const wanted = normalizeCode(code);
      if (!wanted) return null;
      const snap = await getDocs(query(rooms, where('code', '==', wanted), limit(1)));
      const room = snap.docs[0] ? toRoom(snap.docs[0]) : null;
      return room as RoomSummary | null;
    }),

    requestJoin: (roomId) => edit(roomId, (room) => {
      const asker = me();
      if (room.playerUids.includes(asker.uid)) return null; // already in
      const game = getGame(room.game);
      if (room.playerUids.length >= game.maxPlayers) throw new GameRuleError('That room is full.');
      if (room.requests.some((r) => r.uid === asker.uid)) return null; // already asked
      const request: JoinRequest = { uid: asker.uid, name: asker.name, at: Date.now() };
      if (asker.photoURL) request.photoURL = asker.photoURL;
      return { requests: clean([...room.requests, request]) };
    }),

    cancelRequest: (roomId, who) => edit(roomId, (room) => {
      const actor = uid();
      if (who !== actor && room.ownerUid !== actor) {
        throw new GameRuleError('Only the host can turn someone down.');
      }
      if (!room.requests.some((r) => r.uid === who)) return null;
      return { requests: clean(room.requests.filter((r) => r.uid !== who)) };
    }),

    approve: (roomId, who) => edit(roomId, (room) => {
      if (room.ownerUid !== uid()) throw new GameRuleError('Only the host can let people in.');
      const request = room.requests.find((r) => r.uid === who);
      if (!request) return null;
      const game = getGame(room.game);
      if (room.playerUids.length >= game.maxPlayers) throw new GameRuleError('The room is full.');
      const player: RoomPlayer = { uid: request.uid, name: request.name, joinedAt: Date.now() };
      if (request.photoURL) player.photoURL = request.photoURL;
      return {
        requests: clean(room.requests.filter((r) => r.uid !== who)),
        ...withPlayers(room, [...room.players, player], room.ownerUid),
      };
    }),

    leave: (roomId) => wrap(async () => {
      const actor = uid();
      let empty = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef(roomId));
        const room = toRoom(snap);
        if (!room) return;
        const players = room.players.filter((p) => p.uid !== actor);
        if (players.length === 0) { empty = true; return; }
        // The owner handing over: the next-longest-standing player takes the room.
        const ownerUid = room.ownerUid === actor
          ? [...players].sort((a, b) => a.joinedAt - b.joinedAt)[0].uid
          : room.ownerUid;
        tx.update(roomRef(roomId), {
          ...withPlayers({ ...room, ownerUid }, players, actor),
          ownerUid,
          requests: clean(room.requests.filter((r) => r.uid !== actor)),
          [`presence.${actor}`]: deleteField(),
          updatedAt: serverTimestamp(),
        });
      });
      // The last one out turns off the lights.
      if (empty) await deleteDoc(roomRef(roomId)).catch(() => {});
    }),

    close: (roomId) => wrap(async () => {
      const snap = await getDoc(roomRef(roomId));
      const room = toRoom(snap);
      if (!room) return;
      if (room.ownerUid !== uid()) throw new GameRuleError('Only the host can close the room.');
      await deleteDoc(roomRef(roomId));
    }),

    act: (roomId, action) => edit(roomId, (room) => {
      const actor = uid();
      if (!room.playerUids.includes(actor)) throw new GameRuleError('You are not in this room.');
      const state = applyGameAction(room.game, room.state, action, contextOf(room, actor));
      // `clean` strips the `undefined`s an optional field leaves behind; wrapping keeps a
      // top-level primitive (should a game ever use one) from being lost.
      return { state: clean({ value: state }).value };
    }),

    heartbeat: (roomId) => wrap(async () => {
      await updateDoc(roomRef(roomId), { [`presence.${uid()}`]: serverTimestamp() })
        .catch((e) => { if ((e as { code?: string }).code !== 'not-found') throw e; });
    }),

    reap: (game) => wrap(async () => {
      const snap = await getDocs(query(rooms, where('game', '==', game)));
      const gone = snap.docs
        .map((d) => toRoom(d))
        .filter((r): r is Room => r !== null && isStale(r));
      // One failure (someone rejoined mid-sweep) must not stop the rest.
      await Promise.all(gone.map((r) => deleteDoc(roomRef(r.id)).catch(() => {})));
    }),
  };
}
