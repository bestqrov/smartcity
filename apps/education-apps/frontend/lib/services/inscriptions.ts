import api from '../api';
import type { Inscription, InscriptionFormData, ApiResponse } from '@/types';

export async function getInscriptions(): Promise<Inscription[]> {
    const response = await api.get<ApiResponse<Inscription[]>>('/inscriptions');
    return response.data.data;
}

export async function getInscriptionById(id: string): Promise<Inscription> {
    const response = await api.get<ApiResponse<Inscription>>(`/inscriptions/${id}`);
    return response.data.data;
}

export async function createInscription(data: InscriptionFormData): Promise<Inscription> {
    const response = await api.post<ApiResponse<Inscription>>('/inscriptions', data);
    return response.data.data;
}

export async function updateInscription(id: string, data: Partial<InscriptionFormData>): Promise<Inscription> {
    const response = await api.put<ApiResponse<Inscription>>(`/inscriptions/${id}`, data);
    return response.data.data;
}

export async function deleteInscription(id: string): Promise<void> {
    await api.delete(`/inscriptions/${id}`);
}

export interface InscriptionAnalytics {
    daily: {
        count: number;
        total: number;
        soutien: number;
        formation: number;
    };
    monthly: {
        count: number;
        total: number;
        soutien: number;
        formation: number;
    };
}

export async function getInscriptionAnalytics(): Promise<InscriptionAnalytics> {
    const response = await api.get<ApiResponse<InscriptionAnalytics>>('/inscriptions/analytics');
    return response.data.data;
}

