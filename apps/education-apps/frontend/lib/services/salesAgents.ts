import api from '../api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '../institutionTypes';
import type { SchoolStatus } from './schools';

export type SubscriptionPeriod = 'MONTHLY' | 'YEARLY';

export interface AgentTotals {
    schools: number;
    activeSchools: number;
    totalCommissions: number;
    totalPayouts: number;
    balance: number;
}

export interface SalesAgentListItem {
    id: string;
    name: string;
    phone: string | null;
    code: string;
    commissionRate: number;
    isHouse: boolean;
    active: boolean;
    email: string | null;
    totals: AgentTotals;
}

export interface AgentReport {
    agent: {
        id: string;
        name: string;
        phone: string | null;
        code: string;
        commissionRate: number;
        isHouse: boolean;
        active: boolean;
        email: string | null;
        referralPath: string;
    };
    totals: AgentTotals;
    schools: {
        id: string;
        name: string;
        city: string | null;
        institutionType: InstitutionType | null;
        status: SchoolStatus;
        createdAt: string;
        ownerName: string;
        ownerPhone: string | null;
        packName: string | null;
        totalPaid: number;
    }[];
    commissions: {
        id: string;
        paidAt: string;
        amount: number;
        period: SubscriptionPeriod;
        commissionRate: number;
        commissionAmount: number;
        schoolName: string;
    }[];
    payouts: { id: string; paidAt: string; amount: number; note: string | null }[];
}

export interface NewAgentInput {
    name: string;
    email: string;
    password: string;
    phone?: string;
    code: string;
    commissionRate: number;
}

export interface AgentUpdateInput {
    name?: string;
    phone?: string;
    commissionRate?: number;
    active?: boolean;
}

export interface SchoolPaymentItem {
    id: string;
    amount: number;
    period: SubscriptionPeriod;
    paidAt: string;
    note: string | null;
    commissionRate: number;
    commissionAmount: number;
    salesAgent: { id: string; name: string; code: string } | null;
}

export interface MoneyInput {
    amount: number;
    paidAt: string; // yyyy-mm-dd
    note?: string;
}

export const formatMAD = (value: number): string =>
    `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

export const formatDate = (value: string): string => new Date(value).toLocaleDateString('fr-FR');

export const referralUrl = (referralPath: string): string =>
    typeof window === 'undefined' ? referralPath : `${window.location.origin}${referralPath}`;

export async function checkReferralCode(code: string): Promise<boolean> {
    const response = await api.get<ApiResponse<{ valid: boolean }>>(`/sales-agents/check/${encodeURIComponent(code)}`);
    return response.data.data.valid;
}

export async function getSalesAgents(): Promise<SalesAgentListItem[]> {
    const response = await api.get<ApiResponse<SalesAgentListItem[]>>('/sales-agents');
    return response.data.data;
}

export async function createSalesAgent(data: NewAgentInput): Promise<void> {
    await api.post('/sales-agents', data);
}

export async function updateSalesAgent(id: string, data: AgentUpdateInput): Promise<void> {
    await api.patch(`/sales-agents/${id}`, data);
}

export async function getSalesAgentReport(id: string): Promise<AgentReport> {
    const response = await api.get<ApiResponse<AgentReport>>(`/sales-agents/${id}`);
    return response.data.data;
}

export async function recordAgentPayout(id: string, data: MoneyInput): Promise<void> {
    await api.post(`/sales-agents/${id}/payouts`, data);
}

export async function deleteAgentPayout(id: string, payoutId: string): Promise<void> {
    await api.delete(`/sales-agents/${id}/payouts/${payoutId}`);
}

export async function getMyAgentReport(): Promise<AgentReport> {
    const response = await api.get<ApiResponse<AgentReport>>('/agent/me');
    return response.data.data;
}

export async function assignSchoolAgent(schoolId: string, salesAgentId: string | null): Promise<void> {
    await api.patch(`/schools/${schoolId}/sales-agent`, { salesAgentId });
}

export async function getSchoolPayments(schoolId: string): Promise<SchoolPaymentItem[]> {
    const response = await api.get<ApiResponse<SchoolPaymentItem[]>>(`/schools/${schoolId}/payments`);
    return response.data.data;
}

export async function recordSchoolPayment(
    schoolId: string,
    data: MoneyInput & { period: SubscriptionPeriod }
): Promise<void> {
    await api.post(`/schools/${schoolId}/payments`, data);
}

export async function deleteSchoolPayment(schoolId: string, paymentId: string): Promise<void> {
    await api.delete(`/schools/${schoolId}/payments/${paymentId}`);
}
