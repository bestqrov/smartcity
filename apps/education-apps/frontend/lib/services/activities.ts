import api from '../api';
import type { ApiResponse } from '@/types';

export type ActivityAudience = 'ALL' | 'GROUPS';

export interface Activity {
    id: string;
    branchId: string;
    title: string;
    description: string | null;
    startAt: string;
    endAt: string | null;
    location: string | null;
    price: number | null;
    needsConsent: boolean;
    deadline: string | null;
    audience: ActivityAudience;
    groupIds: string[];
    coverImage: string | null;
    published: boolean;
    notifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ActivityCounts {
    targeted: number;
    yes: number;
    no: number;
    noAnswer: number;
    paid: number;
}

export type ActivityWithCounts = Activity & { counts: ActivityCounts };

export interface ActivityInput {
    title: string;
    description?: string | null;
    startAt: string;
    endAt?: string | null;
    location?: string | null;
    price?: number | null;
    needsConsent?: boolean;
    deadline?: string | null;
    audience?: ActivityAudience;
    groupIds?: string[];
    coverImage?: string | null;
}

export interface ActivityResponseRow {
    studentId: string;
    name: string;
    surname: string;
    parentName: string | null;
    parentPhone: string | null;
    answer: 'YES' | 'NO' | null;
    paid: boolean;
    note: string | null;
    answeredAt: string | null;
}

export const activitiesService = {
    list: async () => (await api.get<ApiResponse<ActivityWithCounts[]>>('/activities')).data.data,
    create: async (data: ActivityInput) => (await api.post<ApiResponse<Activity>>('/activities', data)).data.data,
    update: async (id: string, data: Partial<ActivityInput>) => (await api.put<ApiResponse<Activity>>(`/activities/${id}`, data)).data.data,
    remove: async (id: string) => {
        await api.delete(`/activities/${id}`);
    },
    setPublished: async (id: string, published: boolean) =>
        (await api.post<ApiResponse<Activity>>(`/activities/${id}/publish`, { published })).data.data,
    responses: async (id: string) => (await api.get<ApiResponse<ActivityResponseRow[]>>(`/activities/${id}/responses`)).data.data,
    setPaid: async (id: string, studentId: string, paid: boolean) =>
        (await api.put<ApiResponse<unknown>>(`/activities/${id}/responses/${studentId}`, { paid })).data.data,
    remind: async (id: string) => (await api.post<ApiResponse<{ parents: number }>>(`/activities/${id}/remind`)).data.data,
};

export const MAX_COVER_BYTES = 1.4 * 1024 * 1024;

/** Resizes an image file to max 1280px and re-encodes it as JPEG (~0.8). Rejects if still too big. */
export function resizeCover(file: File, maxSide = 1280, quality = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas indisponible'));
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const data = canvas.toDataURL('image/jpeg', quality);
            if (data.length > MAX_COVER_BYTES) return reject(new Error('Image trop lourde, choisissez-en une plus petite.'));
            resolve(data);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image illisible'));
        };
        img.src = url;
    });
}
