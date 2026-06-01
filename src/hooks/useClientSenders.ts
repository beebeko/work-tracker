import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createClientSender,
    deleteClientSender,
    listClientSenders,
} from '../services/clientSenders';
import { queryKeys } from '../services/queryKeys';
import { CreateClientSenderInput } from '../types/clientSender';

export function useClientSenders(clientId: string) {
  return useQuery({
    queryKey: queryKeys.clientSenders.all(clientId),
    queryFn: () => listClientSenders(clientId),
    enabled: Boolean(clientId),
  });
}

export function useCreateClientSender(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientSenderInput) => createClientSender(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientSenders.all(clientId) });
    },
  });
}

export function useDeleteClientSender(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClientSender(clientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientSenders.all(clientId) });
    },
  });
}
