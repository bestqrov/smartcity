# Pack student limit and self-service upgrade: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce `Pack.maxStudents` whenever a student is created. When a school is full, let its admin move to a bigger pack from a dialog. The new pack applies immediately, and the school gets one month to pay.

**Architecture:**
- **Backend:**
  - `src/modules/packs/packs.limits.ts` counts the school's active students against its pack, and `createStudent` calls it.
  - A new `src/modules/subscription/` module, mounted at `/api/school`, exposes the capacity, the upgrade and the pending upgrades.
  - Each upgrade is a `PackUpgrade` row. `recordSchoolPayment` settles it, and the platform overview lists the unsettled ones.
- **Frontend:**
  - A small event bus (`lib/packs/upgradeBus.ts`) lets any code ask for an upgrade. A `PackUpgradeHost` mounted in the admin and secretary layouts answers it by showing the dialog.
  - `createStudent` in `lib/services/students.ts` catches `STUDENT_LIMIT_REACHED`, asks for an upgrade, and retries. This covers every form with no change to the forms.

**Tech stack:** Express 4, Prisma 5 on MongoDB, Jest with ts-jest (prisma mocked), Next.js 14 App Router, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-12-education-excel-student-import-design.md`, sections "Pack student limit" and "Upgrading from the limit dialog". Two deviations from the spec:
- The upgrade body is `{ packCode }`, not `{ packId }`, because the public pack list (`/packs/public`) exposes codes, not ids.
- `GET /school/capacity` also returns `status` and `upgradeDueAt`, so the dialog can state the deadline before the admin confirms.

**Working directory for every command:** `apps/education-apps` (backend), or `apps/education-apps/frontend` where stated.

**Before starting:** run `npx jest` once and note any suite that already fails. Do not fix unrelated failures. Report them.

---

## File map

**Backend, created:**
- `src/modules/packs/packs.limits.ts`: capacity lookup, `StudentLimitError`, `assertStudentCapacity`, and the 403 response.
- `src/modules/packs/packs.limits.test.ts`
- `src/modules/subscription/packUpgrade.service.ts`: `addOneMonth`, `upgradeSchoolPack`, `getPendingUpgrades`.
- `src/modules/subscription/packUpgrade.service.test.ts`
- `src/modules/subscription/subscription.controller.ts`
- `src/modules/subscription/subscription.routes.ts`

**Backend, modified:**
- `prisma/schema.prisma`: the `PackUpgrade` model, and the `School.packUpgrades` relation.
- `src/modules/students/students.service.ts`: `createStudent` checks the capacity.
- `src/modules/students/students.service.test.ts`
- `src/modules/students/students.controller.ts`: `create` maps `StudentLimitError` to 403.
- `src/modules/sales-agents/schoolPayments.service.ts`: `recordSchoolPayment` settles upgrades.
- `src/modules/sales-agents/schoolPayments.service.test.ts`
- `src/modules/platform/platform.service.ts` and `src/modules/platform/platform.service.test.ts`: `pendingUpgrades`.
- `src/app.ts`: mounts `/school`.

**Frontend, created (`frontend/`):**
- `lib/packs/limits.ts`: `limitsLine`, moved from `PricingSection`, and `studentLimitMessage`.
- `lib/packs/upgradeBus.ts`
- `lib/services/subscription.ts`
- `components/packs/PackUpgradeDialog.tsx`
- `components/packs/PackUpgradeHost.tsx`
- `components/packs/PackUpgradeBanner.tsx`
- `components/platform/PendingUpgradesCard.tsx`

**Frontend, modified:**
- `components/landing/PricingSection.tsx`: imports `limitsLine`.
- `lib/services/students.ts`: retries after an upgrade.
- `components/forms/AddStudentForm.tsx`: shows the real error message.
- `app/admin/layout.tsx` and `app/secretary/layout.tsx`: mount the host, and the admin layout shows the banner.
- `lib/services/platform.ts`, `lib/platform/messages.ts`, `app/admin/platform/page.tsx`

---

### Task 1: The `PackUpgrade` model

**Files:**
- Modify: `prisma/schema.prisma` (`model School` near line 118; append the new model after `model SchoolPayment`, near line 710)

- [ ] **Step 1: Add the relation field to `School`**

In `model School`, after the line `payments     SchoolPayment[]`, add:

```prisma
  packUpgrades PackUpgrade[]
```

- [ ] **Step 2: Add the model after `model SchoolPayment { ... }`**

```prisma
// A school moving itself to a bigger pack from the student-limit dialog. The new pack applies at once;
// `dueAt` is the payment deadline (null for a school still on trial). `settledAt` is set when the super
// admin records a school payment dated on or after the upgrade. Nothing happens automatically at `dueAt`.
model PackUpgrade {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  schoolId       String    @db.ObjectId
  school         School    @relation(fields: [schoolId], references: [id])
  fromPackId     String?   @db.ObjectId
  fromPackName   String?
  toPackId       String    @db.ObjectId
  toPackName     String
  toMonthlyPrice Float
  byUserId       String    @db.ObjectId
  reason         String
  createdAt      DateTime  @default(now())
  dueAt          DateTime?
  settledAt      DateTime?

  @@index([schoolId, createdAt])
  @@index([settledAt, dueAt])
  @@map("pack_upgrades")
}
```

- [ ] **Step 3: Validate, generate and push**

Run: `npx prisma validate && npx prisma generate && npx prisma db push`

Expected: "The schema at prisma/schema.prisma is valid", "Generated Prisma Client", and "Your database is now in sync with your Prisma schema".

- [ ] **Step 4: Run the whole suite**

Run: `npx jest`

Expected: the same result as before starting. Nothing uses the model yet.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(education): PackUpgrade model"
```

---

### Task 2: Capacity check (`packs.limits.ts`)

**Files:**
- Create: `src/modules/packs/packs.limits.ts`
- Test: `src/modules/packs/packs.limits.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/packs/packs.limits.test.ts
import prisma from '../../config/database';
import { assertStudentCapacity, getSchoolCapacity, StudentLimitError } from './packs.limits';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findUnique: jest.fn(), findMany: jest.fn() },
        student: { count: jest.fn() },
    },
}));

const school = (pack: { code: string; name: string; maxStudents: number | null } | null, status = 'ACTIVE') => ({
    school: { id: 'sc1', status, institutionType: 'TUTORING_CENTER', pack },
});

const PRO = { code: 'pro-soutien', name: 'Pro', maxStudents: 300 };

beforeEach(() => {
    jest.clearAllMocks();
    (prisma.branch.findMany as jest.Mock).mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
});

describe('getSchoolCapacity', () => {
    it('counts the active students of every branch of the school', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school(PRO));
        (prisma.student.count as jest.Mock).mockResolvedValue(120);

        const capacity = await getSchoolCapacity('b1');

        expect(prisma.branch.findMany).toHaveBeenCalledWith({ where: { schoolId: 'sc1' }, select: { id: true } });
        expect(prisma.student.count).toHaveBeenCalledWith({ where: { active: true, branchId: { in: ['b1', 'b2'] } } });
        expect(capacity).toEqual({
            schoolId: 'sc1',
            status: 'ACTIVE',
            institutionType: 'TUTORING_CENTER',
            packCode: 'pro-soutien',
            packName: 'Pro',
            limit: 300,
            current: 120,
        });
    });

    it('treats a missing institution type as PRIVATE_SCHOOL', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
            school: { id: 'sc1', status: 'ACTIVE', institutionType: null, pack: null },
        });
        (prisma.student.count as jest.Mock).mockResolvedValue(0);
        expect((await getSchoolCapacity('b1')).institutionType).toBe('PRIVATE_SCHOOL');
    });

    it('fails when the branch has no school', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getSchoolCapacity('b1')).rejects.toThrow('School not found');
    });
});

describe('assertStudentCapacity', () => {
    it('passes while the school stays within its limit, exactly at the limit included', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school(PRO));
        (prisma.student.count as jest.Mock).mockResolvedValue(299);
        await expect(assertStudentCapacity('b1', 1)).resolves.toMatchObject({ current: 299, limit: 300 });
    });

    it('throws StudentLimitError with the numbers when the school would go over', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school(PRO));
        (prisma.student.count as jest.Mock).mockResolvedValue(120);

        const error = await assertStudentCapacity('b1', 250).catch((e) => e);

        expect(error).toBeInstanceOf(StudentLimitError);
        expect(error.message).toBe('STUDENT_LIMIT_REACHED');
        expect(error.details).toEqual({ limit: 300, current: 120, adding: 250, packName: 'Pro' });
    });

    it('never blocks an unlimited pack or a school with no pack', async () => {
        (prisma.student.count as jest.Mock).mockResolvedValue(5000);
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school({ code: 'premium', name: 'Premium', maxStudents: null }));
        await expect(assertStudentCapacity('b1', 1000)).resolves.toBeDefined();
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school(null));
        await expect(assertStudentCapacity('b1', 1000)).resolves.toBeDefined();
    });
});
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx jest src/modules/packs/packs.limits.test.ts`

Expected: FAIL, "Cannot find module './packs.limits'".

- [ ] **Step 3: Implement**

```ts
// src/modules/packs/packs.limits.ts
import type { Response } from 'express';
import prisma from '../../config/database';
import { DEFAULT_INSTITUTION_TYPE } from './packs.constants';

// The pack's student limit applies to the whole school (all its branches); only active students count.
// A null limit (Premium, Crèche Plus) or a school without a pack means no limit.
export interface SchoolCapacity {
    schoolId: string;
    status: string;
    institutionType: string;
    packCode: string | null;
    packName: string | null;
    limit: number | null;
    current: number;
}

export interface StudentLimitDetails {
    limit: number;
    current: number;
    adding: number;
    packName: string | null;
}

export class StudentLimitError extends Error {
    readonly details: StudentLimitDetails;

    constructor(details: StudentLimitDetails) {
        super('STUDENT_LIMIT_REACHED');
        this.name = 'StudentLimitError';
        this.details = details;
    }
}

export const getSchoolCapacity = async (branchId: string): Promise<SchoolCapacity> => {
    const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: {
            school: {
                select: {
                    id: true,
                    status: true,
                    institutionType: true,
                    pack: { select: { code: true, name: true, maxStudents: true } },
                },
            },
        },
    });
    const school = branch?.school;
    if (!school) throw new Error('School not found');

    const branches = await prisma.branch.findMany({ where: { schoolId: school.id }, select: { id: true } });
    const current = await prisma.student.count({
        where: { active: true, branchId: { in: branches.map((item) => item.id) } },
    });

    return {
        schoolId: school.id,
        status: school.status,
        institutionType: school.institutionType ?? DEFAULT_INSTITUTION_TYPE,
        packCode: school.pack?.code ?? null,
        packName: school.pack?.name ?? null,
        limit: school.pack?.maxStudents ?? null,
        current,
    };
};

export const remainingPlaces = (capacity: Pick<SchoolCapacity, 'limit' | 'current'>): number | null =>
    capacity.limit === null ? null : Math.max(0, capacity.limit - capacity.current);

export const assertStudentCapacity = async (branchId: string, adding: number): Promise<SchoolCapacity> => {
    const capacity = await getSchoolCapacity(branchId);
    if (capacity.limit !== null && capacity.current + adding > capacity.limit) {
        throw new StudentLimitError({ limit: capacity.limit, current: capacity.current, adding, packName: capacity.packName });
    }
    return capacity;
};

// 403 with a machine-readable code and the numbers: the frontend opens the upgrade dialog from them.
export const sendStudentLimitError = (res: Response, error: StudentLimitError): void => {
    const { limit, current, adding } = error.details;
    res.status(403).json({
        success: false,
        error: 'STUDENT_LIMIT_REACHED',
        message: `Limite du pack atteinte : ${limit} élèves autorisés, ${current} inscrits, ${adding} à ajouter.`,
        data: error.details,
    });
};
```

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx jest src/modules/packs/packs.limits.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/packs/packs.limits.ts src/modules/packs/packs.limits.test.ts
git commit -m "feat(education): school-wide student capacity check against the pack"
```

---

### Task 3: Enforce the limit in `POST /students`

**Files:**
- Modify: `src/modules/students/students.service.ts` (the start of `createStudent`, near line 58)
- Modify: `src/modules/students/students.controller.ts` (the `create` catch block, near line 64)
- Test: `src/modules/students/students.service.test.ts`

- [ ] **Step 1: Mock the limits module in the existing test file, and add the failing test**

In `src/modules/students/students.service.test.ts`, add this right after the existing `jest.mock('../../config/database', ...)` block:

```ts
jest.mock('../packs/packs.limits', () => {
    const actual = jest.requireActual('../packs/packs.limits');
    return { ...actual, assertStudentCapacity: jest.fn().mockResolvedValue(undefined) };
});
```

Add this import at the top, next to the others:

```ts
import { assertStudentCapacity, StudentLimitError } from '../packs/packs.limits';
```

Append this test at the end of the file:

```ts
describe('createStudent pack limit', () => {
    it('checks room for one student in the branch before creating anything', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        await createStudent({ name: 'A', surname: 'B', branchId: 'b1' } as any);
        expect(assertStudentCapacity).toHaveBeenCalledWith('b1', 1);
    });

    it('creates nothing when the school is full', async () => {
        (prisma.student.create as jest.Mock).mockClear();
        (assertStudentCapacity as jest.Mock).mockRejectedValueOnce(
            new StudentLimitError({ limit: 100, current: 100, adding: 1, packName: 'Essentiel' })
        );

        await expect(createStudent({ name: 'A', surname: 'B', branchId: 'b1' } as any)).rejects.toBeInstanceOf(StudentLimitError);
        expect(prisma.student.create).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx jest src/modules/students/students.service.test.ts`

Expected: the two new tests FAIL. `assertStudentCapacity` is not called, and the student is created.

- [ ] **Step 3: Call the check in `createStudent`**

In `src/modules/students/students.service.ts`, add this import at the top:

```ts
import { assertStudentCapacity } from '../packs/packs.limits';
```

Then change the start of `createStudent` from:

```ts
export const createStudent = async (data: CreateStudentData & { inscriptionFee?: number; subjectsTotal?: number; amountPaid?: number }) => {
    return await prisma.$transaction(async (tx) => {
```

to:

```ts
export const createStudent = async (data: CreateStudentData & { inscriptionFee?: number; subjectsTotal?: number; amountPaid?: number }) => {
    // Every way of adding one student goes through here: the pack limit is enforced once, for all forms.
    await assertStudentCapacity(data.branchId, 1);

    return await prisma.$transaction(async (tx) => {
```

- [ ] **Step 4: Return 403 from the controller**

In `src/modules/students/students.controller.ts`, add this import:

```ts
import { StudentLimitError, sendStudentLimitError } from '../packs/packs.limits';
```

Then change the catch block of `create` from:

```ts
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create student', 400);
    }
};

export const getAll = async
```

to:

```ts
    } catch (error: any) {
        if (error instanceof StudentLimitError) {
            sendStudentLimitError(res, error);
            return;
        }
        sendError(res, error.message, 'Failed to create student', 400);
    }
};

export const getAll = async
```

- [ ] **Step 5: Run the tests and check that they pass**

Run: `npx jest src/modules/students`

Expected: PASS, the existing tests included.

- [ ] **Step 6: Commit**

```bash
git add src/modules/students/students.service.ts src/modules/students/students.controller.ts src/modules/students/students.service.test.ts
git commit -m "feat(education): creating a student respects the pack student limit"
```

---

### Task 4: The upgrade service

**Files:**
- Create: `src/modules/subscription/packUpgrade.service.ts`
- Test: `src/modules/subscription/packUpgrade.service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/subscription/packUpgrade.service.test.ts
import prisma from '../../config/database';
import { getSchoolCapacity } from '../packs/packs.limits';
import { addOneMonth, getPendingUpgrades, upgradeSchoolPack } from './packUpgrade.service';

jest.mock('../packs/packs.limits', () => ({ getSchoolCapacity: jest.fn() }));

jest.mock('../../config/database', () => {
    const tx = {
        school: { findUnique: jest.fn(), update: jest.fn() },
        pack: { findFirst: jest.fn() },
        packUpgrade: { create: jest.fn() },
    };
    return {
        __esModule: true,
        default: {
            packUpgrade: { findMany: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

const ESSENTIEL = { id: 'p1', code: 'essentiel-soutien', name: 'Essentiel', maxStudents: 150, monthlyPrice: 170, active: true, institutionTypes: ['TUTORING_CENTER'] };
const PRO = { id: 'p2', code: 'pro-soutien', name: 'Pro', maxStudents: 400, monthlyPrice: 300, active: true, institutionTypes: ['TUTORING_CENTER'] };
const PREMIUM = { id: 'p3', code: 'premium-soutien', name: 'Premium', maxStudents: null, monthlyPrice: 399, active: true, institutionTypes: ['TUTORING_CENTER'] };
const SCHOOL_PRO = { id: 'sc1', status: 'ACTIVE', institutionType: 'TUTORING_CENTER', pack: PRO };

beforeEach(() => {
    jest.clearAllMocks();
    (getSchoolCapacity as jest.Mock).mockResolvedValue({ schoolId: 'sc1', current: 390, limit: 400 });
    tx.packUpgrade.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'u1', ...data }));
});

describe('addOneMonth', () => {
    it('adds one calendar month', () => {
        expect(addOneMonth(new Date('2026-11-12T10:00:00Z')).toISOString()).toBe('2026-12-12T10:00:00.000Z');
        expect(addOneMonth(new Date('2026-12-20T00:00:00Z')).toISOString()).toBe('2027-01-20T00:00:00.000Z');
    });

    it('clamps to the last day of a shorter month', () => {
        expect(addOneMonth(new Date('2027-01-31T09:00:00Z')).toISOString()).toBe('2027-02-28T09:00:00.000Z');
        expect(addOneMonth(new Date('2028-01-31T09:00:00Z')).toISOString()).toBe('2028-02-29T09:00:00.000Z');
    });
});

describe('upgradeSchoolPack', () => {
    it('moves an ACTIVE school to a bigger pack, with a deadline one month later', async () => {
        tx.school.findUnique.mockResolvedValue(SCHOOL_PRO);
        tx.pack.findFirst.mockResolvedValue(PREMIUM);

        const result = await upgradeSchoolPack('b1', 'user1', 'premium-soutien');

        expect(tx.pack.findFirst).toHaveBeenCalledWith({ where: { code: 'premium-soutien', active: true } });
        expect(tx.school.update).toHaveBeenCalledWith({ where: { id: 'sc1' }, data: { packId: 'p3' } });
        const data = tx.packUpgrade.create.mock.calls[0][0].data;
        expect(data).toMatchObject({
            schoolId: 'sc1',
            fromPackId: 'p2',
            fromPackName: 'Pro',
            toPackId: 'p3',
            toPackName: 'Premium',
            toMonthlyPrice: 399,
            byUserId: 'user1',
            reason: 'STUDENT_LIMIT',
            settledAt: null,
        });
        expect(data.dueAt).toEqual(addOneMonth(data.createdAt));
        expect(result).toEqual({ packCode: 'premium-soutien', packName: 'Premium', limit: null, current: 390, dueAt: data.dueAt });
    });

    it('sets no deadline for a school still on trial', async () => {
        tx.school.findUnique.mockResolvedValue({ ...SCHOOL_PRO, status: 'PENDING' });
        tx.pack.findFirst.mockResolvedValue(PREMIUM);
        await upgradeSchoolPack('b1', 'user1', 'premium-soutien');
        expect(tx.packUpgrade.create.mock.calls[0][0].data.dueAt).toBeNull();
    });

    it('refuses the same pack, a smaller pack, a pack of another type, and an unknown or inactive pack', async () => {
        tx.school.findUnique.mockResolvedValue(SCHOOL_PRO);

        tx.pack.findFirst.mockResolvedValueOnce(PRO);
        await expect(upgradeSchoolPack('b1', 'u', 'pro-soutien')).rejects.toThrow('Only an upgrade to a bigger pack is allowed');
        tx.pack.findFirst.mockResolvedValueOnce(ESSENTIEL);
        await expect(upgradeSchoolPack('b1', 'u', 'essentiel-soutien')).rejects.toThrow('Only an upgrade to a bigger pack is allowed');
        tx.pack.findFirst.mockResolvedValueOnce({ ...PREMIUM, institutionTypes: ['CRECHE'] });
        await expect(upgradeSchoolPack('b1', 'u', 'creche-plus')).rejects.toThrow('Pack does not serve this institution type');
        tx.pack.findFirst.mockResolvedValueOnce(null);
        await expect(upgradeSchoolPack('b1', 'u', 'nope')).rejects.toThrow('Pack not found');

        expect(tx.school.update).not.toHaveBeenCalled();
        expect(tx.packUpgrade.create).not.toHaveBeenCalled();
    });

    it('lets a school with no pack pick any pack of its type', async () => {
        tx.school.findUnique.mockResolvedValue({ ...SCHOOL_PRO, pack: null });
        tx.pack.findFirst.mockResolvedValue(ESSENTIEL);
        await expect(upgradeSchoolPack('b1', 'u', 'essentiel-soutien')).resolves.toMatchObject({ packName: 'Essentiel' });
    });

    it('requires a pack code', async () => {
        await expect(upgradeSchoolPack('b1', 'u', undefined)).rejects.toThrow('Pack code is required');
        await expect(upgradeSchoolPack('b1', 'u', { $ne: 1 })).rejects.toThrow('Pack code is required');
    });

    it("always upgrades the caller's school, found from the branch", async () => {
        tx.school.findUnique.mockResolvedValue(SCHOOL_PRO);
        tx.pack.findFirst.mockResolvedValue(PREMIUM);
        await upgradeSchoolPack('b1', 'u', 'premium-soutien');
        expect(getSchoolCapacity).toHaveBeenCalledWith('b1');
        expect(tx.school.findUnique).toHaveBeenCalledWith({ where: { id: 'sc1' }, include: { pack: true } });
    });
});

describe('getPendingUpgrades', () => {
    it("lists the school's unsettled upgrades that have a deadline", async () => {
        (prisma.packUpgrade.findMany as jest.Mock).mockResolvedValue([]);
        await getPendingUpgrades('b1');
        expect(prisma.packUpgrade.findMany).toHaveBeenCalledWith({
            where: { schoolId: 'sc1', dueAt: { not: null }, OR: [{ settledAt: null }, { settledAt: { isSet: false } }] },
            orderBy: { createdAt: 'desc' },
            select: { id: true, toPackName: true, toMonthlyPrice: true, createdAt: true, dueAt: true },
        });
    });
});
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx jest src/modules/subscription/packUpgrade.service.test.ts`

Expected: FAIL, "Cannot find module './packUpgrade.service'".

- [ ] **Step 3: Implement**

```ts
// src/modules/subscription/packUpgrade.service.ts
import prisma from '../../config/database';
import { DEFAULT_INSTITUTION_TYPE } from '../packs/packs.constants';
import { getSchoolCapacity } from '../packs/packs.limits';

// Same day next month, clamped to the month's last day (31 Jan -> 28/29 Feb). UTC, like every stored date.
export const addOneMonth = (date: Date): Date => {
    const result = new Date(date.getTime());
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
};

// MongoDB: an unset optional field is not matched by `null`, so "unsettled" checks both.
export const UNSETTLED = { OR: [{ settledAt: null }, { settledAt: { isSet: false } }] };

const room = (maxStudents: number | null) => (maxStudents === null ? Infinity : maxStudents);

// The school moves itself to a bigger pack of its type. The pack applies at once; an ACTIVE school gets
// one month to pay, a school on trial pays for it when the trial ends (no deadline).
export const upgradeSchoolPack = async (branchId: string, userId: string, packCode: unknown) => {
    if (typeof packCode !== 'string' || !packCode.trim()) throw new Error('Pack code is required');
    const capacity = await getSchoolCapacity(branchId);

    return prisma.$transaction(async (tx) => {
        const school = await tx.school.findUnique({ where: { id: capacity.schoolId }, include: { pack: true } });
        if (!school) throw new Error('School not found');

        const pack = await tx.pack.findFirst({ where: { code: packCode.trim(), active: true } });
        if (!pack) throw new Error('Pack not found');
        if (!pack.institutionTypes.includes(school.institutionType ?? DEFAULT_INSTITUTION_TYPE)) {
            throw new Error('Pack does not serve this institution type');
        }
        if (school.pack && room(pack.maxStudents) <= room(school.pack.maxStudents)) {
            throw new Error('Only an upgrade to a bigger pack is allowed');
        }

        const now = new Date();
        await tx.school.update({ where: { id: school.id }, data: { packId: pack.id } });
        const upgrade = await tx.packUpgrade.create({
            data: {
                schoolId: school.id,
                fromPackId: school.pack?.id ?? null,
                fromPackName: school.pack?.name ?? null,
                toPackId: pack.id,
                toPackName: pack.name,
                toMonthlyPrice: pack.monthlyPrice,
                byUserId: userId,
                reason: 'STUDENT_LIMIT',
                createdAt: now,
                dueAt: school.status === 'PENDING' ? null : addOneMonth(now),
                settledAt: null,
            },
        });

        return { packCode: pack.code, packName: pack.name, limit: pack.maxStudents, current: capacity.current, dueAt: upgrade.dueAt };
    });
};

export const getPendingUpgrades = async (branchId: string) => {
    const { schoolId } = await getSchoolCapacity(branchId);
    return prisma.packUpgrade.findMany({
        where: { schoolId, dueAt: { not: null }, ...UNSETTLED },
        orderBy: { createdAt: 'desc' },
        select: { id: true, toPackName: true, toMonthlyPrice: true, createdAt: true, dueAt: true },
    });
};
```

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx jest src/modules/subscription/packUpgrade.service.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/subscription
git commit -m "feat(education): schools can upgrade their pack, with a one-month payment deadline"
```

---

### Task 5: The `/school` routes

**Files:**
- Create: `src/modules/subscription/subscription.controller.ts`
- Create: `src/modules/subscription/subscription.routes.ts`
- Modify: `src/app.ts` (the routes list, near line 76)

- [ ] **Step 1: The controller**

```ts
// src/modules/subscription/subscription.controller.ts
import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import { getSchoolCapacity, remainingPlaces } from '../packs/packs.limits';
import { addOneMonth, getPendingUpgrades, upgradeSchoolPack } from './packUpgrade.service';

// The school is always the caller's own: tenantScope sets req.branchId, nothing is read from the body.
export const capacity = (req: TenantRequest, res: Response) =>
    respond(
        res,
        async () => {
            const result = await getSchoolCapacity(req.branchId!);
            return {
                institutionType: result.institutionType,
                status: result.status,
                packCode: result.packCode,
                packName: result.packName,
                limit: result.limit,
                current: result.current,
                remaining: remainingPlaces(result),
                // The deadline an upgrade made now would get, shown before the admin confirms.
                upgradeDueAt: result.status === 'PENDING' ? null : addOneMonth(new Date()),
            };
        },
        { message: 'School capacity', failure: 'Failed to load school capacity' }
    );

export const upgrade = (req: TenantRequest, res: Response) =>
    respond(res, () => upgradeSchoolPack(req.branchId!, req.user!.id, req.body?.packCode), {
        message: 'Pack upgraded',
        failure: 'Failed to upgrade pack',
    });

export const pending = (req: TenantRequest, res: Response) =>
    respond(res, () => getPendingUpgrades(req.branchId!), {
        message: 'Pending upgrades',
        failure: 'Failed to load pending upgrades',
    });
```

- [ ] **Step 2: The routes**

```ts
// src/modules/subscription/subscription.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { capacity, pending, upgrade } from './subscription.controller';

const router = Router();

router.use(authMiddleware);

// Anyone who can add students sees the numbers; only ADMIN and OWNER commit the school to a higher price.
router.get('/capacity', roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'), tenantScopeMiddleware, capacity);
router.post('/pack-upgrade', roleMiddleware('ADMIN', 'OWNER'), tenantScopeMiddleware, upgrade);
router.get('/pack-upgrade/pending', roleMiddleware('ADMIN', 'OWNER'), tenantScopeMiddleware, pending);

export default router;
```

- [ ] **Step 3: Mount it**

In `src/app.ts`, add this import next to the other route imports:

```ts
import subscriptionRoutes from './modules/subscription/subscription.routes';
```

Then add this after `apiRouter.use('/platform', platformRoutes);`:

```ts
apiRouter.use('/school', subscriptionRoutes);
```

- [ ] **Step 4: Type-check and run the suite**

Run: `npx tsc --noEmit && npx jest`

Expected: no type errors, and the same results as before starting plus the new suites.

- [ ] **Step 5: Smoke test with the dev server**

Run: `npm run dev` in one terminal. Then log in as a school admin of a test school through the frontend at localhost:3011, and copy the bearer token from the browser devtools (Network tab, `Authorization` header). Then run:

```bash
curl -s -H "Authorization: Bearer <TOKEN>" http://localhost:3010/api/school/capacity
```

Expected: `{"success":true,"data":{"institutionType":...,"limit":...,"current":...,"remaining":...,"upgradeDueAt":...}}`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/subscription src/app.ts
git commit -m "feat(education): /school capacity, pack upgrade and pending upgrades routes"
```

---

### Task 6: Recording a school payment settles open upgrades

**Files:**
- Modify: `src/modules/sales-agents/schoolPayments.service.ts` (`recordSchoolPayment`, near line 41)
- Test: `src/modules/sales-agents/schoolPayments.service.test.ts`

- [ ] **Step 1: Extend the mock and add the failing test**

In `schoolPayments.service.test.ts`, change the `tx` line of the database mock from:

```ts
    const tx = { school: { findUnique: jest.fn(), update: jest.fn() }, schoolPayment: { create: jest.fn() } };
```

to:

```ts
    const tx = {
        school: { findUnique: jest.fn(), update: jest.fn() },
        schoolPayment: { create: jest.fn() },
        packUpgrade: { updateMany: jest.fn() },
    };
```

Inside `describe('recordSchoolPayment', ...)`, add:

```ts
    it('settles the open upgrades of that school made up to the end of the payment day', async () => {
        tx.school.findUnique.mockResolvedValue(crecheSchool);

        await recordSchoolPayment('s1', { amount: 350, period: 'MONTHLY', paidAt: '2026-11-12' });

        expect(tx.packUpgrade.updateMany).toHaveBeenCalledWith({
            where: {
                schoolId: 's1',
                createdAt: { lt: new Date('2026-11-13T00:00:00.000Z') },
                OR: [{ settledAt: null }, { settledAt: { isSet: false } }],
            },
            data: { settledAt: new Date('2026-11-12') },
        });
    });
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx jest src/modules/sales-agents/schoolPayments.service.test.ts`

Expected: the new test FAILS, because `updateMany` is not called.

- [ ] **Step 3: Implement**

In `schoolPayments.service.ts`, add this import:

```ts
import { UNSETTLED } from '../subscription/packUpgrade.service';
```

In `recordSchoolPayment`, right before `const packId = school.pack?.id ?? null;`, add:

```ts
        // A payment settles the school's pack upgrades made up to the end of the payment day (paidAt is a
        // date at midnight UTC, the upgrade a timestamp, so an upgrade and its payment the same day match).
        await tx.packUpgrade.updateMany({
            where: {
                schoolId,
                createdAt: { lt: new Date(data.paidAt.getTime() + 86_400_000) },
                ...UNSETTLED,
            },
            data: { settledAt: data.paidAt },
        });
```

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx jest src/modules/sales-agents`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents/schoolPayments.service.ts src/modules/sales-agents/schoolPayments.service.test.ts
git commit -m "feat(education): a school payment settles its pending pack upgrades"
```

---

### Task 7: Unsettled upgrades in the platform overview

**Files:**
- Modify: `src/modules/platform/platform.service.ts`
- Test: `src/modules/platform/platform.service.test.ts`

- [ ] **Step 1: Update the mock and add the failing test**

In `platform.service.test.ts`, add `packUpgrade: { findMany: jest.fn() },` to the mocked `default` object, next to `agentPayout`.

In the `beforeEach` that sets the mocks (near line 96), add:

```ts
    (prisma.packUpgrade.findMany as jest.Mock).mockResolvedValue([
        {
            id: 'u1',
            schoolId: 's1',
            fromPackName: 'Pro',
            toPackName: 'Premium',
            toMonthlyPrice: 650,
            createdAt: d('2026-11-01T10:00:00Z'),
            dueAt: d('2026-12-01T10:00:00Z'),
            school: { name: 'École Atlas' },
        },
    ]);
```

Add this test:

```ts
    it('returns the unsettled upgrades that have a deadline, earliest deadline first', async () => {
        const overview = await getPlatformOverview();

        expect(prisma.packUpgrade.findMany).toHaveBeenCalledWith({
            where: { dueAt: { not: null }, OR: [{ settledAt: null }, { settledAt: { isSet: false } }] },
            orderBy: { dueAt: 'asc' },
            select: {
                id: true,
                schoolId: true,
                fromPackName: true,
                toPackName: true,
                toMonthlyPrice: true,
                createdAt: true,
                dueAt: true,
                school: { select: { name: true } },
            },
        });
        expect(overview.pendingUpgrades).toEqual([
            {
                id: 'u1',
                schoolId: 's1',
                schoolName: 'École Atlas',
                fromPackName: 'Pro',
                toPackName: 'Premium',
                toMonthlyPrice: 650,
                createdAt: d('2026-11-01T10:00:00Z'),
                dueAt: d('2026-12-01T10:00:00Z'),
            },
        ]);
    });
```

In the test `'works on an empty platform'`, add `(prisma.packUpgrade.findMany as jest.Mock).mockResolvedValue([]);` and change the expected value to:

```ts
{ schools: [], payments: [], agents: [], payouts: [], pendingUpgrades: [] }
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx jest src/modules/platform/platform.service.test.ts`

Expected: the new test and the empty-platform test FAIL.

- [ ] **Step 3: Implement**

In `platform.service.ts`:

Add this import:

```ts
import { UNSETTLED } from '../subscription/packUpgrade.service';
```

Change `const [schools, payments, agents, payouts] = await Promise.all([` to `const [schools, payments, agents, payouts, upgrades] = await Promise.all([`.

Then add this fifth query after the `prisma.agentPayout.findMany({...})` entry:

```ts
        prisma.packUpgrade.findMany({
            where: { dueAt: { not: null }, ...UNSETTLED },
            orderBy: { dueAt: 'asc' },
            select: {
                id: true,
                schoolId: true,
                fromPackName: true,
                toPackName: true,
                toMonthlyPrice: true,
                createdAt: true,
                dueAt: true,
                school: { select: { name: true } },
            },
        }),
```

In the returned object, after `payouts: ...`, add:

```ts
        pendingUpgrades: upgrades.map((upgrade) => ({
            id: upgrade.id,
            schoolId: upgrade.schoolId,
            schoolName: upgrade.school.name,
            fromPackName: upgrade.fromPackName,
            toPackName: upgrade.toPackName,
            toMonthlyPrice: upgrade.toMonthlyPrice,
            createdAt: upgrade.createdAt,
            dueAt: upgrade.dueAt,
        })),
```

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx jest src/modules/platform`

Expected: PASS, `platform.routes.test.ts` included. If that file mocks the service output with an exact shape, add `pendingUpgrades: []` to it.

- [ ] **Step 5: Commit**

```bash
git add src/modules/platform
git commit -m "feat(education): platform overview lists pack upgrades awaiting payment"
```

---

### Task 8: Share the pack limits line with the app

**Files:**
- Create: `frontend/lib/packs/limits.ts`
- Modify: `frontend/components/landing/PricingSection.tsx` (lines 31-49)

- [ ] **Step 1: Create the shared module**

```ts
// frontend/lib/packs/limits.ts
import type { Messages } from '@/lib/landing/messages';
import type { InstitutionType } from '@/lib/institutionTypes';
import type { PublicPack } from '@/lib/services/packs';

const fill = (template: string, n: number) => template.replace('{n}', String(n));

// "Jusqu'à 300 élèves · 2 établissements": shared by the landing pricing cards and the in-app upgrade dialog.
export const limitsLine = (pack: Pick<PublicPack, 'maxStudents' | 'maxBranches'>, type: InstitutionType, m: Messages): string => {
    const creche = type === 'CRECHE';
    const students =
        pack.maxStudents === null
            ? creche ? m.lim_children_unlimited : m.lim_students_unlimited
            : fill(creche ? m.lim_children : m.lim_students, pack.maxStudents);
    const branches =
        pack.maxBranches === null
            ? m.lim_branches_unlimited
            : pack.maxBranches === 1
            ? m.lim_branch_one
            : pack.maxBranches === 2
            ? m.lim_branches_two
            : fill(m.lim_branches, pack.maxBranches);
    return `${students} · ${branches}`;
};

export interface StudentLimitDetails {
    limit: number;
    current: number;
    adding: number;
    packName: string | null;
}

export const missingPlaces = (d: StudentLimitDetails) => Math.max(0, d.current + d.adding - d.limit);

export const studentLimitMessage = (d: StudentLimitDetails): string => {
    const pack = d.packName ? `Votre pack « ${d.packName} »` : 'Votre pack';
    const adding = d.adding === 1 ? 'vous voulez en ajouter 1' : `vous voulez en ajouter ${d.adding}`;
    const missing = missingPlaces(d);
    return `${pack} permet ${d.limit} élèves. Vous en avez ${d.current}, ${adding} : il manque ${missing} place${missing > 1 ? 's' : ''}.`;
};
```

- [ ] **Step 2: Use it in `PricingSection.tsx`**

Delete the local `const fill = ...` (line 31) and the whole `const limitsLine = ...` function (lines 33-49). Add this import:

```ts
import { limitsLine } from '@/lib/packs/limits';
```

- [ ] **Step 3: Type-check**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/packs/limits.ts frontend/components/landing/PricingSection.tsx
git commit -m "refactor(education): pack limits line shared by landing and app"
```

---

### Task 9: Frontend service and upgrade bus

**Files:**
- Create: `frontend/lib/services/subscription.ts`
- Create: `frontend/lib/packs/upgradeBus.ts`

- [ ] **Step 1: The service**

```ts
// frontend/lib/services/subscription.ts
import api from '../api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '../institutionTypes';
import type { StudentLimitDetails } from '../packs/limits';

export interface SchoolCapacity {
    institutionType: InstitutionType;
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
    packCode: string | null;
    packName: string | null;
    limit: number | null;
    current: number;
    remaining: number | null;
    upgradeDueAt: string | null;
}

export interface UpgradeResult {
    packCode: string;
    packName: string;
    limit: number | null;
    current: number;
    dueAt: string | null;
}

export interface PendingUpgrade {
    id: string;
    toPackName: string;
    toMonthlyPrice: number;
    createdAt: string;
    dueAt: string;
}

export async function getSchoolCapacity(): Promise<SchoolCapacity> {
    const response = await api.get<ApiResponse<SchoolCapacity>>('/school/capacity');
    return response.data.data;
}

export async function upgradePack(packCode: string): Promise<UpgradeResult> {
    const response = await api.post<ApiResponse<UpgradeResult>>('/school/pack-upgrade', { packCode });
    return response.data.data;
}

export async function getPendingUpgrades(): Promise<PendingUpgrade[]> {
    const response = await api.get<ApiResponse<PendingUpgrade[]>>('/school/pack-upgrade/pending');
    return response.data.data;
}

// The numbers of a 403 STUDENT_LIMIT_REACHED, or null for any other error.
export const studentLimitDetails = (error: any): StudentLimitDetails | null =>
    error?.response?.status === 403 && error?.response?.data?.error === 'STUDENT_LIMIT_REACHED'
        ? (error.response.data.data as StudentLimitDetails)
        : null;
```

- [ ] **Step 2: The bus**

```ts
// frontend/lib/packs/upgradeBus.ts
// Lets plain code (services, the import wizard) open the upgrade dialog and wait for the outcome.
// PackUpgradeHost, mounted once in the admin and secretary layouts, registers the handler.
import type { StudentLimitDetails } from './limits';

type Handler = (details: StudentLimitDetails) => Promise<boolean>;

let handler: Handler | null = null;

export const registerUpgradeHandler = (next: Handler): (() => void) => {
    handler = next;
    return () => {
        if (handler === next) handler = null;
    };
};

// Resolves true once the school has upgraded, false if the user cancelled or no dialog is mounted.
export const askForUpgrade = (details: StudentLimitDetails): Promise<boolean> =>
    handler ? handler(details) : Promise.resolve(false);
```

- [ ] **Step 3: Type-check**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/services/subscription.ts frontend/lib/packs/upgradeBus.ts
git commit -m "feat(education): frontend service and bus for pack upgrades"
```

---

### Task 10: The upgrade dialog and its host

**Files:**
- Create: `frontend/components/packs/PackUpgradeDialog.tsx`
- Create: `frontend/components/packs/PackUpgradeHost.tsx`
- Modify: `frontend/app/admin/layout.tsx`, `frontend/app/secretary/layout.tsx`

- [ ] **Step 1: The dialog**

```tsx
// frontend/components/packs/PackUpgradeDialog.tsx
'use client';

// Opens when the school has no room for the students being added. It shows the same packs as the landing
// page (GET /packs/public for the school's type), with the same limits line. ADMIN and OWNER can move to a
// bigger pack; a SECRETARY only sees the numbers.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { messages } from '@/lib/landing/messages';
import { PACK_FEATURES } from '@/lib/packs';
import { limitsLine, studentLimitMessage, type StudentLimitDetails } from '@/lib/packs/limits';
import { apiErrorMessage, fetchPublicPacks, type PublicPack } from '@/lib/services/packs';
import { getSchoolCapacity, upgradePack, type SchoolCapacity, type UpgradeResult } from '@/lib/services/subscription';

interface Props {
    details: StudentLimitDetails;
    onDone: (upgraded: boolean) => void;
}

type Billing = 'm' | 'y';

const room = (pack: PublicPack) => (pack.maxStudents === null ? Infinity : pack.maxStudents);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const featureLabel = (key: string) => PACK_FEATURES.find((feature) => feature.key === key)?.label ?? key;

export default function PackUpgradeDialog({ details, onDone }: Props) {
    const role = useAuthStore((state) => state.user?.role);
    const canUpgrade = role === 'ADMIN' || role === 'OWNER';
    const [capacity, setCapacity] = useState<SchoolCapacity | null>(null);
    const [packs, setPacks] = useState<PublicPack[] | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [billing, setBilling] = useState<Billing>('m');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState<UpgradeResult | null>(null);

    const needed = details.current + details.adding;

    useEffect(() => {
        let cancelled = false;
        getSchoolCapacity()
            .then(async (cap) => {
                const list = await fetchPublicPacks(cap.institutionType);
                if (cancelled) return;
                setCapacity(cap);
                setPacks(list);
                const fitting = list.filter((pack) => room(pack) >= needed).sort((a, b) => room(a) - room(b));
                setSelected(fitting[0]?.code ?? null);
            })
            .catch((err) => !cancelled && setError(apiErrorMessage(err)));
        return () => {
            cancelled = true;
        };
    }, [needed]);

    const fitting = (packs ?? []).filter((pack) => room(pack) >= needed);
    const recommended = [...fitting].sort((a, b) => room(a) - room(b))[0]?.code;
    const chosen = packs?.find((pack) => pack.code === selected) ?? null;

    const confirm = async () => {
        if (!chosen) return;
        setSaving(true);
        setError('');
        try {
            setDone(await upgradePack(chosen.code));
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const close = () => onDone(done !== null);

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pack-upgrade-title"
            onClick={(event) => event.target === event.currentTarget && close()}
        >
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800">
                <div className="flex items-start justify-between gap-4 border-b p-5 dark:border-gray-700">
                    <div>
                        <h2 id="pack-upgrade-title" className="text-lg font-bold text-gray-900 dark:text-white">
                            {done ? 'Pack mis à jour' : 'Limite de votre pack atteinte'}
                        </h2>
                        {!done && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{studentLimitMessage(details)}</p>}
                    </div>
                    <button type="button" onClick={close} aria-label="Fermer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {done ? (
                        <div className="space-y-2 text-gray-800 dark:text-gray-100">
                            <p>
                                Votre pack <strong>« {done.packName} »</strong> est actif dès maintenant.
                            </p>
                            {done.dueAt && <p>Le paiement du nouveau tarif est attendu avant le <strong>{fmtDate(done.dueAt)}</strong>.</p>}
                        </div>
                    ) : !packs || !capacity ? (
                        error ? (
                            <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>
                        ) : (
                            <p role="status" className="text-gray-500 dark:text-gray-400">Chargement des packs…</p>
                        )
                    ) : (
                        <>
                            <div className="mb-4 flex justify-center gap-2">
                                {(['m', 'y'] as Billing[]).map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        aria-pressed={billing === option}
                                        onClick={() => setBilling(option)}
                                        className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                                            billing === option
                                                ? 'border-indigo-500 bg-indigo-600 text-white'
                                                : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                                        }`}
                                    >
                                        {option === 'm' ? 'Mensuel' : 'Annuel'}
                                    </button>
                                ))}
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                {packs.map((pack) => {
                                    const current = pack.code === capacity.packCode;
                                    const fits = room(pack) >= needed && !current;
                                    const isSelected = pack.code === selected;
                                    return (
                                        <button
                                            key={pack.code}
                                            type="button"
                                            disabled={!fits || !canUpgrade}
                                            aria-pressed={isSelected}
                                            onClick={() => setSelected(pack.code)}
                                            className={`rounded-xl border-2 p-4 text-start transition ${
                                                isSelected && fits
                                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                                    : 'border-gray-200 dark:border-gray-700'
                                            } ${fits ? '' : 'opacity-50'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-bold text-gray-900 dark:text-white">{pack.name}</span>
                                                {current ? (
                                                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-600 dark:text-gray-100">Pack actuel</span>
                                                ) : !fits ? (
                                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">Insuffisant</span>
                                                ) : pack.code === recommended ? (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Recommandé</span>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                                                {billing === 'm' ? pack.monthlyPrice : pack.yearlyPrice}{' '}
                                                <small className="text-sm font-semibold text-gray-500">MAD{billing === 'm' ? ' / mois' : ' / an'}</small>
                                            </p>
                                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{limitsLine(pack, capacity.institutionType, messages.fr)}</p>
                                            {pack.features.length > 0 && (
                                                <ul className="mt-2 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                    {pack.features.map((feature) => (
                                                        <li key={feature}>✓ {featureLabel(feature)}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {!canUpgrade ? (
                                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                    Demandez à l&apos;administrateur de l&apos;établissement de changer de pack.
                                </p>
                            ) : fitting.length === 0 ? (
                                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                    Aucun pack ne couvre ce nombre d&apos;élèves. Contactez l&apos;équipe Arwa.
                                </p>
                            ) : (
                                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                                    Votre nouveau pack est actif immédiatement.
                                    {capacity.upgradeDueAt && <> Vous avez jusqu&apos;au <strong>{fmtDate(capacity.upgradeDueAt)}</strong> pour régler le nouveau tarif.</>}
                                </p>
                            )}
                            {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
                        </>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t p-5 dark:border-gray-700">
                    {done ? (
                        <button type="button" onClick={close} className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700">
                            Continuer
                        </button>
                    ) : (
                        <>
                            <button type="button" onClick={close} className="rounded-lg border border-gray-300 px-5 py-2 font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">
                                Annuler
                            </button>
                            {canUpgrade && chosen && fitting.some((pack) => pack.code === chosen.code) && (
                                <button
                                    type="button"
                                    onClick={confirm}
                                    disabled={saving}
                                    className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                                >
                                    {saving ? 'Mise à jour…' : `Passer au pack ${chosen.name}`}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
```

Check before saving: `useAuthStore` is the default export of `@/store/useAuthStore`, as used in `app/admin/layout.tsx`. `PACK_FEATURES` in `lib/packs.ts` has `{ key, label }` entries. If either differs, adapt the import and keep the behaviour.

- [ ] **Step 2: The host**

```tsx
// frontend/components/packs/PackUpgradeHost.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PackUpgradeDialog from './PackUpgradeDialog';
import { registerUpgradeHandler } from '@/lib/packs/upgradeBus';
import type { StudentLimitDetails } from '@/lib/packs/limits';

// Mounted once per school layout: answers askForUpgrade() by showing the dialog.
export default function PackUpgradeHost() {
    const [details, setDetails] = useState<StudentLimitDetails | null>(null);
    const resolver = useRef<((upgraded: boolean) => void) | null>(null);

    useEffect(
        () =>
            registerUpgradeHandler(
                (next) =>
                    new Promise<boolean>((resolve) => {
                        resolver.current?.(false); // a second request replaces a pending one
                        resolver.current = resolve;
                        setDetails(next);
                    })
            ),
        []
    );

    const finish = useCallback((upgraded: boolean) => {
        resolver.current?.(upgraded);
        resolver.current = null;
        setDetails(null);
    }, []);

    return details ? <PackUpgradeDialog details={details} onDone={finish} /> : null;
}
```

- [ ] **Step 3: Mount the host in both school layouts**

In `frontend/app/admin/layout.tsx`, add this import:

```tsx
import PackUpgradeHost from '@/components/packs/PackUpgradeHost';
```

Then, in the second (non-platform) `return`, add `<PackUpgradeHost />` right after `<RequireRole allowedRoles={['ADMIN', 'OWNER']}>`.

In `frontend/app/secretary/layout.tsx`, add the same import, and add `<PackUpgradeHost />` right after `<RequireRole allowedRoles={['SECRETARY']}>`.

- [ ] **Step 4: Type-check**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/packs frontend/app/admin/layout.tsx frontend/app/secretary/layout.tsx
git commit -m "feat(education): pack upgrade dialog with the landing page packs"
```

---

### Task 11: Every student form opens the dialog and retries

**Files:**
- Modify: `frontend/lib/services/students.ts` (`createStudent`)
- Modify: `frontend/components/forms/AddStudentForm.tsx` (the catch block near line 90)

- [ ] **Step 1: Retry `createStudent` after an upgrade**

In `frontend/lib/services/students.ts`, add these imports:

```ts
import { studentLimitDetails } from './subscription';
import { askForUpgrade } from '../packs/upgradeBus';
import { studentLimitMessage } from '../packs/limits';
```

Replace `createStudent` with:

```ts
// When the school is full, the upgrade dialog opens; after an upgrade the same student is created.
// A cancelled dialog becomes a plain Error (no `response`), so every form shows the limit message as is.
export async function createStudent(data: StudentFormData): Promise<Student> {
    try {
        const response = await api.post<ApiResponse<Student>>('/students', data);
        return response.data.data;
    } catch (error) {
        const details = studentLimitDetails(error);
        if (!details) throw error;
        if (await askForUpgrade(details)) return createStudent(data);
        throw new Error(studentLimitMessage(details));
    }
}
```

- [ ] **Step 2: Show the real message in `AddStudentForm`**

In `frontend/components/forms/AddStudentForm.tsx`, change:

```tsx
        } catch (error) {
            console.error('Failed to save student', error);
            alert('Une erreur est survenue lors de l\'enregistrement.');
```

to:

```tsx
        } catch (error: any) {
            console.error('Failed to save student', error);
            alert(error?.response?.data?.error || error?.message || 'Une erreur est survenue lors de l\'enregistrement.');
```

`SoutienInscriptionForm` and `FormationInscriptionForm` already show `err.message` when there is no `response`, so they need no change.

- [ ] **Step 3: Type-check**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/services/students.ts frontend/components/forms/AddStudentForm.tsx
git commit -m "feat(education): student forms offer a pack upgrade when the school is full"
```

---

### Task 12: The payment deadline banner on the admin dashboard

**Files:**
- Create: `frontend/components/packs/PackUpgradeBanner.tsx`
- Modify: `frontend/app/admin/layout.tsx`

- [ ] **Step 1: The banner**

```tsx
// frontend/components/packs/PackUpgradeBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import useAuthStore from '@/store/useAuthStore';
import { getPendingUpgrades, type PendingUpgrade } from '@/lib/services/subscription';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// Reminds ADMIN/OWNER of a pack upgrade not paid yet; red once the deadline has passed.
export default function PackUpgradeBanner() {
    const role = useAuthStore((state) => state.user?.role);
    const [upgrades, setUpgrades] = useState<PendingUpgrade[]>([]);

    useEffect(() => {
        if (role !== 'ADMIN' && role !== 'OWNER') return;
        getPendingUpgrades()
            .then(setUpgrades)
            .catch(() => setUpgrades([]));
    }, [role]);

    if (upgrades.length === 0) return null;

    return (
        <div className="mb-4 space-y-2">
            {upgrades.map((upgrade) => {
                const overdue = new Date(upgrade.dueAt).getTime() < Date.now();
                return (
                    <div
                        key={upgrade.id}
                        role={overdue ? 'alert' : 'status'}
                        className={`rounded-xl border p-3 text-sm ${
                            overdue
                                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'
                                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                        }`}
                    >
                        Nouveau pack <strong>« {upgrade.toPackName} »</strong> ({upgrade.toMonthlyPrice} MAD / mois) :{' '}
                        {overdue ? 'le paiement était attendu avant le ' : 'paiement attendu avant le '}
                        <strong>{fmtDate(upgrade.dueAt)}</strong>.
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Show it on the dashboard page only**

In `frontend/app/admin/layout.tsx`, add this import:

```tsx
import PackUpgradeBanner from '@/components/packs/PackUpgradeBanner';
```

Then change:

```tsx
                        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                            {children}
```

to:

```tsx
                        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                            {pathname === '/admin' && <PackUpgradeBanner />}
                            {children}
```

- [ ] **Step 3: Type-check**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/packs/PackUpgradeBanner.tsx frontend/app/admin/layout.tsx
git commit -m "feat(education): dashboard banner for an unpaid pack upgrade"
```

---

### Task 13: "Upgrades awaiting payment" on the platform dashboard

**Files:**
- Modify: `frontend/lib/services/platform.ts`
- Modify: `frontend/lib/platform/messages.ts`
- Create: `frontend/components/platform/PendingUpgradesCard.tsx`
- Modify: `frontend/app/admin/platform/page.tsx`

- [ ] **Step 1: The type**

In `frontend/lib/services/platform.ts`, add this interface before `PlatformOverview`:

```ts
export interface PlatformPendingUpgrade {
    id: string;
    schoolId: string;
    schoolName: string;
    fromPackName: string | null;
    toPackName: string;
    toMonthlyPrice: number;
    createdAt: string;
    dueAt: string;
}
```

Then add `pendingUpgrades: PlatformPendingUpgrade[];` to `PlatformOverview`.

- [ ] **Step 2: The messages**

In `frontend/lib/platform/messages.ts`, add these keys to `fr`, before its closing brace:

```ts
    // pack upgrades awaiting payment
    upgrades_title: 'Upgrades en attente de paiement',
    upgrades_hint: 'Écoles passées à un pack supérieur depuis la limite d’élèves. Réglé dès qu’un paiement est enregistré.',
    upgrades_school: 'École',
    upgrades_change: 'Pack',
    upgrades_price: 'Nouveau tarif',
    upgrades_date: 'Date',
    upgrades_due: 'Échéance',
    upgrades_overdue: 'En retard',
```

Add the same keys to `ar`:

```ts
    upgrades_title: 'ترقيات في انتظار الدفع',
    upgrades_hint: 'مدارس انتقلت إلى باقة أعلى عند بلوغ حد التلاميذ. تُسوّى بمجرد تسجيل دفعة.',
    upgrades_school: 'المدرسة',
    upgrades_change: 'الباقة',
    upgrades_price: 'السعر الجديد',
    upgrades_date: 'التاريخ',
    upgrades_due: 'آخر أجل',
    upgrades_overdue: 'متأخرة',
```

- [ ] **Step 3: The card**

```tsx
// frontend/components/platform/PendingUpgradesCard.tsx
'use client';

import Link from 'next/link';
import type { PlatformPendingUpgrade } from '@/lib/services/platform';
import type { PlatformMessages } from '@/lib/platform/messages';
import type { AgentLang } from '@/lib/agent/messages';
import { fmtDay, fmtMAD } from '@/lib/agent/format';
import { cardClass } from '@/components/dashboard/Charts';

interface Props {
    upgrades: PlatformPendingUpgrade[];
    lang: AgentLang;
    m: PlatformMessages;
}

// Follow-up list for the sales team: the backend sorts by deadline, so overdue rows come first.
export default function PendingUpgradesCard({ upgrades, lang, m }: Props) {
    if (upgrades.length === 0) return null;
    const now = Date.now();

    return (
        <section className={`${cardClass} p-4`} aria-label={m.upgrades_title}>
            <h3 className="text-sm font-bold text-espresso-900 dark:text-espresso-50">{m.upgrades_title}</h3>
            <p className="mb-3 text-xs text-espresso-600 dark:text-espresso-300">{m.upgrades_hint}</p>
            <ul className="divide-y divide-espresso-100 dark:divide-espresso-700">
                {upgrades.map((upgrade) => {
                    const overdue = new Date(upgrade.dueAt).getTime() < now;
                    return (
                        <li key={upgrade.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                            <div className="min-w-0">
                                <Link href="/admin/schools" className="font-semibold text-espresso-900 hover:underline dark:text-espresso-50">
                                    {upgrade.schoolName}
                                </Link>
                                <p className="text-xs text-espresso-600 dark:text-espresso-300">
                                    {m.upgrades_change} : {upgrade.fromPackName ?? '—'} → {upgrade.toPackName} · {m.upgrades_price} : {fmtMAD(upgrade.toMonthlyPrice, lang)} · {m.upgrades_date} : {fmtDay(upgrade.createdAt, lang)}
                                </p>
                            </div>
                            <span
                                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                    overdue
                                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200'
                                        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                                }`}
                            >
                                {overdue ? `${m.upgrades_overdue} · ` : `${m.upgrades_due} : `}
                                {fmtDay(upgrade.dueAt, lang)}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
```

- [ ] **Step 4: Render it on the platform page**

In `frontend/app/admin/platform/page.tsx`, add this import:

```tsx
import PendingUpgradesCard from '@/components/platform/PendingUpgradesCard';
```

Then, between the `<DashboardBanner ... />` and `<PlatformDashboard ... />` lines, add:

```tsx
            <PendingUpgradesCard upgrades={data.pendingUpgrades ?? []} lang={lang} m={m} />
```

- [ ] **Step 5: Type-check**

Run, in `frontend/`: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/services/platform.ts frontend/lib/platform/messages.ts frontend/components/platform/PendingUpgradesCard.tsx frontend/app/admin/platform/page.tsx
git commit -m "feat(education): platform dashboard lists pack upgrades awaiting payment"
```

---

### Task 14: Full verification

- [ ] **Step 1: Backend**

Run, in `apps/education-apps`: `npx tsc --noEmit && npx jest`

Expected: no type errors. Every suite passes, except any that already failed before starting.

- [ ] **Step 2: Frontend build**

Run, in `apps/education-apps/frontend`: `npm run build`

Expected: the build succeeds.

- [ ] **Step 3: Check existing schools that are already over their limit**

Run this in `apps/education-apps`, through a throwaway script in the scratchpad, not committed:

```ts
// over-limit.ts — run with: npx ts-node <path>/over-limit.ts
import prisma from './src/config/database';
(async () => {
    const schools = await prisma.school.findMany({ include: { pack: true, branches: { select: { id: true } } } });
    for (const school of schools) {
        if (!school.pack || school.pack.maxStudents === null) continue;
        const count = await prisma.student.count({ where: { active: true, branchId: { in: school.branches.map((b) => b.id) } } });
        if (count > school.pack.maxStudents) console.log(`${school.name}: ${count} / ${school.pack.maxStudents} (${school.pack.name})`);
    }
    await prisma.$disconnect();
})();
```

Report the list to the user before release. These schools will see the dialog the next time they add a student.

- [ ] **Step 4: Manual check on localhost:3011, with the backend on localhost:3010**

1. As super admin, set a test school's pack to one with a small limit. You can edit a test pack's `maxStudents` to the school's current count.
2. As that school's admin, add a student through Inscriptions. The dialog should open with the numbers, the landing packs, "Pack actuel", "Insuffisant" and "Recommandé".
3. Pick the recommended pack and confirm. The student should be created without re-submitting, and the success step should show the deadline.
4. Open `/admin`. The amber banner should show the pack and the deadline.
5. As a secretary of the same school, when the school is full, the dialog shows the numbers and the "Demandez à l'administrateur" message, with no upgrade button.
6. As super admin, `/admin/platform` should show the upgrade in "Upgrades en attente de paiement". Record a payment for the school from `/admin/schools`. The row disappears, and so does the admin's banner.
7. Check the dialog at phone width (375px) and in dark mode.
8. Restore the test pack's `maxStudents` if you changed it.

- [ ] **Step 5: Credentials check before any push**

Run, at the repo root: `git diff origin/main --stat && git diff origin/main | grep -niE "password|admin123|secret|token=" || true`

Expected: nothing except code identifiers. No real credentials in code, docs or tests.
