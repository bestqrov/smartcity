// src/modules/students-import/importStudents.service.ts
import prisma from '../../config/database';
import { getSchoolCapacity, remainingPlaces } from '../packs/packs.limits';
import { assertStudentCapacity } from '../packs/packs.limits';
import { generateRawToken, hashToken } from '../../utils/accessToken';
import { duplicateKeys, foldText, normalizePhone, normalizeRow, type ImportRow, type NormalizedRow } from './normalize';

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
    parents: { toCreate: number; toLink: number };
    parentIds: Map<string, string>; // normalized phone -> id (existing parents of the branch)
    institutionType: string;
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

    const [existing, groups, capacity, parentList] = await Promise.all([
        prisma.student.findMany({ where: { branchId }, select: { surname: true, name: true, birthDate: true, massarNumber: true } }),
        prisma.group.findMany({ where: { branchId }, select: { id: true, name: true } }),
        getSchoolCapacity(branchId),
        prisma.parent.findMany({ where: { branchId }, select: { id: true, phone: true } }),
    ]);

    const parentIds = new Map<string, string>();
    for (const parent of parentList) {
        const phone = normalizePhone(parent.phone).value;
        if (phone && !parentIds.has(phone)) parentIds.set(phone, parent.id);
    }

    const known = new Set(existing.flatMap((student) => duplicateKeys(student)));
    const groupIds = new Map(groups.map((group) => [foldText(group.name), group.id]));
    const seen = new Map<string, number>(); // any key -> first row number in the file
    const missing = new Map<string, string>(); // folded -> name as first written

    const checked: CheckedRow[] = rows.map((row) => {
        const normalized = normalizeRow(row, today);
        if (normalized.errors.length > 0) return { ...normalized, status: 'error' };

        const keys = duplicateKeys(normalized.data);
        if (keys.some((key) => known.has(key))) {
            return { ...normalized, status: 'duplicate', errors: ['Élève déjà inscrit dans cet établissement'] };
        }
        const firstKey = keys.find((key) => seen.has(key));
        if (firstKey) {
            return { ...normalized, status: 'duplicate', errors: [`Doublon de la ligne ${seen.get(firstKey)} du fichier`] };
        }
        for (const key of keys) seen.set(key, normalized.rowNumber);

        if (normalized.group && !groupIds.has(foldText(normalized.group))) {
            const folded = foldText(normalized.group);
            if (!missing.has(folded)) missing.set(folded, normalized.group);
            normalized.warnings.push(`Groupe « ${missing.get(folded)} » inexistant`);
        }
        return { ...normalized, status: 'valid' };
    });

    const counts = { valid: 0, duplicate: 0, error: 0 };
    for (const row of checked) counts[row.status] += 1;

    const newPhones = new Set<string>();
    let toLink = 0;
    for (const row of checked) {
        const phone = row.status === 'valid' ? row.data.parentPhone : undefined;
        if (!phone) continue;
        if (parentIds.has(phone)) toLink += 1;
        else newPhones.add(phone);
    }

    return {
        rows: checked,
        counts,
        missingGroups: [...missing.values()],
        groupIds,
        parents: { toCreate: newPhones.size, toLink },
        parentIds,
        institutionType: capacity.institutionType,
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
    parents: { created: number; linked: number };
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
    // Formation groups need a formationId: vocational schools create them from the Groups page.
    if (createMissingGroups && validation.institutionType !== 'VOCATIONAL_TRAINING') {
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

    // One parent per distinct phone: reuse the branch's, else create (the access link is made later).
    const parentIds = new Map(validation.parentIds);
    const existingPhones = new Set(parentIds.keys());
    const failedPhones = new Set<string>();
    let parentsCreated = 0;
    for (const row of valid) {
        const phone = row.data.parentPhone;
        if (!phone || parentIds.has(phone) || failedPhones.has(phone)) continue;
        const name =
            valid.find((other) => other.data.parentPhone === phone && (other.data.parentName || other.data.fatherName || other.data.motherName)) ??
            row;
        try {
            const parent = await prisma.parent.create({
                data: {
                    name:
                        name.data.parentName ||
                        name.data.fatherName ||
                        name.data.motherName ||
                        `Parent de ${row.data.name} ${row.data.surname}`,
                    phone,
                    branchId,
                    accessTokenHash: hashToken(generateRawToken()),
                    linkIssuedAt: null, // no link handed out yet
                },
                select: { id: true },
            });
            parentIds.set(phone, parent.id);
            parentsCreated += 1;
        } catch (error) {
            console.error(`Import parent for row ${row.rowNumber} failed`, error);
            failedPhones.add(phone);
        }
    }
    let parentsLinked = 0;

    const outcome = new Map<number, CommitRow>();
    for (let start = 0; start < valid.length; start += CHUNK) {
        await Promise.all(
            valid.slice(start, start + CHUNK).map(async (row) => {
                const phone = row.data.parentPhone;
                const parentId = phone ? parentIds.get(phone) : undefined;
                const warnings = phone && !parentId ? [...row.warnings, 'Profil parent non créé'] : row.warnings;
                const groupId = row.group ? groupIds.get(foldText(row.group)) : undefined;
                try {
                    await prisma.student.create({
                        data: {
                            branchId,
                            ...row.data,
                            ...(parentId && { parentId }),
                            active: true,
                            accessTokenHash: hashToken(generateRawToken()),
                            portalTokenHash: hashToken(generateRawToken()),
                            ...(groupId && { groups: { connect: [{ id: groupId }] } }),
                        },
                        select: { id: true },
                    });
                    outcome.set(row.rowNumber, { rowNumber: row.rowNumber, status: 'created', errors: [], warnings });
                    if (parentId && phone && existingPhones.has(phone)) parentsLinked += 1;
                } catch (error) {
                    console.error(`Import row ${row.rowNumber} failed`, error);
                    outcome.set(row.rowNumber, {
                        rowNumber: row.rowNumber,
                        status: 'error',
                        errors: ["Échec de l'enregistrement"],
                        warnings,
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

    return { rows, counts, createdGroups, parents: { created: parentsCreated, linked: parentsLinked } };
};
