import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IGroupStudent, IStudent } from '@smartcity/types';
import { apiClient } from './api';

export interface GroupStudentWithStudent extends IGroupStudent {
  student: IStudent;
}

export interface CreateGroupStudentInput {
  groupId: string;
  studentId: string;
}

export function useGroupStudents(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-students', groupId],
    queryFn: () =>
      apiClient<GroupStudentWithStudent[]>(`/group-students?groupId=${groupId}`),
    enabled: !!groupId,
  });
}

export function useCreateGroupStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGroupStudentInput) =>
      apiClient<IGroupStudent>('/group-students', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['group-students', variables.groupId],
      });
    },
  });
}

export function useRemoveGroupStudent(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/group-students/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-students', groupId] });
    },
  });
}
