import api from '../api';
import type { ApiResponse, Attendance, AttendanceMarkData, AttendanceSessionData, WeeklyAttendance } from '@/types';

export async function getAttendanceByStudent(studentId: string): Promise<Attendance[]> {
    const response = await api.get<ApiResponse<Attendance[]>>(`/attendance/student/${studentId}`);
    return response.data.data;
}

export async function scanAttendance(studentToken: string, groupId: string): Promise<Attendance> {
    const response = await api.post<ApiResponse<Attendance>>('/attendance/scan', { studentToken, groupId });
    return response.data.data;
}

/** The weekly grid of one group. `weekOf` is any day of the wanted week (YYYY-MM-DD). */
export async function getWeeklyAttendance(groupId: string, weekOf: string): Promise<WeeklyAttendance> {
    const response = await api.get<ApiResponse<WeeklyAttendance>>('/attendance/week', { params: { groupId, weekOf } });
    return response.data.data;
}

/** Sets or corrects one student's status for one session. */
export async function markAttendance(data: AttendanceMarkData): Promise<Attendance> {
    const response = await api.put<ApiResponse<Attendance>>('/attendance/mark', data);
    return response.data.data;
}

/** Takes the roll of one session: only the students whose status changed need to be sent. */
export async function markSessionAttendance(data: AttendanceSessionData): Promise<Attendance[]> {
    const response = await api.put<ApiResponse<Attendance[]>>('/attendance/session', data);
    return response.data.data;
}
