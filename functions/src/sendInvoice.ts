import { FieldValue } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { Resend } from 'resend';
import { db, storage } from './lib/admin';

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

interface SendInvoiceInput {
  invoiceId: string;
  fromAddress: string;
  toAddress: string;
}

export const sendInvoice = onCall<SendInvoiceInput>(
  { secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const { invoiceId, fromAddress, toAddress } = request.data;
    if (!invoiceId || !fromAddress || !toAddress) {
      throw new HttpsError(
        'invalid-argument',
        'invoiceId, fromAddress, and toAddress are required.',
      );
    }

    // ── Fetch invoice ──────────────────────────────────────────────────────
    const invoiceSnap = await db.collection('invoices').doc(invoiceId).get();
    if (!invoiceSnap.exists) {
      throw new HttpsError('not-found', 'Invoice not found.');
    }
    const invoice = invoiceSnap.data()!;

    if (invoice.ownerUid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Access denied.');
    }

    if (!invoice.pdfStoragePath) {
      throw new HttpsError('failed-precondition', 'Invoice has no PDF. Generate it first.');
    }

    // ── Download PDF from Storage ──────────────────────────────────────────
    const bucket = storage.bucket();
    const file = bucket.file(invoice.pdfStoragePath as string);
    const [pdfBuffer] = await file.download();

    // ── Send email via Resend ──────────────────────────────────────────────
    const resend = new Resend(RESEND_API_KEY.value());
    const invoiceNumber = invoice.invoiceNumber as string;

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
      throw new HttpsError('internal', `Failed to send email: ${error.message}`);
    }

    // ── Update invoice status ──────────────────────────────────────────────
    await db
      .collection('invoices')
      .doc(invoiceId)
      .update({
        status: 'sent',
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return { success: true };
  },
);
