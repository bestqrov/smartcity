import api from '@/lib/api';
import type { ApiResponse } from '@/types';
import type { SubscriptionPeriod } from '@/lib/services/salesAgents';

// A school payment reported by its sales agent with a proof, confirmed or rejected by the super admin.
export type DeclarationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type DeclarationMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_MONEY';
export const DECLARATION_METHODS: DeclarationMethod[] = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_MONEY'];

export interface PaymentDeclaration {
    id: string;
    schoolId: string;
    salesAgentId: string;
    amount: number;
    period: SubscriptionPeriod;
    paidAt: string;
    method: DeclarationMethod;
    note: string | null;
    proofName: string | null;
    status: DeclarationStatus;
    rejectReason: string | null;
    reviewedAt: string | null;
    createdAt: string;
    school: { id: string; name: string; city: string | null; status: string; pack: { name: string } | null };
    salesAgent: { id: string; name: string; code: string };
    proof?: string; // only when one declaration is fetched
}

export interface DeclarationInput {
    schoolId: string;
    amount: number;
    period: SubscriptionPeriod;
    paidAt: string; // YYYY-MM-DD
    method: DeclarationMethod;
    note?: string;
    proof: string; // data URL
    proofName?: string;
}

// ---- sales agent
export const declarePayment = async (input: DeclarationInput) =>
    (await api.post<ApiResponse<PaymentDeclaration>>('/agent/me/payment-declarations', input)).data.data;
export const getMyDeclarations = async () =>
    (await api.get<ApiResponse<PaymentDeclaration[]>>('/agent/me/payment-declarations')).data.data;

// ---- super admin
/** Window event fired after a review, so the menu badge refreshes at once. */
export const DECLARATIONS_CHANGED = 'payment-declarations-changed';

export const getDeclarations = async (status?: DeclarationStatus) =>
    (await api.get<ApiResponse<PaymentDeclaration[]>>('/platform/payment-declarations', { params: status ? { status } : {} })).data.data;
export const getPendingDeclarationsCount = async () =>
    (await api.get<ApiResponse<{ pending: number }>>('/platform/payment-declarations/pending-count')).data.data.pending;
export const getDeclaration = async (id: string) =>
    (await api.get<ApiResponse<PaymentDeclaration>>(`/platform/payment-declarations/${id}`)).data.data;
export const confirmDeclaration = async (id: string, overrides: { amount?: number; period?: SubscriptionPeriod; paidAt?: string } = {}) =>
    (await api.post<ApiResponse<PaymentDeclaration>>(`/platform/payment-declarations/${id}/confirm`, overrides)).data.data;
export const rejectDeclaration = async (id: string, reason: string) =>
    (await api.post<ApiResponse<PaymentDeclaration>>(`/platform/payment-declarations/${id}/reject`, { reason })).data.data;

/** Reads a chosen file as a data URL; large photos are re-encoded as JPEG (1600 px) to stay light. */
export async function fileToProof(file: File): Promise<string> {
    const asDataUrl = (blob: Blob) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    if (!file.type.startsWith('image/') || file.size < 800_000) return asDataUrl(file);
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
}
