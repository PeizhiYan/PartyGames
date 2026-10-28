import { describe, expect, it } from 'vitest';
import {
  CODE_LENGTH, PRESENCE_TIMEOUT_MS, activePlayers, isStale, newRoomCode, normalizeCode, sortRooms,
  standing,
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

  it('is true once every heartbeat has gone quiet', () => {
    expect(isStale(room(), NOW + PRESENCE_TIMEOUT_MS + 1)).toBe(true);
  });

  it('is false if any one player is still there', () => {
    const r = room({
      playerUids: ['alice', 'bob'],
      presence: { alice: new Date(NOW), bob: new Date(NOW + PRESENCE_TIMEOUT_MS) },
    });
    expect(isStale(r, NOW + PRESENCE_TIMEOUT_MS + 1000)).toBe(false);
  });

  it('gives a brand-new room with no heartbeat yet its grace period', () => {
    const fresh = room({ presence: {} });
    expect(isStale(fresh, NOW + 1000)).toBe(false);
    expect(isStale(fresh, NOW + PRESENCE_TIMEOUT_MS + 1)).toBe(true);
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
