import { describe, expect, it } from 'vitest';
import {
  ABANDONED_AFTER_MS, CODE_LENGTH, PRESENCE_TIMEOUT_MS, activePlayers, isStale, newRoomCode,
  normalizeCode, sortRooms, standing,
} from './rooms';
import type { RoomSummary } from './types';

const NOW = 1_700_000_000_000;

function room(patch: Partial<RoomSummary> = {}): RoomSummary {
  return {
    id: 'r1',
    game: 'gomoku',
    name: "Alice's room",
    code: 'AB12',
    ownerUid: 'alice',
    players: [{ uid: 'alice', name: 'Alice', joinedAt: NOW }],
    playerUids: ['alice'],
    requests: [],
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    presence: { alice: new Date(NOW) },
    ...patch,
  };
}

describe('room codes', () => {
  it('are the right length and avoid letters that read like digits', () => {
    for (let i = 0; i < 200; i++) {
      const code = newRoomCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    }
  });

  it('are normalised from however someone types them', () => {
    expect(normalizeCode(' ab-12 ')).toBe('AB12');
    expect(normalizeCode('a b 1 2')).toBe('AB12');
    expect(normalizeCode('')).toBe('');
  });
});

describe('isStale', () => {
  it('is false while someone has checked in recently', () => {
    expect(isStale(room(), NOW + 1000)).toBe(false);
  });

  it('is true only once a room has been quiet for the abandonment window', () => {
    expect(isStale(room(), NOW + PRESENCE_TIMEOUT_MS + 1)).toBe(false);
    expect(isStale(room(), NOW + ABANDONED_AFTER_MS - 1000)).toBe(false);
    expect(isStale(room(), NOW + ABANDONED_AFTER_MS + 1)).toBe(true);
  });

  it('is false if any one player is still there', () => {
    const r = room({
      playerUids: ['alice', 'bob'],
      presence: { alice: new Date(NOW), bob: new Date(NOW + ABANDONED_AFTER_MS) },
    });
    expect(isStale(r, NOW + ABANDONED_AFTER_MS + 1000)).toBe(false);
  });

  /*
   * The case that cost a real game: a phone that locks, or a browser tab in the background, stops
   * running timers, so the host stops checking in within seconds of opening another app. A move
   * or a join has to count as life too, or the room is deleted while it is being played.
   */
  it('counts a recent move as life even with no check-ins at all', () => {
    const playing = room({
      presence: {},
      createdAt: new Date(NOW - 2 * ABANDONED_AFTER_MS),
      updatedAt: new Date(NOW),
    });
    expect(isStale(playing, NOW + 1000)).toBe(false);
    expect(isStale(playing, NOW + ABANDONED_AFTER_MS + 1)).toBe(true);
  });

  it('gives a brand-new room with no check-in yet the full window', () => {
    const fresh = room({ presence: {} });
    expect(isStale(fresh, NOW + PRESENCE_TIMEOUT_MS + 1)).toBe(false);
    expect(isStale(fresh, NOW + ABANDONED_AFTER_MS + 1)).toBe(true);
  });

  /*
   * Staleness compares the viewer's clock against timestamps the server wrote, so a device whose
   * clock is wrong must not be able to delete everyone else's rooms.
   */
  it('never deletes a room that looks like it is from the future', () => {
    expect(isStale(room(), NOW - 60 * 60_000)).toBe(false);
  });

  it('leaves a room alone when nothing about it can be dated', () => {
    const undated = room({ presence: {}, createdAt: new Date(0), updatedAt: new Date(0) });
    expect(isStale(undated, NOW)).toBe(false);
  });
});

describe('activePlayers', () => {
  it('counts only the players whose devices are still checking in', () => {
    const r = room({
      players: [
        { uid: 'alice', name: 'Alice', joinedAt: NOW },
        { uid: 'bob', name: 'Bob', joinedAt: NOW },
      ],
      playerUids: ['alice', 'bob'],
      presence: { alice: new Date(NOW), bob: new Date(NOW - PRESENCE_TIMEOUT_MS - 1) },
    });
    expect(activePlayers(r, NOW)).toEqual(['alice']);
  });
});

describe('standing', () => {
  it('tells each kind of visitor what they are', () => {
    const r = room({
      playerUids: ['alice', 'bob'],
      requests: [{ uid: 'carol', name: 'Carol', at: NOW }],
    });
    expect(standing(r, 'alice', 2)).toBe('owner');
    expect(standing(r, 'bob', 2)).toBe('player');
    expect(standing(r, 'carol', 2)).toBe('requested');
    expect(standing(r, 'dave', 2)).toBe('full');
    expect(standing(r, 'dave', 8)).toBe('joinable');
  });
});

describe('sortRooms', () => {
  it('puts your rooms first, then the newest', () => {
    const mine = room({ id: 'mine', playerUids: ['me'], createdAt: new Date(NOW - 10_000) });
    const older = room({ id: 'older', playerUids: ['x'], createdAt: new Date(NOW - 5000) });
    const newer = room({ id: 'newer', playerUids: ['y'], createdAt: new Date(NOW) });
    expect(sortRooms([older, newer, mine], 'me').map((r) => r.id)).toEqual(['mine', 'newer', 'older']);
  });
});
