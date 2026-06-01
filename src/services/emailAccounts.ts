import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
    CreateEmailAccountInput,
    EmailAccount,
    UpdateEmailAccountInput,
} from '../types/emailAccount';

const COLLECTION = 'emailAccounts';

function requireAuth(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

function toEmailAccount(id: string, data: Record<string, unknown>): EmailAccount {
  return {
    id,
    ownerUid: data.ownerUid as string,
    displayName: data.displayName as string,
    fromAddress: data.fromAddress as string,
    isDefault: data.isDefault as boolean,
    createdAt: data.createdAt as EmailAccount['createdAt'],
    updatedAt: data.updatedAt as EmailAccount['updatedAt'],
  };
}

export async function listEmailAccounts(): Promise<EmailAccount[]> {
  const uid = requireAuth();
  const q = query(collection(db, COLLECTION), where('ownerUid', '==', uid), orderBy('displayName'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toEmailAccount(d.id, d.data()));
}

export async function createEmailAccount(data: CreateEmailAccountInput): Promise<EmailAccount> {
  const uid = requireAuth();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    ownerUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(doc(db, COLLECTION, ref.id));
  return toEmailAccount(snap.id, snap.data()!);
}

export async function updateEmailAccount(
  id: string,
  patch: UpdateEmailAccountInput,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteEmailAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
