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
import { CreateInvoiceInput, Invoice, InvoiceStatus, UpdateInvoiceInput } from '../types/invoice';

const COLLECTION = 'invoices';

function requireAuth(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

function toInvoice(id: string, data: Record<string, unknown>): Invoice {
  return {
    id,
    clientId: data.clientId as string,
    gigId: data.gigId as string,
    ownerUid: data.ownerUid as string,
    invoiceNumber: data.invoiceNumber as string,
    status: data.status as InvoiceStatus,
    lineItems: data.lineItems as Invoice['lineItems'],
    subtotal: data.subtotal as number,
    totalAmount: data.totalAmount as number,
    dueDate: data.dueDate as string | undefined,
    notes: data.notes as string | undefined,
    pdfStoragePath: data.pdfStoragePath as string | undefined,
    sentAt: data.sentAt as Invoice['sentAt'],
    createdAt: data.createdAt as Invoice['createdAt'],
    updatedAt: data.updatedAt as Invoice['updatedAt'],
  };
}

export async function listInvoices(): Promise<Invoice[]> {
  const uid = requireAuth();
  const q = query(
    collection(db, COLLECTION),
    where('ownerUid', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toInvoice(d.id, d.data()));
}

export async function listInvoicesByClient(clientId: string): Promise<Invoice[]> {
  const uid = requireAuth();
  const q = query(
    collection(db, COLLECTION),
    where('ownerUid', '==', uid),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toInvoice(d.id, d.data()));
}

export async function getInvoice(id: string): Promise<Invoice> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) throw new Error(`Invoice ${id} not found`);
  return toInvoice(snap.id, snap.data());
}

export async function createInvoice(data: CreateInvoiceInput): Promise<Invoice> {
  const uid = requireAuth();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    ownerUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getInvoice(ref.id);
}

export async function updateInvoice(id: string, patch: UpdateInvoiceInput): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
