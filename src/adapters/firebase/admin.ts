import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, where,
  writeBatch, type DocumentData,
} from 'firebase/firestore';
import type { Member } from '../../domain/types';
import type { AccountRepo, AdminRepo } from '../../services/types';
import { NotSignedInError } from '../../services/errors';
import { ROOT, type FirebaseContext } from './app';
import { wrap } from './errors';

export function createAdminRepo({ auth, db }: FirebaseContext): AdminRepo {
  const allowlist = collection(db, ROOT, 'allowlist');
  const members = collection(db, ROOT, 'members');

  return {
    listMembers: () => wrap(async () => {
      const snap = await getDocs(members);
      return snap.docs
        .map((d): Member => {
          const data = d.data();
          return {
            uid: d.id,
            email: data.email ?? '',
            displayName: data.displayName ?? '',
            photoURL: data.photoURL,
            firstSeen: (data.firstSeen as Timestamp | null)?.toDate() ?? new Date(),
            lastSeen: (data.lastSeen as Timestamp | null)?.toDate() ?? new Date(),
            visits: data.visits,
            installed: data.installed,
            disabled: data.disabled === true,
          };
        })
        .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
    }),

    listAllowed: () => wrap(async () => {
      const snap = await getDocs(allowlist);
      return snap.docs.map((d) => d.id).sort((a, b) => a.localeCompare(b));
    }),

    allow: (email) => wrap(() => setDoc(doc(allowlist, email.trim().toLowerCase()), {
      addedAt: serverTimestamp(),
      addedBy: auth.currentUser?.email ?? '',
    })),

    revoke: (email) => wrap(() => deleteDoc(doc(allowlist, email.trim().toLowerCase()))),

    /**
     * Takes someone's account out of this app. Their rooms go, their allowlist entry goes, and
     * their member record is kept but marked `disabled` — that flag is what stops them signing
     * back in while sign-up is open, and it is also the record that says they were removed.
     * Deleting the Google identity itself is a Firebase Auth operation that needs admin
     * credentials; see the README for the one command that does it.
     */
    removeAccount: (uid, email) => wrap(async () => {
      const batch = writeBatch(db);
      if (email) batch.delete(doc(allowlist, email.trim().toLowerCase()));
      batch.set(doc(members, uid), {
        disabled: true,
        disabledAt: serverTimestamp(),
        disabledBy: auth.currentUser?.email ?? '',
      }, { merge: true });
      await batch.commit();
      // Their rooms would otherwise sit in the list until the presence sweep catches them.
      const theirs = await getDocs(query(collection(db, ROOT, 'rooms'), where('ownerUid', '==', uid)));
      await Promise.all(theirs.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    }),

    setSignupOpen: (open) => wrap(() => setDoc(doc(db, ROOT, 'config', 'access'), {
      openSignup: open,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.email ?? '',
    })),
  };
}

export function createAccountRepo({ auth, db }: FirebaseContext): AccountRepo {
  return {
    recordVisit: (info) => wrap(async () => {
      const user = auth.currentUser;
      if (!user?.email) throw new NotSignedInError();
      const ref = doc(db, ROOT, 'members', user.uid);
      const previous = (await getDoc(ref).catch(() => null))?.data();
      const record: DocumentData = {
        email: user.email.toLowerCase(),
        displayName: user.displayName ?? '',
        firstSeen: previous?.firstSeen ?? serverTimestamp(),
        lastSeen: serverTimestamp(),
        visits: (previous?.visits ?? 0) + 1,
        installed: info.installed,
      };
      if (user.photoURL) record.photoURL = user.photoURL;
      await setDoc(ref, record, { merge: true });
    }),
  };
}
