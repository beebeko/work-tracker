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
import { CreateGigInput, Gig, GigStatus, UpdateGigInput } from '../types/gig';

function collectionPath(clientId: string) {
  return collection(db, 'clients', clientId, 'gigs');
}

function docPath(clientId: string, gigId: string) {
  return doc(db, 'clients', clientId, 'gigs', gigId);
}

function toGig(clientId: string, id: string, data: Record<string, unknown>): Gig {
  return {
    id,
    clientId,
    ownerUid: data.ownerUid as string,
    name: data.name as string,
    status: data.status as GigStatus,
    startDate: data.startDate as string | undefined,
    endDate: data.endDate as string | undefined,
    tags: (data.tags as string[]) ?? [],
    notes: data.notes as string | undefined,
    createdAt: data.createdAt as Gig['createdAt'],
    updatedAt: data.updatedAt as Gig['updatedAt'],
  };
}

export async function listGigs(clientId: string): Promise<Gig[]> {
  const q = query(collectionPath(clientId), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toGig(clientId, d.id, d.data()));
}

export async function listActiveGigs(clientId: string): Promise<Gig[]> {
  const q = query(collectionPath(clientId), where('status', '==', 'active'), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toGig(clientId, d.id, d.data()));
}

export async function getGig(clientId: string, gigId: string): Promise<Gig> {
  const snap = await getDoc(docPath(clientId, gigId));
  if (!snap.exists()) throw new Error(`Gig ${gigId} not found`);
  return toGig(clientId, snap.id, snap.data());
}

export async function createGig(clientId: string, data: CreateGigInput): Promise<Gig> {
  const ref = await addDoc(collectionPath(clientId), {
    ...data,
    clientId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getGig(clientId, ref.id);
}

export async function updateGig(
  clientId: string,
  gigId: string,
  patch: UpdateGigInput,
): Promise<void> {
  await updateDoc(docPath(clientId, gigId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGig(clientId: string, gigId: string): Promise<void> {
  await deleteDoc(docPath(clientId, gigId));
}
