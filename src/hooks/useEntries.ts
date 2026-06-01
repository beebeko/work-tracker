import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createEntry,
    deleteEntry,
    getEntry,
    listEntries,
    listEntriesByPosition,
    updateEntry,
} from '../services/entries';
import { queryKeys } from '../services/queryKeys';
import { CreateWorkEntryInput, UpdateWorkEntryInput } from '../types/workEntry';

export function useEntries(clientId: string, gigId: string) {
  return useQuery({
    queryKey: queryKeys.entries.all(clientId, gigId),
    queryFn: () => listEntries(clientId, gigId),
    enabled: Boolean(clientId) && Boolean(gigId),
  });
}

export function useEntriesByPosition(clientId: string, gigId: string, positionId: string) {
  return useQuery({
    queryKey: [...queryKeys.entries.all(clientId, gigId), 'position', positionId],
    queryFn: () => listEntriesByPosition(clientId, gigId, positionId),
    enabled: Boolean(clientId) && Boolean(gigId) && Boolean(positionId),
  });
}

export function useEntry(clientId: string, gigId: string, entryId: string) {
  return useQuery({
    queryKey: queryKeys.entries.detail(clientId, gigId, entryId),
    queryFn: () => getEntry(clientId, gigId, entryId),
    enabled: Boolean(clientId) && Boolean(gigId) && Boolean(entryId),
  });
}

export function useCreateEntry(clientId: string, gigId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkEntryInput) => createEntry(clientId, gigId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries.all(clientId, gigId) });
    },
  });
}

export function useUpdateEntry(clientId: string, gigId: string, entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateWorkEntryInput) => updateEntry(clientId, gigId, entryId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries.all(clientId, gigId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.entries.detail(clientId, gigId, entryId),
      });
    },
  });
}

export function useDeleteEntry(clientId: string, gigId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => deleteEntry(clientId, gigId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries.all(clientId, gigId) });
    },
  });
}
