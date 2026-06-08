import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPendingImports, updatePendingImport } from '../services/pendingImports';
import { queryKeys } from '../services/queryKeys';
import { PendingImportStatus } from '../types/pendingImport';

export function usePendingImports() {
  return useQuery({
    queryKey: queryKeys.pendingImports.all,
    queryFn: listPendingImports,
  });
}

/** Count of imports with status "pending" — used for the tab badge. */
export function usePendingImportCount(): number {
  const { data } = usePendingImports();
  return data?.filter((i) => i.status === 'pending').length ?? 0;
}

export function useUpdatePendingImport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: PendingImportStatus) => updatePendingImport(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingImports.all });
    },
  });
}
