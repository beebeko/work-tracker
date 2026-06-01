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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClientSender, CreateClientSenderInput } from '../types/clientSender';
import { requireAuth } from './_requireAuth';

function sendersColl(clientId: string) {
  return collection(db, 'clients', clientId, 'senders');
}

function toClientSender(id: string, data: Record<string, unknown>): ClientSender {
  return {
    id,
    ownerUid: data.ownerUid as string,
    clientId: data.clientId as string,
    pattern: data.pattern as string,
    patternType: data.patternType as ClientSender['patternType'],
    createdAt: data.createdAt as ClientSender['createdAt'],
  };
}

export async function listClientSenders(clientId: string): Promise<ClientSender[]> {
  requireAuth();
  const q = query(sendersColl(clientId), orderBy('pattern'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toClientSender(d.id, d.data()));
}

export async function createClientSender(input: CreateClientSenderInput): Promise<ClientSender> {
  const uid = requireAuth();
  const ref = await addDoc(sendersColl(input.clientId), {
    ...input,
    ownerUid: uid,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(doc(sendersColl(input.clientId), ref.id));
  return toClientSender(snap.id, snap.data()!);
}

export async function deleteClientSender(clientId: string, id: string): Promise<void> {
  requireAuth();
  await deleteDoc(doc(sendersColl(clientId), id));
}
