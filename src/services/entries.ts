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
import { db } from '../lib/firebase';
import {
  CreateWorkEntryInput,
  LumpSumEntry,
  ShiftEntry,
  UpdateWorkEntryInput,
  WorkEntry,
} from '../types/workEntry';

function collectionPath(clientId: string, gigId: string) {
  return collection(db, 'clients', clientId, 'gigs', gigId, 'entries');
}

function docPath(clientId: string, gigId: string, entryId: string) {
  return doc(db, 'clients', clientId, 'gigs', gigId, 'entries', entryId);
}

function toEntry(
  clientId: string,
  gigId: string,
  id: string,
  data: Record<string, unknown>,
): WorkEntry {
  const base = {
    id,
    gigId,
    clientId,
    positionId: data.positionId as string,
    ownerUid: data.ownerUid as string,
    date: data.date as string,
    tags: (data.tags as string[]) ?? [],
    notes: data.notes as string | undefined,
    createdAt: data.createdAt as WorkEntry['createdAt'],
    updatedAt: data.updatedAt as WorkEntry['updatedAt'],
  };

  if (data.type === 'lump_sum') {
    return {
      ...base,
      type: 'lump_sum',
      amount: data.amount as number,
      description: data.description as string | undefined,
    } as LumpSumEntry;
  }

  return {
    ...base,
    type: 'shift',
    startTime: data.startTime as string,
    endTime: data.endTime as string,
    mealBreaks: (data.mealBreaks as ShiftEntry['mealBreaks']) ?? [],
  } as ShiftEntry;
}

export async function listEntries(clientId: string, gigId: string): Promise<WorkEntry[]> {
  const q = query(collectionPath(clientId, gigId), orderBy('date'), orderBy('startTime'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toEntry(clientId, gigId, d.id, d.data()));
}

export async function listEntriesByPosition(
  clientId: string,
  gigId: string,
  positionId: string,
): Promise<WorkEntry[]> {
  const q = query(
    collectionPath(clientId, gigId),
    where('positionId', '==', positionId),
    orderBy('date'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toEntry(clientId, gigId, d.id, d.data()));
}

export async function getEntry(
  clientId: string,
  gigId: string,
  entryId: string,
): Promise<WorkEntry> {
  const snap = await getDoc(docPath(clientId, gigId, entryId));
  if (!snap.exists()) throw new Error(`Entry ${entryId} not found`);
  return toEntry(clientId, gigId, snap.id, snap.data());
}

export async function createEntry(
  clientId: string,
  gigId: string,
  data: CreateWorkEntryInput,
): Promise<WorkEntry> {
  const ref = await addDoc(collectionPath(clientId, gigId), {
    ...data,
    clientId,
    gigId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getEntry(clientId, gigId, ref.id);
}

export async function updateEntry(
  clientId: string,
  gigId: string,
  entryId: string,
  patch: UpdateWorkEntryInput,
): Promise<void> {
  await updateDoc(docPath(clientId, gigId, entryId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEntry(
  clientId: string,
  gigId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(docPath(clientId, gigId, entryId));
}
