/**
 * Drives the memory adapter the way two phones would: one creates a room, the other asks to join,
 * and the game runs over the shared store. This is the test that covers the room layer itself
 * (requests, approval, seating, leaving, reaping) rather than the game rules.
 *
 * The adapter only needs Web Storage, so the two are stubbed here instead of pulling in a whole
 * DOM for one file. Each `createMemoryBackend()` is a separate "tab" sharing one localStorage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function storageStub(): Storage {
  let data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => { data = new Map(); },
  } as Storage;
}

vi.stubGlobal('localStorage', storageStub());
vi.stubGlobal('sessionStorage', storageStub());
import { createMemoryBackend } from './index';
import type { GomokuState } from '../../domain/gomoku/game';
import { idx } from '../../domain/gomoku/board';
import { ABANDONED_AFTER_MS } from '../../domain/rooms';
import type { Room } from '../../domain/types';

describe('two players in a room', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('create, ask, approve, play, leave', async () => {
    // Two "tabs": each backend instance keeps its own identity, like two devices.
    const host = createMemoryBackend();
    await host.auth.signInWithGoogle();
    sessionStorage.clear(); // the next instance gets a different identity
    const guest = createMemoryBackend();
    await guest.auth.signInWithGoogle();

    let hostUid = '';
    host.auth.onChange((u) => { hostUid = u?.uid ?? ''; });
    let guestUid = '';
    guest.auth.onChange((u) => { guestUid = u?.uid ?? ''; });
    expect(hostUid).toBe('admin');
    expect(guestUid).toBe('player2');

    const roomId = await host.rooms.create('gomoku', 'Test room');

    // The guest sees the room in the list.
    let listed: Room[] = [];
    guest.rooms.watchRooms('gomoku', (rooms) => { listed = rooms as Room[]; });
    expect(listed.map((r) => r.id)).toEqual([roomId]);

    // Ask to join, and the host lets them in.
    await guest.rooms.requestJoin(roomId);
    let room: Room | null = null;
    host.rooms.watchRoom(roomId, (r) => { room = r; });
    expect(room!.requests.map((r) => r.uid)).toEqual([guestUid]);
    await host.rooms.approve(roomId, guestUid);
    expect(room!.playerUids).toEqual([hostUid, guestUid]);

    // Both seats are filled, so play can start.
    let state = room!.state as GomokuState;
    expect(state.black).toBe(hostUid);
    expect(state.white).toBe(guestUid);

    // Out of turn is refused; in turn works, and the guest's watcher sees it.
    await expect(guest.rooms.act(roomId, { type: 'place', cell: idx(7, 7) })).rejects.toThrow(/not your turn/i);
    await host.rooms.act(roomId, { type: 'place', cell: idx(7, 7) });
    state = room!.state as GomokuState;
    expect(state.board[idx(7, 7)]).toBe(1);
    expect(state.turn).toBe(2);
    await guest.rooms.act(roomId, { type: 'place', cell: idx(0, 0) });
    expect((room!.state as GomokuState).turn).toBe(1);

    // Someone outside the room cannot play.
    sessionStorage.clear();
    const stranger = createMemoryBackend();
    await stranger.auth.signInWithGoogle();
    await expect(stranger.rooms.act(roomId, { type: 'place', cell: idx(5, 5) }))
      .rejects.toThrow(/not in this room/i);

    // Find it by code.
    const found = await guest.rooms.findByCode(room!.code.toLowerCase());
    expect(found?.id).toBe(roomId);

    // The guest leaves; the host keeps the room and the seat frees up.
    await guest.rooms.leave(roomId);
    expect(room!.playerUids).toEqual([hostUid]);
    expect((room!.state as GomokuState).white).toBeNull();

    // The last one out deletes it.
    await host.rooms.leave(roomId);
    expect(room).toBeNull();
  });

  it('hands the room to the next player when the host leaves', async () => {
    const host = createMemoryBackend();
    await host.auth.signInWithGoogle();
    sessionStorage.clear();
    const guest = createMemoryBackend();
    await guest.auth.signInWithGoogle();

    const roomId = await host.rooms.create('monopoly', 'Bank night');
    await guest.rooms.requestJoin(roomId);
    await host.rooms.approve(roomId, 'player2');

    let room: Room | null = null;
    guest.rooms.watchRoom(roomId, (r) => { room = r; });
    await host.rooms.leave(roomId);
    expect(room!.ownerUid).toBe('player2');
    // ...and the new host can now start the game, which the old one could.
    await expect(guest.rooms.act(roomId, { type: 'start' })).rejects.toThrow(/two players/i);
  });

  it('reaps a room nobody has checked into for a while', async () => {
    const host = createMemoryBackend();
    await host.auth.signInWithGoogle();
    const roomId = await host.rooms.create('gomoku', 'Abandoned');

    let room: Room | null = null;
    host.rooms.watchRoom(roomId, (r) => { room = r; });
    await host.rooms.reap('gomoku');
    expect(room).not.toBeNull(); // still fresh

    // Age the room past the abandonment window: every sign of life has to be old, including the
    // last update, or the room counts as still being played in.
    const store = JSON.parse(localStorage.getItem('partygames:memory')!);
    const old = new Date(Date.now() - 2 * ABANDONED_AFTER_MS).toISOString();
    store.rooms[roomId].presence = { admin: old };
    store.rooms[roomId].createdAt = old;
    store.rooms[roomId].updatedAt = old;
    localStorage.setItem('partygames:memory', JSON.stringify(store));

    await host.rooms.reap('gomoku');
    host.rooms.watchRoom(roomId, (r) => { room = r; });
    expect(room).toBeNull();
  });
});
