"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvoice = void 0;
const firestore_1 = require("firebase-admin/firestore");
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const resend_1 = require("resend");
const admin_1 = require("./lib/admin");
const RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
exports.sendInvoice = (0, https_1.onCall)({ secrets: [RESEND_API_KEY] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const { invoiceId, fromAddress, toAddress } = request.data;
    if (!invoiceId || !fromAddress || !toAddress) {
        throw new https_1.HttpsError('invalid-argument', 'invoiceId, fromAddress, and toAddress are required.');
    }
    // ── Fetch invoice ──────────────────────────────────────────────────────
    const invoiceSnap = await admin_1.db.collection('invoices').doc(invoiceId).get();
    if (!invoiceSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Invoice not found.');
    }
    const invoice = invoiceSnap.data();
    if (invoice.ownerUid !== request.auth.uid) {
        throw new https_1.HttpsError('permission-denied', 'Access denied.');
    }
    if (!invoice.pdfStoragePath) {
        throw new https_1.HttpsError('failed-precondition', 'Invoice has no PDF. Generate it first.');
    }
    // ── Download PDF from Storage ──────────────────────────────────────────
    const bucket = admin_1.storage.bucket();
    const file = bucket.file(invoice.pdfStoragePath);
    const [pdfBuffer] = await file.download();
    // ── Send email via Resend ──────────────────────────────────────────────
    const resend = new resend_1.Resend(RESEND_API_KEY.value());
    const invoiceNumber = invoice.invoiceNumber;
    const { error } = await resend.emails.send({
        from: fromAddress,
        to: toAddress,
        subject: `Invoice ${invoiceNumber}`,
        html: `<p>Please find attached invoice <strong>${invoiceNumber}</strong>.</p>`,
        attachments: [
            {
                filename: `${invoiceNumber}.pdf`,
                content: pdfBuffer,
            },
        ],
    });
    if (error) {
        console.error('Resend error:', error);
        throw new https_1.HttpsError('internal', `Failed to send email: ${error.message}`);
    }
    // ── Update invoice status ──────────────────────────────────────────────
    await admin_1.db
        .collection('invoices')
        .doc(invoiceId)
        .update({
        status: 'sent',
        sentAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
