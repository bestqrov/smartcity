# Excel student import: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin or secretary uploads the school's Excel list of students, maps its columns, previews every row with its status, and creates all the valid students in one go, without typing them one by one.

**Architecture:**
- **The browser** reads the file with SheetJS, maps its columns to our fields, and sends the rows as JSON.
- **The backend module** `src/modules/students-import/` has three parts:
  - pure normalisation: dates, phones, names, duplicate keys;
  - a service that validates against the database (duplicates, groups, pack capacity) and creates students one by one;
  - two routes, `POST /api/students/import/validate` and `POST /api/students/import/commit`.
- **Pack capacity** reuses `getSchoolCapacity` and `assertStudentCapacity` from phase 1 (`src/modules/packs/packs.limits.ts`). Upgrading reuses `askForUpgrade` (`frontend/lib/packs/upgradeBus.ts`).

**Tech stack:** Express 4, Prisma 5 on MongoDB, Jest with ts-jest (prisma mocked), Next.js 14, Tailwind, SheetJS 0.20.3 (from the SheetJS CDN, not npm).

**Spec:** `docs/superpowers/specs/2026-11-12-education-excel-student-import-design.md`. Phase 1 (the pack limit) is merged.

**Working directory:** `apps/education-apps` for backend commands; `apps/education-apps/frontend` where stated.

**Before starting:** run `npx jest` and note the counts. Expected: 49 suites, all passing.

---

## Field keys (shared contract)

The frontend sends each row as `{ rowNumber: number, ...fields }`, where every field value is a string. The field keys are:

`surname`, `name`, `fullName`, `birthDate`, `birthPlace`, `schoolLevel`, `group`, `currentSchool`, `massarNumber`, `cin`, `address`, `phone`, `email`, `fatherName`, `motherName`, `parentName`, `parentRelation`, `parentPhone`, `crecheSection`, `healthNotes`

- `fullName` holds "NOM Prénom" in one cell. The backend splits it into a surname (the first word) and a name (the rest), unless `surname` and `name` are already given.
- `group` is a group name. It is resolved to a `Group` of the branch.

---

## File map

**Backend, created:**
- `src/modules/students-import/normalize.ts`: pure functions, no Prisma.
- `src/modules/students-import/normalize.test.ts`
- `src/modules/students-import/importStudents.service.ts`
- `src/modules/students-import/importStudents.service.test.ts`
- `src/modules/students-import/importStudents.controller.ts`
- `src/modules/students-import/importStudents.routes.ts`

**Backend, modified:**
- `src/app.ts`: mounts `/students/import` before `/students`.

**Frontend (`frontend/`), created:**
- `lib/import/fields.ts`: field list, header synonyms, `matchHeader`.
- `lib/import/sheet.ts`: read a file; write the template and the error file (SheetJS, loaded lazily).
- `lib/services/studentsImport.ts`
- `components/import/StudentImportWizard.tsx`
- `app/admin/inscriptions/import/page.tsx`
- `app/secretary/inscriptions/import/page.tsx`

**Frontend, modified:**
- `package.json`: adds SheetJS.
- `components/Sidebar.tsx`: an "Import Excel" entry for admin and secretary.
- `app/admin/inscriptions/page.tsx` and `app/secretary/inscriptions/page.tsx`: a link to the import page.

---

### Task 1: Pure normalisation

**Files:**
- Create: `src/modules/students-import/normalize.ts`
- Test: `src/modules/students-import/normalize.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/students-import/normalize.test.ts
import { duplicateKey, foldText, normalizeRow, parseImportDate, normalizePhone, splitFullName } from './normalize';

const TODAY = new Date('2026-11-12T12:00:00Z');

describe('parseImportDate', () => {
    it('reads dd/mm/yyyy, dd-mm-yyyy, d/m/yyyy and yyyy-mm-dd as UTC midnight', () => {
        expect(parseImportDate('05/03/2015', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
        expect(parseImportDate('05-03-2015', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
        expect(parseImportDate('5/3/2015', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
        expect(parseImportDate('2015-03-05', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
    });

    it('reads an Excel date serial', () => {
        expect(parseImportDate('42068', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
    });

    it('rejects impossible dates, years before 1950 and future dates', () => {
        expect(parseImportDate('31/02/2015', TODAY)).toBeNull();
        expect(parseImportDate('01/01/1949', TODAY)).toBeNull();
        expect(parseImportDate('01/01/2027', TODAY)).toBeNull();
        expect(parseImportDate('hier', TODAY)).toBeNull();
        expect(parseImportDate('12', TODAY)).toBeNull();
    });
});

describe('normalizePhone', () => {
    it('turns Moroccan international forms into 0X…', () => {
        expect(normalizePhone('+212 6 12 34 56 78')).toEqual({ value: '0612345678', moroccan: true });
        expect(normalizePhone('00212712345678')).toEqual({ value: '0712345678', moroccan: true });
        expect(normalizePhone('212512345678')).toEqual({ value: '0512345678', moroccan: true });
        expect(normalizePhone('06.12.34.56.78')).toEqual({ value: '0612345678', moroccan: true });
    });

    it('keeps other numbers as typed and flags them', () => {
        expect(normalizePhone('+33 6 12 34 56 78')).toEqual({ value: '+33 6 12 34 56 78', moroccan: false });
        expect(normalizePhone('612345678')).toEqual({ value: '612345678', moroccan: false });
    });
});

describe('splitFullName', () => {
    it('takes the first word as surname and the rest as name', () => {
        expect(splitFullName('  EL AMRANI   Yasmine ')).toEqual({ surname: 'EL', name: 'AMRANI Yasmine' });
        expect(splitFullName('Bennani Omar')).toEqual({ surname: 'Bennani', name: 'Omar' });
    });

    it('returns an empty name for a single word', () => {
        expect(splitFullName('Bennani')).toEqual({ surname: 'Bennani', name: '' });
    });
});

describe('foldText and duplicateKey', () => {
    it('ignores case, accents and extra spaces', () => {
        expect(foldText('  Élodie   GARÇON ')).toBe('elodie garcon');
    });

    it('prefers the Massar code, then name + birth date, else no key', () => {
        expect(duplicateKey({ massarNumber: 'J130000001', surname: 'A', name: 'B', birthDate: null })).toBe('m:J130000001');
        expect(duplicateKey({ massarNumber: null, surname: 'Bennani', name: 'Omar', birthDate: new Date('2015-03-05T00:00:00Z') })).toBe(
            'n:bennani|omar|2015-03-05'
        );
        expect(duplicateKey({ massarNumber: null, surname: 'Bennani', name: 'Omar', birthDate: null })).toBeNull();
    });
});

describe('normalizeRow', () => {
    it('builds the student data from a valid row', () => {
        const result = normalizeRow(
            {
                rowNumber: 2,
                surname: ' Bennani ',
                name: 'Omar',
                birthDate: '05/03/2015',
                massarNumber: ' j130000001 ',
                cin: 'ab123',
                parentPhone: '+212612345678',
                group: ' CE2-A ',
                email: '',
            },
            TODAY
        );
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.data).toEqual({
            surname: 'Bennani',
            name: 'Omar',
            birthDate: new Date('2015-03-05T00:00:00Z'),
            massarNumber: 'J130000001',
            cin: 'AB123',
            parentPhone: '0612345678',
        });
        expect(result.group).toBe('CE2-A');
    });

    it('splits the full name when surname and name are not given', () => {
        const result = normalizeRow({ rowNumber: 3, fullName: 'Alaoui Sara' }, TODAY);
        expect(result.data).toMatchObject({ surname: 'Alaoui', name: 'Sara' });
        expect(result.errors).toEqual([]);
    });

    it('reports a missing surname or name, a bad date, a bad email and a too-long value', () => {
        const result = normalizeRow(
            { rowNumber: 4, surname: '', name: 'x'.repeat(101), birthDate: '32/13/2015', email: 'pas-un-email', address: 'y'.repeat(501) },
            TODAY
        );
        expect(result.errors).toEqual([
            'Nom manquant',
            'Prénom trop long (100 caractères max)',
            'Date de naissance invalide : 32/13/2015',
            'Email invalide : pas-un-email',
            'Adresse trop longue (500 caractères max)',
        ]);
    });

    it('warns about a non-Moroccan phone number without rejecting the row', () => {
        const result = normalizeRow({ rowNumber: 5, surname: 'A', name: 'B', phone: '+33612345678' }, TODAY);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual(['Téléphone élève non marocain, gardé tel quel : +33612345678']);
        expect(result.data.phone).toBe('+33612345678');
    });

    it('ignores unknown keys', () => {
        const result = normalizeRow({ rowNumber: 6, surname: 'A', name: 'B', password: 'x', branchId: 'evil' } as any, TODAY);
        expect(result.data).toEqual({ surname: 'A', name: 'B' });
    });
});
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx jest src/modules/students-import/normalize.test.ts`

Expected: FAIL, "Cannot find module './normalize'".

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx jest src/modules/students-import/normalize.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/students-import/normalize.ts src/modules/students-import/normalize.test.ts
git commit -m "feat(education): normalisation of imported student rows"
```

---

### Task 2: Validation against the database

**Files:**
- Create: `src/modules/students-import/importStudents.service.ts`
- Test: `src/modules/students-import/importStudents.service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/students-import/importStudents.service.test.ts
import prisma from '../../config/database';
import { getSchoolCapacity } from '../packs/packs.limits';
import { MAX_IMPORT_ROWS, validateImport } from './importStudents.service';

jest.mock('../packs/packs.limits', () => {
    const actual = jest.requireActual('../packs/packs.limits');
    return { ...actual, getSchoolCapacity: jest.fn(), assertStudentCapacity: jest.fn() };
});

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findMany: jest.fn(), create: jest.fn() },
        group: { findMany: jest.fn(), create: jest.fn() },
    },
}));

const TODAY = new Date('2026-11-12T12:00:00Z');

beforeEach(() => {
    jest.clearAllMocks();
    (prisma.student.findMany as jest.Mock).mockResolvedValue([
        { surname: 'Bennani', name: 'Omar', birthDate: new Date('2015-03-05T00:00:00Z'), massarNumber: null },
        { surname: 'X', name: 'Y', birthDate: null, massarNumber: 'J1' },
    ]);
    (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 'g1', name: 'CE2-A' }]);
    (getSchoolCapacity as jest.Mock).mockResolvedValue({ schoolId: 'sc1', limit: 300, current: 120, packName: 'Pro' });
});

describe('validateImport', () => {
    it('looks up duplicates and groups in the caller branch only', async () => {
        await validateImport('b1', [{ rowNumber: 2, surname: 'A', name: 'B' }], TODAY);
        expect(prisma.student.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1' },
            select: { surname: true, name: true, birthDate: true, massarNumber: true },
        });
        expect(prisma.group.findMany).toHaveBeenCalledWith({ where: { branchId: 'b1' }, select: { id: true, name: true } });
        expect(getSchoolCapacity).toHaveBeenCalledWith('b1');
    });

    it('classifies valid rows, errors, duplicates in the database and duplicates within the file', async () => {
        const result = await validateImport(
            'b1',
            [
                { rowNumber: 2, surname: 'Alaoui', name: 'Sara', birthDate: '01/09/2016' },
                { rowNumber: 3, surname: 'BENNANI', name: 'omar', birthDate: '05/03/2015' },
                { rowNumber: 4, surname: 'Z', name: 'W', massarNumber: 'j1' },
                { rowNumber: 5, surname: 'alaoui', name: 'SARA', birthDate: '2016-09-01' },
                { rowNumber: 6, surname: '', name: 'Nobody' },
                { rowNumber: 7, surname: 'Same', name: 'Name' },
                { rowNumber: 8, surname: 'Same', name: 'Name' },
            ],
            TODAY
        );

        expect(result.rows.map((row) => [row.rowNumber, row.status])).toEqual([
            [2, 'valid'],
            [3, 'duplicate'],
            [4, 'duplicate'],
            [5, 'duplicate'],
            [6, 'error'],
            [7, 'valid'],
            [8, 'valid'],
        ]);
        expect(result.rows[1].errors).toEqual(['Élève déjà inscrit dans cet établissement']);
        expect(result.rows[3].errors).toEqual(['Doublon de la ligne 2 du fichier']);
        expect(result.counts).toEqual({ valid: 3, duplicate: 3, error: 1 });
    });

    it('lists missing groups once, matched case-insensitively, and warns on their rows', async () => {
        const result = await validateImport(
            'b1',
            [
                { rowNumber: 2, surname: 'A', name: 'B', group: 'ce2-a' },
                { rowNumber: 3, surname: 'C', name: 'D', group: 'CM1-B' },
                { rowNumber: 4, surname: 'E', name: 'F', group: 'cm1-b ' },
            ],
            TODAY
        );
        expect(result.missingGroups).toEqual(['CM1-B']);
        expect(result.rows[0].warnings).toEqual([]);
        expect(result.rows[1].warnings).toEqual(['Groupe « CM1-B » inexistant']);
    });

    it('reports the capacity left for the valid rows', async () => {
        const result = await validateImport('b1', [{ rowNumber: 2, surname: 'A', name: 'B' }], TODAY);
        expect(result.capacity).toEqual({ limit: 300, current: 120, remaining: 180, packName: 'Pro' });
    });

    it('rejects more than MAX_IMPORT_ROWS rows and malformed input', async () => {
        const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({ rowNumber: i + 2, surname: 'A', name: 'B' }));
        await expect(validateImport('b1', rows, TODAY)).rejects.toThrow(`Maximum ${MAX_IMPORT_ROWS} lignes par import`);
        await expect(validateImport('b1', 'nope' as any, TODAY)).rejects.toThrow('Rows must be a non-empty list');
        await expect(validateImport('b1', [], TODAY)).rejects.toThrow('Rows must be a non-empty list');
        await expect(validateImport('b1', [{ surname: 'A' } as any], TODAY)).rejects.toThrow('Each row needs a rowNumber');
    });
});
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx jest src/modules/students-import/importStudents.service.test.ts`

Expected: FAIL, "Cannot find module './importStudents.service'".

- [ ] **Step 3: Implement validation**

```ts
// src/modules/students-import/importStudents.service.ts
import prisma from '../../config/database';
import { getSchoolCapacity, remainingPlaces } from '../packs/packs.limits';
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
```

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx jest src/modules/students-import/importStudents.service.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/students-import/importStudents.service.ts src/modules/students-import/importStudents.service.test.ts
git commit -m "feat(education): validate an imported student list against the branch"
```

---

### Task 3: Committing the import

**Files:**
- Modify: `src/modules/students-import/importStudents.service.ts`
- Test: `src/modules/students-import/importStudents.service.test.ts`

- [ ] **Step 1: Add the failing tests**

Change the imports at the top of the test file to:

```ts
import prisma from '../../config/database';
import { assertStudentCapacity, getSchoolCapacity, StudentLimitError } from '../packs/packs.limits';
import { commitImport, MAX_IMPORT_ROWS, validateImport } from './importStudents.service';
```

Append:

```ts
describe('commitImport', () => {
    beforeEach(() => {
        (prisma.student.create as jest.Mock).mockImplementation(({ data }: any) => Promise.resolve({ id: `s-${data.surname}` }));
        (prisma.group.create as jest.Mock).mockImplementation(({ data }: any) => Promise.resolve({ id: `g-${data.name}` }));
        (assertStudentCapacity as jest.Mock).mockResolvedValue(undefined);
    });

    const ROWS = [
        { rowNumber: 2, surname: 'Alaoui', name: 'Sara', group: 'ce2-a', schoolLevel: 'Primaire' },
        { rowNumber: 3, surname: 'Bennani', name: 'Omar', birthDate: '05/03/2015' }, // duplicate in DB
        { rowNumber: 4, surname: 'Idrissi', name: 'Adam', group: 'CM1-B', schoolLevel: 'Primaire' },
        { rowNumber: 5, surname: '', name: 'Bad' }, // error
    ];

    it('checks capacity for the valid rows before writing anything', async () => {
        (assertStudentCapacity as jest.Mock).mockRejectedValueOnce(
            new StudentLimitError({ limit: 100, current: 99, adding: 2, packName: 'Essentiel' })
        );
        await expect(commitImport('b1', ROWS, false, TODAY)).rejects.toBeInstanceOf(StudentLimitError);
        expect(assertStudentCapacity).toHaveBeenCalledWith('b1', 2);
        expect(prisma.student.create).not.toHaveBeenCalled();
        expect(prisma.group.create).not.toHaveBeenCalled();
    });

    it('creates valid students with tokens and their existing group, and no inscription or payment', async () => {
        const result = await commitImport('b1', ROWS, false, TODAY);

        expect(prisma.student.create).toHaveBeenCalledTimes(2);
        const first = (prisma.student.create as jest.Mock).mock.calls[0][0].data;
        expect(first).toEqual({
            branchId: 'b1',
            surname: 'Alaoui',
            name: 'Sara',
            schoolLevel: 'Primaire',
            active: true,
            accessTokenHash: expect.any(String),
            portalTokenHash: expect.any(String),
            groups: { connect: [{ id: 'g1' }] },
        });
        const second = (prisma.student.create as jest.Mock).mock.calls[1][0].data;
        expect(second.groups).toBeUndefined(); // CM1-B missing and not created
        expect(prisma.group.create).not.toHaveBeenCalled();
        expect((prisma as any).inscription).toBeUndefined();
        expect((prisma as any).payment).toBeUndefined();

        expect(result.counts).toEqual({ created: 2, duplicate: 1, error: 1 });
        expect(result.rows.map((row) => [row.rowNumber, row.status])).toEqual([
            [2, 'created'],
            [3, 'duplicate'],
            [4, 'created'],
            [5, 'error'],
        ]);
        expect(result.createdGroups).toEqual([]);
    });

    it('creates each missing group once, with the level of its first row, when asked', async () => {
        const result = await commitImport('b1', ROWS, true, TODAY);
        expect(prisma.group.create).toHaveBeenCalledTimes(1);
        expect(prisma.group.create).toHaveBeenCalledWith({
            data: { name: 'CM1-B', type: 'SOUTIEN', level: 'Primaire', branchId: 'b1' },
            select: { id: true },
        });
        const second = (prisma.student.create as jest.Mock).mock.calls[1][0].data;
        expect(second.groups).toEqual({ connect: [{ id: 'g-CM1-B' }] });
        expect(result.createdGroups).toEqual(['CM1-B']);
    });

    it('records a failing row as an error and goes on with the next ones', async () => {
        (prisma.student.create as jest.Mock)
            .mockRejectedValueOnce(new Error('boom'))
            .mockImplementationOnce(({ data }: any) => Promise.resolve({ id: `s-${data.surname}` }));
        const result = await commitImport('b1', ROWS, false, TODAY);
        expect(result.rows[0]).toMatchObject({ rowNumber: 2, status: 'error', errors: ["Échec de l'enregistrement"] });
        expect(result.rows[2]).toMatchObject({ rowNumber: 4, status: 'created' });
        expect(result.counts).toEqual({ created: 1, duplicate: 1, error: 2 });
    });
});
```

The `prisma` mock in this file has no `inscription` or `payment` model, so any attempt to create one would throw.

- [ ] **Step 2: Run them and check that they fail**

Run: `npx jest src/modules/students-import/importStudents.service.test.ts`

Expected: the new tests FAIL, because `commitImport` is not exported.

- [ ] **Step 3: Implement `commitImport`**

Add this to the imports at the top of `importStudents.service.ts`:

```ts
import { assertStudentCapacity } from '../packs/packs.limits';
import { generateRawToken, hashToken } from '../../utils/accessToken';
```

Then append:

```ts
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
```

Note that the test asserts `create` is called with `{ data, select }`. Its `mock.calls[0][0].data` check only looks at `data`, so the `select` key is fine.

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx jest src/modules/students-import`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/students-import
git commit -m "feat(education): commit an imported student list"
```

---

### Task 4: Routes

**Files:**
- Create: `src/modules/students-import/importStudents.controller.ts`
- Create: `src/modules/students-import/importStudents.routes.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: The controller**

```ts
// src/modules/students-import/importStudents.controller.ts
import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { sendError, sendSuccess } from '../../utils/response';
import { StudentLimitError, sendStudentLimitError } from '../packs/packs.limits';
import { commitImport, validateImport } from './importStudents.service';

const fail = (res: Response, error: unknown, label: string) => {
    if (error instanceof StudentLimitError) return sendStudentLimitError(res, error);
    if (error instanceof Error && error.name.startsWith('PrismaClient')) {
        console.error(error);
        sendError(res, 'Internal server error', label, 500);
        return;
    }
    sendError(res, error instanceof Error ? error.message : String(error), label, 400);
};

// branchId always comes from tenantScope, never from the body.
export const validate = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const result = await validateImport(req.branchId!, req.body?.rows);
        // groupIds is an internal Map (group ids): not sent to the client.
        sendSuccess(
            res,
            { rows: result.rows, counts: result.counts, missingGroups: result.missingGroups, capacity: result.capacity },
            'Import validated'
        );
    } catch (error) {
        fail(res, error, 'Failed to validate import');
    }
};

export const commit = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const result = await commitImport(req.branchId!, req.body?.rows, req.body?.createMissingGroups === true);
        sendSuccess(res, result, 'Import done', 201);
    } catch (error) {
        fail(res, error, 'Failed to import students');
    }
};
```

- [ ] **Step 2: The routes**

```ts
// src/modules/students-import/importStudents.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { commit, validate } from './importStudents.controller';

const router = Router();

// Same access as creating a student (POST /students).
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.post('/validate', validate);
router.post('/commit', commit);

export default router;
```

- [ ] **Step 3: Mount it before `/students`**

In `src/app.ts`, add this import:

```ts
import studentsImportRoutes from './modules/students-import/importStudents.routes';
```

Then put this line directly **above** `apiRouter.use('/students', studentsRoutes);`:

```ts
apiRouter.use('/students/import', studentsImportRoutes);
```

The JSON body limit is already 50mb (`app.ts` line 43), so 1000 rows fit and no change is needed.

- [ ] **Step 4: Type-check and run the suite**

Run: `npx tsc --noEmit && npx jest`

Expected: no type errors, and all suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/students-import src/app.ts
git commit -m "feat(education): /students/import validate and commit routes"
```

---

### Task 5: SheetJS, fields and header matching

**Files:**
- Modify: `frontend/package.json` (via npm)
- Create: `frontend/lib/import/fields.ts`
- Create: `frontend/lib/import/sheet.ts`

- [ ] **Step 1: Install SheetJS from its CDN**

Run, in `frontend/`: `npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`

Expected: `package.json` gets `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`. The npm-registry `xlsx` (0.18.5) is unmaintained and has known vulnerabilities, so do not use it.

- [ ] **Step 2: Fields and synonyms**

```ts
// frontend/lib/import/fields.ts
// The import's target fields (keys match the backend's ImportRow) and the header names schools use.
// Grow SYNONYMS as real school files come in.

export type ImportFieldKey =
    | 'surname' | 'name' | 'fullName' | 'birthDate' | 'birthPlace' | 'schoolLevel' | 'group' | 'currentSchool'
    | 'massarNumber' | 'cin' | 'address' | 'phone' | 'email' | 'fatherName' | 'motherName' | 'parentName'
    | 'parentRelation' | 'parentPhone' | 'crecheSection' | 'healthNotes';

export interface ImportFieldDef {
    key: ImportFieldKey;
    label: string; // French template header
    hint: string; // Arabic hint shown under the header
    example: string;
    crecheOnly?: boolean;
}

export const IMPORT_FIELDS: ImportFieldDef[] = [
    { key: 'surname', label: 'Nom', hint: 'النسب', example: 'Bennani' },
    { key: 'name', label: 'Prénom', hint: 'الاسم', example: 'Omar' },
    { key: 'fullName', label: 'Nom complet', hint: 'الاسم الكامل', example: '' },
    { key: 'birthDate', label: 'Date de naissance', hint: 'تاريخ الازدياد', example: '05/03/2015' },
    { key: 'birthPlace', label: 'Lieu de naissance', hint: 'مكان الازدياد', example: 'Rabat' },
    { key: 'schoolLevel', label: 'Niveau', hint: 'المستوى', example: 'Primaire' },
    { key: 'group', label: 'Groupe / Classe', hint: 'القسم / الفوج', example: 'CE2-A' },
    { key: 'currentSchool', label: 'École actuelle', hint: 'المدرسة الحالية', example: '' },
    { key: 'massarNumber', label: 'Code Massar', hint: 'رمز مسار', example: 'J130000001' },
    { key: 'cin', label: 'CIN', hint: 'رقم البطاقة الوطنية', example: '' },
    { key: 'address', label: 'Adresse', hint: 'العنوان', example: '' },
    { key: 'phone', label: 'Téléphone élève', hint: 'هاتف التلميذ', example: '' },
    { key: 'email', label: 'Email', hint: 'البريد الإلكتروني', example: '' },
    { key: 'fatherName', label: 'Nom du père', hint: 'اسم الأب', example: 'Ahmed Bennani' },
    { key: 'motherName', label: 'Nom de la mère', hint: 'اسم الأم', example: 'Fatima Alaoui' },
    { key: 'parentName', label: 'Nom du tuteur', hint: 'اسم ولي الأمر', example: 'Ahmed Bennani' },
    { key: 'parentRelation', label: 'Lien de parenté', hint: 'صفة ولي الأمر', example: 'Père' },
    { key: 'parentPhone', label: 'Téléphone tuteur', hint: 'هاتف ولي الأمر', example: '0612345678' },
    { key: 'crecheSection', label: 'Section crèche', hint: 'قسم الحضانة', example: '', crecheOnly: true },
    { key: 'healthNotes', label: 'Notes de santé', hint: 'ملاحظات صحية', example: '', crecheOnly: true },
];

export const fieldsFor = (creche: boolean) => IMPORT_FIELDS.filter((field) => creche || !field.crecheOnly);

// Lowercase, no Latin accents, no Arabic diacritics/tatweel, unified alef, no punctuation, single spaces.
export const foldHeader = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[ً-ْـ]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();

const SYNONYMS: Record<ImportFieldKey, string[]> = {
    surname: ['nom', 'nom eleve', 'nom de famille', 'family name', 'last name', 'النسب', 'الاسم العائلي', 'اسم العائلة'],
    name: ['prenom', 'prenom eleve', 'first name', 'الاسم', 'الاسم الشخصي'],
    fullName: ['nom et prenom', 'nom prenom', 'nom complet', 'eleve', 'full name', 'الاسم الكامل', 'الاسم و النسب', 'الاسم والنسب', 'التلميذ'],
    birthDate: ['date de naissance', 'date naissance', 'ddn', 'ne le', 'nee le', 'naissance', 'birth date', 'date of birth', 'تاريخ الازدياد', 'تاريخ الولادة'],
    birthPlace: ['lieu de naissance', 'lieu naissance', 'ne a', 'place of birth', 'مكان الازدياد', 'مكان الولادة'],
    schoolLevel: ['niveau', 'niveau scolaire', 'cycle', 'level', 'المستوى', 'المستوى الدراسي'],
    group: ['classe', 'groupe', 'class', 'group', 'section', 'القسم', 'الفوج', 'الفصل'],
    currentSchool: ['ecole actuelle', 'ecole', 'etablissement', 'etablissement actuel', 'school', 'المدرسة', 'المؤسسة'],
    massarNumber: ['code massar', 'massar', 'cne', 'n massar', 'numero massar', 'رمز مسار', 'مسار', 'الرمز'],
    cin: ['cin', 'cni', 'carte nationale', 'البطاقة الوطنية', 'رقم البطاقة الوطنية'],
    address: ['adresse', 'address', 'العنوان'],
    phone: ['telephone eleve', 'tel eleve', 'gsm eleve', 'telephone', 'tel', 'gsm', 'phone', 'الهاتف', 'هاتف التلميذ'],
    email: ['email', 'e mail', 'mail', 'courriel', 'البريد الالكتروني'],
    fatherName: ['nom du pere', 'pere', 'nom pere', 'father', 'اسم الاب', 'الاب'],
    motherName: ['nom de la mere', 'mere', 'nom mere', 'mother', 'اسم الام', 'الام'],
    parentName: ['nom du tuteur', 'tuteur', 'parent', 'nom parent', 'responsable', 'ولي الامر', 'اسم ولي الامر'],
    parentRelation: ['lien de parente', 'lien', 'relation', 'parente', 'صفة ولي الامر', 'القرابة'],
    parentPhone: ['telephone tuteur', 'tel tuteur', 'tel parent', 'telephone parent', 'gsm parent', 'gsm tuteur', 'tel pere', 'هاتف ولي الامر', 'هاتف الولي', 'هاتف الاب'],
    crecheSection: ['section creche', 'section', 'قسم الحضانة'],
    healthNotes: ['notes de sante', 'sante', 'allergies', 'remarques sante', 'ملاحظات صحية'],
};

const LOOKUP = new Map<string, ImportFieldKey>();
for (const field of IMPORT_FIELDS) {
    LOOKUP.set(foldHeader(field.label), field.key);
    for (const synonym of SYNONYMS[field.key]) if (!LOOKUP.has(foldHeader(synonym))) LOOKUP.set(foldHeader(synonym), field.key);
}

// Template headers are "Nom (النسب)": try the whole header, then the part before a parenthesis.
export const matchHeader = (header: string): ImportFieldKey | null => {
    const whole = LOOKUP.get(foldHeader(header));
    if (whole) return whole;
    const beforeParen = header.split('(')[0];
    return LOOKUP.get(foldHeader(beforeParen)) ?? null;
};

// One field per column: the first column that claims a field keeps it.
export const autoMapping = (headers: string[], allowed: ImportFieldKey[]): (ImportFieldKey | null)[] => {
    const used = new Set<ImportFieldKey>();
    return headers.map((header) => {
        const key = matchHeader(header);
        if (!key || used.has(key) || !allowed.includes(key)) return null;
        used.add(key);
        return key;
    });
};
```

Note that `section` appears for both `group` and `crecheSection`. The first one registered wins (`group`), and the admin can remap it.

- [ ] **Step 3: Reading and writing sheets**

```ts
// frontend/lib/import/sheet.ts
// SheetJS is loaded only on the import page (dynamic import), so other pages stay small.
import type { ImportFieldDef } from './fields';

export interface SheetData {
    headers: string[];
    rows: { rowNumber: number; cells: string[] }[]; // rowNumber = line number in the sheet (1-based)
}

const cellText = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

// First sheet, first non-empty line as headers; empty lines skipped. Dates stay Excel serials
// (numbers) and CSV is read raw (no date guessing): the backend parses both.
export async function readSheet(file: File): Promise<SheetData> {
    const XLSX = await import('xlsx');
    const csv = file.name.toLowerCase().endsWith('.csv');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: csv });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('Le fichier ne contient aucune feuille.');
    const lines = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true });

    const headerIndex = lines.findIndex((line) => line.some((cell) => cellText(cell) !== ''));
    if (headerIndex === -1) throw new Error('Le fichier est vide.');
    const headers = lines[headerIndex].map(cellText);

    const rows = lines
        .slice(headerIndex + 1)
        .map((line, offset) => ({ rowNumber: headerIndex + offset + 2, cells: headers.map((_, i) => cellText(line[i])) }))
        .filter((row) => row.cells.some((cell) => cell !== ''));
    return { headers, rows };
}

const download = async (aoa: string[][], filename: string, widths?: number[]) => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    if (widths) sheet['!cols'] = widths.map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Élèves');
    XLSX.writeFile(workbook, filename);
};

export const downloadTemplate = (fields: ImportFieldDef[]) =>
    download(
        [fields.map((field) => `${field.label} (${field.hint})`), fields.map((field) => field.example)],
        'modele-import-eleves.xlsx',
        fields.map(() => 22)
    );

export const downloadErrorRows = (headers: string[], rows: { cells: string[]; errors: string[] }[]) =>
    download([[...headers, 'Erreur'], ...rows.map((row) => [...row.cells, row.errors.join(' ; ')])], 'lignes-en-erreur.xlsx');
```

- [ ] **Step 4: Type-check**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors. If TypeScript cannot find types for `xlsx`, check that `node_modules/xlsx/types` exists. The CDN package ships its own types.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/lib/import
git commit -m "feat(education): SheetJS reading, import fields and header matching"
```

---

### Task 6: Frontend service

**Files:**
- Create: `frontend/lib/services/studentsImport.ts`

- [ ] **Step 1: Write it**

```ts
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
}

export interface ImportCommitResult {
    rows: { rowNumber: number; status: 'created' | 'duplicate' | 'error'; errors: string[]; warnings: string[] }[];
    counts: { created: number; duplicate: number; error: number };
    createdGroups: string[];
}

export async function validateStudentImport(rows: ImportRowInput[]): Promise<ImportValidation> {
    const response = await api.post<ApiResponse<ImportValidation>>('/students/import/validate', { rows });
    return response.data.data;
}

export async function commitStudentImport(rows: ImportRowInput[], createMissingGroups: boolean): Promise<ImportCommitResult> {
    const response = await api.post<ApiResponse<ImportCommitResult>>('/students/import/commit', { rows, createMissingGroups });
    return response.data.data;
}
```

- [ ] **Step 2: Type-check, then commit**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

```bash
git add frontend/lib/services/studentsImport.ts
git commit -m "feat(education): frontend service for the student import"
```

---

### Task 7: The import wizard

**Files:**
- Create: `frontend/components/import/StudentImportWizard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/components/import/StudentImportWizard.tsx
'use client';

// Four steps: file -> column mapping -> preview (server validation) -> report.
// The server re-validates on commit; the preview only shows what will happen.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { autoMapping, fieldsFor, type ImportFieldKey } from '@/lib/import/fields';
import { downloadErrorRows, downloadTemplate, readSheet, type SheetData } from '@/lib/import/sheet';
import { apiErrorMessage } from '@/lib/services/packs';
import { studentLimitDetails } from '@/lib/services/subscription';
import { askForUpgrade } from '@/lib/packs/upgradeBus';
import { studentLimitMessage } from '@/lib/packs/limits';
import {
    commitStudentImport,
    validateStudentImport,
    type ImportCommitResult,
    type ImportRowInput,
    type ImportValidation,
} from '@/lib/services/studentsImport';

type Step = 'file' | 'mapping' | 'preview' | 'done';
type Filter = 'all' | 'valid' | 'duplicate' | 'error';

const MAX_ROWS = 1000;

const STATUS_STYLE = {
    valid: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    duplicate: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    error: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200',
};
const STATUS_LABEL = { valid: 'Valide', duplicate: 'Doublon', error: 'Erreur' };

const card = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6';
const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryBtn = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700';

interface Props {
    studentsPath: string; // where "Voir les élèves" goes after the import
}

export default function StudentImportWizard({ studentsPath }: Props) {
    const { profile } = useSchoolProfile();
    const fields = useMemo(() => fieldsFor(profile.institutionType === 'CRECHE'), [profile.institutionType]);

    const [step, setStep] = useState<Step>('file');
    const [sheet, setSheet] = useState<SheetData | null>(null);
    const [fileName, setFileName] = useState('');
    const [mapping, setMapping] = useState<(ImportFieldKey | null)[]>([]);
    const [validation, setValidation] = useState<ImportValidation | null>(null);
    const [createGroups, setCreateGroups] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');
    const [result, setResult] = useState<ImportCommitResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const mapped = new Set(mapping.filter(Boolean));
    const namesMapped = (mapped.has('surname') && mapped.has('name')) || mapped.has('fullName');

    const buildRows = (): ImportRowInput[] =>
        (sheet?.rows ?? []).map((row) => {
            const out: ImportRowInput = { rowNumber: row.rowNumber };
            mapping.forEach((key, column) => {
                if (key && row.cells[column]) out[key] = row.cells[column];
            });
            return out;
        });

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        setError('');
        setBusy(true);
        try {
            const data = await readSheet(file);
            if (data.rows.length === 0) throw new Error('Aucune ligne d’élève sous les en-têtes.');
            if (data.rows.length > MAX_ROWS) throw new Error(`Le fichier contient ${data.rows.length} lignes : maximum ${MAX_ROWS} par import. Découpez-le en plusieurs fichiers.`);
            setSheet(data);
            setFileName(file.name);
            setMapping(autoMapping(data.headers, fields.map((field) => field.key)));
            setStep('mapping');
        } catch (err: any) {
            setError(err?.message || 'Lecture du fichier impossible.');
        } finally {
            setBusy(false);
        }
    };

    const setColumn = (column: number, key: ImportFieldKey | null) =>
        setMapping((current) => current.map((value, i) => (i === column ? key : key && value === key ? null : value)));

    const runValidation = async () => {
        setError('');
        setBusy(true);
        try {
            setValidation(await validateStudentImport(buildRows()));
            setFilter('all');
            setStep('preview');
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const overCapacity =
        validation && validation.capacity.remaining !== null && validation.counts.valid > validation.capacity.remaining;

    const openUpgrade = async () => {
        if (!validation || validation.capacity.limit === null) return;
        const upgraded = await askForUpgrade({
            limit: validation.capacity.limit,
            current: validation.capacity.current,
            adding: validation.counts.valid,
            packName: validation.capacity.packName,
        });
        if (upgraded) await runValidation();
    };

    const runCommit = async () => {
        setError('');
        setBusy(true);
        try {
            setResult(await commitStudentImport(buildRows(), createGroups));
            setStep('done');
        } catch (err) {
            const details = studentLimitDetails(err);
            if (details) {
                setBusy(false);
                if (await askForUpgrade(details)) return runCommit();
                setError(studentLimitMessage(details));
                return;
            }
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const restart = () => {
        setStep('file');
        setSheet(null);
        setValidation(null);
        setResult(null);
        setCreateGroups(false);
        setError('');
    };

    const cellsOf = (rowNumber: number) => sheet?.rows.find((row) => row.rowNumber === rowNumber)?.cells ?? [];
    const nameOf = (rowNumber: number) => {
        const row = validation?.rows.find((item) => item.rowNumber === rowNumber);
        return row ? `${row.data.surname} ${row.data.name}`.trim() || '—' : '—';
    };

    return (
        <div className="mx-auto max-w-6xl space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importer des élèves depuis Excel</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Ajoutez toute votre liste d’élèves en une fois, sans les saisir un par un.
                </p>
            </div>

            <ol className="flex flex-wrap gap-2 text-xs font-semibold">
                {(['file', 'mapping', 'preview', 'done'] as Step[]).map((item, index) => (
                    <li
                        key={item}
                        className={`rounded-full px-3 py-1 ${
                            step === item ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                    >
                        {index + 1}. {['Fichier', 'Colonnes', 'Vérification', 'Résultat'][index]}
                    </li>
                ))}
            </ol>

            {error && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                    {error}
                </div>
            )}

            {step === 'file' && (
                <div className={`${card} space-y-5`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold text-gray-900 dark:text-white">1. Préparez votre fichier</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Utilisez votre fichier actuel ou notre modèle. Une ligne par élève, les en-têtes sur la première ligne.
                            </p>
                        </div>
                        <button type="button" className={secondaryBtn} onClick={() => downloadTemplate(fields)}>
                            <Download className="h-4 w-4" /> Télécharger le modèle
                        </button>
                    </div>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-indigo-400 dark:border-gray-600">
                        <Upload className="h-8 w-8 text-indigo-500" />
                        <span className="font-semibold text-gray-800 dark:text-gray-100">{busy ? 'Lecture…' : 'Choisir un fichier Excel ou CSV'}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">.xlsx, .xls ou .csv · {MAX_ROWS} élèves maximum par import</span>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="sr-only"
                            disabled={busy}
                            onChange={(event) => {
                                onFile(event.target.files?.[0]);
                                event.target.value = '';
                            }}
                        />
                    </label>
                </div>
            )}

            {step === 'mapping' && sheet && (
                <div className={`${card} space-y-4`}>
                    <div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">2. Associez les colonnes</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            <FileSpreadsheet className="me-1 inline h-4 w-4" />
                            {fileName} · {sheet.rows.length} ligne{sheet.rows.length > 1 ? 's' : ''}. Vérifiez à quel champ correspond chaque colonne.
                        </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {sheet.headers.map((header, column) => (
                            <div key={column} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white" title={header}>
                                    {header || `Colonne ${column + 1}`}
                                </p>
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                    ex. : {sheet.rows.slice(0, 3).map((row) => row.cells[column]).filter(Boolean).join(' · ') || '—'}
                                </p>
                                <select
                                    value={mapping[column] ?? ''}
                                    onChange={(event) => setColumn(column, (event.target.value || null) as ImportFieldKey | null)}
                                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    aria-label={`Champ pour la colonne ${header || column + 1}`}
                                >
                                    <option value="">Ignorer cette colonne</option>
                                    {fields.map((field) => (
                                        <option key={field.key} value={field.key}>
                                            {field.label} — {field.hint}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                    {!namesMapped && (
                        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                            Associez « Nom » et « Prénom », ou « Nom complet », pour continuer.
                        </p>
                    )}
                    <div className="flex flex-wrap justify-between gap-2">
                        <button type="button" className={secondaryBtn} onClick={restart}>
                            Changer de fichier
                        </button>
                        <button type="button" className={primaryBtn} disabled={!namesMapped || busy} onClick={runValidation}>
                            {busy ? 'Vérification…' : 'Vérifier les lignes'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'preview' && validation && (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {(['valid', 'duplicate', 'error'] as const).map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setFilter(filter === status ? 'all' : status)}
                                aria-pressed={filter === status}
                                className={`rounded-xl p-3 text-start ${STATUS_STYLE[status]} ${filter === status ? 'ring-2 ring-indigo-500' : ''}`}
                            >
                                <span className="block text-2xl font-extrabold">{validation.counts[status]}</span>
                                <span className="text-xs font-semibold">{STATUS_LABEL[status]}{status !== 'valid' ? ' · ignoré' : ''}</span>
                            </button>
                        ))}
                    </div>

                    {overCapacity && (
                        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                {studentLimitMessage({
                                    limit: validation.capacity.limit!,
                                    current: validation.capacity.current,
                                    adding: validation.counts.valid,
                                    packName: validation.capacity.packName,
                                })}{' '}
                                Retirez des lignes du fichier ou passez à un pack supérieur.
                            </span>
                            <button type="button" className={primaryBtn} onClick={openUpgrade}>
                                Voir les packs
                            </button>
                        </div>
                    )}

                    {validation.missingGroups.length > 0 && (
                        <div className={`${card} space-y-2`}>
                            <p className="text-sm text-gray-800 dark:text-gray-100">
                                Ces groupes n’existent pas encore : <strong>{validation.missingGroups.join(', ')}</strong>
                            </p>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                <input type="checkbox" checked={createGroups} onChange={(event) => setCreateGroups(event.target.checked)} className="h-4 w-4" />
                                Créer ces groupes automatiquement
                            </label>
                            {!createGroups && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">Sinon, ces élèves seront créés sans groupe.</p>
                            )}
                        </div>
                    )}

                    <div className={`${card} p-0 sm:p-0`}>
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                            {validation.rows
                                .filter((row) => filter === 'all' || row.status === filter)
                                .map((row) => (
                                    <li key={row.rowNumber} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:gap-4">
                                        <span className="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400">Ligne {row.rowNumber}</span>
                                        <span className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status]}`}>
                                            {STATUS_LABEL[row.status]}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {nameOf(row.rowNumber)}
                                                {row.group && <span className="ms-2 text-xs text-gray-500 dark:text-gray-400">· {row.group}</span>}
                                            </p>
                                            {row.errors.map((message) => (
                                                <p key={message} className="text-xs text-red-600 dark:text-red-300">{message}</p>
                                            ))}
                                            {row.warnings.map((message) => (
                                                <p key={message} className="text-xs text-amber-700 dark:text-amber-300">{message}</p>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                        </ul>
                    </div>

                    <div className="flex flex-wrap justify-between gap-2">
                        <button type="button" className={secondaryBtn} onClick={() => setStep('mapping')}>
                            Modifier les colonnes
                        </button>
                        <button
                            type="button"
                            className={primaryBtn}
                            disabled={busy || validation.counts.valid === 0 || !!overCapacity}
                            onClick={runCommit}
                        >
                            {busy ? 'Import en cours…' : `Importer ${validation.counts.valid} élève${validation.counts.valid > 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            )}

            {step === 'done' && result && sheet && (
                <div className={`${card} space-y-4`}>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" /> Import terminé
                    </div>
                    <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-100">
                        <li><CheckCircle2 className="me-1 inline h-4 w-4 text-emerald-500" />{result.counts.created} élève(s) créé(s)</li>
                        <li><AlertTriangle className="me-1 inline h-4 w-4 text-amber-500" />{result.counts.duplicate} doublon(s) ignoré(s)</li>
                        <li><XCircle className="me-1 inline h-4 w-4 text-red-500" />{result.counts.error} ligne(s) en erreur</li>
                        {result.createdGroups.length > 0 && <li>Groupes créés : {result.createdGroups.join(', ')}</li>}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                        {result.counts.error > 0 && (
                            <button
                                type="button"
                                className={secondaryBtn}
                                onClick={() =>
                                    downloadErrorRows(
                                        sheet.headers,
                                        result.rows.filter((row) => row.status === 'error').map((row) => ({ cells: cellsOf(row.rowNumber), errors: row.errors }))
                                    )
                                }
                            >
                                <Download className="h-4 w-4" /> Télécharger les lignes en erreur
                            </button>
                        )}
                        <button type="button" className={secondaryBtn} onClick={restart}>
                            Importer un autre fichier
                        </button>
                        <Link href={studentsPath} className={primaryBtn}>
                            Voir les élèves
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Type-check, then commit**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

```bash
git add frontend/components/import
git commit -m "feat(education): student import wizard"
```

---

### Task 8: Pages and navigation

**Files:**
- Create: `frontend/app/admin/inscriptions/import/page.tsx`
- Create: `frontend/app/secretary/inscriptions/import/page.tsx`
- Modify: `frontend/components/Sidebar.tsx` (near lines 75 and 195)
- Modify: `frontend/app/admin/inscriptions/page.tsx`, `frontend/app/secretary/inscriptions/page.tsx`

- [ ] **Step 1: The pages**

```tsx
// frontend/app/admin/inscriptions/import/page.tsx
'use client';

import StudentImportWizard from '@/components/import/StudentImportWizard';

export default function AdminStudentImportPage() {
    return <StudentImportWizard studentsPath="/admin/students" />;
}
```

```tsx
// frontend/app/secretary/inscriptions/import/page.tsx
'use client';

import StudentImportWizard from '@/components/import/StudentImportWizard';

export default function SecretaryStudentImportPage() {
    return <StudentImportWizard studentsPath="/secretary/students" />;
}
```

Check that `/secretary/students` exists (`app/secretary/students`). It does, per the directory listing.

- [ ] **Step 2: Sidebar entries**

In `frontend/components/Sidebar.tsx`, after `{ label: 'Inscriptions', path: '/admin/inscriptions' },` add:

```tsx
        { label: 'Import Excel', path: '/admin/inscriptions/import' },
```

After `{ label: 'Inscriptions', path: '/secretary/inscriptions' },` add:

```tsx
        { label: 'Import Excel', path: '/secretary/inscriptions/import' },
```

If the sidebar has a separate menu for crèches (search the file for `CRECHE` and for another `/admin/inscriptions` entry), add the same admin entry there too.

Then check the active-item logic. If it uses `startsWith`, "Inscriptions" may also highlight on the import page. That is acceptable, so leave it.

- [ ] **Step 3: A link on the inscription pages**

Replace `frontend/app/admin/inscriptions/page.tsx` with:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import SoutienInscriptionForm from '@/components/forms/SoutienInscriptionForm';
import AddStudentForm from '@/components/forms/AddStudentForm';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';

const ImportLink = () => (
    <div className="mb-4 flex justify-end">
        <Link
            href="/admin/inscriptions/import"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
        >
            <FileSpreadsheet className="h-4 w-4" /> Importer une liste Excel
        </Link>
    </div>
);

export default function RegisterStudentPage() {
    const router = useRouter();
    const { profile, loading } = useSchoolProfile();

    if (!loading && profile.institutionType === 'CRECHE') {
        return (
            <>
                <ImportLink />
                <AddStudentForm onSuccess={() => router.push('/admin/students')} />
            </>
        );
    }

    return (
        <>
            <ImportLink />
            <SoutienInscriptionForm onSuccessRedirect="/admin/students" />
        </>
    );
}
```

Replace `frontend/app/secretary/inscriptions/page.tsx` with:

```tsx
'use client';

import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import SoutienInscriptionForm from '@/components/forms/SoutienInscriptionForm';

export default function SecretaryInscriptionsPage() {
    return (
        <>
            <div className="mb-4 flex justify-end">
                <Link
                    href="/secretary/inscriptions/import"
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
                >
                    <FileSpreadsheet className="h-4 w-4" /> Importer une liste Excel
                </Link>
            </div>
            <SoutienInscriptionForm onSuccessRedirect="/secretary" />
        </>
    );
}
```

- [ ] **Step 4: Type-check, then commit**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

```bash
git add frontend/app/admin/inscriptions frontend/app/secretary/inscriptions frontend/components/Sidebar.tsx
git commit -m "feat(education): import page and links for admin and secretary"
```

---

### Task 9: Verification

- [ ] **Step 1: Backend**

Run, in `apps/education-apps`: `npx tsc --noEmit && npx jest`

Expected: all suites pass.

- [ ] **Step 2: Frontend**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

**Do not run `npm run build` while the dev server on port 3011 is running.** It overwrites `.next` and breaks the dev server. Run the build only with the dev server stopped, and then delete `.next` before restarting `next dev -p 3011`.

- [ ] **Step 3: A realistic test file**

Write a scratchpad script that uses SheetJS (`node -e` with `require('xlsx')` run from `frontend/`) to produce `import-test.xlsx` with 20 rows. The file must contain:
- headers in a school's own wording: `Nom et Prénom`, `Date naissance`, `Classe`, `Tél parent`, `Code Massar`;
- 15 valid rows across 2 classes, one of which does not exist yet;
- 2 duplicates within the file (the same Massar code);
- 1 row with an empty name;
- 1 invalid date (`31/02/2015`);
- 1 French phone number (+33…).

- [ ] **Step 4: Manual check on localhost:3011**

1. Log in as the test school's admin and open Inscriptions. Click "Importer une liste Excel".
2. Download the template and check that it opens with French headers and Arabic hints.
3. Upload `import-test.xlsx`. The columns should be mapped automatically, with `Nom et Prénom` mapped to "Nom complet".
4. Click "Vérifier". You should see 16 valid rows (one of them with a phone warning), 2 duplicates (the second Massar row; the first is valid), 2 errors, and the missing group listed.
5. Check "Créer ces groupes", then import. The report should match the counts. Download the error rows and check that they contain the "Erreur" column.
6. Upload the same file again. Every row should now be a duplicate or an error, and nothing is created.
7. Pack limit: set the test pack's `maxStudents` just above the current count. The red banner and "Voir les packs" should appear, and the dialog should open. After an upgrade, the preview re-validates and the import button is enabled. Afterwards, restore the pack.
8. Check at phone width (375px) and in dark mode.
9. Delete the test students: by hand, or with a scratchpad script that deletes the branch's students created today with `accessTokenHash` set by the import. Also delete the created group. Tell the user what was deleted.
