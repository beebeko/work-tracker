import { Timestamp } from 'firebase/firestore';

export interface InvoiceLineItem {
  description: string;
  hours?: number;
  rate?: number;
  amount: number;
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
  subtotal: number;
  totalAmount: number;
  /** ISO date string (YYYY-MM-DD) */
  dueDate?: string;
  notes?: string;
  /** Firebase Storage path to the generated PDF */
  pdfStoragePath?: string;
  sentAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateInvoiceInput = Omit<Invoice, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;
export type UpdateInvoiceInput = Partial<CreateInvoiceInput>;
