# Complete private school — professional inscription (phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `PRIVATE_SCHOOL` declares its cycles (préscolaire → lycée). It then sets fees per level, registers students with a complete Moroccan school file, prints that file, and follows unpaid monthly tuition.

**Architecture:**
- A fixed level catalog, mirrored in the backend (`src/modules/school-mode/levels.ts`) and the frontend (`lib/schoolLevels.ts`).
- New backend module `school-mode`: tuition fee grid, a one-transaction professional inscription, and monthly dues computed from `Payment.forMonth`.
- The new mode is on when `Settings.schoolCycles` is non-empty. Everything else keeps its current behaviour.

**Tech Stack:** Express + Prisma (MongoDB) + Jest/supertest (backend, `apps/education-apps`), Next.js 14 + Tailwind + the `tr()` i18n (frontend, `apps/education-apps/frontend`), Playwright for the final browser check.

**Spec:** `docs/superpowers/specs/2026-11-24-education-private-school-inscription-design.md`

---

## Conventions every task follows

- **Paths:**
  - Backend paths are relative to `apps/education-apps/`.
  - Frontend paths are relative to `apps/education-apps/frontend/`.
  - Run backend commands from `apps/education-apps`, frontend type-checks from `apps/education-apps/frontend`.
- **Tests:**
  - Backend tests mock prisma like the existing ones: `jest.mock('../../config/database', () => ({ __esModule: true, default: { … } }))`.
  - Route tests mock `../../utils/jwt` so the bearer token *is* the role (see `src/modules/platform/platform.routes.test.ts`).
- **UI text:** every user-facing string is French and wrapped in `tr('…')` (from `useI18n()` in `@/lib/i18n/I18nProvider`). Its Arabic goes in `lib/i18n/ar/school-mode.ts` (Task 17).
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Type-check after each frontend task:** `npx tsc --noEmit -p .`, expected: no output.

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `SCOLARITE`, `Settings.schoolCycles/schoolYear`, `TuitionFee`, new `Student` fields |
| `src/modules/school-mode/levels.ts` (+ test) | Catalog: cycles, codes, labels, helpers, level text → code |
| `src/modules/school-mode/schoolYear.ts` (+ test) | Current school year, start month, months due |
| `src/modules/school-mode/tuitionFees.service.ts` (+ test) | Read / upsert the fee grid |
| `src/modules/school-mode/inscription.service.ts` (+ test) | Validate + create student, parent link, inscription, payments, transport |
| `src/modules/school-mode/dues.service.ts` (+ test) | Monthly dues list, collect a month |
| `src/modules/school-mode/schoolMode.controller.ts`, `schoolMode.routes.ts` (+ routes test) | HTTP layer |
| `src/modules/settings/*` | Accept and validate `schoolCycles`, `schoolYear` |
| `src/modules/students/students.controller.ts` | Update accepts the new fields |
| `src/modules/students-import/normalize.ts` (+ fields) | Level text → code, Arabic names, sex |
| `frontend/lib/schoolLevels.ts` | Frontend mirror of the catalog |
| `frontend/lib/services/schoolMode.ts` | API calls |
| `frontend/hooks/useSchoolCycles.ts` | Branch cycles + school year from settings |
| `frontend/components/settings/SchoolCyclesCard.tsx` | Cycles + school year editor |
| `frontend/components/school-mode/TuitionFeesTable.tsx` | Fee grid on the Prix page |
| `frontend/components/school-mode/SchoolInscriptionForm.tsx` | The 5-step form |
| `frontend/app/admin/students/[id]/dossier/page.tsx` | Printable inscription file |
| `frontend/components/school-mode/StudentSchoolInfo.tsx` | New fields on the student file (view + edit) |
| `frontend/app/admin/finance/mensualites/page.tsx` | Monthly dues page (+ secretary re-export) |
| `frontend/lib/i18n/ar/school-mode.ts` | Arabic texts |

---

### Task 1: Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the enum value, settings fields, tuition model and student fields**

In `enum InscriptionType`, add `SCOLARITE`:

```prisma
enum InscriptionType {
  SOUTIEN
  FORMATION
  SCOLARITE
}
```

In `model Settings`, after `gradingPeriods String[]`:

```prisma
  // Complete private school mode: cycles run by this branch (PRESCOLAIRE | PRIMAIRE | COLLEGE | LYCEE).
  // Empty = classic mode (tutoring form, subject prices).
  schoolCycles String[]
  schoolYear   String? // "2026/2027"; null = computed (September to August)
```

In `model Branch`, next to `pricing Pricing[]`:

```prisma
  tuitionFees             TuitionFee[]
```

At the end of the file:

```prisma
// Fees per level of a complete private school (inscription, monthly, annual insurance).
model TuitionFee {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  branchId       String   @db.ObjectId
  branch         Branch   @relation(fields: [branchId], references: [id])
  level          String // catalog code, e.g. "P3" (src/modules/school-mode/levels.ts)
  inscriptionFee Float    @default(0)
  monthlyFee     Float    @default(0)
  insuranceFee   Float    @default(0)
  updatedAt      DateTime @updatedAt

  @@unique([branchId, level])
  @@map("tuition_fees")
}
```

In `model Student`, after `massarNumber String?`:

```prisma
  // Complete private school file (all optional; set by the professional inscription)
  nameAr          String?
  surnameAr       String?
  gender          String? // M | F
  nationality     String?
  schoolYear      String? // "2026/2027" of the current inscription
  enrollmentKind  String? // NEW | RETURNING
  fatherCin       String?
  fatherPhone     String?
  fatherJob       String?
  motherCin       String?
  motherPhone     String?
  motherJob       String?
  payer           String? // FATHER | MOTHER | GUARDIAN
  emergencyName   String?
  emergencyPhone  String?
  bloodGroup      String?
  chronicDiseases String?
  medications     String?
  careConsent     Boolean?
  documents       String[]
  monthlyFee      Float? // frozen at inscription, after the sibling discount
  siblingDiscount Float? // percent applied to the monthly fee
```

- [ ] **Step 2: Validate and generate**

Run:

```bash
npx prisma format && npx prisma validate && npx prisma generate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀` and `Generated Prisma Client`.

- [ ] **Step 3: Type-check the backend**

Run: `npx tsc --noEmit -p .`

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(education): schema for the complete private school mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Level catalog (backend)

**Files:**
- Create: `src/modules/school-mode/levels.ts`
- Test: `src/modules/school-mode/levels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/school-mode/levels.test.ts
import { CYCLES, isCycle, isLevelCode, levelFromText, levelsOfCycles, levelCycle } from './levels';

describe('level catalog', () => {
    it('lists the levels of the chosen cycles in school order', () => {
        expect(levelsOfCycles(['PRIMAIRE', 'PRESCOLAIRE'])).toEqual(['PS1', 'PS2', 'PS3', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
        expect(levelsOfCycles([])).toEqual([]);
    });

    it('knows cycles and codes', () => {
        expect(CYCLES).toEqual(['PRESCOLAIRE', 'PRIMAIRE', 'COLLEGE', 'LYCEE']);
        expect(isCycle('COLLEGE')).toBe(true);
        expect(isCycle('CRECHE')).toBe(false);
        expect(isLevelCode('B2')).toBe(true);
        expect(isLevelCode('3AP')).toBe(false);
        expect(levelCycle('PS2')).toBe('PRESCOLAIRE');
    });

    it('reads the usual ways schools write a level', () => {
        expect(levelFromText('3AP')).toBe('P3');
        expect(levelFromText('3ème année primaire')).toBe('P3');
        expect(levelFromText('السنة الثالثة ابتدائي')).toBe('P3');
        expect(levelFromText('السنة الثانية روض')).toBe('PS2');
        expect(levelFromText('2ème année préscolaire')).toBe('PS2');
        expect(levelFromText('1AC')).toBe('C1');
        expect(levelFromText('Tronc commun')).toBe('TC');
        expect(levelFromText('2 Bac')).toBe('B2');
        expect(levelFromText('P5')).toBe('P5');
        expect(levelFromText('Collège')).toBeNull(); // a cycle, not a level
    });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx jest src/modules/school-mode/levels.test.ts`

Expected: FAIL with `Cannot find module './levels'`.

- [ ] **Step 3: Implement**

```ts
// src/modules/school-mode/levels.ts
// Moroccan private school levels. Keep in sync with frontend/lib/schoolLevels.ts.
export const CYCLES = ['PRESCOLAIRE', 'PRIMAIRE', 'COLLEGE', 'LYCEE'] as const;
export type Cycle = (typeof CYCLES)[number];

export const LEVELS_BY_CYCLE: Record<Cycle, string[]> = {
    PRESCOLAIRE: ['PS1', 'PS2', 'PS3'],
    PRIMAIRE: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    COLLEGE: ['C1', 'C2', 'C3'],
    LYCEE: ['TC', 'B1', 'B2'],
};

export const LEVEL_CODES = CYCLES.flatMap((cycle) => LEVELS_BY_CYCLE[cycle]);

export const isCycle = (value: unknown): value is Cycle => typeof value === 'string' && (CYCLES as readonly string[]).includes(value);
export const isLevelCode = (value: unknown): value is string => typeof value === 'string' && LEVEL_CODES.includes(value);
export const levelCycle = (code: string): Cycle | null => CYCLES.find((cycle) => LEVELS_BY_CYCLE[cycle].includes(code)) ?? null;
export const isPrescolaire = (code: string | null | undefined) => !!code && LEVELS_BY_CYCLE.PRESCOLAIRE.includes(code);

/** Levels of the given cycles, in school order. */
export const levelsOfCycles = (cycles: readonly string[]): string[] => CYCLES.filter((c) => cycles.includes(c)).flatMap((c) => LEVELS_BY_CYCLE[c]);

const fold = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[إأآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

const ORDINALS: [RegExp, number][] = [
    [/\b(1|1er|1ere|premiere)\b|الاولى|الاول/, 1],
    [/\b(2|2e|2eme|deuxieme)\b|الثانية|الثاني/, 2],
    [/\b(3|3e|3eme|troisieme)\b|الثالثة|الثالث/, 3],
    [/\b(4|4e|4eme|quatrieme)\b|الرابعة|الرابع/, 4],
    [/\b(5|5e|5eme|cinquieme)\b|الخامسة|الخامس/, 5],
    [/\b(6|6e|6eme|sixieme)\b|السادسة|السادس/, 6],
];

/** Level code from what a school writes ("3AP", "السنة الثالثة ابتدائي", "2ème année préscolaire"…); null when unknown. */
export function levelFromText(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const upper = raw.trim().toUpperCase();
    if (isLevelCode(upper)) return upper;
    const compact = upper.replace(/\s+/g, '');
    const short = compact.match(/^([1-6])(AP|AC)$/);
    if (short) return short[2] === 'AP' ? `P${short[1]}` : Number(short[1]) <= 3 ? `C${short[1]}` : null;
    const text = fold(raw);
    if (/tronc|جذع/.test(text) || /^tc$/.test(text)) return 'TC';
    const bac = text.match(/\b([12])\s*(ere|eme|e)?\s*(annee)?\s*bac\b|bac\s*([12])\b/);
    if (bac) return `B${bac[1] ?? bac[4]}`;
    if (/الاولى باك/.test(text)) return 'B1';
    if (/الثانية باك/.test(text)) return 'B2';
    const n = ORDINALS.find(([rx]) => rx.test(text))?.[1];
    if (!n) return null;
    if (/prescolaire|maternelle|روض|اولي/.test(text)) return n <= 3 ? `PS${n}` : null;
    if (/primaire|ابتدائي/.test(text)) return `P${n}`;
    if (/college|اعدادي/.test(text)) return n <= 3 ? `C${n}` : null;
    return null;
}
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `npx jest src/modules/school-mode/levels.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/school-mode/levels.ts src/modules/school-mode/levels.test.ts
git commit -m "feat(education): Moroccan level catalog for private schools

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: School year helpers

**Files:**
- Create: `src/modules/school-mode/schoolYear.ts`
- Test: `src/modules/school-mode/schoolYear.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/school-mode/schoolYear.test.ts
import { currentSchoolYear, isDueMonth, isSchoolYear, startMonthFor } from './schoolYear';

describe('school year', () => {
    it('runs September to August', () => {
        expect(currentSchoolYear(new Date('2026-11-24T10:00:00Z'))).toBe('2026/2027');
        expect(currentSchoolYear(new Date('2027-03-01T10:00:00Z'))).toBe('2026/2027');
        expect(currentSchoolYear(new Date('2027-08-31T10:00:00Z'))).toBe('2026/2027');
        expect(currentSchoolYear(new Date('2027-09-01T10:00:00Z'))).toBe('2027/2028');
    });

    it('validates the "YYYY/YYYY+1" format', () => {
        expect(isSchoolYear('2026/2027')).toBe(true);
        expect(isSchoolYear('2026/2028')).toBe(false);
        expect(isSchoolYear('2026-2027')).toBe(false);
    });

    it('bills September to June only', () => {
        expect(isDueMonth('2026-09')).toBe(true);
        expect(isDueMonth('2027-06')).toBe(true);
        expect(isDueMonth('2027-07')).toBe(false);
        expect(isDueMonth('2027-08')).toBe(false);
    });

    it('starts the first month now, or in September when registering in summer', () => {
        expect(startMonthFor(new Date('2026-11-24T10:00:00Z'))).toBe('2026-11');
        expect(startMonthFor(new Date('2027-07-10T10:00:00Z'))).toBe('2027-09');
        expect(startMonthFor(new Date('2027-08-25T10:00:00Z'))).toBe('2027-09');
    });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx jest src/modules/school-mode/schoolYear.test.ts`

Expected: FAIL, the module is missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/school-mode/schoolYear.ts
// A Moroccan school year runs from September to August; tuition is due September to June.
const ym = (year: number, month1: number) => `${year}-${String(month1).padStart(2, '0')}`;

export const currentSchoolYear = (now = new Date()): string => {
    const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1; // getMonth: 8 = September
    return `${start}/${start + 1}`;
};

export const isSchoolYear = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const m = value.match(/^(\d{4})\/(\d{4})$/);
    return !!m && Number(m[2]) === Number(m[1]) + 1;
};

export const isMonthKey = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** July and August are holidays: no tuition. */
export const isDueMonth = (month: string): boolean => !['07', '08'].includes(month.slice(5, 7));

/** Month of the first tuition fee for an inscription made on `now`. */
export const startMonthFor = (now = new Date()): string => {
    const month = now.getMonth() + 1;
    if (month === 7 || month === 8) return ym(now.getFullYear(), 9);
    return ym(now.getFullYear(), month);
};
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `npx jest src/modules/school-mode/schoolYear.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/school-mode/schoolYear.ts src/modules/school-mode/schoolYear.test.ts
git commit -m "feat(education): school year helpers (September to June dues)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Settings accept cycles and school year

**Files:**
- Modify: `src/modules/settings/settings.service.ts` (add `validateSchoolCycles`; extend `UpdateSettingsData`)
- Modify: `src/modules/settings/settings.controller.ts:15-55`
- Test: `src/modules/settings/settings.service.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/modules/settings/settings.service.test.ts`:

```ts
import { validateSchoolCycles } from './settings.service';

describe('validateSchoolCycles', () => {
    it('keeps known cycles in school order, once', () => {
        expect(validateSchoolCycles(['PRIMAIRE', 'PRESCOLAIRE', 'PRIMAIRE'], 'PRIVATE_SCHOOL')).toEqual(['PRESCOLAIRE', 'PRIMAIRE']);
        expect(validateSchoolCycles([], 'PRIVATE_SCHOOL')).toEqual([]);
    });

    it('refuses unknown cycles and other institution types', () => {
        expect(() => validateSchoolCycles(['CRECHE'], 'PRIVATE_SCHOOL')).toThrow('schoolCycles');
        expect(() => validateSchoolCycles('PRIMAIRE', 'PRIVATE_SCHOOL')).toThrow('schoolCycles');
        expect(() => validateSchoolCycles(['PRIMAIRE'], 'TUTORING_CENTER')).toThrow('private school');
        expect(validateSchoolCycles(['PRIMAIRE'], null)).toEqual(['PRIMAIRE']); // null type = private school
    });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx jest src/modules/settings/settings.service.test.ts -t validateSchoolCycles`

Expected: FAIL, `validateSchoolCycles is not a function`.

- [ ] **Step 3: Implement**

In `src/modules/settings/settings.service.ts`:

1. Add at the top: `import { CYCLES, isCycle } from '../school-mode/levels';`.
2. Add `schoolCycles?: string[]; schoolYear?: string | null;` to `UpdateSettingsData`.
3. Add:

```ts
// The complete private school mode exists for private schools only (null type = private school).
export const validateSchoolCycles = (value: unknown, institutionType: string | null | undefined): string[] => {
    if (!Array.isArray(value) || !value.every(isCycle)) {
        throw new Error('schoolCycles must be a list of PRESCOLAIRE, PRIMAIRE, COLLEGE, LYCEE');
    }
    if (value.length > 0 && institutionType && institutionType !== 'PRIVATE_SCHOOL') {
        throw new Error('School cycles are only for a private school');
    }
    return CYCLES.filter((cycle) => value.includes(cycle));
};
```

In `src/modules/settings/settings.controller.ts`:

1. Add the imports: `import { isSchoolYear } from '../school-mode/schoolYear';`, `import prisma from '../../config/database';` and `validateSchoolCycles`.
2. Read `schoolCycles, schoolYear` from `req.body`.
3. Before `const updateData`, add:

```ts
        let cycles: string[] | undefined;
        if (schoolCycles !== undefined) {
            const branch = await prisma.branch.findUnique({ where: { id: req.branchId! }, select: { school: { select: { institutionType: true } } } });
            try {
                cycles = validateSchoolCycles(schoolCycles, branch?.school.institutionType ?? null);
            } catch (e: any) {
                sendError(res, e.message, 'Validation error', 400);
                return;
            }
        }
        if (schoolYear !== undefined && schoolYear !== null && !isSchoolYear(schoolYear)) {
            sendError(res, 'schoolYear must look like 2026/2027', 'Validation error', 400);
            return;
        }
```

4. After the existing `updateData` assignments, add:

```ts
        if (cycles !== undefined) updateData.schoolCycles = cycles;
        if (schoolYear !== undefined) updateData.schoolYear = schoolYear;
```

- [ ] **Step 4: Run the settings tests and check that they pass**

Run: `npx jest src/modules/settings`

Expected: PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/modules/settings
git commit -m "feat(education): settings store the school cycles and school year

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tuition fee grid service

**Files:**
- Create: `src/modules/school-mode/tuitionFees.service.ts`
- Test: `src/modules/school-mode/tuitionFees.service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/school-mode/tuitionFees.service.test.ts
import prisma from '../../config/database';
import { getTuitionGrid, saveTuitionGrid } from './tuitionFees.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        settings: { findUnique: jest.fn() },
        tuitionFee: { findMany: jest.fn(), upsert: jest.fn() },
    },
}));
const db = prisma as any;

beforeEach(() => {
    jest.clearAllMocks();
    db.settings.findUnique.mockResolvedValue({ schoolCycles: ['PRESCOLAIRE'] });
});

describe('getTuitionGrid', () => {
    it('returns one row per level of the cycles, zero when not set', async () => {
        db.tuitionFee.findMany.mockResolvedValue([{ level: 'PS2', inscriptionFee: 500, monthlyFee: 600, insuranceFee: 150 }]);
        expect(await getTuitionGrid('b1')).toEqual([
            { level: 'PS1', inscriptionFee: 0, monthlyFee: 0, insuranceFee: 0 },
            { level: 'PS2', inscriptionFee: 500, monthlyFee: 600, insuranceFee: 150 },
            { level: 'PS3', inscriptionFee: 0, monthlyFee: 0, insuranceFee: 0 },
        ]);
    });
});

describe('saveTuitionGrid', () => {
    it('upserts each row of the branch', async () => {
        db.tuitionFee.findMany.mockResolvedValue([]);
        await saveTuitionGrid('b1', [{ level: 'PS1', inscriptionFee: 400, monthlyFee: '550', insuranceFee: 0 }]);
        expect(db.tuitionFee.upsert).toHaveBeenCalledWith({
            where: { branchId_level: { branchId: 'b1', level: 'PS1' } },
            create: { branchId: 'b1', level: 'PS1', inscriptionFee: 400, monthlyFee: 550, insuranceFee: 0 },
            update: { inscriptionFee: 400, monthlyFee: 550, insuranceFee: 0 },
        });
    });

    it('refuses levels outside the cycles and negative amounts', async () => {
        await expect(saveTuitionGrid('b1', [{ level: 'P1', inscriptionFee: 1, monthlyFee: 1, insuranceFee: 1 }])).rejects.toThrow('P1');
        await expect(saveTuitionGrid('b1', [{ level: 'PS1', inscriptionFee: -1, monthlyFee: 1, insuranceFee: 1 }])).rejects.toThrow('amount');
        await expect(saveTuitionGrid('b1', 'nope' as any)).rejects.toThrow('items');
        expect(db.tuitionFee.upsert).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx jest src/modules/school-mode/tuitionFees.service.test.ts`

Expected: FAIL, the module is missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/school-mode/tuitionFees.service.ts
import prisma from '../../config/database';
import { levelsOfCycles } from './levels';

export interface TuitionRow {
    level: string;
    inscriptionFee: number;
    monthlyFee: number;
    insuranceFee: number;
}

export const branchCycles = async (branchId: string): Promise<string[]> =>
    (await prisma.settings.findUnique({ where: { branchId }, select: { schoolCycles: true } }))?.schoolCycles ?? [];

const amount = (value: unknown): number => {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : typeof value === 'number' ? value : value == null ? 0 : NaN;
    if (!Number.isFinite(n) || n < 0) throw new Error('Each amount must be a positive number');
    return Math.round(n * 100) / 100;
};

/** One row per level of the branch's cycles; levels without fees show 0. */
export const getTuitionGrid = async (branchId: string): Promise<TuitionRow[]> => {
    const levels = levelsOfCycles(await branchCycles(branchId));
    const saved = await prisma.tuitionFee.findMany({ where: { branchId } });
    return levels.map((level) => {
        const row = saved.find((s) => s.level === level);
        return { level, inscriptionFee: row?.inscriptionFee ?? 0, monthlyFee: row?.monthlyFee ?? 0, insuranceFee: row?.insuranceFee ?? 0 };
    });
};

export const saveTuitionGrid = async (branchId: string, items: unknown): Promise<TuitionRow[]> => {
    if (!Array.isArray(items)) throw new Error('items must be a list');
    const levels = levelsOfCycles(await branchCycles(branchId));
    const rows = items.map((item: any) => {
        if (!levels.includes(item?.level)) throw new Error(`Level ${item?.level} is not one of this school's cycles`);
        return { level: item.level as string, inscriptionFee: amount(item.inscriptionFee), monthlyFee: amount(item.monthlyFee), insuranceFee: amount(item.insuranceFee) };
    });
    for (const { level, ...fees } of rows) {
        await prisma.tuitionFee.upsert({
            where: { branchId_level: { branchId, level } },
            create: { branchId, level, ...fees },
            update: fees,
        });
    }
    return getTuitionGrid(branchId);
};

export const feesForLevel = async (branchId: string, level: string) =>
    prisma.tuitionFee.findUnique({ where: { branchId_level: { branchId, level } } });
```

> The test for `saveTuitionGrid` calls `getTuitionGrid` at the end. The mocked `findMany` returns `[]` there, which is fine.

Add `findUnique: jest.fn()` to the `tuitionFee` mock. Later tasks use `feesForLevel`, which calls it.

- [ ] **Step 4: Run the test and check that it passes**

Run: `npx jest src/modules/school-mode/tuitionFees.service.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/school-mode/tuitionFees.service.ts src/modules/school-mode/tuitionFees.service.test.ts
git commit -m "feat(education): tuition fee grid per level

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Professional inscription service

**Files:**
- Create: `src/modules/school-mode/inscription.service.ts`
- Test: `src/modules/school-mode/inscription.service.test.ts`

The service runs these steps, in this order:

1. It validates the input.
2. It checks the capacity (`assertStudentCapacity`).
3. It refuses a duplicate Massar code.
4. It resolves the fees (the grid, then the overrides).
5. In one `$transaction`:
   - it links or creates the `Parent` by guardian phone;
   - it creates the `Student`;
   - it creates the `Inscription` (`SCOLARITE`);
   - it creates up to two `Payment`s.
6. After the transaction, it creates the income transactions (like `createPayment`) and the transport subscription. The transport service has its own checks and is not transactional.

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/school-mode/inscription.service.test.ts
import prisma from '../../config/database';
import { assertStudentCapacity } from '../packs/packs.limits';
import { createSubscription } from '../transport/subscriptions.service';
import { createTransaction } from '../transactions/transactions.service';
import { registerSchoolStudent, splitPaid } from './inscription.service';

jest.mock('../packs/packs.limits', () => ({ assertStudentCapacity: jest.fn() }));
jest.mock('../transport/subscriptions.service', () => ({ createSubscription: jest.fn() }));
jest.mock('../transactions/transactions.service', () => ({ createTransaction: jest.fn() }));
jest.mock('../packs/packFeatures', () => ({ branchHasFeature: jest.fn().mockResolvedValue(true) }));
jest.mock('../../config/database', () => {
    const tx = {
        parent: { findFirst: jest.fn(), create: jest.fn() },
        student: { create: jest.fn() },
        inscription: { create: jest.fn() },
        payment: { create: jest.fn() },
    };
    return {
        __esModule: true,
        default: {
            settings: { findUnique: jest.fn() },
            tuitionFee: { findUnique: jest.fn() },
            student: { findFirst: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});
const db = prisma as any;
const tx = db.__tx;
const NOW = new Date('2026-11-24T10:00:00Z');

const base = {
    name: 'Lina', surname: 'Sqalli', nameAr: 'لينا', surnameAr: 'الصقلي', gender: 'F', birthDate: '2021-04-02',
    level: 'PS2', parentName: 'Mohamed Sqalli', parentRelation: 'Père', parentPhone: '06 12 34 56 78',
    amountPaid: 1250, method: 'CASH',
};

beforeEach(() => {
    jest.clearAllMocks();
    db.settings.findUnique.mockResolvedValue({ schoolCycles: ['PRESCOLAIRE', 'PRIMAIRE'], schoolYear: null });
    db.tuitionFee.findUnique.mockResolvedValue({ inscriptionFee: 500, monthlyFee: 600, insuranceFee: 150 });
    db.student.findFirst.mockResolvedValue(null);
    tx.parent.findFirst.mockResolvedValue(null);
    tx.parent.create.mockResolvedValue({ id: 'par1' });
    tx.student.create.mockImplementation(({ data }: any) => ({ id: 'stu1', ...data }));
    tx.payment.create.mockImplementation(({ data }: any) => ({ id: `pay-${data.forMonth ?? 'fees'}`, ...data }));
});

describe('splitPaid', () => {
    it('pays the fees first, then the first month, and refuses more', () => {
        expect(splitPaid(1250, 650, 600)).toEqual({ fees: 650, firstMonth: 600 });
        expect(splitPaid(400, 650, 600)).toEqual({ fees: 400, firstMonth: 0 });
        expect(splitPaid(0, 650, 600)).toEqual({ fees: 0, firstMonth: 0 });
        expect(() => splitPaid(1300, 650, 600)).toThrow('Mensualités');
    });
});

describe('registerSchoolStudent', () => {
    it('creates student, parent, a SCOLARITE inscription and the two payments', async () => {
        const result = await registerSchoolStudent('b1', base, NOW);

        expect(assertStudentCapacity).toHaveBeenCalledWith('b1', 1);
        expect(tx.parent.create.mock.calls[0][0].data).toMatchObject({ name: 'Mohamed Sqalli', phone: '0612345678', branchId: 'b1' });
        const student = tx.student.create.mock.calls[0][0].data;
        expect(student).toMatchObject({ schoolLevel: 'PS2', schoolYear: '2026/2027', monthlyFee: 600, parentId: 'par1', parentPhone: '0612345678', nameAr: 'لينا', gender: 'F' });
        expect(tx.inscription.create.mock.calls[0][0].data).toMatchObject({ type: 'SCOLARITE', category: 'PS2', amount: 1250, note: 'Inscription 2026/2027' });
        expect(tx.payment.create.mock.calls.map((c: any) => [c[0].data.amount, c[0].data.forMonth ?? null])).toEqual([[650, null], [600, '2026-11']]);
        expect(createTransaction).toHaveBeenCalledTimes(2);
        expect(result.summary).toEqual({ inscriptionFee: 500, insuranceFee: 150, monthlyFee: 600, firstDue: 1250, paid: 1250, remaining: 0, startMonth: '2026-11' });
    });

    it('applies the sibling discount to the monthly fee and freezes it', async () => {
        await registerSchoolStudent('b1', { ...base, siblingDiscount: 10, amountPaid: 0 }, NOW);
        expect(tx.student.create.mock.calls[0][0].data).toMatchObject({ monthlyFee: 540, siblingDiscount: 10 });
        expect(tx.inscription.create.mock.calls[0][0].data.amount).toBe(1190);
        expect(tx.payment.create).not.toHaveBeenCalled();
    });

    it('uses the office overrides and the existing parent', async () => {
        tx.parent.findFirst.mockResolvedValue({ id: 'parX' });
        await registerSchoolStudent('b1', { ...base, fees: { inscriptionFee: 0, monthlyFee: 700, insuranceFee: 0 }, amountPaid: 700 }, NOW);
        expect(tx.parent.create).not.toHaveBeenCalled();
        expect(tx.student.create.mock.calls[0][0].data).toMatchObject({ parentId: 'parX', monthlyFee: 700 });
        expect(tx.payment.create.mock.calls.map((c: any) => c[0].data.forMonth)).toEqual(['2026-11']);
    });

    it('subscribes to transport when asked', async () => {
        await registerSchoolStudent('b1', { ...base, transport: { routeId: 'aaaaaaaaaaaaaaaaaaaaaaaa', stopId: 'bbbbbbbbbbbbbbbbbbbbbbbb' } }, NOW);
        expect(createSubscription).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'stu1', branchId: 'b1', routeId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }));
    });

    it('refuses bad input before writing anything', async () => {
        await expect(registerSchoolStudent('b1', { ...base, name: ' ' }, NOW)).rejects.toThrow('Le prénom');
        await expect(registerSchoolStudent('b1', { ...base, level: 'C1' }, NOW)).rejects.toThrow('niveau');
        await expect(registerSchoolStudent('b1', { ...base, gender: 'X' }, NOW)).rejects.toThrow('sexe');
        await expect(registerSchoolStudent('b1', { ...base, massarNumber: '123' }, NOW)).rejects.toThrow('Massar');
        db.student.findFirst.mockResolvedValue({ name: 'Adam', surname: 'Bennani' });
        await expect(registerSchoolStudent('b1', { ...base, massarNumber: 'J130000001' }, NOW)).rejects.toThrow('Adam Bennani');
        expect(db.$transaction).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx jest src/modules/school-mode/inscription.service.test.ts`

Expected: FAIL, the module is missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/school-mode/inscription.service.ts
import prisma from '../../config/database';
import { generateRawToken, hashToken } from '../../utils/accessToken';
import { assertStudentCapacity } from '../packs/packs.limits';
import { branchHasFeature } from '../packs/packFeatures';
import { normalizePhone } from '../students-import/normalize';
import { createTransaction } from '../transactions/transactions.service';
import { createSubscription } from '../transport/subscriptions.service';
import { isLevelCode, levelsOfCycles } from './levels';
import { currentSchoolYear, startMonthFor } from './schoolYear';

const DOCUMENTS = ['BIRTH_CERT', 'PHOTOS', 'LEAVING_CERT', 'LAST_REPORT', 'PARENT_CIN', 'VACCINATION'];
const DISCOUNTS = [0, 10, 15, 20];
const METHODS = ['CASH', 'CHEQUE', 'VIREMENT', 'CARD'];

const text = (value: unknown, max = 200): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
const phone = (value: unknown): string | undefined => {
    const raw = text(value, 30);
    return raw ? normalizePhone(raw).value : undefined;
};
const money = (value: unknown): number => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n) || n < 0) throw new Error('Montant invalide');
    return Math.round(n * 100) / 100;
};

/** Amount paid at inscription: fees first (inscription + insurance), then the first month; advance months go through « Mensualités ». */
export const splitPaid = (paid: number, fees: number, firstMonth: number) => {
    if (paid > fees + firstMonth) throw new Error('Le montant dépasse les frais et le premier mois : encaissez les mois suivants depuis « Mensualités ».');
    const feesPart = Math.min(paid, fees);
    return { fees: feesPart, firstMonth: Math.round((paid - feesPart) * 100) / 100 };
};

export const registerSchoolStudent = async (branchId: string, input: Record<string, any>, now = new Date()) => {
    // ---- validation (French sentences: shown as they are by the form)
    const name = text(input.name, 80);
    const surname = text(input.surname, 80);
    if (!name || !surname) throw new Error('Le prénom et le nom sont obligatoires');
    const settings = await prisma.settings.findUnique({ where: { branchId } });
    const levels = levelsOfCycles(settings?.schoolCycles ?? []);
    if (!isLevelCode(input.level) || !levels.includes(input.level)) throw new Error('Choisissez un niveau parmi les cycles de l’établissement');
    if (input.gender !== undefined && input.gender !== null && !['M', 'F'].includes(input.gender)) throw new Error('Le sexe doit être M ou F');
    const massar = text(input.massarNumber, 20)?.toUpperCase();
    if (massar && !/^[A-Z]\d{9}$/.test(massar)) throw new Error('Code Massar invalide (une lettre suivie de 9 chiffres)');
    const discount = Number(input.siblingDiscount ?? 0);
    if (!DISCOUNTS.includes(discount)) throw new Error('Réduction fratrie invalide');
    const method = METHODS.includes(input.method) ? input.method : 'CASH';
    const parentPhone = phone(input.parentPhone);

    await assertStudentCapacity(branchId, 1);
    if (massar) {
        const other = await prisma.student.findFirst({ where: { branchId, massarNumber: massar, active: true }, select: { name: true, surname: true } });
        if (other) throw new Error(`Code Massar déjà utilisé par ${other.name} ${other.surname}`);
    }

    // ---- fees: the grid, then what the office typed
    const grid = await prisma.tuitionFee.findUnique({ where: { branchId_level: { branchId, level: input.level } } });
    const inscriptionFee = money(input.fees?.inscriptionFee ?? grid?.inscriptionFee ?? 0);
    const insuranceFee = money(input.fees?.insuranceFee ?? grid?.insuranceFee ?? 0);
    const baseMonthly = money(input.fees?.monthlyFee ?? grid?.monthlyFee ?? 0);
    const monthlyFee = Math.round(baseMonthly * (100 - discount)) / 100;
    const firstDue = inscriptionFee + insuranceFee + monthlyFee;
    const paid = money(input.amountPaid);
    const split = splitPaid(paid, inscriptionFee + insuranceFee, monthlyFee);
    const schoolYear = settings?.schoolYear || currentSchoolYear(now);
    const startMonth = startMonthFor(now);

    const created = await prisma.$transaction(async (tx) => {
        let parentId: string | undefined;
        if (parentPhone) {
            const existing = await tx.parent.findFirst({ where: { branchId, phone: parentPhone }, select: { id: true } });
            parentId =
                existing?.id ??
                (
                    await tx.parent.create({
                        data: {
                            name: text(input.parentName) || text(input.fatherName) || text(input.motherName) || `Parent de ${name} ${surname}`,
                            phone: parentPhone,
                            branchId,
                            accessTokenHash: hashToken(generateRawToken()),
                            linkIssuedAt: null,
                        },
                        select: { id: true },
                    })
                ).id;
        }

        const student = await tx.student.create({
            data: {
                branchId,
                name,
                surname,
                nameAr: text(input.nameAr, 80),
                surnameAr: text(input.surnameAr, 80),
                gender: input.gender ?? undefined,
                nationality: text(input.nationality, 60) ?? 'Marocaine',
                birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
                birthPlace: text(input.birthPlace, 80),
                address: text(input.address, 300),
                photo: typeof input.photo === 'string' && input.photo.startsWith('data:image/') ? input.photo : undefined,
                massarNumber: massar,
                schoolLevel: input.level,
                schoolYear,
                enrollmentKind: input.enrollmentKind === 'RETURNING' ? 'RETURNING' : 'NEW',
                currentSchool: text(input.previousSchool, 120),
                fatherName: text(input.fatherName, 120),
                fatherCin: text(input.fatherCin, 20)?.toUpperCase(),
                fatherPhone: phone(input.fatherPhone),
                fatherJob: text(input.fatherJob, 80),
                motherName: text(input.motherName, 120),
                motherCin: text(input.motherCin, 20)?.toUpperCase(),
                motherPhone: phone(input.motherPhone),
                motherJob: text(input.motherJob, 80),
                parentName: text(input.parentName, 120),
                parentRelation: text(input.parentRelation, 40),
                parentPhone,
                payer: ['FATHER', 'MOTHER', 'GUARDIAN'].includes(input.payer) ? input.payer : undefined,
                emergencyName: text(input.emergencyName, 120),
                emergencyPhone: phone(input.emergencyPhone),
                bloodGroup: text(input.bloodGroup, 5),
                healthNotes: text(input.allergies, 500),
                chronicDiseases: text(input.chronicDiseases, 500),
                medications: text(input.medications, 500),
                careConsent: typeof input.careConsent === 'boolean' ? input.careConsent : undefined,
                authorizedPickup: Array.isArray(input.authorizedPickup) ? input.authorizedPickup.slice(0, 10) : undefined,
                documents: Array.isArray(input.documents) ? input.documents.filter((d: string) => DOCUMENTS.includes(d)) : [],
                monthlyFee,
                siblingDiscount: discount || undefined,
                parentId,
                groupIds: typeof input.groupId === 'string' && /^[a-f0-9]{24}$/.test(input.groupId) ? [input.groupId] : [],
                accessTokenHash: hashToken(generateRawToken()),
                portalTokenHash: hashToken(generateRawToken()),
            },
        });

        await tx.inscription.create({
            data: { studentId: student.id, branchId, type: 'SCOLARITE', category: input.level, amount: firstDue, date: now, note: `Inscription ${schoolYear}` },
        });

        const payments = [];
        if (split.fees > 0) {
            payments.push(await tx.payment.create({ data: { studentId: student.id, branchId, amount: split.fees, method, date: now, note: 'Frais d’inscription et assurance' } }));
        }
        if (split.firstMonth > 0) {
            payments.push(
                await tx.payment.create({ data: { studentId: student.id, branchId, amount: split.firstMonth, method, date: now, forMonth: startMonth, note: `Mensualité ${startMonth}` } })
            );
        }
        return { student, payments };
    });

    for (const p of created.payments) {
        await createTransaction({ type: 'INCOME', amount: p.amount, category: 'Paiement Scolarité', branchId, description: `Paiement de ${name} ${surname} (${method})`, date: now });
    }
    if (input.transport?.routeId && input.transport?.stopId && (await branchHasFeature(branchId, 'TRANSPORT'))) {
        await createSubscription({ studentId: created.student.id, routeId: input.transport.routeId, stopId: input.transport.stopId, branchId, startDate: now });
    }

    return {
        student: created.student,
        summary: { inscriptionFee, insuranceFee, monthlyFee, firstDue, paid, remaining: Math.round((firstDue - paid) * 100) / 100, startMonth },
    };
};
```

> **Check while implementing:**
> - Open `src/modules/transport/subscriptions.service.ts`: if `CreateSubscriptionData` names the date field differently from `startDate`, use its name.
> - Open `src/modules/transactions/transactions.service.ts`: if `CreateTransactionData` has no `date`, drop that key.
> - Change the test's `toHaveBeenCalledWith` to match.

- [ ] **Step 4: Run the test and check that it passes**

Run: `npx jest src/modules/school-mode/inscription.service.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/school-mode/inscription.service.ts src/modules/school-mode/inscription.service.test.ts
git commit -m "feat(education): professional private school inscription service

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Monthly dues service

**Files:**
- Create: `src/modules/school-mode/dues.service.ts`
- Test: `src/modules/school-mode/dues.service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/school-mode/dues.service.test.ts
import prisma from '../../config/database';
import { createTransaction } from '../transactions/transactions.service';
import { collectMonth, listDues } from './dues.service';

jest.mock('../transactions/transactions.service', () => ({ createTransaction: jest.fn() }));
jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { student: { findMany: jest.fn(), findFirst: jest.fn() }, payment: { findMany: jest.fn(), create: jest.fn() } },
}));
const db = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('listDues', () => {
    it('gives each student paid / partial / unpaid for the month', async () => {
        db.student.findMany.mockResolvedValue([
            { id: 's1', name: 'Lina', surname: 'Sqalli', schoolLevel: 'PS2', monthlyFee: 600, parentPhone: '0612345678', groupIds: [] },
            { id: 's2', name: 'Adam', surname: 'Bennani', schoolLevel: 'P3', monthlyFee: 800, parentPhone: null, groupIds: [] },
            { id: 's3', name: 'Rim', surname: 'Tazi', schoolLevel: 'P3', monthlyFee: 800, parentPhone: null, groupIds: [] },
        ]);
        db.payment.findMany.mockResolvedValue([
            { studentId: 's1', amount: 600 },
            { studentId: 's2', amount: 300 },
        ]);
        const result = await listDues('b1', '2026-11');
        expect(db.student.findMany.mock.calls[0][0].where).toMatchObject({ branchId: 'b1', active: true, monthlyFee: { gt: 0 } });
        expect(result.rows.map((r) => [r.studentId, r.paid, r.status])).toEqual([
            ['s1', 600, 'PAID'],
            ['s2', 300, 'PARTIAL'],
            ['s3', 0, 'UNPAID'],
        ]);
        expect(result.totals).toEqual({ expected: 2200, collected: 900, remaining: 1300 });
    });

    it('has nothing due in July and August', async () => {
        expect(await listDues('b1', '2027-07')).toEqual({ month: '2027-07', rows: [], totals: { expected: 0, collected: 0, remaining: 0 } });
        expect(db.student.findMany).not.toHaveBeenCalled();
    });
});

describe('collectMonth', () => {
    it('records the payment for the month and the income', async () => {
        db.student.findFirst.mockResolvedValue({ id: 's1', name: 'Lina', surname: 'Sqalli', monthlyFee: 600 });
        db.payment.findMany.mockResolvedValue([{ amount: 200 }]);
        db.payment.create.mockImplementation(({ data }: any) => ({ id: 'p1', ...data }));
        await collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-11', amount: 400, method: 'CASH' });
        expect(db.payment.create.mock.calls[0][0].data).toMatchObject({ studentId: 's1', branchId: 'b1', amount: 400, forMonth: '2026-11', method: 'CASH' });
        expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ type: 'INCOME', amount: 400 }));
    });

    it('refuses more than what is left for the month', async () => {
        db.student.findFirst.mockResolvedValue({ id: 's1', name: 'Lina', surname: 'Sqalli', monthlyFee: 600 });
        db.payment.findMany.mockResolvedValue([{ amount: 600 }]);
        await expect(collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-11', amount: 100, method: 'CASH' })).rejects.toThrow('déjà payé');
        db.payment.findMany.mockResolvedValue([{ amount: 500 }]);
        await expect(collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-11', amount: 200, method: 'CASH' })).rejects.toThrow('100');
        await expect(collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-13', amount: 1, method: 'CASH' })).rejects.toThrow('mois');
        expect(db.payment.create).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx jest src/modules/school-mode/dues.service.test.ts`

Expected: FAIL, the module is missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/school-mode/dues.service.ts
import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { createTransaction } from '../transactions/transactions.service';
import { isDueMonth, isMonthKey } from './schoolYear';

export type DueStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
const round = (n: number) => Math.round(n * 100) / 100;
// Tuition months only: transport payments carry a transportSubscriptionId.
const TUITION = { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] };

export const listDues = async (branchId: string, month: string) => {
    if (!isMonthKey(month)) throw new Error('Le mois doit être au format AAAA-MM');
    const empty = { month, rows: [] as any[], totals: { expected: 0, collected: 0, remaining: 0 } };
    if (!isDueMonth(month)) return empty;

    const students = await prisma.student.findMany({
        where: { branchId, active: true, monthlyFee: { gt: 0 } },
        select: { id: true, name: true, surname: true, schoolLevel: true, monthlyFee: true, parentPhone: true, groupIds: true },
        orderBy: [{ surname: 'asc' }, { name: 'asc' }],
    });
    const payments = await prisma.payment.findMany({
        where: { branchId, forMonth: month, ...TUITION, studentId: { in: students.map((s) => s.id) } },
        select: { studentId: true, amount: true },
    });
    const paidBy = new Map<string, number>();
    for (const p of payments) paidBy.set(p.studentId, round((paidBy.get(p.studentId) ?? 0) + p.amount));

    const rows = students.map((s) => {
        const due = s.monthlyFee ?? 0;
        const paid = paidBy.get(s.id) ?? 0;
        const status: DueStatus = paid >= due ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
        return { studentId: s.id, name: s.name, surname: s.surname, level: s.schoolLevel, groupIds: s.groupIds, parentPhone: s.parentPhone, due, paid, remaining: round(Math.max(0, due - paid)), status };
    });
    const expected = round(rows.reduce((sum, r) => sum + r.due, 0));
    const collected = round(rows.reduce((sum, r) => sum + Math.min(r.paid, r.due), 0));
    return { month, rows, totals: { expected, collected, remaining: round(expected - collected) } };
};

export const collectMonth = async (branchId: string, input: Record<string, any>) => {
    assertId('Student id', input.studentId);
    if (!isMonthKey(input.forMonth) || !isDueMonth(input.forMonth)) throw new Error('Choisissez un mois de septembre à juin');
    const amount = round(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Montant invalide');
    const method = ['CASH', 'CHEQUE', 'VIREMENT', 'CARD'].includes(input.method) ? input.method : 'CASH';

    const student = await prisma.student.findFirst({ where: { id: input.studentId, branchId }, select: { id: true, name: true, surname: true, monthlyFee: true } });
    if (!student) throw new Error('Student not found');
    const already = round((await prisma.payment.findMany({ where: { studentId: student.id, forMonth: input.forMonth, ...TUITION }, select: { amount: true } })).reduce((s, p) => s + p.amount, 0));
    const left = round((student.monthlyFee ?? 0) - already);
    if (left <= 0) throw new Error('Ce mois est déjà payé');
    if (amount > left) throw new Error(`Il reste ${left} MAD à payer pour ce mois`);

    const payment = await prisma.payment.create({
        data: { studentId: student.id, branchId, amount, method, forMonth: input.forMonth, date: new Date(), note: `Mensualité ${input.forMonth}` },
    });
    await createTransaction({ type: 'INCOME', amount, category: 'Paiement Scolarité', branchId, description: `Mensualité ${input.forMonth} — ${student.name} ${student.surname} (${method})` });
    return payment;
};
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `npx jest src/modules/school-mode/dues.service.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/school-mode/dues.service.ts src/modules/school-mode/dues.service.test.ts
git commit -m "feat(education): monthly tuition dues and collection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: HTTP layer for the school mode

**Files:**
- Create: `src/modules/school-mode/schoolMode.controller.ts`
- Create: `src/modules/school-mode/schoolMode.routes.ts`
- Modify: `src/app.ts` (register the router)
- Test: `src/modules/school-mode/schoolMode.routes.test.ts`

- [ ] **Step 1: Write the failing route test**

```ts
// src/modules/school-mode/schoolMode.routes.test.ts
import express from 'express';
import request from 'supertest';
import routes from './schoolMode.routes';
import { saveTuitionGrid } from './tuitionFees.service';
import { registerSchoolStudent } from './inscription.service';
import { listDues } from './dues.service';

jest.mock('./tuitionFees.service', () => ({ getTuitionGrid: jest.fn().mockResolvedValue([]), saveTuitionGrid: jest.fn().mockResolvedValue([]) }));
jest.mock('./inscription.service', () => ({ registerSchoolStudent: jest.fn().mockResolvedValue({ student: { id: 's1' }, summary: {} }) }));
jest.mock('./dues.service', () => ({ listDues: jest.fn().mockResolvedValue({ rows: [] }), collectMonth: jest.fn().mockResolvedValue({ id: 'p1' }) }));
jest.mock('../../middlewares/tenantScope.middleware', () => ({ tenantScopeMiddleware: (req: any, _res: any, next: any) => ((req.branchId = 'b1'), next()) }));
jest.mock('../../utils/jwt', () => ({ verifyToken: jest.fn((token: string) => ({ id: 'u1', email: 'u@test.local', role: token, schoolId: 's', branchId: 'b1' })) }));

const app = express();
app.use(express.json());
app.use('/api/school-mode', routes);
beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => jest.clearAllMocks());

it('lets the secretary register and see dues, not change the fee grid', async () => {
    expect((await request(app).post('/api/school-mode/inscriptions').set('Authorization', 'Bearer SECRETARY').send({ name: 'x' })).status).toBe(201);
    expect(registerSchoolStudent).toHaveBeenCalledWith('b1', { name: 'x' });
    expect((await request(app).get('/api/school-mode/dues?month=2026-11').set('Authorization', 'Bearer SECRETARY')).status).toBe(200);
    expect(listDues).toHaveBeenCalledWith('b1', '2026-11');
    expect((await request(app).put('/api/school-mode/tuition-fees').set('Authorization', 'Bearer SECRETARY').send({ items: [] })).status).toBe(403);
    expect(saveTuitionGrid).not.toHaveBeenCalled();
});

it('lets the owner save the grid and refuses sales agents', async () => {
    expect((await request(app).put('/api/school-mode/tuition-fees').set('Authorization', 'Bearer OWNER').send({ items: [] })).status).toBe(200);
    expect((await request(app).get('/api/school-mode/tuition-fees').set('Authorization', 'Bearer SALES_AGENT')).status).toBe(403);
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx jest src/modules/school-mode/schoolMode.routes.test.ts`

Expected: FAIL, the module is missing.

- [ ] **Step 3: Implement the controller, the routes and the registration**

```ts
// src/modules/school-mode/schoolMode.controller.ts
import { Response } from 'express';
import type { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import { collectMonth, listDues } from './dues.service';
import { registerSchoolStudent } from './inscription.service';
import { getTuitionGrid, saveTuitionGrid } from './tuitionFees.service';

export const getGrid = (req: TenantRequest, res: Response) =>
    respond(res, () => getTuitionGrid(req.branchId!), { message: 'Tuition fees retrieved', failure: 'Failed to retrieve tuition fees' });
export const saveGrid = (req: TenantRequest, res: Response) =>
    respond(res, () => saveTuitionGrid(req.branchId!, req.body?.items), { message: 'Tuition fees saved', failure: 'Failed to save tuition fees' });
export const register = (req: TenantRequest, res: Response) =>
    respond(res, () => registerSchoolStudent(req.branchId!, req.body ?? {}), { message: 'Student registered', failure: 'Failed to register the student', status: 201 });
export const dues = (req: TenantRequest, res: Response) =>
    respond(res, () => listDues(req.branchId!, String(req.query.month ?? '')), { message: 'Dues retrieved', failure: 'Failed to retrieve dues' });
export const collect = (req: TenantRequest, res: Response) =>
    respond(res, () => collectMonth(req.branchId!, req.body ?? {}), { message: 'Payment recorded', failure: 'Failed to record the payment', status: 201 });
```

```ts
// src/modules/school-mode/schoolMode.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { collect, dues, getGrid, register, saveGrid } from './schoolMode.controller';

// Complete private school mode: fee grid, professional inscription, monthly dues.
const router = Router();
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/tuition-fees', getGrid);
router.put('/tuition-fees', roleMiddleware('ADMIN', 'OWNER'), saveGrid);
router.post('/inscriptions', register);
router.get('/dues', dues);
router.post('/dues/payments', collect);

export default router;
```

In `src/app.ts`:

1. Add `import schoolModeRoutes from './modules/school-mode/schoolMode.routes';` next to the other module imports.
2. Add `apiRouter.use('/school-mode', schoolModeRoutes);` after `apiRouter.use('/students', studentsRoutes);`.

> The spec named `/students/school-inscription` and `/tuition…`. One `/school-mode` prefix keeps the module in one router, with the same behaviour. The frontend service (Task 10) uses these paths.

- [ ] **Step 4: Run the route test and the whole school-mode folder**

Run: `npx jest src/modules/school-mode`

Expected: PASS (all school-mode suites).

- [ ] **Step 5: Commit**

```bash
git add src/modules/school-mode src/app.ts
git commit -m "feat(education): school-mode API (fee grid, inscription, dues)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Student update and Excel import accept the new fields

**Files:**
- Modify: `src/modules/students/students.controller.ts:93-127` (update)
- Modify: `src/modules/students-import/normalize.ts` (level text → code when the branch has cycles; Arabic names; sex)
- Modify: `src/modules/students-import/importStudents.service.ts` (pass the cycles to normalize, store the new fields)
- Modify: `frontend/lib/import/fields.ts` (three new columns)
- Test: `src/modules/students-import/normalize.test.ts` (append)

- [ ] **Step 1: Student update — whitelist the new fields**

In `update`, after `if (parentId !== undefined) updateData.parentId = parentId;`, add:

```ts
        // Complete private school file (see src/modules/school-mode)
        const SCHOOL_FIELDS = [
            'nameAr', 'surnameAr', 'gender', 'nationality', 'schoolYear', 'enrollmentKind', 'fatherCin', 'fatherPhone', 'fatherJob',
            'motherCin', 'motherPhone', 'motherJob', 'payer', 'emergencyName', 'emergencyPhone', 'bloodGroup', 'chronicDiseases',
            'medications', 'careConsent', 'documents',
        ] as const;
        for (const key of SCHOOL_FIELDS) if (req.body[key] !== undefined) updateData[key] = req.body[key];
        if (req.body.gender !== undefined && req.body.gender !== null && !['M', 'F'].includes(req.body.gender)) {
            sendError(res, 'Le sexe doit être M ou F', 'Validation error', 400);
            return;
        }
```

> `monthlyFee` is deliberately not editable here. It is frozen at inscription and only changes with a new inscription.

- [ ] **Step 2: Write the failing import test**

Find in `normalize.ts` the function that turns a raw row into `data` (it fills `data.schoolLevel`; its tests are in `normalize.test.ts`). Append to `normalize.test.ts`:

```ts
import { schoolModeFields } from './normalize';

describe('schoolModeFields', () => {
    it('maps the level to a catalog code when the school has cycles', () => {
        expect(schoolModeFields({ schoolLevel: 'السنة الثالثة ابتدائي', nameAr: ' لينا ', gender: 'Fille' }, ['PRIMAIRE'])).toEqual({
            schoolLevel: 'P3', nameAr: 'لينا', gender: 'F',
        });
        expect(schoolModeFields({ schoolLevel: '3AP', gender: 'garçon' }, [])).toEqual({ gender: 'M' }); // classic mode: level text kept as is
        expect(schoolModeFields({ schoolLevel: '1AC' }, ['PRIMAIRE'])).toEqual({}); // not one of the cycles: text kept
    });
});
```

Run: `npx jest src/modules/students-import/normalize.test.ts -t schoolModeFields`

Expected: FAIL.

- [ ] **Step 3: Implement**

In `normalize.ts`, add the import `import { levelCycle, levelFromText } from '../school-mode/levels';` and:

```ts
// Extra columns and level codes for a complete private school (branch with cycles).
export function schoolModeFields(row: Record<string, string | undefined>, cycles: string[]) {
    const out: Record<string, string> = {};
    const code = levelFromText(row.schoolLevel);
    if (cycles.length > 0 && code && cycles.includes(levelCycle(code) ?? '')) out.schoolLevel = code;
    for (const key of ['nameAr', 'surnameAr'] as const) {
        const value = row[key]?.trim();
        if (value) out[key] = value.slice(0, 80);
    }
    const g = row.gender?.trim().toLowerCase();
    if (g) {
        if (/^(m|h|garcon|garçon|masculin|homme|ذكر)$/.test(g)) out.gender = 'M';
        else if (/^(f|fille|feminin|féminin|femme|أنثى|انثى)$/.test(g)) out.gender = 'F';
    }
    return out;
}
```

In `importStudents.service.ts`:

1. Read the branch cycles once: `const cycles = (await prisma.settings.findUnique({ where: { branchId }, select: { schoolCycles: true } }))?.schoolCycles ?? [];`.
2. Merge `...schoolModeFields(rawRow, cycles)` into each row's `data`, where `data` is built (the same place `schoolLevel` is set).
3. Add `settings: { findUnique: jest.fn().mockResolvedValue(null) }` to the mocked prisma in `importStudents.service.test.ts`.
4. Add the keys `nameAr`, `surnameAr`, `gender` to the `ImportFieldKey` type in the backend.

In `frontend/lib/import/fields.ts`, add after the `name` entry:

```ts
    { key: 'nameAr', label: 'Prénom (arabe)', hint: 'الاسم بالعربية', example: 'عمر' },
    { key: 'surnameAr', label: 'Nom (arabe)', hint: 'النسب بالعربية', example: 'بناني' },
    { key: 'gender', label: 'Sexe', hint: 'الجنس', example: 'M' },
```

Add the same keys to the `ImportFieldKey` union in that file.

- [ ] **Step 4: Run the import and student suites**

Run: `npx jest src/modules/students-import src/modules/students`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/students src/modules/students-import frontend/lib/import/fields.ts
git commit -m "feat(education): student update and Excel import know the private school fields

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Frontend catalog, services and cycles hook

**Files:**
- Create: `frontend/lib/schoolLevels.ts`
- Create: `frontend/lib/services/schoolMode.ts`
- Create: `frontend/hooks/useSchoolCycles.ts`
- Modify: `frontend/lib/levels.ts` (labels of the new codes)
- Modify: `frontend/types/index.ts:256-267` (`Settings.schoolCycles`, `schoolYear`)

- [ ] **Step 1: Catalog mirror**

```ts
// frontend/lib/schoolLevels.ts
// Moroccan private school levels. Keep in sync with src/modules/school-mode/levels.ts.
export type Cycle = 'PRESCOLAIRE' | 'PRIMAIRE' | 'COLLEGE' | 'LYCEE';
export const CYCLES: { key: Cycle; label: string }[] = [
    { key: 'PRESCOLAIRE', label: 'Préscolaire' },
    { key: 'PRIMAIRE', label: 'Primaire' },
    { key: 'COLLEGE', label: 'Collège' },
    { key: 'LYCEE', label: 'Lycée' },
];
export const LEVELS: { code: string; cycle: Cycle; label: string }[] = [
    { code: 'PS1', cycle: 'PRESCOLAIRE', label: '1ère année préscolaire' },
    { code: 'PS2', cycle: 'PRESCOLAIRE', label: '2ème année préscolaire' },
    { code: 'PS3', cycle: 'PRESCOLAIRE', label: '3ème année préscolaire' },
    { code: 'P1', cycle: 'PRIMAIRE', label: '1ère année primaire' },
    { code: 'P2', cycle: 'PRIMAIRE', label: '2ème année primaire' },
    { code: 'P3', cycle: 'PRIMAIRE', label: '3ème année primaire' },
    { code: 'P4', cycle: 'PRIMAIRE', label: '4ème année primaire' },
    { code: 'P5', cycle: 'PRIMAIRE', label: '5ème année primaire' },
    { code: 'P6', cycle: 'PRIMAIRE', label: '6ème année primaire' },
    { code: 'C1', cycle: 'COLLEGE', label: '1ère année collège' },
    { code: 'C2', cycle: 'COLLEGE', label: '2ème année collège' },
    { code: 'C3', cycle: 'COLLEGE', label: '3ème année collège' },
    { code: 'TC', cycle: 'LYCEE', label: 'Tronc commun' },
    { code: 'B1', cycle: 'LYCEE', label: '1ère année Bac' },
    { code: 'B2', cycle: 'LYCEE', label: '2ème année Bac' },
];
export const levelsOfCycles = (cycles: string[]) => LEVELS.filter((l) => cycles.includes(l.cycle));
export const isPrescolaire = (code?: string | null) => !!code && code.startsWith('PS');
export const DOCUMENT_CHECKLIST: { key: string; label: string; prescolaireOnly?: boolean }[] = [
    { key: 'BIRTH_CERT', label: "Extrait d'acte de naissance" },
    { key: 'PHOTOS', label: "Photos d'identité" },
    { key: 'LEAVING_CERT', label: 'Certificat de départ' },
    { key: 'LAST_REPORT', label: 'Dernier bulletin' },
    { key: 'PARENT_CIN', label: 'Copie CIN du parent' },
    { key: 'VACCINATION', label: 'Carnet de vaccination', prescolaireOnly: true },
];
```

In `frontend/lib/levels.ts`, make `levelLabel` know the codes:

1. Add `import { LEVELS } from './schoolLevels';`.
2. Change the body to `const code = level ? LEVELS.find((l) => l.code === level.toUpperCase())?.label : undefined; return code ?? (level ? LEVEL_LABELS[fold(level)] ?? level : '');`.

- [ ] **Step 2: Services**

```ts
// frontend/lib/services/schoolMode.ts
import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export interface TuitionRow { level: string; inscriptionFee: number; monthlyFee: number; insuranceFee: number }
export interface DueRow { studentId: string; name: string; surname: string; level: string | null; groupIds: string[]; parentPhone: string | null; due: number; paid: number; remaining: number; status: 'PAID' | 'PARTIAL' | 'UNPAID' }
export interface DuesList { month: string; rows: DueRow[]; totals: { expected: number; collected: number; remaining: number } }
export interface InscriptionSummary { inscriptionFee: number; insuranceFee: number; monthlyFee: number; firstDue: number; paid: number; remaining: number; startMonth: string }

export const getTuitionGrid = async () => (await api.get<ApiResponse<TuitionRow[]>>('/school-mode/tuition-fees')).data.data;
export const saveTuitionGrid = async (items: TuitionRow[]) => (await api.put<ApiResponse<TuitionRow[]>>('/school-mode/tuition-fees', { items })).data.data;
export const registerSchoolStudent = async (payload: Record<string, unknown>) =>
    (await api.post<ApiResponse<{ student: { id: string; name: string; surname: string }; summary: InscriptionSummary }>>('/school-mode/inscriptions', payload)).data.data;
export const getDues = async (month: string) => (await api.get<ApiResponse<DuesList>>('/school-mode/dues', { params: { month } })).data.data;
export const collectMonth = async (payload: { studentId: string; forMonth: string; amount: number; method: string }) =>
    (await api.post('/school-mode/dues/payments', payload)).data.data;
```

- [ ] **Step 3: Cycles hook and settings type**

In `frontend/types/index.ts`, add to `Settings`:

```ts
    schoolCycles?: string[];
    schoolYear?: string | null;
```

```ts
// frontend/hooks/useSchoolCycles.ts
import { useCallback, useEffect, useState } from 'react';
import { getSettings } from '@/lib/services/settings';

// Cycles of the active branch: non-empty = complete private school mode.
export function useSchoolCycles() {
    const [cycles, setCycles] = useState<string[]>([]);
    const [schoolYear, setSchoolYear] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const load = useCallback(() => {
        setLoading(true);
        getSettings()
            .then((s) => {
                setCycles(s.schoolCycles ?? []);
                setSchoolYear(s.schoolYear ?? null);
            })
            .catch(() => setCycles([]))
            .finally(() => setLoading(false));
    }, []);
    useEffect(load, [load]);
    return { cycles, schoolYear, schoolMode: cycles.length > 0, loading, reload: load };
}
```

- [ ] **Step 4: Type-check**

Run (frontend): `npx tsc --noEmit -p .`

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/schoolLevels.ts frontend/lib/services/schoolMode.ts frontend/hooks/useSchoolCycles.ts frontend/lib/levels.ts frontend/types/index.ts
git commit -m "feat(education): frontend level catalog, school-mode services and cycles hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Settings card « Cycles de l'établissement »

**Files:**
- Create: `frontend/components/settings/SchoolCyclesCard.tsx`
- Modify: `frontend/app/admin/settings/page.tsx:503` (render the card above `<GradingPeriodsEditor />`, for private schools only)

- [ ] **Step 1: The card**

```tsx
// frontend/components/settings/SchoolCyclesCard.tsx
'use client';

import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { CYCLES } from '@/lib/schoolLevels';
import { updateSettings } from '@/lib/services/settings';
import { useSchoolCycles } from '@/hooks/useSchoolCycles';
import { describeApiError } from '@/lib/apiError';

const currentYear = () => {
    const now = new Date();
    const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${start}/${start + 1}`;
};

// Turns on the complete private school mode: professional inscription, fees per level, monthly dues.
export default function SchoolCyclesCard() {
    const { tr } = useI18n();
    const { cycles, schoolYear, loading, reload } = useSchoolCycles();
    const [chosen, setChosen] = useState<string[]>([]);
    const [year, setYear] = useState('');
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setChosen(cycles);
        setYear(schoolYear ?? currentYear());
    }, [cycles, schoolYear]);

    const toggle = (key: string) => setChosen((list) => (list.includes(key) ? list.filter((c) => c !== key) : [...list, key]));
    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await updateSettings({ schoolCycles: chosen, schoolYear: year } as any);
            setMessage({ ok: true, text: tr('Cycles enregistrés') });
            reload();
        } catch (e) {
            setMessage({ ok: false, text: describeApiError(e, tr, "Échec de l'enregistrement") });
        } finally {
            setSaving(false);
        }
    };
    if (loading) return null;

    return (
        <section className="rounded-2xl border border-gray-200 p-6 dark:border-white/10">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                <GraduationCap size={20} aria-hidden="true" /> {tr("Cycles de l'établissement")}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {tr('Cochez les cycles de votre école : l’inscription passe au dossier complet (frais par niveau, code Massar, santé, mensualités).')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
                {CYCLES.map((c) => (
                    <label key={c.key} className={`cursor-pointer rounded-xl border-2 px-4 py-2 text-sm font-semibold ${chosen.includes(c.key) ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200' : 'border-gray-200 text-gray-700 dark:border-white/10 dark:text-gray-200'}`}>
                        <input type="checkbox" className="sr-only" checked={chosen.includes(c.key)} onChange={() => toggle(c.key)} />
                        {tr(c.label)}
                    </label>
                ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {tr('Année scolaire')}
                    <input dir="ltr" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026/2027" className="mt-1 block w-40 rounded-lg border border-gray-300 px-3 py-2 dark:border-white/10 dark:bg-white/5" />
                </label>
                <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {saving ? tr('Enregistrement…') : tr('Enregistrer')}
                </button>
            </div>
            {message && <p className={`mt-3 text-sm font-semibold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
        </section>
    );
}
```

- [ ] **Step 2: Render it on the settings page (private schools only)**

In `frontend/app/admin/settings/page.tsx`:

1. Import `SchoolCyclesCard`.
2. Make sure `useSchoolProfile` is used. If the page lacks it, add `const { profile: schoolProfile } = useSchoolProfile();`.
3. Right before `<GradingPeriodsEditor />`, insert:

```tsx
                            {(!schoolProfile.institutionType || schoolProfile.institutionType === 'PRIVATE_SCHOOL') && <SchoolCyclesCard />}
```

- [ ] **Step 3: Type-check and look at it**

Run: `npx tsc --noEmit -p .`

Expected: no output. Open `/admin/settings` as the demo owner: the card is visible, and saving « Préscolaire + Primaire » shows « Cycles enregistrés ».

- [ ] **Step 4: Commit**

```bash
git add frontend/components/settings/SchoolCyclesCard.tsx frontend/app/admin/settings/page.tsx
git commit -m "feat(education): school cycles card in the settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tuition fee table on the Prix page

**Files:**
- Create: `frontend/components/school-mode/TuitionFeesTable.tsx`
- Modify: `frontend/app/admin/finance/prix/page.tsx` (school mode: show the table instead of the subject price table)

- [ ] **Step 1: The table**

```tsx
// frontend/components/school-mode/TuitionFeesTable.tsx
'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { describeApiError } from '@/lib/apiError';
import { LEVELS } from '@/lib/schoolLevels';
import { getTuitionGrid, saveTuitionGrid, type TuitionRow } from '@/lib/services/schoolMode';

const FIELDS: { key: keyof Omit<TuitionRow, 'level'>; label: string }[] = [
    { key: 'inscriptionFee', label: "Frais d'inscription" },
    { key: 'monthlyFee', label: 'Mensualité' },
    { key: 'insuranceFee', label: 'Assurance (année)' },
];

// Fees per level of a complete private school (the inscription form reads them).
export default function TuitionFeesTable() {
    const { tr } = useI18n();
    const [rows, setRows] = useState<TuitionRow[]>([]);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        getTuitionGrid().then(setRows).catch((e) => setMessage({ ok: false, text: describeApiError(e, tr, 'Impossible de charger les prix') }));
    }, [tr]);

    const set = (level: string, key: keyof Omit<TuitionRow, 'level'>, value: string) =>
        setRows((list) => list.map((r) => (r.level === level ? { ...r, [key]: value === '' ? 0 : Number(value) } : r)));
    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            setRows(await saveTuitionGrid(rows));
            setMessage({ ok: true, text: tr('Tarifs enregistrés') });
        } catch (e) {
            setMessage({ ok: false, text: describeApiError(e, tr, "Échec de l'enregistrement") });
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800">{tr('Frais de scolarité par niveau')}</h2>
            <p className="mt-1 text-sm text-gray-600">{tr("Utilisés automatiquement par le formulaire d'inscription. Les élèves déjà inscrits gardent leur mensualité.")}</p>
            <div className="mt-4 overflow-x-auto">
                <table className="w-full text-start text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-start">{tr('Niveau')}</th>
                            {FIELDS.map((f) => <th key={f.key} className="px-3 py-2 text-start">{tr(f.label)} ({tr('MAD')})</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.level} className="border-t border-gray-100">
                                <td className="px-3 py-2 font-semibold text-gray-800">{tr(LEVELS.find((l) => l.code === row.level)?.label ?? row.level)}</td>
                                {FIELDS.map((f) => (
                                    <td key={f.key} className="px-3 py-2">
                                        <input type="number" min="0" step="1" dir="ltr" value={row[f.key] || ''} onChange={(e) => set(row.level, f.key, e.target.value)} placeholder="0" className="w-28 rounded-lg border border-gray-300 px-2 py-1.5" aria-label={`${tr(f.label)} — ${row.level}`} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex items-center gap-3">
                <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60">
                    {saving ? tr('Enregistrement…') : tr('Enregistrer')}
                </button>
                {message && <span className={`text-sm font-semibold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</span>}
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Use it on the Prix page**

In `frontend/app/admin/finance/prix/page.tsx`:

1. Import `TuitionFeesTable` and `useSchoolCycles`.
2. In the component, add `const { schoolMode } = useSchoolCycles();`.
3. Wrap the existing subject price section (the block that starts with the « Prix par niveau et matière » heading) in `{schoolMode ? <TuitionFeesTable /> : ( …existing block… )}`.
4. Keep the « Formations Professionnelles » section unchanged.

- [ ] **Step 3: Type-check and look at it**

Run: `npx tsc --noEmit -p .`

Expected: no output. On the demo school with cycles set, the Prix page shows one row per PS/P level. Saving keeps the values after a reload.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/school-mode/TuitionFeesTable.tsx frontend/app/admin/finance/prix/page.tsx
git commit -m "feat(education): tuition fees per level on the Prix page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: The professional inscription form

**Files:**
- Create: `frontend/components/school-mode/SchoolInscriptionForm.tsx`
- Modify: `frontend/app/admin/inscriptions/page.tsx` and `frontend/app/secretary/inscriptions/page.tsx` (school mode → new form)

- [ ] **Step 1: The form**

```tsx
// frontend/components/school-mode/SchoolInscriptionForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { describeApiError } from '@/lib/apiError';
import { hasFeature } from '@/lib/packs';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { DOCUMENT_CHECKLIST, isPrescolaire, levelsOfCycles } from '@/lib/schoolLevels';
import { getTuitionGrid, registerSchoolStudent, type InscriptionSummary, type TuitionRow } from '@/lib/services/schoolMode';
import { groupsService } from '@/lib/services/groups';
import { getStudents } from '@/lib/services/students';
import { transportService } from '@/lib/services/transport';

type Pickup = { name: string; phone: string; relation: string };
const STEPS = ['Élève', 'Scolarité', 'Parents', 'Santé', 'Services et frais'];
const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white';
const label = 'mb-1 block text-xs font-bold text-gray-600 dark:text-gray-300';
const currentYear = () => {
    const now = new Date();
    const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${start}/${start + 1}`;
};

export default function SchoolInscriptionForm({ cycles, schoolYear, studentsPath }: { cycles: string[]; schoolYear: string | null; studentsPath: string }) {
    const { tr } = useI18n();
    const { profile } = useSchoolProfile();
    const transportOn = hasFeature(profile.features, 'TRANSPORT');
    const levels = levelsOfCycles(cycles);
    const [step, setStep] = useState(0);
    const [f, setF] = useState<Record<string, any>>({ nationality: 'Marocaine', enrollmentKind: 'NEW', payer: 'FATHER', careConsent: true, documents: [], schoolYear: schoolYear ?? currentYear(), siblingDiscount: 0, method: 'CASH' });
    const [pickup, setPickup] = useState<Pickup[]>([]);
    const [grid, setGrid] = useState<TuitionRow[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [siblings, setSiblings] = useState<string[]>([]);
    const [fees, setFees] = useState({ inscriptionFee: 0, monthlyFee: 0, insuranceFee: 0 });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ id: string; name: string; summary: InscriptionSummary } | null>(null);
    const set = (key: string, value: unknown) => setF((prev) => ({ ...prev, [key]: value }));

    useEffect(() => {
        getTuitionGrid().then(setGrid).catch(() => setGrid([]));
        groupsService.getAll().then(setGroups).catch(() => setGroups([]));
        if (transportOn) transportService.routes.getAll().then(setRoutes).catch(() => setRoutes([]));
    }, [transportOn]);

    // Level change: take the grid amounts (the office can still type others).
    useEffect(() => {
        const row = grid.find((r) => r.level === f.level);
        setFees({ inscriptionFee: row?.inscriptionFee ?? 0, monthlyFee: row?.monthlyFee ?? 0, insuranceFee: row?.insuranceFee ?? 0 });
    }, [f.level, grid]);

    // Same guardian phone as an active student: suggest the sibling discount.
    useEffect(() => {
        const phone = String(f.parentPhone ?? '').replace(/\D/g, '');
        if (phone.length < 9) return setSiblings([]);
        getStudents().then((list: any[]) => setSiblings(list.filter((s) => s.active !== false && String(s.parentPhone ?? '').replace(/\D/g, '').endsWith(phone.slice(-9))).map((s) => `${s.name} ${s.surname}`))).catch(() => setSiblings([]));
    }, [f.parentPhone]);

    const monthly = Math.round(fees.monthlyFee * (100 - Number(f.siblingDiscount)) ) / 100;
    const firstDue = fees.inscriptionFee + fees.insuranceFee + monthly;
    const levelGroups = useMemo(() => groups.filter((g) => !f.level || !g.level || String(g.level).toUpperCase() === f.level || String(g.level).toLowerCase().startsWith(f.level.startsWith('PS') ? 'pres' : f.level.startsWith('P') ? 'prim' : f.level.startsWith('C') ? 'col' : 'lyc')), [groups, f.level]);
    const route = routes.find((r) => r.id === f.routeId);
    const docs = DOCUMENT_CHECKLIST.filter((d) => !d.prescolaireOnly || isPrescolaire(f.level));

    const submit = async () => {
        setError('');
        if (!f.name?.trim() || !f.surname?.trim()) return setStep(0), setError(tr('Le prénom et le nom sont obligatoires'));
        if (!f.level) return setStep(1), setError(tr('Choisissez le niveau'));
        setBusy(true);
        try {
            const result = await registerSchoolStudent({
                ...f,
                authorizedPickup: isPrescolaire(f.level) ? pickup.filter((p) => p.name.trim()) : undefined,
                fees,
                amountPaid: Number(f.amountPaid || 0),
                transport: f.routeId && f.stopId ? { routeId: f.routeId, stopId: f.stopId } : undefined,
            });
            setDone({ id: result.student.id, name: `${result.student.name} ${result.student.surname}`, summary: result.summary });
        } catch (e) {
            setError(describeApiError(e, tr, "L'inscription a échoué"));
        } finally {
            setBusy(false);
        }
    };

    if (done) {
        return (
            <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm dark:bg-vib-card">
                <CheckCircle2 className="mx-auto text-emerald-500" size={48} aria-hidden="true" />
                <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{tr('{name} est inscrit(e)', { name: done.name })}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {tr('Dû à l’inscription : {due} MAD · payé : {paid} MAD · reste : {rest} MAD', { due: done.summary.firstDue, paid: done.summary.paid, rest: done.summary.remaining })}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Link href={`${studentsPath.replace(/\/students$/, '')}/students/${done.id}/dossier`} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"><Printer size={16} />{tr('Imprimer le dossier')}</Link>
                    <Link href={`${studentsPath}/${done.id}`} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold dark:border-white/10">{tr('Voir la fiche')}</Link>
                    <button type="button" onClick={() => { setDone(null); setF((p) => ({ nationality: 'Marocaine', enrollmentKind: 'NEW', payer: 'FATHER', careConsent: true, documents: [], schoolYear: p.schoolYear, siblingDiscount: 0, method: 'CASH' })); setPickup([]); setStep(0); }} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold dark:border-white/10">{tr('Nouvelle inscription')}</button>
                </div>
            </div>
        );
    }

    const field = (key: string, text: string, props: Record<string, any> = {}) => (
        <div><label className={label} htmlFor={`f-${key}`}>{tr(text)}</label><input id={`f-${key}`} className={input} value={f[key] ?? ''} onChange={(e) => set(key, e.target.value)} {...props} /></div>
    );

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-3xl bg-white p-6 shadow-sm dark:bg-vib-card">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr("Dossier d'inscription")}</h1>
                <ol className="mt-4 flex flex-wrap gap-2" aria-label={tr('Étapes')}>
                    {STEPS.map((s, i) => (
                        <li key={s}><button type="button" onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined} className={`rounded-full px-3 py-1.5 text-xs font-bold ${step === i ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'}`}>{i + 1}. {tr(s)}</button></li>
                    ))}
                </ol>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {step === 0 && (<>
                        {field('name', 'Prénom *', { required: true })}
                        {field('surname', 'Nom *', { required: true })}
                        {field('nameAr', 'Prénom (arabe)', { dir: 'rtl', lang: 'ar' })}
                        {field('surnameAr', 'Nom (arabe)', { dir: 'rtl', lang: 'ar' })}
                        <div><label className={label} htmlFor="f-gender">{tr('Sexe')}</label><select id="f-gender" className={input} value={f.gender ?? ''} onChange={(e) => set('gender', e.target.value || undefined)}><option value="">—</option><option value="M">{tr('Garçon')}</option><option value="F">{tr('Fille')}</option></select></div>
                        {field('birthDate', 'Date de naissance', { type: 'date' })}
                        {field('birthPlace', 'Lieu de naissance')}
                        {field('nationality', 'Nationalité')}
                        {field('massarNumber', 'Code Massar', { dir: 'ltr', placeholder: 'J130000001' })}
                        {field('address', 'Adresse')}
                    </>)}
                    {step === 1 && (<>
                        {field('schoolYear', 'Année scolaire', { dir: 'ltr' })}
                        <div><label className={label} htmlFor="f-level">{tr('Niveau *')}</label><select id="f-level" className={input} value={f.level ?? ''} onChange={(e) => set('level', e.target.value)}><option value="">{tr('Choisir…')}</option>{levels.map((l) => <option key={l.code} value={l.code}>{tr(l.label)}</option>)}</select></div>
                        <div><label className={label} htmlFor="f-group">{tr('Groupe / classe')}</label><select id="f-group" className={input} value={f.groupId ?? ''} onChange={(e) => set('groupId', e.target.value || undefined)}><option value="">—</option>{levelGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                        <div><label className={label} htmlFor="f-kind">{tr('Type')}</label><select id="f-kind" className={input} value={f.enrollmentKind} onChange={(e) => set('enrollmentKind', e.target.value)}><option value="NEW">{tr('Nouvel élève')}</option><option value="RETURNING">{tr('Réinscription')}</option></select></div>
                        {field('previousSchool', 'École précédente')}
                    </>)}
                    {step === 2 && (<>
                        {field('fatherName', 'Nom du père')}{field('fatherCin', 'CIN du père', { dir: 'ltr' })}{field('fatherPhone', 'Téléphone du père', { type: 'tel' })}{field('fatherJob', 'Profession du père')}
                        {field('motherName', 'Nom de la mère')}{field('motherCin', 'CIN de la mère', { dir: 'ltr' })}{field('motherPhone', 'Téléphone de la mère', { type: 'tel' })}{field('motherJob', 'Profession de la mère')}
                        {field('parentName', 'Tuteur légal (nom)')}{field('parentRelation', 'Lien de parenté')}{field('parentPhone', 'Téléphone du tuteur (espace parents)', { type: 'tel' })}
                        <div><label className={label} htmlFor="f-payer">{tr('Qui paie ?')}</label><select id="f-payer" className={input} value={f.payer} onChange={(e) => set('payer', e.target.value)}><option value="FATHER">{tr('Le père')}</option><option value="MOTHER">{tr('La mère')}</option><option value="GUARDIAN">{tr('Le tuteur')}</option></select></div>
                        {field('emergencyName', "Contact d'urgence (nom)")}{field('emergencyPhone', "Contact d'urgence (téléphone)", { type: 'tel' })}
                    </>)}
                    {step === 3 && (<>
                        <div><label className={label} htmlFor="f-blood">{tr('Groupe sanguin')}</label><select id="f-blood" className={input} value={f.bloodGroup ?? ''} onChange={(e) => set('bloodGroup', e.target.value || undefined)}><option value="">—</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g}>{g}</option>)}</select></div>
                        {field('allergies', 'Allergies')}{field('chronicDiseases', 'Maladies chroniques')}{field('medications', 'Médicaments')}
                        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={!!f.careConsent} onChange={(e) => set('careConsent', e.target.checked)} />{tr("J'autorise l'établissement à faire donner les premiers soins et à appeler les urgences")}</label>
                        {isPrescolaire(f.level) && (
                            <div className="sm:col-span-2">
                                <p className={label}>{tr("Personnes autorisées à récupérer l'enfant")}</p>
                                {pickup.map((p, i) => (
                                    <div key={i} className="mb-2 grid grid-cols-3 gap-2">
                                        {(['name', 'phone', 'relation'] as const).map((k) => <input key={k} className={input} placeholder={tr(k === 'name' ? 'Nom' : k === 'phone' ? 'Téléphone' : 'Lien')} value={p[k]} onChange={(e) => setPickup((l) => l.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />)}
                                    </div>
                                ))}
                                <button type="button" onClick={() => setPickup((l) => [...l, { name: '', phone: '', relation: '' }])} className="text-sm font-bold text-indigo-600">{tr('+ Ajouter une personne')}</button>
                            </div>
                        )}
                    </>)}
                    {step === 4 && (<>
                        {transportOn && (<>
                            <div><label className={label} htmlFor="f-route">{tr('Transport scolaire')}</label><select id="f-route" className={input} value={f.routeId ?? ''} onChange={(e) => { set('routeId', e.target.value || undefined); set('stopId', undefined); }}><option value="">{tr('Sans transport')}</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                            {route && <div><label className={label} htmlFor="f-stop">{tr('Arrêt')}</label><select id="f-stop" className={input} value={f.stopId ?? ''} onChange={(e) => set('stopId', e.target.value || undefined)}><option value="">{tr('Choisir…')}</option>{(route.stops ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
                        </>)}
                        {(['inscriptionFee', 'monthlyFee', 'insuranceFee'] as const).map((k) => (
                            <div key={k}><label className={label} htmlFor={`f-${k}`}>{tr(k === 'inscriptionFee' ? "Frais d'inscription (MAD)" : k === 'monthlyFee' ? 'Mensualité (MAD)' : 'Assurance (MAD)')}</label><input id={`f-${k}`} type="number" min="0" dir="ltr" className={input} value={fees[k]} onChange={(e) => setFees((x) => ({ ...x, [k]: Number(e.target.value || 0) }))} /></div>
                        ))}
                        <div><label className={label} htmlFor="f-disc">{tr('Réduction fratrie')}</label><select id="f-disc" className={input} value={f.siblingDiscount} onChange={(e) => set('siblingDiscount', Number(e.target.value))}>{[0, 10, 15, 20].map((p) => <option key={p} value={p}>{p} %</option>)}</select>{siblings.length > 0 && <p className="mt-1 text-xs text-amber-700">{tr('Frère/sœur déjà inscrit(e) : {names}', { names: siblings.join(', ') })}</p>}</div>
                        <div><label className={label} htmlFor="f-paid">{tr('Montant payé maintenant (MAD)')}</label><input id="f-paid" type="number" min="0" dir="ltr" className={input} value={f.amountPaid ?? ''} onChange={(e) => set('amountPaid', e.target.value)} /></div>
                        <div><label className={label} htmlFor="f-method">{tr('Mode de paiement')}</label><select id="f-method" className={input} value={f.method} onChange={(e) => set('method', e.target.value)}><option value="CASH">{tr('Espèces')}</option><option value="CHEQUE">{tr('Chèque')}</option><option value="VIREMENT">{tr('Virement')}</option><option value="CARD">{tr('Carte')}</option></select></div>
                        <fieldset className="sm:col-span-2"><legend className={label}>{tr('Documents remis')}</legend><div className="flex flex-wrap gap-3">{docs.map((d) => <label key={d.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.documents.includes(d.key)} onChange={(e) => set('documents', e.target.checked ? [...f.documents, d.key] : f.documents.filter((x: string) => x !== d.key))} />{tr(d.label)}</label>)}</div></fieldset>
                    </>)}
                </div>

                {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
                <div className="mt-6 flex justify-between gap-2">
                    <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-40 dark:border-white/10">{tr('Précédent')}</button>
                    {step < STEPS.length - 1
                        ? <button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white">{tr('Suivant')}</button>
                        : <button type="button" onClick={submit} disabled={busy} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? tr('Enregistrement…') : tr("Enregistrer l'inscription")}</button>}
                </div>
            </div>

            <aside className="h-fit rounded-3xl bg-white p-6 shadow-sm dark:bg-vib-card">
                <h2 className="font-bold text-gray-900 dark:text-white">{tr('Récapitulatif')}</h2>
                <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><dt>{tr("Frais d'inscription")}</dt><dd>{fees.inscriptionFee} {tr('MAD')}</dd></div>
                    <div className="flex justify-between"><dt>{tr('Assurance')}</dt><dd>{fees.insuranceFee} {tr('MAD')}</dd></div>
                    <div className="flex justify-between"><dt>{tr('Mensualité')}{Number(f.siblingDiscount) ? ` (−${f.siblingDiscount} %)` : ''}</dt><dd>{monthly} {tr('MAD')}</dd></div>
                    <div className="flex justify-between border-t pt-2 font-bold"><dt>{tr("Dû à l'inscription")}</dt><dd>{firstDue} {tr('MAD')}</dd></div>
                </dl>
                {f.level && !grid.find((r) => r.level === f.level && r.monthlyFee > 0) && <p className="mt-3 text-xs font-semibold text-amber-700">{tr('Aucun tarif pour ce niveau : renseignez-le dans Prix')}</p>}
            </aside>
        </div>
    );
}
```

> **Check while implementing:** the exact names of these imports in `lib/services/*`:
> - `groupsService.getAll` (`lib/services/groups.ts`),
> - `getStudents` (`lib/services/students.ts`),
> - `transportService.routes.getAll` (`lib/services/transport.ts`).
>
> Use the names those files export. The returned shapes are the ones their pages already use.

- [ ] **Step 2: Switch the inscription pages**

In `frontend/app/admin/inscriptions/page.tsx`:

1. Import `SchoolInscriptionForm` and `useSchoolCycles`.
2. In `RegisterStudentPage`, add `const { cycles, schoolYear, schoolMode, loading: cyclesLoading } = useSchoolCycles();`.
3. Before the crèche branch, add:

```tsx
    if (!loading && !cyclesLoading && schoolMode) {
        return (
            <>
                <ImportLink />
                <SchoolInscriptionForm cycles={cycles} schoolYear={schoolYear} studentsPath="/admin/students" />
            </>
        );
    }
```

In `frontend/app/secretary/inscriptions/page.tsx`, do the same with `studentsPath="/secretary/students"`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/school-mode/SchoolInscriptionForm.tsx frontend/app/admin/inscriptions/page.tsx frontend/app/secretary/inscriptions/page.tsx
git commit -m "feat(education): professional inscription form for complete private schools

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Printable inscription file (dossier)

**Files:**
- Create: `frontend/app/admin/students/[id]/dossier/page.tsx`
- Create: `frontend/app/secretary/students/[id]/dossier/page.tsx` (re-export)

- [ ] **Step 1: The print page**

```tsx
// frontend/app/admin/students/[id]/dossier/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { useI18n, appLocale } from '@/lib/i18n/I18nProvider';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { DOCUMENT_CHECKLIST } from '@/lib/schoolLevels';
import { levelLabel } from '@/lib/levels';
import { getStudentById } from '@/lib/services/students';

// The inscription file handed to the parents, printed in the interface language.
export default function StudentDossierPage() {
    const { tr } = useI18n();
    const { id } = useParams<{ id: string }>();
    const { profile } = useSchoolProfile();
    const [s, setS] = useState<any>(null);
    useEffect(() => {
        getStudentById(id).then(setS).catch(() => setS(false));
    }, [id]);
    if (s === null) return <p className="p-6">{tr('Chargement…')}</p>;
    if (!s) return <p className="p-6">{tr('Élève introuvable')}</p>;

    const date = (v?: string) => (v ? new Date(v).toLocaleDateString(appLocale()) : '—');
    const row = (k: string, v?: string | null) => (
        <div className="flex gap-2 border-b border-dotted border-gray-300 py-1.5"><dt className="w-48 shrink-0 font-semibold">{tr(k)}</dt><dd>{v || '—'}</dd></div>
    );

    return (
        <div className="mx-auto max-w-3xl bg-white p-8 text-gray-900 print:p-0">
            <button type="button" onClick={() => window.print()} className="mb-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white print:hidden"><Printer size={16} />{tr('Imprimer')}</button>
            <header className="flex items-center justify-between border-b-2 border-gray-900 pb-4">
                <div className="flex items-center gap-3">
                    {profile.logo && <img src={profile.logo} alt="" className="h-16 w-16 object-contain" />}
                    <div><p className="text-xl font-black">{profile.schoolName}</p><p className="text-sm">{profile.address} {profile.phone ? `· ${profile.phone}` : ''}</p></div>
                </div>
                {s.photo && <img src={s.photo} alt="" className="h-24 w-20 rounded object-cover" />}
            </header>
            <h1 className="mt-6 text-center text-2xl font-black">{tr("Dossier d'inscription")} {s.schoolYear ?? ''}</h1>
            <section className="mt-6"><h2 className="mb-2 text-lg font-bold">{tr('Élève')}</h2><dl>
                {row('Nom et prénom', `${s.surname} ${s.name}`)}
                {row('الاسم والنسب', [s.surnameAr, s.nameAr].filter(Boolean).join(' '))}
                {row('Sexe', s.gender === 'M' ? tr('Garçon') : s.gender === 'F' ? tr('Fille') : '')}
                {row('Date et lieu de naissance', `${date(s.birthDate)} ${s.birthPlace ? `— ${s.birthPlace}` : ''}`)}
                {row('Nationalité', s.nationality)}
                {row('Code Massar', s.massarNumber)}
                {row('Niveau', tr(levelLabel(s.schoolLevel)))}
                {row('Adresse', s.address)}
            </dl></section>
            <section className="mt-6"><h2 className="mb-2 text-lg font-bold">{tr('Parents')}</h2><dl>
                {row('Père', [s.fatherName, s.fatherCin, s.fatherPhone, s.fatherJob].filter(Boolean).join(' · '))}
                {row('Mère', [s.motherName, s.motherCin, s.motherPhone, s.motherJob].filter(Boolean).join(' · '))}
                {row('Tuteur légal', [s.parentName, s.parentRelation, s.parentPhone].filter(Boolean).join(' · '))}
                {row("Contact d'urgence", [s.emergencyName, s.emergencyPhone].filter(Boolean).join(' · '))}
            </dl></section>
            <section className="mt-6"><h2 className="mb-2 text-lg font-bold">{tr('Santé')}</h2><dl>
                {row('Groupe sanguin', s.bloodGroup)}{row('Allergies', s.healthNotes)}{row('Maladies chroniques', s.chronicDiseases)}{row('Médicaments', s.medications)}
            </dl></section>
            <section className="mt-6"><h2 className="mb-2 text-lg font-bold">{tr('Documents remis')}</h2>
                <ul className="grid grid-cols-2 gap-1 text-sm">{DOCUMENT_CHECKLIST.map((d) => <li key={d.key}>{(s.documents ?? []).includes(d.key) ? '☑' : '☐'} {tr(d.label)}</li>)}</ul>
            </section>
            <footer className="mt-12 grid grid-cols-2 gap-8 text-center text-sm"><div>{tr('Signature du parent')}<div className="mt-16 border-t border-gray-400" /></div><div>{tr("Cachet de l'établissement")}<div className="mt-16 border-t border-gray-400" /></div></footer>
        </div>
    );
}
```

```tsx
// frontend/app/secretary/students/[id]/dossier/page.tsx
'use client';

import StudentDossierPage from '@/app/admin/students/[id]/dossier/page';

export default function SecretaryStudentDossierPage() {
    return <StudentDossierPage />;
}
```

> **Check while implementing:** the name of the single-student getter in `lib/services/students.ts` (the student file page uses it). Use that name.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/admin/students/[id]/dossier" "frontend/app/secretary/students/[id]/dossier"
git commit -m "feat(education): printable inscription file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: The new fields on the student file

**Files:**
- Create: `frontend/components/school-mode/StudentSchoolInfo.tsx`
- Modify: `frontend/app/admin/students/[id]/page.tsx` (Informations tab: render it when the student has a catalog level; « Imprimer le dossier » button)

- [ ] **Step 1: The component (view + edit)**

```tsx
// frontend/components/school-mode/StudentSchoolInfo.tsx
'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { describeApiError } from '@/lib/apiError';
import { updateStudent } from '@/lib/services/students';

const SECTIONS: { title: string; fields: [string, string][] }[] = [
    { title: 'Identité', fields: [['nameAr', 'Prénom (arabe)'], ['surnameAr', 'Nom (arabe)'], ['nationality', 'Nationalité'], ['massarNumber', 'Code Massar']] },
    { title: 'Parents', fields: [['fatherCin', 'CIN du père'], ['fatherPhone', 'Téléphone du père'], ['fatherJob', 'Profession du père'], ['motherCin', 'CIN de la mère'], ['motherPhone', 'Téléphone de la mère'], ['motherJob', 'Profession de la mère'], ['emergencyName', "Contact d'urgence (nom)"], ['emergencyPhone', "Contact d'urgence (téléphone)"]] },
    { title: 'Santé', fields: [['bloodGroup', 'Groupe sanguin'], ['healthNotes', 'Allergies'], ['chronicDiseases', 'Maladies chroniques'], ['medications', 'Médicaments']] },
];

export default function StudentSchoolInfo({ student, onSaved }: { student: any; onSaved: (s: any) => void }) {
    const { tr } = useI18n();
    const [edit, setEdit] = useState(false);
    const [form, setForm] = useState<Record<string, string>>({});
    const [error, setError] = useState('');
    const open = () => {
        setForm(Object.fromEntries(SECTIONS.flatMap((s) => s.fields.map(([k]) => [k, student[k] ?? '']))));
        setEdit(true);
    };
    const save = async () => {
        setError('');
        try {
            onSaved(await updateStudent(student.id, form));
            setEdit(false);
        } catch (e) {
            setError(describeApiError(e, tr, "Échec de l'enregistrement"));
        }
    };
    return (
        <div className="space-y-4">
            {SECTIONS.map((s) => (
                <section key={s.title}>
                    <h3 className="mb-2 font-bold text-slate-900 dark:text-white">{tr(s.title)}</h3>
                    <dl className="grid gap-2 sm:grid-cols-2">
                        {s.fields.map(([k, label]) => (
                            <div key={k}><dt className="text-xs text-slate-500">{tr(label)}</dt>
                                {edit ? <input className="w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900" value={form[k] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} /> : <dd className="font-medium text-slate-900 dark:text-white">{student[k] || '—'}</dd>}
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            {edit
                ? <div className="flex gap-2"><button type="button" onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">{tr('Enregistrer')}</button><button type="button" onClick={() => setEdit(false)} className="rounded-lg border px-4 py-2 text-sm">{tr('Annuler')}</button></div>
                : <button type="button" onClick={open} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">{tr('Modifier')}</button>}
        </div>
    );
}
```

- [ ] **Step 2: Wire it into the student file**

In `frontend/app/admin/students/[id]/page.tsx`:

1. Import `StudentSchoolInfo` and `{ LEVELS } from '@/lib/schoolLevels'`.
2. Compute `const schoolFile = LEVELS.some((l) => l.code === student.schoolLevel);`.
3. In the `tab === 'info'` block, render `{schoolFile && <StudentSchoolInfo student={student} onSaved={setStudent} />}` after the existing information list.
4. Next to the header buttons, add `{schoolFile && <Link href={\`${base}/students/${student.id}/dossier\`} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium">{tr('Imprimer le dossier')}</Link>}`.
   - `base` is `/admin` or `/secretary`, derived the way the presence page does: `const base = usePathname()?.startsWith('/secretary') ? '/secretary' : '/admin';`.
   - Use the page's existing state setter name in place of `setStudent` if it differs.

> **Check while implementing:** `updateStudent` in `lib/services/students.ts` (the name of the update call). It returns the updated student.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/school-mode/StudentSchoolInfo.tsx "frontend/app/admin/students/[id]/page.tsx"
git commit -m "feat(education): private school file on the student page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: « Mensualités » page, menu entries and the dashboard figure

**Files:**
- Create: `frontend/app/admin/finance/mensualites/page.tsx`
- Create: `frontend/app/secretary/finance/mensualites/page.tsx` (re-export)
- Modify: `frontend/components/Sidebar.tsx` (Finance submenu + secretary entry, only in school mode)
- Modify: `frontend/app/admin/page.tsx` (« Impayés » in school mode)

- [ ] **Step 1: The page**

```tsx
// frontend/app/admin/finance/mensualites/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useI18n, appLocale } from '@/lib/i18n/I18nProvider';
import { describeApiError } from '@/lib/apiError';
import { levelLabel } from '@/lib/levels';
import { collectMonth, getDues, type DueRow, type DuesList } from '@/lib/services/schoolMode';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const STATUS_CLS = { PAID: 'bg-emerald-50 text-emerald-700', PARTIAL: 'bg-amber-50 text-amber-800', UNPAID: 'bg-red-50 text-red-700' };
const STATUS_TXT = { PAID: 'Payé', PARTIAL: 'Partiel', UNPAID: 'Non payé' };

// Monthly tuition: who paid this month, who did not; collect a month or remind the parent.
export default function MensualitesPage() {
    const { tr } = useI18n();
    const [month, setMonth] = useState(thisMonth());
    const [data, setData] = useState<DuesList | null>(null);
    const [level, setLevel] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const load = useCallback(() => getDues(month).then(setData).catch((e) => setError(describeApiError(e, tr, 'Impossible de charger les mensualités'))), [month, tr]);
    useEffect(() => { load(); }, [load]);

    const rows = useMemo(() => (data?.rows ?? []).filter((r) => !level || r.level === level), [data, level]);
    const levels = useMemo(() => Array.from(new Set((data?.rows ?? []).map((r) => r.level).filter(Boolean))) as string[], [data]);
    const monthName = new Date(`${month}-01T12:00:00`).toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' });
    const remind = (r: DueRow) => {
        const digits = String(r.parentPhone ?? '').replace(/\D/g, '').replace(/^0/, '212');
        const text = encodeURIComponent(tr('Bonjour, nous vous rappelons que la mensualité de {month} de {name} ({amount} MAD) reste à régler. Merci.', { month: monthName, name: `${r.name} ${r.surname}`, amount: r.remaining }));
        return `https://wa.me/${digits}?text=${text}`;
    };
    const collect = async (r: DueRow) => {
        setBusy(r.studentId);
        setError('');
        try {
            await collectMonth({ studentId: r.studentId, forMonth: month, amount: r.remaining, method: 'CASH' });
            await load();
        } catch (e) {
            setError(describeApiError(e, tr, "Échec de l'encaissement"));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('Mensualités')}</h1><p className="text-gray-600 dark:text-gray-300">{tr('Suivi des mensualités de scolarité, de septembre à juin')}</p></div>
                <div className="flex gap-2">
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 dark:border-white/10 dark:bg-white/5" aria-label={tr('Mois')} />
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 dark:border-white/10 dark:bg-white/5" aria-label={tr('Niveau')}><option value="">{tr('Tous les niveaux')}</option>{levels.map((l) => <option key={l} value={l}>{tr(levelLabel(l))}</option>)}</select>
                </div>
            </div>
            {data && (
                <div className="grid gap-4 sm:grid-cols-3">
                    {([['Attendu', data.totals.expected], ['Encaissé', data.totals.collected], ['Reste à encaisser', data.totals.remaining]] as const).map(([k, v]) => (
                        <div key={k} className="vib-card p-5"><p className="text-sm text-gray-500">{tr(k)}</p><p className="text-2xl font-black text-gray-900 dark:text-white">{v} {tr('MAD')}</p></div>
                    ))}
                </div>
            )}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            {data && data.rows.length === 0 && <p className="vib-card p-6 text-gray-600">{tr('Aucune mensualité ce mois-ci (vacances d’été ou aucun élève inscrit avec une mensualité).')}</p>}
            {rows.length > 0 && (
                <div className="vib-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 dark:bg-white/5"><tr>{['Élève', 'Niveau', 'Mensualité', 'Payé', 'Statut', ''].map((h) => <th key={h} className="px-4 py-3 text-start">{h && tr(h)}</th>)}</tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.studentId} className="border-t border-gray-100 dark:border-white/5">
                                    <td className="px-4 py-3 font-semibold">{r.surname} {r.name}</td>
                                    <td className="px-4 py-3">{tr(levelLabel(r.level))}</td>
                                    <td className="px-4 py-3">{r.due} {tr('MAD')}</td>
                                    <td className="px-4 py-3">{r.paid} {tr('MAD')}</td>
                                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CLS[r.status]}`}>{tr(STATUS_TXT[r.status])}</span></td>
                                    <td className="px-4 py-3">
                                        {r.status !== 'PAID' && (
                                            <div className="flex gap-2">
                                                <button type="button" disabled={busy === r.studentId} onClick={() => collect(r)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{tr('Encaisser {amount} MAD', { amount: r.remaining })}</button>
                                                {r.parentPhone && <a href={remind(r)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700"><MessageCircle size={14} />{tr('Rappel')}</a>}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
```

```tsx
// frontend/app/secretary/finance/mensualites/page.tsx
'use client';

import MensualitesPage from '@/app/admin/finance/mensualites/page';

export default function SecretaryMensualitesPage() {
    return <MensualitesPage />;
}
```

- [ ] **Step 2: Menu entries (school mode only)**

In `frontend/components/Sidebar.tsx`:

1. Import `useSchoolCycles`.
2. Add `const { schoolMode } = useSchoolCycles();` (skip the call's result for `SUPER_ADMIN`: `const showDues = schoolMode && effectiveRole !== 'SUPER_ADMIN';`).
3. In `adminMenuItems`, the `finance` submenu, insert after « Paiements »: `...(showDues ? [{ label: 'Mensualités', path: '/admin/finance/mensualites' }] : []),`.
4. In `secretaryMenuItems`, before the `recus` entry, insert: `...(showDues ? [{ id: 'mensualites', label: 'Mensualités', icon: DollarSign, path: '/secretary/finance/mensualites', activeColor: 'bg-[#334155]/50 border-[#34D399]', iconColor: 'text-[#34D399]' }] : []),`.
5. In `ITEM_GROUP`, add `mensualites: 'finance',`.

- [ ] **Step 3: Dashboard « Impayés » in school mode**

In `frontend/app/admin/page.tsx`:

1. Import `useSchoolCycles` and `getDues`.
2. Add `const { schoolMode } = useSchoolCycles();` and a state `const [duesUnpaid, setDuesUnpaid] = useState<number | null>(null);`.
3. Add an effect: `useEffect(() => { if (schoolMode) getDues(new Date().toISOString().slice(0, 7)).then((d) => setDuesUnpaid(d.totals.remaining)).catch(() => setDuesUnpaid(null)); }, [schoolMode]);`.
4. In the « Impayés » `VibrantKpi`:
   - use `value={mad(duesUnpaid ?? stats.unpaid)}`;
   - use `sub={duesUnpaid !== null ? tr('Mensualités du mois non réglées') : …existing sub…}`;
   - make `onClick` go to `/admin/finance/mensualites` when `duesUnpaid !== null`.

> The spec counts "unpaid months up to now". This step shows the current month's remaining amount, which is the actionable figure. Older months stay one click away on the Mensualités page, using the month picker.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin/finance/mensualites frontend/app/secretary/finance/mensualites frontend/components/Sidebar.tsx frontend/app/admin/page.tsx
git commit -m "feat(education): monthly tuition page, menu entries and dashboard figure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Arabic texts

**Files:**
- Create: `frontend/lib/i18n/ar/school-mode.ts`
- Modify: `frontend/lib/i18n/ar/index.ts` (spread it last)

- [ ] **Step 1: List the missing keys**

Run, from `frontend`, the session's missing-keys checker on the new and changed files. The checker is a node script that loads `lib/i18n/ar/*.ts` and lists `tr('…')` literals without an Arabic entry. If it is not available, re-create it as `scratchpad/missing.cjs`: it parses each file with the TypeScript AST and collects the `tr()` string arguments missing from the merged dictionary.

```bash
node <scratchpad>/missing.cjs "$PWD" components/school-mode/*.tsx components/settings/SchoolCyclesCard.tsx app/admin/finance/mensualites/page.tsx "app/admin/students/[id]/dossier/page.tsx" lib/schoolLevels.ts
```

Expected: a JSON list of French strings.

- [ ] **Step 2: Write the dictionary**

```ts
// frontend/lib/i18n/ar/school-mode.ts
// Complete private school mode: cycles, levels, inscription file, monthly tuition.
export const schoolMode: Record<string, string> = {
    Préscolaire: 'التعليم الأولي',
    '1ère année préscolaire': 'السنة الأولى روض',
    '2ème année préscolaire': 'السنة الثانية روض',
    '3ème année préscolaire': 'السنة الثالثة روض',
    '1ère année primaire': 'السنة الأولى ابتدائي',
    '2ème année primaire': 'السنة الثانية ابتدائي',
    '3ème année primaire': 'السنة الثالثة ابتدائي',
    '4ème année primaire': 'السنة الرابعة ابتدائي',
    '5ème année primaire': 'السنة الخامسة ابتدائي',
    '6ème année primaire': 'السنة السادسة ابتدائي',
    '1ère année collège': 'السنة الأولى إعدادي',
    '2ème année collège': 'السنة الثانية إعدادي',
    '3ème année collège': 'السنة الثالثة إعدادي',
    'Tronc commun': 'الجذع المشترك',
    '1ère année Bac': 'الأولى باك',
    '2ème année Bac': 'الثانية باك',
    "Cycles de l'établissement": 'أسلاك المؤسسة',
    'Cochez les cycles de votre école : l’inscription passe au dossier complet (frais par niveau, code Massar, santé, mensualités).':
        'اختر أسلاك مؤسستك: يصبح التسجيل ملفاً كاملاً (واجبات حسب المستوى، رمز مسار، الصحة، الواجبات الشهرية).',
    'Année scolaire': 'السنة الدراسية',
    'Cycles enregistrés': 'تم حفظ الأسلاك',
    'Frais de scolarité par niveau': 'واجبات التمدرس حسب المستوى',
    "Utilisés automatiquement par le formulaire d'inscription. Les élèves déjà inscrits gardent leur mensualité.":
        'تُستعمل تلقائياً في استمارة التسجيل. يحتفظ التلاميذ المسجلون بواجبهم الشهري.',
    Mensualité: 'الواجب الشهري',
    'Assurance (année)': 'التأمين (سنوي)',
    Assurance: 'التأمين',
    'Tarifs enregistrés': 'تم حفظ الأثمنة',
    "Dossier d'inscription": 'ملف التسجيل',
    Étapes: 'المراحل',
    Élève: 'التلميذ',
    'Services et frais': 'الخدمات والواجبات',
    'Prénom *': 'الاسم الشخصي *',
    'Nom *': 'الاسم العائلي *',
    'Prénom (arabe)': 'الاسم الشخصي (بالعربية)',
    'Nom (arabe)': 'الاسم العائلي (بالعربية)',
    Sexe: 'الجنس',
    Garçon: 'ذكر',
    Fille: 'أنثى',
    Nationalité: 'الجنسية',
    'Code Massar': 'رمز مسار',
    'Niveau *': 'المستوى *',
    'Groupe / classe': 'المجموعة / القسم',
    'Nouvel élève': 'تلميذ جديد',
    Réinscription: 'إعادة التسجيل',
    'École précédente': 'المؤسسة السابقة',
    'CIN du père': 'رقم بطاقة الأب',
    'Téléphone du père': 'هاتف الأب',
    'Profession du père': 'مهنة الأب',
    'Nom de la mère': 'اسم الأم',
    'CIN de la mère': 'رقم بطاقة الأم',
    'Téléphone de la mère': 'هاتف الأم',
    'Profession de la mère': 'مهنة الأم',
    'Tuteur légal (nom)': 'ولي الأمر (الاسم)',
    'Téléphone du tuteur (espace parents)': 'هاتف ولي الأمر (فضاء الآباء)',
    'Qui paie ?': 'من يؤدي الواجبات؟',
    'Le père': 'الأب',
    'La mère': 'الأم',
    'Le tuteur': 'ولي الأمر',
    "Contact d'urgence (nom)": 'جهة الاتصال في حالة الطوارئ (الاسم)',
    "Contact d'urgence (téléphone)": 'جهة الاتصال في حالة الطوارئ (الهاتف)',
    'Groupe sanguin': 'فصيلة الدم',
    Allergies: 'الحساسية',
    'Maladies chroniques': 'الأمراض المزمنة',
    Médicaments: 'الأدوية',
    "J'autorise l'établissement à faire donner les premiers soins et à appeler les urgences": 'أرخّص للمؤسسة بتقديم الإسعافات الأولية والاتصال بالمستعجلات',
    'Sans transport': 'بدون نقل',
    "Frais d'inscription (MAD)": 'واجبات التسجيل (درهم)',
    'Mensualité (MAD)': 'الواجب الشهري (درهم)',
    'Assurance (MAD)': 'التأمين (درهم)',
    'Réduction fratrie': 'تخفيض الإخوة',
    'Frère/sœur déjà inscrit(e) : {names}': 'أخ/أخت مسجل(ة): {names}',
    Carte: 'بطاقة بنكية',
    'Documents remis': 'الوثائق المسلّمة',
    "Extrait d'acte de naissance": 'نسخة من عقد الازدياد',
    "Photos d'identité": 'صور شمسية',
    'Certificat de départ': 'شهادة المغادرة',
    'Dernier bulletin': 'آخر بيان نقط',
    'Copie CIN du parent': 'نسخة بطاقة ولي الأمر',
    'Carnet de vaccination': 'دفتر التلقيح',
    Précédent: 'السابق',
    Suivant: 'التالي',
    "Dû à l'inscription": 'المستحق عند التسجيل',
    'Aucun tarif pour ce niveau : renseignez-le dans Prix': 'لا يوجد ثمن لهذا المستوى: حدده في صفحة الأسعار',
    'Choisissez le niveau': 'اختر المستوى',
    "L'inscription a échoué": 'تعذّر التسجيل',
    '{name} est inscrit(e)': 'تم تسجيل {name}',
    'Dû à l’inscription : {due} MAD · payé : {paid} MAD · reste : {rest} MAD': 'المستحق عند التسجيل: {due} درهم · المؤدّى: {paid} درهم · الباقي: {rest} درهم',
    'Imprimer le dossier': 'طباعة الملف',
    'Voir la fiche': 'عرض الملف',
    'Nom et prénom': 'الاسم الكامل',
    'الاسم والنسب': 'الاسم والنسب',
    'Date et lieu de naissance': 'تاريخ ومكان الازدياد',
    Père: 'الأب',
    Mère: 'الأم',
    'Tuteur légal': 'ولي الأمر',
    "Contact d'urgence": 'جهة الاتصال في حالة الطوارئ',
    Santé: 'الصحة',
    Identité: 'الهوية',
    'Signature du parent': 'توقيع ولي الأمر',
    "Cachet de l'établissement": 'ختم المؤسسة',
    Mensualités: 'الواجبات الشهرية',
    'Suivi des mensualités de scolarité, de septembre à juin': 'تتبع الواجبات الشهرية من شتنبر إلى يونيو',
    Attendu: 'المتوقع',
    Encaissé: 'المحصَّل',
    'Reste à encaisser': 'الباقي للتحصيل',
    'Non payé': 'غير مؤدّى',
    'Encaisser {amount} MAD': 'تحصيل {amount} درهم',
    Rappel: 'تذكير',
    'Aucune mensualité ce mois-ci (vacances d’été ou aucun élève inscrit avec une mensualité).': 'لا توجد واجبات شهرية هذا الشهر (العطلة الصيفية أو لا يوجد تلميذ بواجب شهري).',
    'Bonjour, nous vous rappelons que la mensualité de {month} de {name} ({amount} MAD) reste à régler. Merci.':
        'السلام عليكم، نذكّركم بأن الواجب الشهري لشهر {month} الخاص بـ {name} ({amount} درهم) لم يُؤدَّ بعد. شكراً.',
    'Impossible de charger les mensualités': 'تعذّر تحميل الواجبات الشهرية',
    "Échec de l'encaissement": 'تعذّر التحصيل',
    'Mensualités du mois non réglées': 'واجبات الشهر غير المؤداة',
};
```

In `frontend/lib/i18n/ar/index.ts`:

1. Add `import { schoolMode } from './school-mode';`.
2. Spread `...schoolMode` last in `AR`.

Also add the backend's French error sentences of Tasks 6–7:

```ts
    'Le prénom et le nom sont obligatoires': 'الاسم الشخصي والعائلي إلزاميان',
    'Choisissez un niveau parmi les cycles de l’établissement': 'اختر مستوى من أسلاك المؤسسة',
    'Le sexe doit être M ou F': 'يجب أن يكون الجنس ذكراً أو أنثى',
    'Code Massar invalide (une lettre suivie de 9 chiffres)': 'رمز مسار غير صالح (حرف متبوع بـ9 أرقام)',
    'Réduction fratrie invalide': 'تخفيض الإخوة غير صالح',
    'Le montant dépasse les frais et le premier mois : encaissez les mois suivants depuis « Mensualités ».': 'المبلغ يتجاوز الواجبات والشهر الأول: حصّل الأشهر الموالية من صفحة « الواجبات الشهرية ».',
    'Ce mois est déjà payé': 'هذا الشهر مؤدّى',
    'Choisissez un mois de septembre à juin': 'اختر شهراً من شتنبر إلى يونيو',
```

- [ ] **Step 3: Re-run the checker**

Run the same command as Step 1.

Expected: `{}`.

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit -p .
git add frontend/lib/i18n/ar
git commit -m "feat(education): Arabic texts of the private school mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Full checks and the browser walk-through

**Files:** none, except fixes found along the way.

- [ ] **Step 1: All tests and type-checks**

Run (backend): `npx tsc --noEmit -p . && npx jest`

Expected: every suite passes, about 790 + the new ones.

Run (frontend): `npx tsc --noEmit -p .`

Expected: no output.

- [ ] **Step 2: Restart the dev servers if needed**

The backend dev server needs the new Prisma client: restart `npm run dev` in `apps/education-apps`. The frontend runs on :3011.

- [ ] **Step 3: Walk through it as the demo owner (Al Wafa)**

Use Playwright from the session scratchpad (`pw/shotlib.mjs`: `open(lang)`, `go(page, path)`). Run the walk-through in FR, then in AR:

1. `/admin/settings`: check Préscolaire + Primaire and save.
2. `/admin/finance/prix`: set PS2 = 500 / 600 / 150 and P3 = 600 / 800 / 150, then save.
3. `/admin/inscriptions`: the 5-step form shows. Register a PS2 child:
   - with the Arabic names and a Massar code;
   - with the guardian phone of an existing demo parent (the sibling hint appears);
   - with 10 % off, paying 1190.
   - Expected: « … est inscrit(e) » with remaining 0.
4. Open « Imprimer le dossier »: the file prints with every section, in FR and in AR.
5. `/admin/finance/mensualites`: the new child shows PAID. An older demo student with a `monthlyFee` shows UNPAID. « Encaisser » turns it PAID.
6. Switch the demo school's institution type to `TUTORING_CENTER` with a temporary prisma script, then restore it. Check that `/admin/inscriptions` shows the old tutoring form and that Settings hides the cycles card.

Fix any problem found, re-run Step 1, and commit with `fix(education): …`.

- [ ] **Step 4: Final commit of the walk-through fixes, if any**

```bash
git add -A apps/education-apps
git commit -m "fix(education): private school mode — walk-through fixes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review against the spec

- **Spec coverage:**
  - Cycles and school year: Tasks 1, 4, 11. Level catalog: Tasks 2, 10.
  - `TuitionFee` grid: Tasks 5, 8, 12.
  - Professional inscription (fields, fees, sibling discount, parent link, transport, two payments, Massar check): Tasks 6, 8, 13.
  - Printable file: Task 14. Student file fields and update: Tasks 9, 15.
  - Monthly dues (September–June, collect, refusal, reminder): Tasks 3, 7, 16.
  - Dashboard: Task 16. Excel import codes and columns: Task 9. Arabic: Task 17.
  - Pack `TRANSPORT` respected: Tasks 6 and 13. Other types untouched: Tasks 4, 11, 13, 18.
- **Deviations, each explained where it appears:**
  - The API paths use one `/school-mode` prefix (Task 8).
  - The dashboard figure is the current month's remaining amount (Task 16).
- **Types used across tasks:**
  - `TuitionRow`, `DueRow`, `DuesList`, `InscriptionSummary` are defined in Task 10 and used by Tasks 12, 13, 16.
  - Backend `registerSchoolStudent(branchId, input, now)`, `listDues(branchId, month)` and `collectMonth(branchId, input)` match their tests and the controller.
