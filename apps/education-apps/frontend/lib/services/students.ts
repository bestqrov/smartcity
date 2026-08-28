import api from '../api';
import type { Student, StudentFormData, ApiResponse } from '@/types';

export async function getStudents(): Promise<Student[]> {
    const response = await api.get<ApiResponse<Student[]>>('/students');
    return response.data.data;
}

export async function getStudentById(id: string): Promise<Student> {
    const response = await api.get<ApiResponse<Student>>(`/students/${id}`);
    return response.data.data;
}

export async function createStudent(data: StudentFormData): Promise<Student> {
    const response = await api.post<ApiResponse<Student>>('/students', data);
    return response.data.data;
}

export async function updateStudent(id: string, data: Partial<StudentFormData>): Promise<Student> {
    const response = await api.put<ApiResponse<Student>>(`/students/${id}`, data);
    return response.data.data;
}

export async function deleteStudent(id: string): Promise<void> {
    await api.delete(`/students/${id}`);
}

export async function searchStudents(query: string): Promise<Student[]> {
    const response = await api.get<ApiResponse<Student[]>>(`/students?search=${encodeURIComponent(query)}`);
    return response.data.data;
}

export async function getStudentAnalytics() {
    const response = await api.get<ApiResponse<{
        totalStudents: number;
        totalInscriptions: number;
        totalRevenue: number;
        recentInscriptions: any[];
    }>>('/students/analytics');
    return response.data.data;
}
