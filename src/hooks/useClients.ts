import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createClient,
    deleteClient,
    getClient,
    listClients,
    updateClient,
} from '../services/clients';
import { queryKeys } from '../services/queryKeys';
import { CreateClientInput, UpdateClientInput } from '../types/client';

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients.all,
    queryFn: listClients,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: () => getClient(id),
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientInput) => createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateClientInput) => updateClient(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(id) });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}
