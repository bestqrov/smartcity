import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ITeacher, PaymentType } from '@smartcity/types';
import { apiClient } from './api';

interface TeacherListResponse {
  data: ITeacher[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateTeacherInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  specialties?: string[];
  levels?: string[];
  hourlyRate?: number;
  paymentType?: PaymentType;
}

export type UpdateTeacherInput = Partial<CreateTeacherInput>;

export function useTeachers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['teachers', page, limit],
    queryFn: () =>
      apiClient<TeacherListResponse>(`/teachers?page=${page}&limit=${limit}`),
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTeacherInput) =>
      apiClient<ITeacher>('/teachers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useUpdateTeacher(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTeacherInput) =>
      apiClient<ITeacher>(`/teachers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/teachers/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}
