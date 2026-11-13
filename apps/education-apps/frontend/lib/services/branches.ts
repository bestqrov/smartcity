import api from '../api';
import type { ApiResponse } from '@/types';

export interface Branch {
    id: string;
    schoolId: string;
    name: string;
    city: string;
    address?: string;
    phone?: string;
}

export interface NewBranch {
    name: string;
    city?: string;
    address?: string;
    phone?: string;
}

// OWNER only; the school is the caller's. A full pack answers 403 BRANCH_LIMIT_REACHED.
export async function createBranch(data: NewBranch): Promise<Branch> {
    const response = await api.post<ApiResponse<Branch>>('/branches', data);
    return response.data.data;
}

export interface BranchSummaryEntry {
    branch: Branch;
    studentCount: number;
    presentToday: number;
    balanceDue: number;
}

export interface BranchSummary {
    branches: BranchSummaryEntry[];
    totalStudents: number;
    totalBalanceDue: number;
}

export async function getBranches(): Promise<Branch[]> {
    const response = await api.get<ApiResponse<Branch[]>>('/branches');
    return response.data.data;
}

export async function getBranchSummary(): Promise<BranchSummary> {
    const response = await api.get<ApiResponse<BranchSummary>>('/branches/summary');
    return response.data.data;
}
