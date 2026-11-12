// src/modules/students-import/normalize.ts
// Pure normalisation of one imported row: no database access, so it is fully unit-tested.

export const TEXT_FIELDS = [
    'birthPlace',
    'schoolLevel',
    'currentSchool',
    'address',
    'fatherName',
    'motherName',
    'parentName',
    'parentRelation',
    'crecheSection',
    'healthNotes',
] as const;

export const IMPORT_FIELDS = [
    'surname',
    'name',
    'fullName',
    'birthDate',
    'group',
    'massarNumber',
    'cin',
    'phone',
    'email',
    'parentPhone',
    ...TEXT_FIELDS,
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportRow = { rowNumber: number } & Partial<Record<ImportField, string>>;

export interface StudentImportData {
    surname: string;
    name: string;
    birthDate?: Date;
    massarNumber?: string;
    cin?: string;
    phone?: string;
    email?: string;
    parentPhone?: string;
    birthPlace?: string;
    schoolLevel?: string;
    currentSchool?: string;
    address?: string;
    fatherName?: string;
    motherName?: string;
    parentName?: string;
    parentRelation?: string;
    crecheSection?: string;
    healthNotes?: string;
}

export interface NormalizedRow {
    rowNumber: number;
    data: StudentImportData;
    group: string | null;
    errors: string[];
    warnings: string[];
}

const LABELS: Record<string, string> = {
    birthPlace: 'Lieu de naissance',
    schoolLevel: 'Niveau',
    currentSchool: 'École actuelle',
    address: 'Adresse',
    fatherName: 'Nom du père',
    motherName: 'Nom de la mère',
    parentName: 'Nom du tuteur',
    parentRelation: 'Lien de parenté',
    crecheSection: 'Section crèche',
    healthNotes: 'Notes de santé',
};
const FEMININE = new Set(['address', 'healthNotes', 'crecheSection']);

const MAX_NAME = 100;
const MAX_TEXT = 500;
const DAY_MS = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');

export const foldText = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

const utcDate = (year: number, month: number, day: number): Date | null => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
};

// dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd, or an Excel serial (days since 1899-12-30).
// Accepted range: 1950-01-01 to today.
export const parseImportDate = (raw: string, today: Date = new Date()): Date | null => {
    const value = raw.trim();
    let date: Date | null = null;
    let match: RegExpMatchArray | null;
    if ((match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
        date = utcDate(Number(match[3]), Number(match[2]), Number(match[1]));
    } else if ((match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
        date = utcDate(Number(match[1]), Number(match[2]), Number(match[3]));
    } else if (/^\d{5}(\.\d+)?$/.test(value)) {
        date = new Date(EXCEL_EPOCH + Math.floor(Number(value)) * DAY_MS);
    }
    if (!date) return null;
    if (date.getUTCFullYear() < 1950 || date.getTime() > today.getTime()) return null;
    return date;
};

// +212 6…, 00212 6…, 212 6… and 06… all become 06…; anything else is kept as typed and flagged.
export const normalizePhone = (raw: string): { value: string; moroccan: boolean } => {
    const digits = raw.replace(/[\s.\-()]/g, '');
    const local = digits.replace(/^(\+212|00212|212)([5-7]\d{8})$/, '0$2');
    if (/^0[5-7]\d{8}$/.test(local)) return { value: local, moroccan: true };
    return { value: raw.trim(), moroccan: false };
};

export const splitFullName = (raw: string): { surname: string; name: string } => {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    return { surname: words[0] ?? '', name: words.slice(1).join(' ') };
};

// Massar code first; otherwise surname + name + birth date; with neither there is no safe key.
export const duplicateKey = (student: { massarNumber?: string | null; surname: string; name: string; birthDate?: Date | null }): string | null => {
    if (student.massarNumber) return `m:${student.massarNumber.toUpperCase()}`;
    if (student.birthDate) return `n:${foldText(student.surname)}|${foldText(student.name)}|${student.birthDate.toISOString().slice(0, 10)}`;
    return null;
};

export const normalizeRow = (row: ImportRow, today: Date = new Date()): NormalizedRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const get = (key: ImportField) => clean((row as Record<string, unknown>)[key]);

    let surname = get('surname');
    let name = get('name');
    const fullName = get('fullName');
    if (fullName && !surname && !name) ({ surname, name } = splitFullName(fullName));

    if (!surname) errors.push('Nom manquant');
    else if (surname.length > MAX_NAME) errors.push(`Nom trop long (${MAX_NAME} caractères max)`);
    if (!name) errors.push('Prénom manquant');
    else if (name.length > MAX_NAME) errors.push(`Prénom trop long (${MAX_NAME} caractères max)`);

    const data: StudentImportData = { surname, name };

    const birthDate = get('birthDate');
    if (birthDate) {
        const parsed = parseImportDate(birthDate, today);
        if (parsed) data.birthDate = parsed;
        else errors.push(`Date de naissance invalide : ${birthDate}`);
    }

    const massar = get('massarNumber');
    if (massar) data.massarNumber = massar.toUpperCase();
    const cin = get('cin');
    if (cin) data.cin = cin.toUpperCase();

    const email = get('email');
    if (email) {
        if (email.includes('@')) data.email = email;
        else errors.push(`Email invalide : ${email}`);
    }

    for (const [key, label] of [['phone', 'Téléphone élève'], ['parentPhone', 'Téléphone tuteur']] as const) {
        const phone = get(key);
        if (!phone) continue;
        const normalized = normalizePhone(phone);
        data[key] = normalized.value;
        if (!normalized.moroccan) warnings.push(`${label} non marocain, gardé tel quel : ${phone}`);
    }

    for (const key of TEXT_FIELDS) {
        const value = get(key);
        if (!value) continue;
        if (value.length > MAX_TEXT) {
            errors.push(`${LABELS[key]} trop ${FEMININE.has(key) ? 'longue' : 'long'} (${MAX_TEXT} caractères max)`);
            continue;
        }
        data[key] = value;
    }

    const group = get('group');
    return { rowNumber: row.rowNumber, data, group: group || null, errors, warnings };
};
