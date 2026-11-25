import api from '@/lib/api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '@/lib/institutionTypes';

// Super admin messages to school owners (email + WhatsApp), and the platform WhatsApp number that sends them.
export type BroadcastChannel = 'EMAIL' | 'WHATSAPP';
export type SchoolState = 'TRIAL' | 'TRIAL_EXPIRED' | 'ACTIVE' | 'SUSPENDED';
export type BroadcastMessageStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
export const SCHOOL_STATES: SchoolState[] = ['TRIAL', 'TRIAL_EXPIRED', 'ACTIVE', 'SUSPENDED'];
export const BROADCAST_CHANNELS: BroadcastChannel[] = ['EMAIL', 'WHATSAPP'];

export interface BroadcastFilters {
    states?: SchoolState[];
    packId?: string;
    institutionType?: InstitutionType;
    salesAgentId?: string;
}

export interface BroadcastPreview {
    schools: number;
    email: number;
    whatsapp: number;
    channels: { email: boolean; whatsapp: boolean };
}

export interface Broadcast {
    id: string;
    subject: string;
    body: string;
    channels: BroadcastChannel[];
    total: number;
    emailSent: number;
    emailFailed: number;
    emailSkipped: number;
    whatsappSent: number;
    whatsappFailed: number;
    whatsappSkipped: number;
    createdAt: string;
}

export interface BroadcastMessageRow {
    id: string;
    schoolId: string;
    schoolName: string;
    channel: BroadcastChannel;
    to: string | null;
    status: BroadcastMessageStatus;
    error: string | null;
    attempts: number;
    sentAt: string | null;
}

export interface BroadcastDetail extends Broadcast {
    messages: BroadcastMessageRow[];
}

export interface BroadcastInput {
    subject: string;
    body: string;
    channels: BroadcastChannel[];
    filters: BroadcastFilters;
}

export type PlatformWaStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
export interface PlatformWhatsapp {
    configured: boolean;
    status: PlatformWaStatus;
    phone: string | null;
}
export interface PlatformWhatsappConnect extends PlatformWhatsapp {
    qr: { base64: string | null; code: string | null };
}

export async function previewBroadcast(filters: BroadcastFilters): Promise<BroadcastPreview> {
    const response = await api.post<ApiResponse<BroadcastPreview>>('/platform/broadcasts/preview', { filters });
    return response.data.data;
}

export async function createBroadcast(input: BroadcastInput): Promise<Broadcast> {
    const response = await api.post<ApiResponse<Broadcast>>('/platform/broadcasts', input);
    return response.data.data;
}

export async function getBroadcasts(): Promise<Broadcast[]> {
    const response = await api.get<ApiResponse<Broadcast[]>>('/platform/broadcasts');
    return response.data.data;
}

export async function getBroadcast(id: string): Promise<BroadcastDetail> {
    const response = await api.get<ApiResponse<BroadcastDetail>>(`/platform/broadcasts/${id}`);
    return response.data.data;
}

export async function retryBroadcast(id: string): Promise<{ requeued: number; broadcast: Broadcast }> {
    const response = await api.post<ApiResponse<{ requeued: number; broadcast: Broadcast }>>(`/platform/broadcasts/${id}/retry`);
    return response.data.data;
}

export async function getPlatformWhatsapp(): Promise<PlatformWhatsapp> {
    const response = await api.get<ApiResponse<PlatformWhatsapp>>('/platform/whatsapp');
    return response.data.data;
}

export async function connectPlatformWhatsapp(): Promise<PlatformWhatsappConnect> {
    const response = await api.post<ApiResponse<PlatformWhatsappConnect>>('/platform/whatsapp/connect');
    return response.data.data;
}

export async function disconnectPlatformWhatsapp(): Promise<PlatformWhatsapp> {
    const response = await api.post<ApiResponse<PlatformWhatsapp>>('/platform/whatsapp/disconnect');
    return response.data.data;
}

/** Messages still waiting to go out (the history polls while a broadcast has some). */
export const pendingCount = (b: Broadcast) =>
    b.channels.length * b.total -
    (b.emailSent + b.emailFailed + b.emailSkipped + b.whatsappSent + b.whatsappFailed + b.whatsappSkipped);
