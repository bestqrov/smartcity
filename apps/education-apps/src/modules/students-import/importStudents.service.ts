// src/modules/students-import/importStudents.service.ts
import prisma from '../../config/database';
import { getSchoolCapacity, remainingPlaces } from '../packs/packs.limits';
import { assertStudentCapacity } from '../packs/packs.limits';
import { generateRawToken, hashToken } from '../../utils/accessToken';
import { duplicateKey, foldText, normalizeRow, type ImportRow, type NormalizedRow } from './normalize';

export const MAX_IMPORT_ROWS = 1000;

export type RowStatus = 'valid' | 'duplicate' | 'error';

export interface CheckedRow extends NormalizedRow {
    status: RowStatus;
}

export interface ImportValidation {
    rows: CheckedRow[];
    counts: Record<RowStatus, number>;
    missingGroups: string[];
    groupIds: Map<string, string>; // folded group name -> id (existing groups)
    capacity: { limit: number | null; current: number; remaining: number | null; packName: string | null };
}

const assertRows = (rows: unknown): ImportRow[] => {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Rows must be a non-empty list');
    if (rows.length > MAX_IMPORT_ROWS) throw new Error(`Maximum ${MAX_IMPORT_ROWS} lignes par import : découpez le fichier`);
    for (const row of rows) {
        if (!row || typeof row !== 'object' || typeof (row as ImportRow).rowNumber !== 'number') {
            throw new Error('Each row needs a rowNumber');
        }
    }
    return rows as ImportRow[];
};

// Normalises every row and classifies it against the branch's students and groups. Writes nothing.
export const validateImport = async (branchId: string, input: unknown, today: Date = new Date()): Promise<ImportValidation> => {
    const rows = assertRows(input);

    const [existing, groups, capacity] = await Promise.all([
        prisma.student.findMany({ where: { branchId }, select: { surname: true, name: true, birthDate: true, massarNumber: true } }),
        prisma.group.findMany({ where: { branchId }, select: { id: true, name: true } }),
        getSchoolCapacity(branchId),
    ]);

    const known = new Set(existing.map((student) => duplicateKey(student)).filter((key): key is string => key !== null));
    const groupIds = new Map(groups.map((group) => [foldText(group.name), group.id]));
    const seen = new Map<string, number>(); // key -> first row number in the file
    const missing = new Map<string, string>(); // folded -> name as first written

    const checked: CheckedRow[] = rows.map((row) => {
        const normalized = normalizeRow(row, today);
        if (normalized.errors.length > 0) return { ...normalized, status: 'error' };

        const key = duplicateKey(normalized.data);
        if (key && known.has(key)) {
            return { ...normalized, status: 'duplicate', errors: ['Élève déjà inscrit dans cet établissement'] };
        }
        if (key && seen.has(key)) {
            return { ...normalized, status: 'duplicate', errors: [`Doublon de la ligne ${seen.get(key)} du fichier`] };
        }
        if (key) seen.set(key, normalized.rowNumber);

        if (normalized.group && !groupIds.has(foldText(normalized.group))) {
            const folded = foldText(normalized.group);
            if (!missing.has(folded)) missing.set(folded, normalized.group);
            normalized.warnings.push(`Groupe « ${missing.get(folded)} » inexistant`);
        }
        return { ...normalized, status: 'valid' };
    });

    const counts = { valid: 0, duplicate: 0, error: 0 };
    for (const row of checked) counts[row.status] += 1;

    return {
        rows: checked,
        counts,
        missingGroups: [...missing.values()],
        groupIds,
        capacity: { limit: capacity.limit, current: capacity.current, remaining: remainingPlaces(capacity), packName: capacity.packName },
    };
};

export type CommitStatus = 'created' | 'duplicate' | 'error';

export interface CommitRow {
    rowNumber: number;
    status: CommitStatus;
    errors: string[];
    warnings: string[];
}

export interface ImportCommitResult {
    rows: CommitRow[];
    counts: Record<CommitStatus, number>;
    createdGroups: string[];
}

const CHUNK = 50;

// Re-validates (the data may have changed since the preview), checks the pack once for every valid
// row, creates the requested missing groups, then creates students one by one: a failing row is
// reported and the others go on. Imported students get no Inscription and no Payment.
export const commitImport = async (
    branchId: string,
    input: unknown,
    createMissingGroups: boolean,
    today: Date = new Date()
): Promise<ImportCommitResult> => {
    const validation = await validateImport(branchId, input, today);
    const valid = validation.rows.filter((row) => row.status === 'valid');
    await assertStudentCapacity(branchId, valid.length);

    const groupIds = new Map(validation.groupIds);
    const createdGroups: string[] = [];
    if (createMissingGroups) {
        for (const name of validation.missingGroups) {
            const folded = foldText(name);
            const level = valid.find((row) => row.group && foldText(row.group) === folded && row.data.schoolLevel)?.data.schoolLevel;
            const group = await prisma.group.create({
                data: { name, type: 'SOUTIEN', ...(level && { level }), branchId },
                select: { id: true },
            });
            groupIds.set(folded, group.id);
            createdGroups.push(name);
        }
    }

    const outcome = new Map<number, CommitRow>();
    for (let start = 0; start < valid.length; start += CHUNK) {
        await Promise.all(
            valid.slice(start, start + CHUNK).map(async (row) => {
                const groupId = row.group ? groupIds.get(foldText(row.group)) : undefined;
                try {
                    await prisma.student.create({
                        data: {
                            branchId,
                            ...row.data,
                            active: true,
                            accessTokenHash: hashToken(generateRawToken()),
                            portalTokenHash: hashToken(generateRawToken()),
                            ...(groupId && { groups: { connect: [{ id: groupId }] } }),
                        },
                        select: { id: true },
                    });
                    outcome.set(row.rowNumber, { rowNumber: row.rowNumber, status: 'created', errors: [], warnings: row.warnings });
                } catch (error) {
                    console.error(`Import row ${row.rowNumber} failed`, error);
                    outcome.set(row.rowNumber, {
                        rowNumber: row.rowNumber,
                        status: 'error',
                        errors: ["Échec de l'enregistrement"],
                        warnings: row.warnings,
                    });
                }
            })
        );
    }

    const rows: CommitRow[] = validation.rows.map(
        (row) =>
            outcome.get(row.rowNumber) ?? {
                rowNumber: row.rowNumber,
                status: row.status === 'duplicate' ? 'duplicate' : 'error',
                errors: row.errors,
                warnings: row.warnings,
            }
    );
    const counts = { created: 0, duplicate: 0, error: 0 };
    for (const row of rows) counts[row.status] += 1;

    return { rows, counts, createdGroups };
};
