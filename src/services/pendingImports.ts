import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    CreatePendingImportInput,
    PendingImport,
    UpdatePendingImportInput,
} from '../types/pendingImport';
import { requireAuth } from './_requireAuth';

const COLLECTION = 'pendingImports';

function toPendingImport(id: string, data: Record<string, unknown>): PendingImport {
  return {
    id,
    ownerUid: data.ownerUid as string,
    clientId: data.clientId as string,
    rawEmail: data.rawEmail as string,
    extracted: data.extracted as PendingImport['extracted'],
    status: data.status as PendingImport['status'],
    createdAt: data.createdAt as PendingImport['createdAt'],
  };
}

export async function listPendingImports(): Promise<PendingImport[]> {
  const uid = requireAuth();
  const q = query(
    collection(db, COLLECTION),
    where('ownerUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toPendingImport(d.id, d.data()));
}

export async function createPendingImport(input: CreatePendingImportInput): Promise<string> {
  const uid = requireAuth();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    ownerUid: uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePendingImport(
  id: string,
  patch: UpdatePendingImportInput,
): Promise<void> {
  requireAuth();
  await updateDoc(doc(db, COLLECTION, id), patch);
}
