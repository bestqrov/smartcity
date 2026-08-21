import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IGuardian, IStudent } from '@smartcity/types';
import { apiClient } from './api';

interface GuardianListResponse {
  data: IGuardian[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateGuardianInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export type UpdateGuardianInput = Partial<CreateGuardianInput>;

interface GuardianRelationshipSummary {
  id: string;
  relationshipType: string;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  canPickUp: boolean;
  canCommunicate: boolean;
  financiallyResponsible: boolean;
}

export interface GuardianStudentLink {
  relationship: GuardianRelationshipSummary;
  student: IStudent;
}

export function useGuardians(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['guardians', page, limit],
    queryFn: () =>
      apiClient<GuardianListResponse>(`/guardians?page=${page}&limit=${limit}`),
  });
}

export function useGuardianStudents(guardianId: string | undefined) {
  return useQuery({
    queryKey: ['guardians', guardianId, 'students'],
    queryFn: () =>
      apiClient<GuardianStudentLink[]>(`/guardians/${guardianId}/students`),
    enabled: !!guardianId,
  });
}

export function useCreateGuardian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGuardianInput) =>
      apiClient<IGuardian>('/guardians', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
    },
  });
}

export function useUpdateGuardian(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateGuardianInput) =>
      apiClient<IGuardian>(`/guardians/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
    },
  });
}

export function useDeleteGuardian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/guardians/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
    },
  });
}
