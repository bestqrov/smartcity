// frontend/lib/services/subscription.ts
import api from '../api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '../institutionTypes';
import type { StudentLimitDetails } from '../packs/limits';

export interface SchoolCapacity {
    institutionType: InstitutionType;
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
    packCode: string | null;
    packName: string | null;
    limit: number | null;
    current: number;
    remaining: number | null;
    upgradeDueAt: string | null;
}

export interface UpgradeResult {
    packCode: string;
    packName: string;
    limit: number | null;
    current: number;
    dueAt: string | null;
}

export interface PendingUpgrade {
    id: string;
    toPackName: string;
    toMonthlyPrice: number;
    createdAt: string;
    dueAt: string;
}

export async function getSchoolCapacity(): Promise<SchoolCapacity> {
    const response = await api.get<ApiResponse<SchoolCapacity>>('/school/capacity');
    return response.data.data;
}

export async function upgradePack(packCode: string): Promise<UpgradeResult> {
    const response = await api.post<ApiResponse<UpgradeResult>>('/school/pack-upgrade', { packCode });
    return response.data.data;
}

export async function getPendingUpgrades(): Promise<PendingUpgrade[]> {
    const response = await api.get<ApiResponse<PendingUpgrade[]>>('/school/pack-upgrade/pending');
    return response.data.data;
}

// The numbers of a 403 STUDENT_LIMIT_REACHED, or null for any other error.
export const studentLimitDetails = (error: any): StudentLimitDetails | null =>
    error?.response?.status === 403 && error?.response?.data?.error === 'STUDENT_LIMIT_REACHED'
        ? (error.response.data.data as StudentLimitDetails)
        : null;
