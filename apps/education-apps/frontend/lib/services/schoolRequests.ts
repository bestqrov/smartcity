import api from '@/lib/api';
import type { ApiResponse } from '@/types';

// Requests a school admin sends to the super admin (smaller pack, feature, problem...) and the SA's answer.
export type SchoolRequestKind = 'PACK_DOWNGRADE' | 'FEATURE' | 'PACK_OPTION' | 'PROBLEM' | 'OTHER';
export type SchoolRequestStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';
export const REQUEST_STATUSES: SchoolRequestStatus[] = ['NEW', 'IN_PROGRESS', 'DONE', 'REJECTED'];
/** Kinds the «Demander une fonctionnalité» form offers (a downgrade comes from the pack dialog). */
export const FORM_KINDS: SchoolRequestKind[] = ['FEATURE', 'PACK_OPTION', 'PROBLEM', 'OTHER'];

export interface MySchoolRequest {
    id: string;
    kind: SchoolRequestKind;
    message: string;
    targetPackName: string | null;
    status: SchoolRequestStatus;
    reply: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SchoolRequest extends MySchoolRequest {
    schoolId: string;
    branchId: string;
    targetPackId: string | null;
    school: { id: string; name: string; city: string | null; status: string; ownerName: string; ownerPhone: string | null; pack: { name: string } | null };
}

export interface SchoolRequestInput {
    kind: SchoolRequestKind;
    message?: string;
    targetPackCode?: string;
}

// ---- school (ADMIN / OWNER)
export const createSchoolRequest = async (input: SchoolRequestInput) =>
    (await api.post<ApiResponse<MySchoolRequest>>('/school-requests', input)).data.data;
export const getMySchoolRequests = async () => (await api.get<ApiResponse<MySchoolRequest[]>>('/school-requests/mine')).data.data;

// ---- super admin
/** Window event fired after an SA update, so the menu badge refreshes at once. */
export const SCHOOL_REQUESTS_CHANGED = 'school-requests-changed';

export const getSchoolRequests = async (status?: SchoolRequestStatus) =>
    (await api.get<ApiResponse<SchoolRequest[]>>('/platform/school-requests', { params: status ? { status } : {} })).data.data;
export const getNewSchoolRequestsCount = async () =>
    (await api.get<ApiResponse<{ pending: number }>>('/platform/school-requests/pending-count')).data.data.pending;
export const updateSchoolRequest = async (id: string, patch: { status?: SchoolRequestStatus; reply?: string }) =>
    (await api.patch<ApiResponse<SchoolRequest>>(`/platform/school-requests/${id}`, patch)).data.data;
