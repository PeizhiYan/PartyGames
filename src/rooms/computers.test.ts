import { describe, expect, it } from 'vitest';
import {
  COMPUTER_UID, ROOM_LIMIT, actingAs, afterLeaving, computerDriver, computerUid, isComputer, nextComputerUid,
  seatComputer, unseatComputer,
} from './computers';
import { PRESENCE_TIMEOUT_MS } from './rules';
import type { RoomPlayer, RoomSummary } from '../types';

const NOW = 1_000_000;

function room(players: string[], presence: Record<string, number> = {}, ownerUid = players[0]): RoomSummary {
  const list: RoomPlayer[] = players.map((uid, i) => ({ uid, name: uid, joinedAt: i }));
  return {
    id: 'r', game: 'uno', name: 'R', code: 'ABCD', ownerUid, players: list, playerUids: players, requests: [],
    createdAt: new Date(0), updatedAt: new Date(0),
    presence: Object.fromEntries(Object.entries(presence).map(([u, t]) => [u, new Date(t)])),
  };
}

const game = { computerPlayers: true, maxPlayers: 4 };

describe('computer seats', () => {
  it('are numbered in cast order and take the first free number', () => {
    expect(computerUid(0)).toBe(COMPUTER_UID);
    expect(computerUid(2)).toBe('computer-3');
    expect(nextComputerUid(['host', 'computer', 'computer-3'])).toBe('computer-2');
    expect(isComputer('computer-2')).toBe(true);
    expect(isComputer('host')).toBe(false);
  });

  it('are seated only by the host, in a game that has them, while there is room', () => {
    const r = room(['host', 'guest']);
    expect(seatComputer(r, 'host', game, () => 'Dot', 5)).toEqual({ uid: 'computer', name: 'Dot', joinedAt: 5 });
    expect(() => seatComputer(r, 'guest', game, () => 'Dot', 5)).toThrow(/host/);
    expect(() => seatComputer(r, 'host', { ...game, computerPlayers: false }, () => 'Dot', 5)).toThrow(/no computer/);
    expect(() => seatComputer(room(['host', 'a', 'b', 'c']), 'host', game, () => 'Dot', 5)).toThrow(/full/);
  });

  it('never fill a room past what the database allows, whatever the game says', () => {
    const r = room(['host', ...Array.from({ length: ROOM_LIMIT - 1 }, (_, i) => computerUid(i))]);
    expect(() => seatComputer(r, 'host', { computerPlayers: true, maxPlayers: 10 }, () => 'x', 5)).toThrow(/full/);
  });

  it('are taken out only by the host, and only computers can be', () => {
    const r = room(['host', 'guest', 'computer']);
    expect(unseatComputer(r, 'host', 'computer').map((p) => p.uid)).toEqual(['host', 'guest']);
    expect(() => unseatComputer(r, 'guest', 'computer')).toThrow(/host/);
    expect(() => unseatComputer(r, 'host', 'guest')).toThrow(/computer/);
  });
});

describe('acting for a computer', () => {
  const r = room(['host', 'guest', 'computer']);
  it('is open to anyone in the room, for a computer in the room', () => {
    expect(actingAs(r, 'host')).toBe('host');
    expect(actingAs(r, 'guest', 'computer')).toBe('computer');
  });
  it('is not a way to play as another person, or from outside', () => {
    expect(() => actingAs(r, 'host', 'guest')).toThrow();
    expect(() => actingAs(r, 'host', 'computer-2')).toThrow();
    expect(() => actingAs(r, 'stranger', 'computer')).toThrow(/not in this room/);
  });
});

describe('leaving a room with computers in it', () => {
  it('hands the room to the next person, never to a computer', () => {
    const r = { ownerUid: 'host', players: [{ uid: 'host', name: '', joinedAt: 0 }, { uid: 'computer', name: '', joinedAt: 1 }, { uid: 'guest', name: '', joinedAt: 2 }] };
    expect(afterLeaving(r, 'host')).toEqual({ players: r.players.slice(1), ownerUid: 'guest' });
  });
  it('closes the room when only computers would be left', () => {
    const r = { ownerUid: 'host', players: [{ uid: 'host', name: '', joinedAt: 0 }, { uid: 'computer', name: '', joinedAt: 1 }] };
    expect(afterLeaving(r, 'host')).toBeNull();
  });
});

describe('which device plays the computers', () => {
  it('is the host while the host is here', () => {
    expect(computerDriver(room(['host', 'guest', 'computer'], { host: NOW, guest: NOW }), NOW)).toBe('host');
  });
  it('passes to the longest-standing person here when the host has gone quiet', () => {
    const r = room(['host', 'guest', 'late', 'computer'], { host: NOW - PRESENCE_TIMEOUT_MS - 1, guest: NOW - PRESENCE_TIMEOUT_MS - 1, late: NOW });
    expect(computerDriver(r, NOW)).toBe('late');
  });
  it('stays with the host when nobody has checked in yet', () => {
    expect(computerDriver(room(['host', 'guest']), NOW)).toBe('host');
  });
});
