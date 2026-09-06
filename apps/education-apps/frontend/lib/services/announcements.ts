import api from '../api';
import type { Announcement, ApiResponse } from '@/types';

export const announcementsService = {
    getAll: async (): Promise<Announcement[]> => {
        const response = await api.get<ApiResponse<Announcement[]>>('/announcements');
        return response.data.data;
    },

    create: async (data: { title: string; body: string }): Promise<Announcement> => {
        const response = await api.post<ApiResponse<Announcement>>('/announcements', data);
        return response.data.data;
    },

    update: async (id: string, data: Partial<{ title: string; body: string; active: boolean }>): Promise<Announcement> => {
        const response = await api.put<ApiResponse<Announcement>>(`/announcements/${id}`, data);
        return response.data.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/announcements/${id}`);
    },
};
