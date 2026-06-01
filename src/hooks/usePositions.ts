import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPosition,
  deletePosition,
  getPosition,
  listPositions,
  updatePosition,
} from '../services/positions';
import { queryKeys } from '../services/queryKeys';
import { CreatePositionInput, UpdatePositionInput } from '../types/position';

export function usePositions(clientId: string) {
  return useQuery({
    queryKey: queryKeys.positions.all(clientId),
    queryFn: () => listPositions(clientId),
    enabled: Boolean(clientId),
  });
}

export function usePosition(clientId: string, positionId: string) {
  return useQuery({
    queryKey: queryKeys.positions.detail(clientId, positionId),
    queryFn: () => getPosition(clientId, positionId),
    enabled: Boolean(clientId) && Boolean(positionId),
  });
}

export function useCreatePosition(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePositionInput) => createPosition(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positions.all(clientId) });
    },
  });
}

export function useUpdatePosition(clientId: string, positionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdatePositionInput) => updatePosition(clientId, positionId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positions.all(clientId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.positions.detail(clientId, positionId),
      });
    },
  });
}

export function useDeletePosition(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (positionId: string) => deletePosition(clientId, positionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positions.all(clientId) });
    },
  });
}
