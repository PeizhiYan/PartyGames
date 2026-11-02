/**
 * Security-rules tests, run against the Firestore emulator: `npm run test:rules`.
 *
 * These check who may read and write what — the half of security that firestore.rules owns. The
 * game rules themselves (whose turn it is, whether there is enough money) are checked by the unit
 * tests in src/domain, because they run in a transaction rather than in the rules.
 */
import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc, doc, getDoc, getDocs, collection, query, serverTimestamp, setDoc, updateDoc, where,
  orderBy, limit, type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHanoiLeaderboard } from '../src/adapters/firebase/hanoi';
import type { FirebaseContext } from '../src/adapters/firebase/app';
import { completedRun } from './helpers/hanoi';

const ROOT = 'apps/partygames';
const ADMIN = 'yanpeizhi2008@gmail.com';

let env: RulesTestEnvironment;

/** A signed-in, email-verified client, the way Google sign-in leaves one. */
function as(uid: string, email: string): Firestore {
  return env.authenticatedContext(uid, { email, email_verified: true }).firestore() as unknown as Firestore;
}

const roomDoc = (db: Firestore, id = 'room1') => doc(db, ROOT, 'rooms', id);

function newRoom(ownerUid: string, overrides: Record<string, unknown> = {}) {
  return {
    game: 'gomoku',
    name: 'Test room',
    code: 'AB12',
    ownerUid,
    players: [{ uid: ownerUid, name: 'Owner', joinedAt: 1 }],
    playerUids: [ownerUid],
    requests: [],
    state: { board: [], moves: [], turn: 1 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    presence: { [ownerUid]: serverTimestamp() },
    ...overrides,
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'partygames-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(() => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  // Sign-up open by default, so the tests that care can close it.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, ROOT, 'config', 'access'), { openSignup: true });
  });
});

async function closeSignup() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, ROOT, 'config', 'access'), { openSignup: false });
  });
}

async function seed(path: string[], data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, ROOT, ...path), data);
  });
}

describe('who gets in', () => {
  it('lets anyone read the sign-up switch, even signed out', async () => {
    const db = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertSucceeds(getDoc(doc(db, ROOT, 'config', 'access')));
  });

  it('only the admin flips it', async () => {
    await assertFails(setDoc(doc(as('u1', 'a@b.com'), ROOT, 'config', 'access'),
      { openSignup: false, updatedAt: serverTimestamp(), updatedBy: 'a@b.com' }));
    await assertSucceeds(setDoc(doc(as('admin', ADMIN), ROOT, 'config', 'access'),
      { openSignup: false, updatedAt: serverTimestamp(), updatedBy: ADMIN }));
  });

  it('shuts out a signed-out visitor entirely', async () => {
    const db = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(getDocs(query(collection(db, ROOT, 'rooms'), where('game', '==', 'gomoku'))));
    await assertFails(setDoc(roomDoc(db), newRoom('nobody')));
  });

  it('while sign-up is open, any verified Google account can open a room', async () => {
    await assertSucceeds(setDoc(roomDoc(as('u1', 'a@b.com')), newRoom('u1')));
  });

  it('once closed, only the allowlist and the admin can', async () => {
    await closeSignup();
    await assertFails(setDoc(roomDoc(as('u1', 'a@b.com')), newRoom('u1')));
    await seed(['allowlist', 'a@b.com'], { addedAt: serverTimestamp(), addedBy: ADMIN });
    await assertSucceeds(setDoc(roomDoc(as('u1', 'a@b.com')), newRoom('u1')));
    await assertSucceeds(setDoc(roomDoc(as('admin', ADMIN), 'room2'), newRoom('admin')));
  });

  it('keeps a removed account out even while sign-up is open', async () => {
    await seed(['members', 'u1'], { email: 'a@b.com', disabled: true });
    await assertFails(setDoc(roomDoc(as('u1', 'a@b.com')), newRoom('u1')));
  });

  it('does not trust an unverified email', async () => {
    const db = env.authenticatedContext('u1', { email: 'a@b.com', email_verified: false })
      .firestore() as unknown as Firestore;
    await assertFails(setDoc(roomDoc(db), newRoom('u1')));
  });
});

describe('the allowlist', () => {
  it('is managed by the admin alone', async () => {
    const mine = doc(as('u1', 'a@b.com'), ROOT, 'allowlist', 'a@b.com');
    await assertFails(setDoc(mine, { addedAt: serverTimestamp(), addedBy: 'a@b.com' }));
    await assertSucceeds(setDoc(doc(as('admin', ADMIN), ROOT, 'allowlist', 'a@b.com'),
      { addedAt: serverTimestamp(), addedBy: ADMIN }));
  });

  it('lets a user check their own entry but not read the list', async () => {
    await seed(['allowlist', 'a@b.com'], { addedAt: serverTimestamp(), addedBy: ADMIN });
    const db = as('u1', 'a@b.com');
    await assertSucceeds(getDoc(doc(db, ROOT, 'allowlist', 'a@b.com')));
    await assertFails(getDoc(doc(db, ROOT, 'allowlist', 'someone@else.com')));
    await assertFails(getDocs(collection(db, ROOT, 'allowlist')));
    await assertSucceeds(getDocs(collection(as('admin', ADMIN), ROOT, 'allowlist')));
  });
});

describe('member records', () => {
  const record = (email: string) => ({
    email, displayName: 'A', firstSeen: serverTimestamp(), lastSeen: serverTimestamp(),
    visits: 1, installed: false,
  });

  it('a user writes only their own, with their own email', async () => {
    const db = as('u1', 'a@b.com');
    await assertSucceeds(setDoc(doc(db, ROOT, 'members', 'u1'), record('a@b.com')));
    await assertFails(setDoc(doc(db, ROOT, 'members', 'u2'), record('a@b.com')));
    await assertFails(setDoc(doc(db, ROOT, 'members', 'u1'), record('someone@else.com')));
  });

  it('a user cannot disable themselves back to life, but the admin can disable them', async () => {
    await seed(['members', 'u1'], { email: 'a@b.com', firstSeen: new Date(), lastSeen: new Date(), disabled: true });
    await assertFails(updateDoc(doc(as('u1', 'a@b.com'), ROOT, 'members', 'u1'), { disabled: false }));
    await assertSucceeds(setDoc(doc(as('admin', ADMIN), ROOT, 'members', 'u1'),
      { disabled: true, disabledAt: serverTimestamp(), disabledBy: ADMIN }, { merge: true }));
  });

  it('only the admin lists everyone', async () => {
    await assertFails(getDocs(collection(as('u1', 'a@b.com'), ROOT, 'members')));
    await assertSucceeds(getDocs(collection(as('admin', ADMIN), ROOT, 'members')));
  });
});

describe('rooms', () => {
  it('refuses a room opened in someone else’s name, or pre-filled with players', async () => {
    const db = as('u1', 'a@b.com');
    await assertFails(setDoc(roomDoc(db), newRoom('u2')));
    await assertFails(setDoc(roomDoc(db), newRoom('u1', { playerUids: ['u1', 'u2'] })));
    await assertFails(setDoc(roomDoc(db), newRoom('u1', {
      requests: [{ uid: 'u2', name: 'B', at: 1 }],
    })));
  });

  it('refuses a game it has never heard of, and a nameless room', async () => {
    const db = as('u1', 'a@b.com');
    await assertFails(setDoc(roomDoc(db), newRoom('u1', { game: 'chess' })));
    await assertFails(setDoc(roomDoc(db), newRoom('u1', { name: '' })));
  });

  it('lets a player change the game state, and an outsider not', async () => {
    await seed(['rooms', 'room1'], newRoom('u1'));
    await assertSucceeds(updateDoc(roomDoc(as('u1', 'a@b.com')), {
      state: { board: [1], moves: [0], turn: 2 }, updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(roomDoc(as('u2', 'b@b.com')), {
      state: { board: [2], moves: [0], turn: 1 }, updatedAt: serverTimestamp(),
    }));
  });

  it('lets an outsider ask to join, but not walk in', async () => {
    await seed(['rooms', 'room1'], newRoom('u1'));
    const outsider = as('u2', 'b@b.com');
    await assertSucceeds(updateDoc(roomDoc(outsider), {
      requests: [{ uid: 'u2', name: 'B', at: 1 }], updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(roomDoc(outsider), {
      players: [{ uid: 'u1', name: 'Owner', joinedAt: 1 }, { uid: 'u2', name: 'B', joinedAt: 2 }],
      playerUids: ['u1', 'u2'],
      updatedAt: serverTimestamp(),
    }));
  });

  it('does not let an outsider check in, or touch the state while asking to join', async () => {
    await seed(['rooms', 'room1'], newRoom('u1'));
    const outsider = as('u2', 'b@b.com');
    await assertFails(updateDoc(roomDoc(outsider), { 'presence.u2': serverTimestamp() }));
    await assertFails(updateDoc(roomDoc(outsider), {
      requests: [{ uid: 'u2', name: 'B', at: 1 }],
      state: { board: [2], moves: [], turn: 1 },
      updatedAt: serverTimestamp(),
    }));
  });

  it('accepts a player’s heartbeat, which leaves updatedAt alone', async () => {
    await seed(['rooms', 'room1'], newRoom('u1'));
    await assertSucceeds(updateDoc(roomDoc(as('u1', 'a@b.com')), { 'presence.u1': serverTimestamp() }));
  });

  it('pins the game and the code for the life of the room', async () => {
    await seed(['rooms', 'room1'], newRoom('u1'));
    const db = as('u1', 'a@b.com');
    await assertFails(updateDoc(roomDoc(db), { game: 'monopoly', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(roomDoc(db), { code: 'ZZZZ', updatedAt: serverTimestamp() }));
  });

  it('is readable and deletable by anyone allowed, because cleanup runs in the client', async () => {
    await seed(['rooms', 'room1'], newRoom('u1'));
    const other = as('u2', 'b@b.com');
    await assertSucceeds(getDoc(roomDoc(other)));
    await assertSucceeds(getDocs(query(collection(other, ROOT, 'rooms'), where('game', '==', 'gomoku'))));
    await assertSucceeds(deleteDoc(roomDoc(other)));
  });

  it('is not readable once sign-up is closed and you are not on the list', async () => {
    await seed(['rooms', 'room1'], newRoom('u1'));
    await closeSignup();
    await assertFails(getDoc(roomDoc(as('u2', 'b@b.com'))));
  });
});

describe('Hanoi leaderboard', () => {
  const scoreDoc = (db: Firestore, uid = 'u1') => doc(db, ROOT, 'leaderboards', 'hanoi', 'scores', uid);
  const score = (overrides: Record<string, unknown> = {}) => ({
    uid: 'u1', displayName: 'Player One', durationMs: 180_000, moves: 129,
    achievedAt: serverTimestamp(), ...overrides,
  });

  it('allows a personal best and the ordered top-50 query', async () => {
    await assertSucceeds(setDoc(scoreDoc(as('u1', 'a@b.com')), score()));
    const scores = collection(as('u2', 'b@b.com'), ROOT, 'leaderboards', 'hanoi', 'scores');
    const result = await assertSucceeds(getDocs(query(scores, orderBy('durationMs'), orderBy('moves'), limit(50))));
    expect(result.docs).toHaveLength(1);
  });
  it('prevents writing another player’s score, uid spoofing and non-admin deletion', async () => {
    const db = as('u1', 'a@b.com');
    await assertFails(setDoc(scoreDoc(db, 'u2'), score({ uid: 'u2' })));
    await assertFails(setDoc(scoreDoc(db), score({ uid: 'u2' })));
    await assertSucceeds(setDoc(scoreDoc(db), score()));
    await assertFails(setDoc(scoreDoc(as('u2', 'b@b.com')), score({ durationMs: 1000 })));
    await assertFails(deleteDoc(scoreDoc(db)));
    await assertSucceeds(deleteDoc(scoreDoc(as('admin', ADMIN))));
  });
  it('only accepts a faster time, or fewer moves at the same time', async () => {
    const ref = scoreDoc(as('u1', 'a@b.com'));
    await assertSucceeds(setDoc(ref, score()));
    await assertFails(setDoc(ref, score({ durationMs: 190_000, moves: 127 })));
    await assertFails(setDoc(ref, score()));
    await assertSucceeds(setDoc(ref, score({ moves: 127 })));
    await assertSucceeds(setDoc(ref, score({ durationMs: 170_000, moves: 131 })));
  });
  it('rejects invalid scores, extra data and forged timestamps', async () => {
    const ref = scoreDoc(as('u1', 'a@b.com'));
    for (const patch of [
      { moves: 126 }, { moves: 127.5 }, { moves: 10001 }, { durationMs: 0 }, { durationMs: -1 },
      { durationMs: 1.5 }, { durationMs: 86400001 }, { displayName: '' }, { displayName: 'x'.repeat(101) },
      { email: 'should-not-be-public@example.com' }, { achievedAt: new Date(0) },
    ]) await assertFails(setDoc(ref, score(patch)));
  });
  it('blocks signed-out, disabled, unverified and uninvited accounts', async () => {
    const signedOut = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(getDoc(scoreDoc(signedOut)));
    await assertFails(setDoc(scoreDoc(signedOut), score()));
    const unverified = env.authenticatedContext('u1', { email: 'a@b.com', email_verified: false }).firestore() as unknown as Firestore;
    await assertFails(setDoc(scoreDoc(unverified), score()));
    await seed(['members', 'u1'], { email: 'a@b.com', disabled: true });
    await assertFails(getDoc(scoreDoc(as('u1', 'a@b.com'))));
    await assertFails(setDoc(scoreDoc(as('u1', 'a@b.com')), score()));
    await closeSignup();
    await assertFails(getDoc(scoreDoc(as('u2', 'b@b.com'))));
    await assertFails(setDoc(scoreDoc(as('u2', 'b@b.com'), 'u2'), score({ uid: 'u2' })));
    await seed(['allowlist', 'b@b.com'], { addedAt: serverTimestamp() });
    await assertSucceeds(setDoc(scoreDoc(as('u2', 'b@b.com'), 'u2'), score({ uid: 'u2' })));
  });
  it('the real adapter replays a solution and preserves the best of concurrent results', async () => {
    const db = as('u1', 'a@b.com');
    const repo = createHanoiLeaderboard({
      db, auth: { currentUser: { uid: 'u1', displayName: 'Player One' } },
    } as FirebaseContext);
    await expect(repo.submit({ durationMs: 1000, moves: [] })).rejects.toThrow(/finish/i);
    await Promise.all([repo.submit(completedRun(200_000)), repo.submit(completedRun(180_000, true))]);
    expect((await getDoc(scoreDoc(db))).data()).toMatchObject({ durationMs: 180_000, moves: 129 });
    expect(await repo.submit(completedRun(180_000))).toBe('saved');
    expect(await repo.submit(completedRun(190_000))).toBe('kept');
    expect(await repo.submit(completedRun(180_000))).toBe('kept');
    expect((await getDoc(scoreDoc(db))).data()).toMatchObject({ durationMs: 180_000, moves: 127 });
  });
  it('does not allow a solo-only Hanoi room', async () => {
    await assertFails(setDoc(roomDoc(as('u1', 'a@b.com')), newRoom('u1', { game: 'hanoi' })));
  });
});

describe('anything else in the database', () => {
  it('is denied', async () => {
    const db = as('admin', ADMIN);
    await assertFails(setDoc(doc(db, 'apps', 'partygames', 'secrets', 'x'), { a: 1 }));
    await assertFails(setDoc(doc(db, 'whatever', 'x'), { a: 1 }));
    expect(true).toBe(true);
  });
});
