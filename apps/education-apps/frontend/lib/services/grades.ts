import axios from 'axios';
import api from '../api';
import type { ApiResponse } from '@/types';

export interface Evaluation {
    id: string;
    branchId: string;
    groupId: string;
    title: string;
    subject: string;
    period: string;
    date: string;
    maxScore: number;
    coefficient: number;
    published: boolean;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface Grade {
    id: string;
    branchId: string;
    evaluationId: string;
    studentId: string;
    score: number | null;
    absent: boolean;
    comment: string | null;
    updatedAt: string;
}

export type EvaluationWithGrades = Evaluation & { grades: Grade[] };

export interface EvaluationInput {
    groupId: string;
    title: string;
    period: string;
    date: string;
    maxScore?: number;
    coefficient?: number;
    subject?: string;
}

export type EvaluationUpdate = Partial<Pick<Evaluation, 'title' | 'subject' | 'period' | 'date' | 'maxScore' | 'coefficient'>>;

export interface GradeInput {
    studentId: string;
    score?: number | null;
    absent?: boolean;
    comment?: string | null;
}

export interface GradeStudent {
    id: string;
    name: string;
    surname: string;
}

/** One interface for staff (authenticated) and teacher (token link) grade calls. */
export interface GradesClient {
    listEvaluations(groupId: string): Promise<EvaluationWithGrades[]>;
    createEvaluation(data: EvaluationInput): Promise<Evaluation>;
    updateEvaluation(id: string, data: EvaluationUpdate): Promise<Evaluation>;
    deleteEvaluation(id: string): Promise<void>;
    saveGrades(id: string, grades: GradeInput[]): Promise<Grade[]>;
    setPublished(id: string, published: boolean): Promise<Evaluation>;
}

export const staffGradesClient: GradesClient = {
    listEvaluations: async (groupId) =>
        (await api.get<ApiResponse<EvaluationWithGrades[]>>('/grades/evaluations', { params: { groupId } })).data.data,
    createEvaluation: async (data) => (await api.post<ApiResponse<Evaluation>>('/grades/evaluations', data)).data.data,
    updateEvaluation: async (id, data) =>
        (await api.put<ApiResponse<Evaluation>>(`/grades/evaluations/${id}`, data)).data.data,
    deleteEvaluation: async (id) => {
        await api.delete(`/grades/evaluations/${id}`);
    },
    saveGrades: async (id, grades) =>
        (await api.put<ApiResponse<Grade[]>>(`/grades/evaluations/${id}/grades`, { grades })).data.data,
    setPublished: async (id, published) =>
        (await api.post<ApiResponse<Evaluation>>(`/grades/evaluations/${id}/publish`, { published })).data.data,
};

/** Public calls: no auth header, no X-Branch-Id — the token is the credential. */
const publicApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000' });

export interface TeacherPortalGroup {
    id: string;
    name: string;
    subject: string;
    level: string;
    type: string;
    students: GradeStudent[];
    evaluations: EvaluationWithGrades[];
    homework?: import('./homework').Homework[];
}

export interface TeacherPortal {
    teacher: { id: string; name: string };
    school: { name: string; logo: string | null } | null;
    periods: string[];
    groups: TeacherPortalGroup[];
}

const tp = (token: string) => `/teacher-portal/${encodeURIComponent(token)}`;

export async function getTeacherPortal(token: string): Promise<TeacherPortal> {
    return (await publicApi.get<ApiResponse<TeacherPortal>>(tp(token))).data.data;
}

export function teacherGradesClient(token: string): GradesClient {
    return {
        // The teacher page loads everything once (strict read rate limit) and keeps state locally.
        listEvaluations: async (groupId) => {
            const portal = await getTeacherPortal(token);
            return portal.groups.find((g) => g.id === groupId)?.evaluations ?? [];
        },
        createEvaluation: async (data) =>
            (await publicApi.post<ApiResponse<Evaluation>>(`${tp(token)}/evaluations`, data)).data.data,
        updateEvaluation: async (id, data) =>
            (await publicApi.put<ApiResponse<Evaluation>>(`${tp(token)}/evaluations/${id}`, data)).data.data,
        deleteEvaluation: async (id) => {
            await publicApi.delete(`${tp(token)}/evaluations/${id}`);
        },
        saveGrades: async (id, grades) =>
            (await publicApi.put<ApiResponse<Grade[]>>(`${tp(token)}/evaluations/${id}/grades`, { grades })).data.data,
        setPublished: async (id, published) =>
            (await publicApi.post<ApiResponse<Evaluation>>(`${tp(token)}/evaluations/${id}/publish`, { published })).data.data,
    };
}

export interface BulletinRow {
    studentId: string;
    name: string;
    surname: string;
    averages: Record<string, number | null>;
    general: number | null;
    rank: number | null;
}

export interface Bulletin {
    groupId: string;
    period: string;
    subjects: string[];
    rows: BulletinRow[];
}

export async function getGradingPeriods(): Promise<string[]> {
    return (await api.get<ApiResponse<string[]>>('/grades/periods')).data.data;
}

export async function getBulletin(groupId: string, period: string): Promise<Bulletin> {
    return (await api.get<ApiResponse<Bulletin>>('/grades/bulletin', { params: { groupId, period } })).data.data;
}

export async function issueTeacherPortalLink(teacherId: string): Promise<{ rawToken: string; linkIssuedAt: string }> {
    return (await api.post<ApiResponse<{ rawToken: string; linkIssuedAt: string }>>(`/teachers/${teacherId}/portal-link`)).data.data;
}

export const apiErrorMessage = (err: unknown, fallback = 'Une erreur est survenue'): string => {
    const e = err as { response?: { data?: { message?: string; error?: string } } };
    return e?.response?.data?.message || e?.response?.data?.error || fallback;
};
