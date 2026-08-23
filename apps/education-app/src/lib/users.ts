import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IUser } from '@smartcity/types';
import { apiClient } from './api';

interface UserListResponse {
  data: IUser[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type ManagedRole = 'MANAGER' | 'STAFF' | 'ACCOUNTANT';

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: ManagedRole;
}

export function useUsers(page = 1, limit = 20, role?: ManagedRole) {
  return useQuery({
    queryKey: ['users', page, limit, role],
    queryFn: () =>
      apiClient<UserListResponse>(
        `/users?page=${page}&limit=${limit}${role ? `&role=${role}` : ''}`,
      ),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      apiClient<IUser>('/users', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/users/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
