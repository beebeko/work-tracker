import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { functions, storage } from '../lib/firebase';
import { queryKeys } from '../services/queryKeys';

// ── Input / result types for Cloud Function calls ───────────────────────────

export interface GenerateInvoiceInput {
  clientId: string;
  gigId: string;
  entryIds: string[];
  /** Existing invoice ID when regenerating; omit for new invoices */
  invoiceId?: string;
  /** ISO date string (YYYY-MM-DD) */
  dueDate?: string;
  notes?: string;
}

export interface GenerateInvoiceResult {
  invoiceId: string;
}

export interface SendInvoiceInput {
  invoiceId: string;
  fromAddress: string;
  toAddress: string;
}

export interface SendInvoiceResult {
  success: boolean;
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useGenerateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: GenerateInvoiceInput): Promise<GenerateInvoiceResult> => {
      const fn = httpsCallable<GenerateInvoiceInput, GenerateInvoiceResult>(
        functions,
        'generateInvoice',
      );
      const result = await fn(data);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.byGig(variables.gigId) });
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SendInvoiceInput): Promise<SendInvoiceResult> => {
      const fn = httpsCallable<SendInvoiceInput, SendInvoiceResult>(functions, 'sendInvoice');
      const result = await fn(data);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

// ── Query — PDF download URL ─────────────────────────────────────────────────

export function useInvoicePdfUrl(pdfStoragePath: string | undefined) {
  return useQuery({
    queryKey: ['invoicePdf', pdfStoragePath],
    queryFn: () => getDownloadURL(ref(storage, pdfStoragePath!)),
    enabled: Boolean(pdfStoragePath),
    staleTime: 1000 * 60 * 55, // Firebase Storage signed URLs expire after 1h; refresh at 55m
  });
}
