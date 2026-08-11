import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GuardianRelationshipType, IGuardian, IStudentGuardian } from '@smartcity/types';
import { apiClient } from './api';

export interface StudentGuardianWithGuardian extends IStudentGuardian {
  guardian: IGuardian;
}

export interface CreateStudentGuardianInput {
  studentId: string;
  guardianId: string;
  relationshipType: GuardianRelationshipType;
  isPrimary?: boolean;
  isEmergencyContact?: boolean;
  canPickUp?: boolean;
  canCommunicate?: boolean;
  financiallyResponsible?: boolean;
}

export type UpdateStudentGuardianInput = Partial<
  Omit<CreateStudentGuardianInput, 'studentId' | 'guardianId'>
>;

export function useStudentGuardians(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student-guardians', studentId],
    queryFn: () =>
      apiClient<StudentGuardianWithGuardian[]>(
        `/api/student-guardians?studentId=${studentId}`,
      ),
    enabled: !!studentId,
  });
}

export function useCreateStudentGuardian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStudentGuardianInput) =>
      apiClient<IStudentGuardian>('/api/student-guardians', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['student-guardians', variables.studentId],
      });
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
    },
  });
}

export function useUpdateStudentGuardian(studentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStudentGuardianInput }) =>
      apiClient<IStudentGuardian>(`/api/student-guardians/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-guardians', studentId] });
    },
  });
}

export function useRemoveStudentGuardian(studentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/api/student-guardians/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-guardians', studentId] });
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
    },
  });
}
