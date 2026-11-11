import api from '../api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '../institutionTypes';
import type { SchoolStatus } from './schools';

export type SubscriptionPeriod = 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';
export type ClientStatus = 'PENDING' | 'ACTIVE_UNPAID' | 'CONFIRMED' | 'CANCELLED';
export type PayoutStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'NONE';
export type StatusCounts = Record<ClientStatus, number>;

export interface PackRateInput {
    packId: string;
    period: SubscriptionPeriod;
    rate: number;
}

// As returned by the API: the pack's current name and code are looked up (null if the pack is gone).
export interface PackRate extends PackRateInput {
    packName: string | null;
    packCode: string | null;
}

export interface AgentRates {
    monthlyRate: number;
    semiannualRate: number;
    yearlyRate: number;
    packRates: PackRate[];
}

export interface AgentTotals {
    schools: number;
    activeSchools: number;
    totalCommissions: number;
    totalPayouts: number;
    balance: number;
}

export interface SalesAgentListItem extends AgentRates {
    id: string;
    name: string;
    phone: string | null;
    code: string;
    isHouse: boolean;
    active: boolean;
    email: string | null;
    totals: AgentTotals;
}

export interface AgentReport {
    agent: AgentRates & {
        id: string;
        name: string;
        phone: string | null;
        code: string;
        isHouse: boolean;
        active: boolean;
        email: string | null;
        referralPath: string;
    };
    totals: AgentTotals & { statusCounts: StatusCounts };
    schools: {
        id: string;
        name: string;
        city: string | null;
        institutionType: InstitutionType | null;
        status: SchoolStatus;
        clientStatus: ClientStatus;
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
        packName: string | null;
        commissionRate: number;
        commissionAmount: number;
        schoolName: string;
        payoutStatus: PayoutStatus;
        paidAmount: number;
    }[];
    payouts: { id: string; paidAt: string; amount: number; note: string | null }[];
}

export interface BaseRatesInput {
    monthlyRate: number;
    semiannualRate: number;
    yearlyRate: number;
    packRates: PackRateInput[];
}

export interface NewAgentInput extends BaseRatesInput {
    name: string;
    email: string;
    password: string;
    phone?: string;
    code: string;
}

export interface AgentUpdateInput extends Partial<BaseRatesInput> {
    name?: string;
    phone?: string;
    active?: boolean;
}

export interface SchoolPaymentItem {
    id: string;
    amount: number;
    period: SubscriptionPeriod;
    paidAt: string;
    note: string | null;
    packName: string | null; // null on payments recorded before v2
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

// For date-only values (e.g. paidAt stored at UTC midnight).
export const formatDay = (value: string): string => new Date(value).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

// Local calendar date as YYYY-MM-DD.
export const todayLocal = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

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
