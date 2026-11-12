import api from '../api';
import type { Parent, ApiResponse, ParentNotification } from '@/types';

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

export interface ParentAccessRow {
    id: string;
    name: string;
    phone: string;
    whatsapp: string | null;
    linkIssuedAt: string | null;
    lastVisitAt: string | null;
    children: { id: string; name: string; surname: string }[];
}

export async function getParentsAccess(): Promise<ParentAccessRow[]> {
    const response = await api.get<ApiResponse<ParentAccessRow[]>>('/parents/access');
    return response.data.data;
}

export async function issueParentLinks(parentIds: string[]): Promise<{ id: string; rawToken: string }[]> {
    const response = await api.post<ApiResponse<{ id: string; rawToken: string }[]>>('/parents/links', { parentIds });
    return response.data.data;
}

export async function answerParentActivity(
    token: string,
    body: { activityId: string; studentId: string; answer: 'YES' | 'NO'; note?: string },
): Promise<{ activityId: string; studentId: string; answer: 'YES' | 'NO'; paid: boolean; note: string | null }> {
    const response = await api.post<ApiResponse<{ activityId: string; studentId: string; answer: 'YES' | 'NO'; paid: boolean; note: string | null }>>(
        `/parents/activity-response/${token}`,
        body,
    );
    return response.data.data;
}

export async function getParentNotifications(
    token: string,
    params: { before?: string; limit?: number } = {},
): Promise<{ items: ParentNotification[]; unread: number; nextBefore: string | null }> {
    const response = await api.get<ApiResponse<{ items: ParentNotification[]; unread: number; nextBefore: string | null }>>(
        `/parents/notifications/${token}`,
        { params },
    );
    return response.data.data;
}

export async function markParentNotificationsRead(token: string, ids?: string[]): Promise<{ unread: number }> {
    const response = await api.post<ApiResponse<{ unread: number }>>(`/parents/notifications/${token}/read`, ids ? { ids } : {});
    return response.data.data;
}
