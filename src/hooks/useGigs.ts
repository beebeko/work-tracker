import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createGig,
  deleteGig,
  getGig,
  listActiveGigs,
  listGigs,
  updateGig,
} from '../services/gigs';
import { queryKeys } from '../services/queryKeys';
import { CreateGigInput, UpdateGigInput } from '../types/gig';

export function useGigs(clientId: string) {
  return useQuery({
    queryKey: queryKeys.gigs.all(clientId),
    queryFn: () => listGigs(clientId),
    enabled: Boolean(clientId),
  });
}

export function useActiveGigs(clientId: string) {
  return useQuery({
    queryKey: [...queryKeys.gigs.all(clientId), 'active'],
    queryFn: () => listActiveGigs(clientId),
    enabled: Boolean(clientId),
  });
}

export function useGig(clientId: string, gigId: string) {
  return useQuery({
    queryKey: queryKeys.gigs.detail(clientId, gigId),
    queryFn: () => getGig(clientId, gigId),
    enabled: Boolean(clientId) && Boolean(gigId),
  });
}

export function useCreateGig(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGigInput) => createGig(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gigs.all(clientId) });
    },
  });
}

export function useUpdateGig(clientId: string, gigId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateGigInput) => updateGig(clientId, gigId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gigs.all(clientId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.gigs.detail(clientId, gigId) });
    },
  });
}

export function useDeleteGig(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (gigId: string) => deleteGig(clientId, gigId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gigs.all(clientId) });
    },
  });
}
