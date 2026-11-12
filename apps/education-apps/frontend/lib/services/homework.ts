import axios from 'axios';
import api from '../api';
import type { ApiResponse } from '@/types';

export interface Homework {
    id: string;
    branchId: string;
    groupId: string;
    subject: string | null;
    title: string;
    details: string | null;
    dueDate: string;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface HomeworkInput {
    groupId: string;
    title: string;
    subject?: string | null;
    details?: string | null;
    dueDate: string;
}

/** One interface for staff (authenticated) and teacher (token link) homework calls. */
export interface HomeworkClient {
    list(groupId: string): Promise<Homework[]>;
    create(data: HomeworkInput): Promise<Homework>;
    update(id: string, data: Partial<HomeworkInput>): Promise<Homework>;
    remove(id: string): Promise<void>;
}

export const staffHomeworkClient: HomeworkClient = {
    list: async (groupId) => (await api.get<ApiResponse<Homework[]>>('/homework', { params: { groupId } })).data.data,
    create: async (data) => (await api.post<ApiResponse<Homework>>('/homework', data)).data.data,
    update: async (id, data) => (await api.put<ApiResponse<Homework>>(`/homework/${id}`, data)).data.data,
    remove: async (id) => {
        await api.delete(`/homework/${id}`);
    },
};

const publicApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000' });
const tp = (token: string) => `/teacher-portal/${encodeURIComponent(token)}`;

export function teacherHomeworkClient(token: string): HomeworkClient {
    return {
        // The teacher page already holds the list from the portal payload (strict read rate limit).
        list: async () => [],
        create: async (data) => (await publicApi.post<ApiResponse<Homework>>(`${tp(token)}/homework`, data)).data.data,
        update: async (id, data) => (await publicApi.put<ApiResponse<Homework>>(`${tp(token)}/homework/${id}`, data)).data.data,
        remove: async (id) => {
            await publicApi.delete(`${tp(token)}/homework/${id}`);
        },
    };
}
