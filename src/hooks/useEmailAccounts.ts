import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createEmailAccount,
    deleteEmailAccount,
    listEmailAccounts,
    updateEmailAccount,
} from '../services/emailAccounts';
import { queryKeys } from '../services/queryKeys';
import { CreateEmailAccountInput, UpdateEmailAccountInput } from '../types/emailAccount';

export function useEmailAccounts() {
  return useQuery({
    queryKey: queryKeys.emailAccounts.all,
    queryFn: listEmailAccounts,
  });
}

export function useCreateEmailAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmailAccountInput) => createEmailAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailAccounts.all });
    },
  });
}

export function useUpdateEmailAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateEmailAccountInput) => updateEmailAccount(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailAccounts.all });
    },
  });
}

export function useDeleteEmailAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmailAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailAccounts.all });
    },
  });
}
