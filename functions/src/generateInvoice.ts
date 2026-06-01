import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, storage } from './lib/admin';
import { buildPdf, PdfInvoiceData } from './lib/pdf';
import { buildInvoiceLineItems, Position, WorkEntry } from './pay/buildInvoiceLineItems';
import { OvertimeRules } from './pay/calculatePay';

interface GenerateInvoiceInput {
  clientId: string;
  gigId: string;
  entryIds: string[];
  /** Provide when regenerating an existing invoice */
  invoiceId?: string;
  dueDate?: string;
  notes?: string;
}

export const generateInvoice = onCall<GenerateInvoiceInput>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  const uid = request.auth.uid;
  const { clientId, gigId, entryIds, invoiceId, dueDate, notes } = request.data;

  if (!clientId || !gigId || !Array.isArray(entryIds)) {
    throw new HttpsError('invalid-argument', 'clientId, gigId, and entryIds are required.');
  }

  // ── Fetch Firestore documents ────────────────────────────────────────────
  const [clientSnap, gigSnap, profileSnap] = await Promise.all([
    db.collection('clients').doc(clientId).get(),
    db.collection('gigs').doc(gigId).get(),
    db.collection('userProfiles').doc(uid).get(),
  ]);

  if (!clientSnap.exists) throw new HttpsError('not-found', 'Client not found.');
  if (!gigSnap.exists) throw new HttpsError('not-found', 'Gig not found.');

  const client = clientSnap.data()!;
  const gig = gigSnap.data()!;
  const profile = profileSnap.exists ? profileSnap.data()! : null;

  // Ownership checks
  if (client.ownerUid !== uid) throw new HttpsError('permission-denied', 'Access denied.');
  if (gig.ownerUid !== uid) throw new HttpsError('permission-denied', 'Access denied.');

  // Fetch entries
  const entrySnaps = await Promise.all(
    entryIds.map((id) => db.collection('workEntries').doc(id).get()),
  );
  const entries = entrySnaps
    .filter((s) => s.exists)
    .map((s) => ({ id: s.id, ...s.data()! } as WorkEntry));

  // Verify all entries belong to this gig and owner
  const unauthorized = entries.find(
    (e) => (e as any).gigId !== gigId || (e as any).ownerUid !== uid,
  );
  if (unauthorized) throw new HttpsError('permission-denied', 'Access denied.');

  // Fetch positions referenced by the entries
  const positionIds = [
    ...new Set(
      entries
        .filter((e) => e.type === 'shift')
        .map((e) => (e as WorkEntry & { positionId?: string }).positionId)
        .filter(Boolean) as string[],
    ),
  ];

  const positionSnaps = await Promise.all(
    positionIds.map((id) => db.collection('positions').doc(id).get()),
  );
  const positionsById: Record<string, Position> = {};
  for (const snap of positionSnaps) {
    if (snap.exists) {
      positionsById[snap.id] = { id: snap.id, ...(snap.data() as Omit<Position, 'id'>) };
    }
  }

  // ── Build line items ──────────────────────────────────────────────────────
  const rules: OvertimeRules = client.overtimeRules ?? {
    weeklyThresholdHours: 40,
    weeklyOvertimeMultiplier: 1.5,
    weekStartDay: 1,
    mealPenaltyEnabled: false,
    mealPenaltyWindowHours: 6,
    mealPenaltyRateHours: 0.5,
  };

  const lineItems = buildInvoiceLineItems(entries, positionsById, rules);
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = subtotal;

  // ── Determine invoice number ──────────────────────────────────────────────
  let invoiceNumber: string;
  let isRegeneration = false;

  if (invoiceId) {
    // Regeneration — keep same number, verify ownership
    const existingSnap = await db.collection('invoices').doc(invoiceId).get();
    if (!existingSnap.exists) throw new HttpsError('not-found', 'Invoice not found.');
    const existingInvoice = existingSnap.data()!;
    if (existingInvoice.ownerUid !== uid) throw new HttpsError('permission-denied', 'Access denied.');
    invoiceNumber = existingInvoice.invoiceNumber as string;
    isRegeneration = true;
  } else {
    const seq = (client.nextInvoiceSeq as number) ?? 1;
    const prefix = (client.invoicePrefix as string) ?? 'INV-';
    invoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const pdfData: PdfInvoiceData = {
    invoiceNumber,
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate,
    notes,
    senderName: (profile?.name as string) ?? uid,
    senderEmail: profile?.email as string | undefined,
    senderAddress: profile?.address as string | undefined,
    senderPhone: profile?.phone as string | undefined,
    clientName: client.name as string,
    clientEmail: client.email as string | undefined,
    clientAddress: client.address as string | undefined,
    gigName: gig.name as string,
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };

  const pdfBytes = await buildPdf(pdfData);

  // ── Upload PDF to Storage ─────────────────────────────────────────────────
  const pdfStoragePath = `invoices/${uid}/${invoiceNumber}.pdf`;
  const bucket = storage.bucket();
  const file = bucket.file(pdfStoragePath);
  await file.save(Buffer.from(pdfBytes), {
    contentType: 'application/pdf',
    metadata: { contentDisposition: `inline; filename="${invoiceNumber}.pdf"` },
  });

  // ── Write Firestore ───────────────────────────────────────────────────────
  let finalInvoiceId: string;

  if (isRegeneration) {
    // Archive current state to history, then update (re-use already-fetched snap)
    const existingSnap = await db.collection('invoices').doc(invoiceId!).get();
    const existing = existingSnap.data()!;
    const snapshot = {
      lineItems: existing.lineItems,
      subtotal: existing.subtotal,
      totalAmount: existing.totalAmount,
      entryIds: existing.entryIds ?? [],
      pdfStoragePath: existing.pdfStoragePath,
      supersededAt: FieldValue.serverTimestamp(),
    };

    await db
      .collection('invoices')
      .doc(invoiceId!)
      .update({
        lineItems,
        entryIds,
        subtotal: pdfData.subtotal,
        totalAmount: pdfData.totalAmount,
        pdfStoragePath,
        dueDate: dueDate ?? existing.dueDate ?? null,
        notes: notes ?? existing.notes ?? null,
        status: 'draft',
        history: FieldValue.arrayUnion(snapshot),
        updatedAt: FieldValue.serverTimestamp(),
      });

    finalInvoiceId = invoiceId!;
  } else {
    // New invoice — use a transaction to prevent duplicate invoice numbers
    finalInvoiceId = await db.runTransaction(async (tx) => {
      // Re-read client inside transaction to get a fresh, locked seq
      const freshClientSnap = await tx.get(db.collection('clients').doc(clientId));
      if (!freshClientSnap.exists) throw new HttpsError('not-found', 'Client not found.');
      const freshClient = freshClientSnap.data()!;
      if (freshClient.ownerUid !== uid) throw new HttpsError('permission-denied', 'Access denied.');

      const seq = (freshClient.nextInvoiceSeq as number) ?? 1;
      const prefix = (freshClient.invoicePrefix as string) ?? 'INV-';
      const txInvoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`;

      const newRef = db.collection('invoices').doc();
      tx.set(newRef, {
        clientId,
        gigId,
        ownerUid: uid,
        invoiceNumber: txInvoiceNumber,
        status: 'draft',
        lineItems,
        entryIds,
        subtotal: pdfData.subtotal,
        totalAmount: pdfData.totalAmount,
        pdfStoragePath,
        dueDate: dueDate ?? null,
        notes: notes ?? null,
        senderEmailAccountId: null,
        history: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.update(db.collection('clients').doc(clientId), {
        nextInvoiceSeq: FieldValue.increment(1),
      });

      return newRef.id;
    });
  }

  return { invoiceId: finalInvoiceId };
});
