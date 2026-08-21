import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IBranch, IGroup, ITeacher } from '@smartcity/types';
import { apiClient } from './api';

export interface GroupWithRelations extends IGroup {
  teacher?: ITeacher | null;
  branch?: IBranch;
}

interface GroupListResponse {
  data: GroupWithRelations[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateGroupInput {
  name: string;
  branchId: string;
  level?: string;
  subject?: string;
  room?: string;
  teacherId?: string;
}

export type UpdateGroupInput = Partial<CreateGroupInput>;

export function useGroups(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['groups', page, limit],
    queryFn: () => apiClient<GroupListResponse>(`/groups?page=${page}&limit=${limit}`),
  });
}

export function useGroup(id: string | undefined) {
  return useQuery({
    queryKey: ['groups', id],
    queryFn: () => apiClient<GroupWithRelations>(`/groups/${id}`),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGroupInput) =>
      apiClient<GroupWithRelations>('/groups', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useUpdateGroup(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateGroupInput) =>
      apiClient<GroupWithRelations>(`/groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/groups/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}
