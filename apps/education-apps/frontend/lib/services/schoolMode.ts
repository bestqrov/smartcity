import api from '@/lib/api';
import type { ApiResponse } from '@/types';

// /school-mode answers 403 SCHOOL_MODE_DISABLED unless the school is a private school or the branch has cycles.
export interface TuitionRow { level: string; inscriptionFee: number; monthlyFee: number; insuranceFee: number }
export interface DueRow { studentId: string; name: string; surname: string; level: string | null; groupIds: string[]; parentPhone: string | null; due: number; paid: number; remaining: number; status: 'PAID' | 'PARTIAL' | 'UNPAID' }
export interface DuesList { month: string; rows: DueRow[]; totals: { expected: number; collected: number; remaining: number } }
/** firstDue = inscriptionFee + insuranceFee + first month; the first month is recorded as a payment with forMonth = startMonth. */
export interface InscriptionSummary { inscriptionFee: number; insuranceFee: number; monthlyFee: number; firstDue: number; paid: number; remaining: number; startMonth: string }
export interface InscriptionResult {
    student: { id: string; name: string; surname: string };
    summary: InscriptionSummary;
    /** Set when the student was registered but the transport subscription failed. */
    transportError?: string;
}

export const getTuitionGrid = async () => (await api.get<ApiResponse<TuitionRow[]>>('/school-mode/tuition-fees')).data.data;
export const saveTuitionGrid = async (items: TuitionRow[]) => (await api.put<ApiResponse<TuitionRow[]>>('/school-mode/tuition-fees', { items })).data.data;
export const registerSchoolStudent = async (payload: Record<string, unknown>) =>
    (await api.post<ApiResponse<InscriptionResult>>('/school-mode/inscriptions', payload)).data.data;
export const getDues = async (month: string) => (await api.get<ApiResponse<DuesList>>('/school-mode/dues', { params: { month } })).data.data;
export const collectMonth = async (payload: { studentId: string; forMonth: string; amount: number; method: string }) =>
    (await api.post('/school-mode/dues/payments', payload)).data.data;
/** Unpaid months of the school year up to now + unpaid inscription balances, for active school-mode students. */
export interface DuesSummary { unpaid: number; months: number; inscriptions: number }
export const getDuesSummary = async () => (await api.get<ApiResponse<DuesSummary>>('/school-mode/dues/summary')).data.data;
