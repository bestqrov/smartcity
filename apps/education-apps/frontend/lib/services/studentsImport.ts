// frontend/lib/services/studentsImport.ts
import api from '../api';
import type { ApiResponse } from '@/types';
import type { ImportFieldKey } from '../import/fields';

export type ImportRowInput = { rowNumber: number } & Partial<Record<ImportFieldKey, string>>;

export interface ValidatedRow {
    rowNumber: number;
    status: 'valid' | 'duplicate' | 'error';
    errors: string[];
    warnings: string[];
    group: string | null;
    data: { surname: string; name: string };
}

export interface ImportValidation {
    rows: ValidatedRow[];
    counts: { valid: number; duplicate: number; error: number };
    missingGroups: string[];
    capacity: { limit: number | null; current: number; remaining: number | null; packName: string | null };
    parents: { toCreate: number; toLink: number };
}

export interface ImportCommitResult {
    rows: { rowNumber: number; status: 'created' | 'duplicate' | 'error'; errors: string[]; warnings: string[] }[];
    counts: { created: number; duplicate: number; error: number };
    createdGroups: string[];
    parents: { created: number; linked: number };
}

export async function validateStudentImport(rows: ImportRowInput[]): Promise<ImportValidation> {
    const response = await api.post<ApiResponse<ImportValidation>>('/students/import/validate', { rows });
    return response.data.data;
}

export async function commitStudentImport(rows: ImportRowInput[], createMissingGroups: boolean): Promise<ImportCommitResult> {
    const response = await api.post<ApiResponse<ImportCommitResult>>('/students/import/commit', { rows, createMissingGroups });
    return response.data.data;
}
