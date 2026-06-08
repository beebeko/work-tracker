"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoice = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("./lib/admin");
const pdf_1 = require("./lib/pdf");
const buildInvoiceLineItems_1 = require("./pay/buildInvoiceLineItems");
exports.generateInvoice = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const uid = request.auth.uid;
    const { clientId, gigId, entryIds, invoiceId, dueDate, notes } = request.data;
    if (!clientId || !gigId || !Array.isArray(entryIds)) {
        throw new https_1.HttpsError('invalid-argument', 'clientId, gigId, and entryIds are required.');
    }
    // ── Fetch Firestore documents ────────────────────────────────────────────
    const [clientSnap, gigSnap, profileSnap] = await Promise.all([
        admin_1.db.collection('clients').doc(clientId).get(),
        admin_1.db.collection('gigs').doc(gigId).get(),
        admin_1.db.collection('userProfiles').doc(uid).get(),
    ]);
    if (!clientSnap.exists)
        throw new https_1.HttpsError('not-found', 'Client not found.');
    if (!gigSnap.exists)
        throw new https_1.HttpsError('not-found', 'Gig not found.');
    const client = clientSnap.data();
    const gig = gigSnap.data();
    const profile = profileSnap.exists ? profileSnap.data() : null;
    // Ownership checks
    if (client.ownerUid !== uid)
        throw new https_1.HttpsError('permission-denied', 'Access denied.');
    if (gig.ownerUid !== uid)
        throw new https_1.HttpsError('permission-denied', 'Access denied.');
    // Fetch entries
    const entrySnaps = await Promise.all(entryIds.map((id) => admin_1.db.collection('workEntries').doc(id).get()));
    const entries = entrySnaps
        .filter((s) => s.exists)
        .map((s) => ({ id: s.id, ...s.data() }));
    // Verify all entries belong to this gig and owner
    const unauthorized = entries.find((e) => e.gigId !== gigId || e.ownerUid !== uid);
    if (unauthorized)
        throw new https_1.HttpsError('permission-denied', 'Access denied.');
    // Fetch positions referenced by the entries
    const positionIds = [
        ...new Set(entries
            .filter((e) => e.type === 'shift')
            .map((e) => e.positionId)
            .filter(Boolean)),
    ];
    const positionSnaps = await Promise.all(positionIds.map((id) => admin_1.db.collection('positions').doc(id).get()));
    const positionsById = {};
    for (const snap of positionSnaps) {
        if (snap.exists) {
            positionsById[snap.id] = { id: snap.id, ...snap.data() };
        }
    }
    // ── Build line items ──────────────────────────────────────────────────────
    const rules = client.overtimeRules ?? {
        weeklyThresholdHours: 40,
        weeklyOvertimeMultiplier: 1.5,
        weekStartDay: 1,
        mealPenaltyEnabled: false,
        mealPenaltyWindowHours: 6,
        mealPenaltyRateHours: 0.5,
    };
    const lineItems = (0, buildInvoiceLineItems_1.buildInvoiceLineItems)(entries, positionsById, rules);
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const totalAmount = subtotal;
    // ── Determine invoice number ──────────────────────────────────────────────
    let invoiceNumber;
    let isRegeneration = false;
    if (invoiceId) {
        // Regeneration — keep same number, verify ownership
        const existingSnap = await admin_1.db.collection('invoices').doc(invoiceId).get();
        if (!existingSnap.exists)
            throw new https_1.HttpsError('not-found', 'Invoice not found.');
        const existingInvoice = existingSnap.data();
        if (existingInvoice.ownerUid !== uid)
            throw new https_1.HttpsError('permission-denied', 'Access denied.');
        invoiceNumber = existingInvoice.invoiceNumber;
        isRegeneration = true;
    }
    else {
        const seq = client.nextInvoiceSeq ?? 1;
        const prefix = client.invoicePrefix ?? 'INV-';
        invoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`;
    }
    // ── Build PDF ─────────────────────────────────────────────────────────────
    const pdfData = {
        invoiceNumber,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate,
        notes,
        senderName: profile?.name ?? uid,
        senderEmail: profile?.email,
        senderAddress: profile?.address,
        senderPhone: profile?.phone,
        clientName: client.name,
        clientEmail: client.email,
        clientAddress: client.address,
        gigName: gig.name,
        lineItems,
        subtotal: Math.round(subtotal * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
    };
    const pdfBytes = await (0, pdf_1.buildPdf)(pdfData);
    // ── Upload PDF to Storage ─────────────────────────────────────────────────
    const pdfStoragePath = `invoices/${uid}/${invoiceNumber}.pdf`;
    const bucket = admin_1.storage.bucket();
    const file = bucket.file(pdfStoragePath);
    await file.save(Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        metadata: { contentDisposition: `inline; filename="${invoiceNumber}.pdf"` },
    });
    // ── Write Firestore ───────────────────────────────────────────────────────
    let finalInvoiceId;
    if (isRegeneration) {
        // Archive current state to history, then update. Re-fetch to ensure we have
        // the latest state (may have changed since line 101).
        const existingSnap = await admin_1.db.collection('invoices').doc(invoiceId).get();
        const existing = existingSnap.data();
        const snapshot = {
            lineItems: existing.lineItems,
            subtotal: existing.subtotal,
            totalAmount: existing.totalAmount,
            entryIds: existing.entryIds ?? [],
            pdfStoragePath: existing.pdfStoragePath,
            supersededAt: firestore_1.FieldValue.serverTimestamp(),
        };
        await admin_1.db
            .collection('invoices')
            .doc(invoiceId)
            .update({
            lineItems,
            entryIds,
            subtotal: pdfData.subtotal,
            totalAmount: pdfData.totalAmount,
            pdfStoragePath,
            dueDate: dueDate ?? existing.dueDate ?? null,
            notes: notes ?? existing.notes ?? null,
            status: 'draft',
            history: firestore_1.FieldValue.arrayUnion(snapshot),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        finalInvoiceId = invoiceId;
    }
    else {
        // New invoice — use a transaction to prevent duplicate invoice numbers
        finalInvoiceId = await admin_1.db.runTransaction(async (tx) => {
            // Re-read client inside transaction to get a fresh, locked seq
            const freshClientSnap = await tx.get(admin_1.db.collection('clients').doc(clientId));
            if (!freshClientSnap.exists)
                throw new https_1.HttpsError('not-found', 'Client not found.');
            const freshClient = freshClientSnap.data();
            if (freshClient.ownerUid !== uid)
                throw new https_1.HttpsError('permission-denied', 'Access denied.');
            const seq = freshClient.nextInvoiceSeq ?? 1;
            const prefix = freshClient.invoicePrefix ?? 'INV-';
            const txInvoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`;
            const newRef = admin_1.db.collection('invoices').doc();
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
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            tx.update(admin_1.db.collection('clients').doc(clientId), {
                nextInvoiceSeq: firestore_1.FieldValue.increment(1),
            });
            return newRef.id;
        });
    }
    return { invoiceId: finalInvoiceId };
});
