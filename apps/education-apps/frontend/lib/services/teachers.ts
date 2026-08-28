
import api from '../api';
import type { Teacher, ApiResponse } from '@/types';


export const teachersService = {
    getAll: async (): Promise<Teacher[]> => {
        const response = await api.get<ApiResponse<Teacher[]>>('/teachers');
        return response.data.data;
    },
    create: async (data: Partial<Teacher>): Promise<Teacher> => {
        const response = await api.post<ApiResponse<Teacher>>('/teachers', data);
        return response.data.data;
    },
    update: async (id: string, data: Partial<Teacher>): Promise<Teacher> => {
        const response = await api.put<ApiResponse<Teacher>>(`/teachers/${id}`, data);
        return response.data.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`/teachers/${id}`);
    }
};

export const getTeachers = teachersService.getAll;
export const createTeacher = teachersService.create;
export const updateTeacher = teachersService.update;
export const deleteTeacher = teachersService.delete;
