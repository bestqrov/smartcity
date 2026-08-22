import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttendanceStatus, IAttendance, IGroup } from '@smartcity/types';
import { apiClient } from './api';

export interface AttendanceWithGroup extends IAttendance {
  group: IGroup;
}

export interface MarkAttendanceEntryInput {
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface BulkMarkAttendanceInput {
  groupId: string;
  date: string;
  entries: MarkAttendanceEntryInput[];
}

export interface GroupAttendanceStats {
  totalRecords: number;
  presentCount: number;
  attendanceRate: number;
}

export function useGroupAttendance(groupId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'group', groupId, date],
    queryFn: () =>
      apiClient<IAttendance[]>(`/attendance?groupId=${groupId}&date=${date}`),
    enabled: !!groupId && !!date,
  });
}

export function useStudentAttendance(studentId: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'student', studentId],
    queryFn: () =>
      apiClient<AttendanceWithGroup[]>(`/attendance?studentId=${studentId}`),
    enabled: !!studentId,
  });
}

export function useGroupAttendanceStats(groupId: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'stats', groupId],
    queryFn: () => apiClient<GroupAttendanceStats>(`/attendance/stats/${groupId}`),
    enabled: !!groupId,
  });
}

export function useBulkMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkMarkAttendanceInput) =>
      apiClient<IAttendance[]>('/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['attendance', 'group', variables.groupId, variables.date],
      });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'student'] });
    },
  });
}
