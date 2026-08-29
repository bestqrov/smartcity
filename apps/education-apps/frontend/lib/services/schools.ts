import api from '../api';
import type { ApiResponse, User } from '@/types';

export interface SignupSchoolData {
    schoolName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password: string;
    branchName: string;
    branchCity: string;
    packTier: string;
}

export async function signupSchool(data: SignupSchoolData): Promise<{ token: string; user: User }> {
    const response = await api.post<ApiResponse<{ token: string; user: User }>>('/schools/signup', data);
    return response.data.data;
}
