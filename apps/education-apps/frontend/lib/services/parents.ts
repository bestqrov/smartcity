import api from '../api';
import type { Parent, ApiResponse } from '@/types';

export async function getParents(): Promise<Parent[]> {
    const response = await api.get<ApiResponse<Parent[]>>('/parents');
    return response.data.data;
}

export async function getParentById(id: string): Promise<Parent> {
    const response = await api.get<ApiResponse<Parent>>(`/parents/${id}`);
    return response.data.data;
}

export async function createParent(data: {
    name: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    cin?: string;
    address?: string;
}): Promise<{ parent: Parent; rawToken: string }> {
    const response = await api.post<ApiResponse<{ parent: Parent; rawToken: string }>>('/parents', data);
    return response.data.data;
}

export async function regenerateParentToken(id: string): Promise<{ parent: Parent; rawToken: string }> {
    const response = await api.post<ApiResponse<{ parent: Parent; rawToken: string }>>(`/parents/${id}/regenerate-token`);
    return response.data.data;
}

export async function getPublicParentProfile(token: string): Promise<Parent> {
    const response = await api.get<ApiResponse<Parent>>(`/parents/profile/${token}`);
    return response.data.data;
}
