import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { getUserProfile, upsertUserProfile } from '../services/userProfile';
import { UpdateUserProfileInput } from '../types/userProfile';

export function useUserProfile() {
  return useQuery({
    queryKey: queryKeys.userProfile.detail(),
    queryFn: getUserProfile,
  });
}

export function useUpsertUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateUserProfileInput) => upsertUserProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.detail() });
    },
  });
}
