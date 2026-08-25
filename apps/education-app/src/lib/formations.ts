import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IFormation, IInscription, IStudent } from '@smartcity/types';
import { apiClient } from './api';

interface FormationListResponse {
  data: IFormation[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateFormationInput {
  name: string;
  duration: string;
  price: number;
  description?: string;
}

export type UpdateFormationInput = Partial<CreateFormationInput>;

export interface FormationAnalytics {
  totalFormations: number;
  totalInscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  recentInscriptions: (IInscription & { student: IStudent })[];
}

export function useFormations(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['formations', page, limit],
    queryFn: () =>
      apiClient<FormationListResponse>(`/formations?page=${page}&limit=${limit}`),
  });
}

export function useCreateFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFormationInput) =>
      apiClient<IFormation>('/formations', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
    },
  });
}

export function useUpdateFormation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateFormationInput) =>
      apiClient<IFormation>(`/formations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
    },
  });
}

export function useDeleteFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/formations/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
    },
  });
}

export function useFormationAnalytics() {
  return useQuery({
    queryKey: ['formations', 'analytics'],
    queryFn: () => apiClient<FormationAnalytics>('/formations/analytics'),
  });
}
