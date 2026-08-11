import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IBranch } from '@smartcity/types';
import { apiClient } from './api';

interface BranchListResponse {
  data: IBranch[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateBranchInput {
  name: string;
  address: string;
  city: string;
}

export function useBranches(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['branches', page, limit],
    queryFn: () =>
      apiClient<BranchListResponse>(`/api/branches?page=${page}&limit=${limit}`),
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBranchInput) =>
      apiClient<IBranch>('/api/branches', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}
