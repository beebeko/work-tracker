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
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Client, CreateClientInput, UpdateClientInput } from '../types/client';

const COLLECTION = 'clients';

function requireAuth(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

function toClient(id: string, data: Record<string, unknown>): Client {
  return {
    id,
    ownerUid: data.ownerUid as string,
    name: data.name as string,
    email: data.email as string,
    address: data.address as string | undefined,
    notes: data.notes as string | undefined,
    overtimeRules: data.overtimeRules as Client['overtimeRules'],
    createdAt: data.createdAt as Client['createdAt'],
    updatedAt: data.updatedAt as Client['updatedAt'],
  };
}

export async function listClients(): Promise<Client[]> {
  const uid = requireAuth();
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toClient(d.id, d.data()))
    .filter((c) => c.ownerUid === uid);
}

export async function getClient(id: string): Promise<Client> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) throw new Error(`Client ${id} not found`);
  return toClient(snap.id, snap.data());
}

export async function createClient(data: CreateClientInput): Promise<Client> {
  const uid = requireAuth();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    ownerUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getClient(ref.id);
}

export async function updateClient(id: string, patch: UpdateClientInput): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClient(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
