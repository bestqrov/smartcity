import api from '../api';
import type { Attendance, AttendanceFormData, ApiResponse } from '@/types';

export async function getAttendanceByStudent(studentId: string): Promise<Attendance[]> {
    const response = await api.get<ApiResponse<Attendance[]>>(`/attendance/student/${studentId}`);
    return response.data.data;
}

export async function createAttendance(data: AttendanceFormData): Promise<Attendance> {
    const response = await api.post<ApiResponse<Attendance>>('/attendance', data);
    return response.data.data;
}
