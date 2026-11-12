import api from '../api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '../institutionTypes';
import type { SchoolStatus } from './schools';
import type { AgentTotals, SubscriptionPeriod } from './salesAgents';

// GET /platform/overview (super admin): raw data of the platform dashboard, aggregated in the browser.
export interface PlatformSchool {
    id: string;
    name: string;
    city: string | null;
    institutionType: InstitutionType | null; // null is treated as PRIVATE_SCHOOL
    status: SchoolStatus;
    packName: string | null;
    salesAgent: { id: string; name: string; code: string } | null;
    createdAt: string;
    trialEndsAt: string | null;
    totalPaid: number;
    lastPaidAt: string | null;
}

export interface PlatformPayment {
    id: string;
    schoolId: string;
    schoolName: string;
    amount: number;
    period: SubscriptionPeriod;
    paidAt: string;
    packName: string | null;
    salesAgentId: string | null;
    salesAgentName: string | null;
    commissionAmount: number;
}

export interface PlatformAgent {
    id: string;
    name: string;
    code: string;
    isHouse: boolean;
    active: boolean;
    avatar: string | null;
    totals: AgentTotals;
}

export interface PlatformPayout {
    agentId: string;
    amount: number;
    paidAt: string;
}

export interface PlatformOverview {
    schools: PlatformSchool[];
    payments: PlatformPayment[];
    agents: PlatformAgent[];
    payouts: PlatformPayout[];
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
    const response = await api.get<ApiResponse<PlatformOverview>>('/platform/overview');
    return response.data.data;
}
