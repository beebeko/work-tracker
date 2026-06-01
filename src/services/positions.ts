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
import { db } from '../lib/firebase';
import { CreatePositionInput, Position, UpdatePositionInput } from '../types/position';

function collectionPath(clientId: string) {
  return collection(db, 'clients', clientId, 'positions');
}

function docPath(clientId: string, positionId: string) {
  return doc(db, 'clients', clientId, 'positions', positionId);
}

function toPosition(clientId: string, id: string, data: Record<string, unknown>): Position {
  return {
    id,
    clientId,
    ownerUid: data.ownerUid as string,
    name: data.name as string,
    baseRate: data.baseRate as number,
    overtimeRulesOverride: data.overtimeRulesOverride as Position['overtimeRulesOverride'],
    createdAt: data.createdAt as Position['createdAt'],
    updatedAt: data.updatedAt as Position['updatedAt'],
  };
}

export async function listPositions(clientId: string): Promise<Position[]> {
  const q = query(collectionPath(clientId), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toPosition(clientId, d.id, d.data()));
}

export async function getPosition(clientId: string, positionId: string): Promise<Position> {
  const snap = await getDoc(docPath(clientId, positionId));
  if (!snap.exists()) throw new Error(`Position ${positionId} not found`);
  return toPosition(clientId, snap.id, snap.data());
}

export async function createPosition(
  clientId: string,
  data: CreatePositionInput,
): Promise<Position> {
  const ref = await addDoc(collectionPath(clientId), {
    ...data,
    clientId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getPosition(clientId, ref.id);
}

export async function updatePosition(
  clientId: string,
  positionId: string,
  patch: UpdatePositionInput,
): Promise<void> {
  await updateDoc(docPath(clientId, positionId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePosition(clientId: string, positionId: string): Promise<void> {
  await deleteDoc(docPath(clientId, positionId));
}
