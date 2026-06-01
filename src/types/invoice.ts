import { Timestamp } from 'firebase/firestore';

export interface InvoiceLineItem {
  description: string;
  hours?: number;
  rate?: number;
  amount: number;
}

/** A point-in-time snapshot of an invoice before it was regenerated */
export interface InvoiceSnapshot {
  lineItems: InvoiceLineItem[];
  subtotal: number;
  totalAmount: number;
  entryIds: string[];
  pdfStoragePath?: string;
  /** Server timestamp when this version was superseded */
  supersededAt: Timestamp;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface Invoice {
  id: string;
  clientId: string;
  gigId: string;
  ownerUid: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  /** Entry IDs included in this invoice */
  entryIds: string[];
  /** Email account ID used to send this invoice */
  senderEmailAccountId?: string;
  subtotal: number;
  totalAmount: number;
  /** ISO date string (YYYY-MM-DD) */
  dueDate?: string;
  notes?: string;
  /** Firebase Storage path to the generated PDF */
  pdfStoragePath?: string;
  sentAt?: Timestamp;
  /** Previous versions, oldest first */
  history: InvoiceSnapshot[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateInvoiceInput = Omit<Invoice, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;
export type UpdateInvoiceInput = Partial<CreateInvoiceInput>;
