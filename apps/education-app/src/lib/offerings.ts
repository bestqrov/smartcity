import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IOffering, ITeacher, InscriptionType } from '@smartcity/types';
import { apiClient } from './api';

export interface OfferingWithTeacher extends IOffering {
  teacher: ITeacher | null;
}

interface OfferingListResponse {
  data: OfferingWithTeacher[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateOfferingInput {
  type: InscriptionType;
  name: string;
  description?: string;
  duration?: string;
  price: number;
  teacherId?: string;
}

export type UpdateOfferingInput = Partial<CreateOfferingInput> & { isActive?: boolean };

export function useOfferings(page = 1, limit = 20, type?: InscriptionType) {
  return useQuery({
    queryKey: ['offerings', page, limit, type],
    queryFn: () =>
      apiClient<OfferingListResponse>(
        `/offerings?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`,
      ),
  });
}

export function useCreateOffering() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOfferingInput) =>
      apiClient<OfferingWithTeacher>('/offerings', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
    },
  });
}

export function useUpdateOffering(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOfferingInput) =>
      apiClient<OfferingWithTeacher>(`/offerings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
    },
  });
}
