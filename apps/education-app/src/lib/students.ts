import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IStudent } from '@smartcity/types';
import { apiClient } from './api';

interface StudentListResponse {
  data: IStudent[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateStudentInput {
  branchId: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}

export function useStudents(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['students', page, limit],
    queryFn: () =>
      apiClient<StudentListResponse>(`/api/students?page=${page}&limit=${limit}`),
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStudentInput) =>
      apiClient<IStudent>('/api/students', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
