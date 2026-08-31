import api from '../api';
import type { ApiResponse, User } from '@/types';

export interface SignupSchoolData {
    ownerName: string;
    ownerEmail: string;
    password: string;
}

export interface SignupSchoolResponse {
    token: string;
    user: User;
    branch: { id: string; name: string };
}

export async function signupSchool(data: SignupSchoolData): Promise<SignupSchoolResponse> {
    const response = await api.post<ApiResponse<SignupSchoolResponse>>('/schools/signup', data);
    return response.data.data;
}

export type SchoolStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface SchoolProfileData {
    id: string;
    name: string;
    status: SchoolStatus;
    trialEndsAt: string | null;
    director?: string | null;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
}

export async function getMySchool(): Promise<SchoolProfileData> {
    const response = await api.get<ApiResponse<SchoolProfileData>>('/schools/me');
    return response.data.data;
}

export interface UpdateSchoolProfilePayload {
    name?: string;
    director?: string;
    city?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
}

export async function updateMySchool(data: UpdateSchoolProfilePayload): Promise<SchoolProfileData> {
    const response = await api.put<ApiResponse<SchoolProfileData>>('/schools/me', data);
    return response.data.data;
}

export interface SchoolListItem {
    id: string;
    name: string;
    ownerEmail: string;
    status: SchoolStatus;
    trialEndsAt: string | null;
    createdAt: string;
}

export async function getAllSchools(): Promise<SchoolListItem[]> {
    const response = await api.get<ApiResponse<SchoolListItem[]>>('/schools');
    return response.data.data;
}

export async function updateSchoolStatus(id: string, status: SchoolStatus): Promise<SchoolListItem> {
    const response = await api.patch<ApiResponse<SchoolListItem>>(`/schools/${id}/status`, { status });
    return response.data.data;
}
