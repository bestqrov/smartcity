import api from '../api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '../institutionTypes';
import type { PackFeature } from '../packs';

export interface PublicPack {
    code: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionType[];
    recommended: boolean;
}

export interface AdminPack {
    id: string;
    name: string;
    code: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionType[];
    isDefault: boolean;
    active: boolean;
    sortOrder: number;
    _count?: { schools: number };
}

export interface PackFormInput {
    name: string;
    code: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionType[];
    active: boolean;
    sortOrder: number;
}

// The API puts the specific reason in `error`; `message` is only a generic label.
export const apiErrorMessage = (e: any): string =>
    e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Une erreur est survenue';

export async function fetchPublicPacks(type?: InstitutionType): Promise<PublicPack[]> {
    const response = await api.get<ApiResponse<PublicPack[]>>('/packs/public', {
        params: type ? { type } : undefined,
    });
    return response.data.data;
}

export async function getAllPacks(): Promise<AdminPack[]> {
    const response = await api.get<ApiResponse<AdminPack[]>>('/packs');
    return response.data.data;
}

export async function createPack(data: PackFormInput): Promise<AdminPack> {
    const response = await api.post<ApiResponse<AdminPack>>('/packs', data);
    return response.data.data;
}

export async function updatePack(id: string, data: Partial<PackFormInput>): Promise<AdminPack> {
    const response = await api.put<ApiResponse<AdminPack>>(`/packs/${id}`, data);
    return response.data.data;
}

export async function setDefaultPack(id: string): Promise<AdminPack> {
    const response = await api.patch<ApiResponse<AdminPack>>(`/packs/${id}/default`);
    return response.data.data;
}

export async function assignSchoolPack(schoolId: string, packId: string): Promise<void> {
    await api.patch(`/schools/${schoolId}/pack`, { packId });
}
