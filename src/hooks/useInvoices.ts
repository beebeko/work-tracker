import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createInvoice,
    deleteInvoice,
    getInvoice,
    listInvoices,
    listInvoicesByClient,
    updateInvoice,
} from '../services/invoices';
import { queryKeys } from '../services/queryKeys';
import { CreateInvoiceInput, UpdateInvoiceInput } from '../types/invoice';

export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices.all,
    queryFn: listInvoices,
  });
}

export function useInvoicesByClient(clientId: string) {
  return useQuery({
    queryKey: queryKeys.invoices.byClient(clientId),
    queryFn: () => listInvoicesByClient(clientId),
    enabled: Boolean(clientId),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: () => getInvoice(id),
    enabled: Boolean(id),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceInput) => createInvoice(data),
    onSuccess: (_invoice) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useUpdateInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateInvoiceInput) => updateInvoice(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}
