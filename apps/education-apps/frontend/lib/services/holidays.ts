import api from '../api';
import type { Holiday, ApiResponse } from '@/types';

export const holidaysService = {
    getAll: async (): Promise<Holiday[]> => {
        const response = await api.get<ApiResponse<Holiday[]>>('/holidays');
        return response.data.data;
    },

    create: async (data: { title: string; startDate: string; endDate: string }): Promise<Holiday> => {
        const response = await api.post<ApiResponse<Holiday>>('/holidays', data);
        return response.data.data;
    },

    update: async (id: string, data: Partial<{ title: string; startDate: string; endDate: string; active: boolean }>): Promise<Holiday> => {
        const response = await api.put<ApiResponse<Holiday>>(`/holidays/${id}`, data);
        return response.data.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/holidays/${id}`);
    },
};
