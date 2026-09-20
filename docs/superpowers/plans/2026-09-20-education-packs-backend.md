# Education Packs + Institution Types — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a SUPER_ADMIN-managed pack catalogue, institution types on schools, pack assignment, a public packs endpoint, and pack/type-aware signup, plus an idempotent seed for the four commercial packs.

**Architecture:** New platform-level module `src/modules/packs/` (constants, pure validation, service, controller, router) reusing the transport module's `respond` and `assertId` helpers. The existing `schools` module gains `institutionType`, `packId`, pack resolution at signup and a pack-assignment function. Pack limits/features are stored and exposed only (no enforcement).

**Tech Stack:** Node/Express, Prisma 5 on MongoDB (Atlas replica set, `$transaction` works), Jest + ts-jest with mocked prisma.

**Spec:** `docs/superpowers/specs/2026-09-20-education-packs-landing-design.md`. The frontend (Super Admin pages, signup, landing, type-aware menus) is a separate plan: `2026-09-20-education-packs-frontend.md`.

**Conventions**
- Commands run from `apps/education-apps`. Work on a new branch: `git checkout -b feature/education-packs`.
- Baseline before starting: `npx jest` (all pass) and `npx tsc --noEmit -p .` (silent).
- Commit trailer, verbatim, on every commit: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Tests mock `../../config/database` like `src/modules/transport/*.test.ts`.

## Decisions that refine the spec

1. `School.institutionType` is **optional in the schema** (`InstitutionType?`; `null` is treated as `PRIVATE_SCHOOL`): a required field would make Prisma fail reading existing MongoDB `schools` documents that lack it. The API still requires it at signup, and the seed backfills existing schools.
2. `School.packTier` becomes optional in Task 1 and is removed from the schema only in Task 7, after no code uses it, so every commit compiles.
3. Changing a pack's `institutionTypes` does not re-validate schools already assigned to it (known limitation, YAGNI).
4. Shared helpers are imported from `../transport/http` (`respond`) and `../transport/ids` (`assertId`) instead of being moved.

## File Structure

**Create** (`src/modules/packs/`): `packs.constants.ts`, `packs.validation.ts`(+test), `packs.service.ts`(+test), `packs.controller.ts`, `packs.routes.ts`, `packs.seed.ts`(+test). **Create:** `prisma/seed-packs.ts`.
**Modify:** `prisma/schema.prisma`, `package.json`, `src/app.ts`, `src/modules/schools/schools.service.ts`(+test), `schools.controller.ts`, `schools.routes.ts`.

---

### Task 1: Prisma schema (additive)

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add the enum and the `Pack` model** (append to the end of the file):

```prisma
enum InstitutionType {
  PRIVATE_SCHOOL
  TUTORING_CENTER
  VOCATIONAL_TRAINING
  LANGUAGE_CENTER
  CRECHE
}

model Pack {
  id               String            @id @default(auto()) @map("_id") @db.ObjectId
  name             String
  code             String            @unique
  monthlyPrice     Float
  yearlyPrice      Float
  maxStudents      Int?
  maxBranches      Int?
  features         String[]
  institutionTypes InstitutionType[]
  isDefault        Boolean           @default(false)
  active           Boolean           @default(true)
  sortOrder        Int               @default(0)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  schools School[]

  @@index([active, sortOrder])
  @@map("packs")
}
```

- [ ] **Step 2: Extend `School`.** In `model School`: change `packTier    String` to `packTier    String?`, and before its `@@map("schools")` line add:

```prisma
  institutionType InstitutionType? // null is treated as PRIVATE_SCHOOL
  packId          String?          @db.ObjectId
  pack            Pack?            @relation(fields: [packId], references: [id])

  @@index([packId])
```

- [ ] **Step 3: Generate, typecheck, push**

Run: `npx prisma format && npx prisma validate && npx prisma generate && npx tsc --noEmit -p . && npx jest`
Expected: schema valid, tsc silent, all suites pass (existing code still writes `packTier`, which is still accepted).
Then: `npx prisma db push` — expected `Your database is now in sync`. If Prisma warns about data loss, STOP and ask the user. (Additive: new `packs` collection + index, new optional fields.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(education): add Pack model, InstitutionType enum and School.pack fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Constants and pack validation (pure)

**Files:** Create `src/modules/packs/packs.constants.ts`, `packs.validation.ts`, `packs.validation.test.ts`

- [ ] **Step 1: Write the failing test** `src/modules/packs/packs.validation.test.ts`:

```ts
import { sanitizeNewPack, sanitizePackUpdate } from './packs.validation';

const valid = {
    name: ' Pro ',
    code: ' PRO ',
    monthlyPrice: 400,
    yearlyPrice: 4000,
    maxStudents: 300,
    maxBranches: 2,
    features: ['PARENT_PORTAL', 'PARENT_PORTAL', 'QR_ATTENDANCE'],
    institutionTypes: ['PRIVATE_SCHOOL', 'PRIVATE_SCHOOL', 'TUTORING_CENTER'],
};

describe('sanitizeNewPack', () => {
    it('trims, lowercases the code and collapses duplicate features and types', () => {
        expect(sanitizeNewPack(valid)).toEqual({
            name: 'Pro',
            code: 'pro',
            monthlyPrice: 400,
            yearlyPrice: 4000,
            maxStudents: 300,
            maxBranches: 2,
            features: ['PARENT_PORTAL', 'QR_ATTENDANCE'],
            institutionTypes: ['PRIVATE_SCHOOL', 'TUTORING_CENTER'],
        });
    });

    it('defaults omitted limits to null (unlimited) and features to required', () => {
        const { maxStudents, maxBranches, ...rest } = valid;
        expect(sanitizeNewPack(rest)).toEqual(expect.objectContaining({ maxStudents: null, maxBranches: null }));
        const { features, ...noFeatures } = valid;
        expect(() => sanitizeNewPack(noFeatures)).toThrow('features is required');
    });

    it('requires name and code', () => {
        expect(() => sanitizeNewPack({ ...valid, name: ' ' })).toThrow('name is required');
        const { code, ...noCode } = valid;
        expect(() => sanitizeNewPack(noCode)).toThrow('code is required');
    });

    it('rejects a code with invalid characters', () => {
        expect(() => sanitizeNewPack({ ...valid, code: 'Pro Plus' })).toThrow(
            'code must contain only lowercase letters, digits and dashes'
        );
    });

    it('rejects negative, non-numeric or non-finite prices', () => {
        for (const bad of [-1, '10', NaN, Infinity]) {
            expect(() => sanitizeNewPack({ ...valid, monthlyPrice: bad })).toThrow(
                'monthlyPrice must be a number greater than or equal to 0'
            );
        }
    });

    it('rejects limits that are neither null nor a positive integer', () => {
        for (const bad of [0, -3, 2.5, '5']) {
            expect(() => sanitizeNewPack({ ...valid, maxStudents: bad })).toThrow(
                'maxStudents must be null or a positive integer'
            );
        }
        expect(sanitizeNewPack({ ...valid, maxStudents: null }).maxStudents).toBeNull();
    });

    it('rejects an unknown feature key', () => {
        expect(() => sanitizeNewPack({ ...valid, features: ['NOPE'] })).toThrow('features contains an unknown feature');
    });

    it('requires a non-empty list of valid institution types', () => {
        expect(() => sanitizeNewPack({ ...valid, institutionTypes: [] })).toThrow(
            'institutionTypes must be a non-empty list of valid institution types'
        );
        expect(() => sanitizeNewPack({ ...valid, institutionTypes: ['UNIVERSITY'] })).toThrow(
            'institutionTypes must be a non-empty list of valid institution types'
        );
    });

    it('validates optional active and sortOrder', () => {
        expect(sanitizeNewPack({ ...valid, active: false, sortOrder: 3 })).toEqual(
            expect.objectContaining({ active: false, sortOrder: 3 })
        );
        expect(() => sanitizeNewPack({ ...valid, active: 'yes' })).toThrow('active must be a boolean');
        expect(() => sanitizeNewPack({ ...valid, sortOrder: 1.5 })).toThrow('sortOrder must be an integer');
    });
});

describe('sanitizePackUpdate', () => {
    it('returns only the provided fields, validated', () => {
        expect(sanitizePackUpdate({ monthlyPrice: 450 })).toEqual({ monthlyPrice: 450 });
        expect(sanitizePackUpdate({})).toEqual({});
    });

    it('applies the same validation to provided fields', () => {
        expect(() => sanitizePackUpdate({ code: 'Bad Code' })).toThrow('code must contain only');
        expect(() => sanitizePackUpdate({ features: ['NOPE'] })).toThrow('features contains an unknown feature');
        expect(sanitizePackUpdate({ maxBranches: null })).toEqual({ maxBranches: null });
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/packs/packs.validation.test.ts`
Expected: FAIL — `Cannot find module './packs.validation'`.

- [ ] **Step 3: Implement**

`src/modules/packs/packs.constants.ts`:

```ts
export const INSTITUTION_TYPES = [
    'PRIVATE_SCHOOL',
    'TUTORING_CENTER',
    'VOCATIONAL_TRAINING',
    'LANGUAGE_CENTER',
    'CRECHE',
] as const;

export type InstitutionTypeValue = (typeof INSTITUTION_TYPES)[number];

// A school without an institutionType (legacy documents) behaves as a private school.
export const DEFAULT_INSTITUTION_TYPE: InstitutionTypeValue = 'PRIVATE_SCHOOL';

export const PACK_FEATURES = [
    'PARENT_PORTAL',
    'STUDENT_PORTAL',
    'QR_ATTENDANCE',
    'ANNOUNCEMENTS',
    'FINANCE_ANALYTICS',
    'TRANSPORT',
    'DAILY_LOG',
] as const;

export type PackFeature = (typeof PACK_FEATURES)[number];

export const isInstitutionType = (value: unknown): value is InstitutionTypeValue =>
    typeof value === 'string' && (INSTITUTION_TYPES as readonly string[]).includes(value);

export const isPackFeature = (value: unknown): value is PackFeature =>
    typeof value === 'string' && (PACK_FEATURES as readonly string[]).includes(value);
```

`src/modules/packs/packs.validation.ts`:

```ts
import { InstitutionTypeValue, PackFeature, isInstitutionType, isPackFeature } from './packs.constants';

export interface PackInput {
    name: string;
    code: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionTypeValue[];
    active?: boolean;
    sortOrder?: number;
}

const CODE_RE = /^[a-z0-9-]+$/;

// `partial` = update mode: only the keys present in `input` are validated and returned.
const sanitize = (input: Record<string, any>, partial: boolean): Partial<PackInput> => {
    const out: Partial<PackInput> = {};
    const has = (key: string) => input[key] !== undefined;
    const present = (key: string): boolean => {
        if (!has(key) && !partial) throw new Error(`${key} is required`);
        return has(key);
    };

    if (present('name')) {
        if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('name is required');
        out.name = input.name.trim();
    }

    if (present('code')) {
        const code = typeof input.code === 'string' ? input.code.trim().toLowerCase() : '';
        if (!CODE_RE.test(code)) throw new Error('code must contain only lowercase letters, digits and dashes');
        out.code = code;
    }

    for (const key of ['monthlyPrice', 'yearlyPrice'] as const) {
        if (present(key)) {
            const value = input[key];
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                throw new Error(`${key} must be a number greater than or equal to 0`);
            }
            out[key] = value;
        }
    }

    for (const key of ['maxStudents', 'maxBranches'] as const) {
        if (has(key)) {
            const value = input[key];
            if (value !== null && !(Number.isInteger(value) && value >= 1)) {
                throw new Error(`${key} must be null or a positive integer`);
            }
            out[key] = value;
        } else if (!partial) {
            out[key] = null;
        }
    }

    if (present('features')) {
        if (!Array.isArray(input.features) || !input.features.every(isPackFeature)) {
            throw new Error('features contains an unknown feature');
        }
        out.features = [...new Set<PackFeature>(input.features)];
    }

    if (present('institutionTypes')) {
        const types = input.institutionTypes;
        if (!Array.isArray(types) || types.length === 0 || !types.every(isInstitutionType)) {
            throw new Error('institutionTypes must be a non-empty list of valid institution types');
        }
        out.institutionTypes = [...new Set<InstitutionTypeValue>(types)];
    }

    if (has('active')) {
        if (typeof input.active !== 'boolean') throw new Error('active must be a boolean');
        out.active = input.active;
    }

    if (has('sortOrder')) {
        if (!Number.isInteger(input.sortOrder)) throw new Error('sortOrder must be an integer');
        out.sortOrder = input.sortOrder;
    }

    return out;
};

export const sanitizeNewPack = (input: Record<string, any>): PackInput => sanitize(input, false) as PackInput;

export const sanitizePackUpdate = (input: Record<string, any>): Partial<PackInput> => sanitize(input, true);
```

- [ ] **Step 4: Run to verify pass + typecheck**

Run: `npx jest src/modules/packs/packs.validation.test.ts && npx tsc --noEmit -p .`
Expected: PASS (all tests), tsc silent.

- [ ] **Step 5: Commit**

```bash
git add src/modules/packs
git commit -m "feat(education): pack constants and input validation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Packs service

**Files:** Create `src/modules/packs/packs.service.ts`, `packs.service.test.ts`

- [ ] **Step 1: Write the failing test** `src/modules/packs/packs.service.test.ts`:

```ts
import prisma from '../../config/database';
import { listPublicPacks, listAllPacks, createPack, updatePack, setDefaultPack } from './packs.service';

jest.mock('../../config/database', () => {
    const tx = { pack: { updateMany: jest.fn(), update: jest.fn() } };
    return {
        __esModule: true,
        default: {
            pack: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

const stored = {
    id: 'p1',
    name: 'Pro',
    code: 'pro',
    monthlyPrice: 400,
    yearlyPrice: 4000,
    maxStudents: 300,
    maxBranches: 2,
    features: ['PARENT_PORTAL'],
    institutionTypes: ['PRIVATE_SCHOOL'],
    isDefault: true,
    active: true,
    sortOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('listPublicPacks', () => {
    afterEach(() => jest.resetAllMocks());

    it('returns only active packs ordered by sortOrder, exposing public fields and `recommended`', async () => {
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([stored]);

        const result = await listPublicPacks();

        expect(prisma.pack.findMany).toHaveBeenCalledWith({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
        expect(result).toEqual([
            {
                code: 'pro',
                name: 'Pro',
                monthlyPrice: 400,
                yearlyPrice: 4000,
                maxStudents: 300,
                maxBranches: 2,
                features: ['PARENT_PORTAL'],
                institutionTypes: ['PRIVATE_SCHOOL'],
                recommended: true,
            },
        ]);
    });

    it('filters by institution type when given', async () => {
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([]);

        await listPublicPacks('CRECHE');

        expect(prisma.pack.findMany).toHaveBeenCalledWith({
            where: { active: true, institutionTypes: { has: 'CRECHE' } },
            orderBy: { sortOrder: 'asc' },
        });
    });

    it('rejects an invalid institution type', async () => {
        await expect(listPublicPacks('UNIVERSITY')).rejects.toThrow('Invalid institution type');
        expect(prisma.pack.findMany).not.toHaveBeenCalled();
    });
});

describe('listAllPacks', () => {
    afterEach(() => jest.resetAllMocks());

    it('returns every pack with its school count', async () => {
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([]);

        await listAllPacks();

        expect(prisma.pack.findMany).toHaveBeenCalledWith({
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { schools: true } } },
        });
    });
});

describe('createPack', () => {
    afterEach(() => jest.resetAllMocks());

    const input = {
        name: 'Crèche',
        code: 'creche',
        monthlyPrice: 200,
        yearlyPrice: 2000,
        maxStudents: 40,
        maxBranches: 1,
        features: ['PARENT_PORTAL', 'DAILY_LOG'],
        institutionTypes: ['CRECHE'],
    };

    it('creates a non-default pack with defaults for active and sortOrder', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.pack.create as jest.Mock).mockResolvedValue({ id: 'p9' });

        await createPack(input);

        expect(prisma.pack.findUnique).toHaveBeenCalledWith({ where: { code: 'creche' } });
        expect(prisma.pack.create).toHaveBeenCalledWith({
            data: { ...input, isDefault: false, active: true, sortOrder: 0 },
        });
    });

    it('rejects a duplicate code', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

        await expect(createPack(input)).rejects.toThrow('A pack with this code already exists');
        expect(prisma.pack.create).not.toHaveBeenCalled();
    });

    it('rejects invalid input before touching the database', async () => {
        await expect(createPack({ ...input, monthlyPrice: -1 })).rejects.toThrow('monthlyPrice must be');
        expect(prisma.pack.findUnique).not.toHaveBeenCalled();
    });
});

describe('updatePack', () => {
    afterEach(() => jest.resetAllMocks());

    it('throws for an unknown pack and requires an id', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(updatePack('p1', { name: 'X' })).rejects.toThrow('Pack not found');
        await expect(updatePack('', { name: 'X' })).rejects.toThrow('Pack id is required');
    });

    it('updates only the provided fields', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue(stored);
        (prisma.pack.update as jest.Mock).mockResolvedValue(stored);

        await updatePack('p1', { monthlyPrice: 450 });

        expect(prisma.pack.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { monthlyPrice: 450 } });
    });

    it('rejects a code that another pack already uses', async () => {
        (prisma.pack.findUnique as jest.Mock)
            .mockResolvedValueOnce(stored)
            .mockResolvedValueOnce({ id: 'other', code: 'premium' });

        await expect(updatePack('p1', { code: 'premium' })).rejects.toThrow('A pack with this code already exists');
        expect(prisma.pack.update).not.toHaveBeenCalled();
    });

    it('refuses to deactivate the default pack', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ ...stored, isDefault: true });

        await expect(updatePack('p1', { active: false })).rejects.toThrow(
            'The default pack cannot be deactivated; choose another default first'
        );
        expect(prisma.pack.update).not.toHaveBeenCalled();
    });

    it('allows deactivating a non-default pack', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ ...stored, isDefault: false });
        (prisma.pack.update as jest.Mock).mockResolvedValue(stored);

        await updatePack('p1', { active: false });

        expect(prisma.pack.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { active: false } });
    });
});

describe('setDefaultPack', () => {
    afterEach(() => jest.resetAllMocks());

    it('throws for an unknown pack', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(setDefaultPack('p1')).rejects.toThrow('Pack not found');
    });

    it('refuses an inactive pack', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ ...stored, active: false });

        await expect(setDefaultPack('p1')).rejects.toThrow('An inactive pack cannot be the default');
    });

    it('clears the previous default and sets the new one in one transaction', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ ...stored, isDefault: false });
        tx.pack.update.mockResolvedValue({ ...stored, isDefault: true });

        const result = await setDefaultPack('p1');

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(tx.pack.updateMany).toHaveBeenCalledWith({ where: { isDefault: true }, data: { isDefault: false } });
        expect(tx.pack.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isDefault: true } });
        expect(result).toEqual(expect.objectContaining({ isDefault: true }));
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/packs/packs.service.test.ts`
Expected: FAIL — `Cannot find module './packs.service'`.

- [ ] **Step 3: Implement** `src/modules/packs/packs.service.ts`:

```ts
import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { isInstitutionType } from './packs.constants';
import { sanitizeNewPack, sanitizePackUpdate } from './packs.validation';

const assertCodeFree = async (code: string) => {
    if (await prisma.pack.findUnique({ where: { code } })) {
        throw new Error('A pack with this code already exists');
    }
};

// Public catalogue for the landing page and signup: active packs only, public fields only.
export const listPublicPacks = async (type?: unknown) => {
    // `null` marks an invalid value so the check below narrows `typeFilter` to a valid type or undefined.
    const typeFilter = type === undefined ? undefined : isInstitutionType(type) ? type : null;
    if (typeFilter === null) throw new Error('Invalid institution type');

    const packs = await prisma.pack.findMany({
        where: { active: true, ...(typeFilter && { institutionTypes: { has: typeFilter } }) },
        orderBy: { sortOrder: 'asc' },
    });

    return packs.map((pack) => ({
        code: pack.code,
        name: pack.name,
        monthlyPrice: pack.monthlyPrice,
        yearlyPrice: pack.yearlyPrice,
        maxStudents: pack.maxStudents,
        maxBranches: pack.maxBranches,
        features: pack.features,
        institutionTypes: pack.institutionTypes,
        recommended: pack.isDefault,
    }));
};

export const listAllPacks = async () => {
    return prisma.pack.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { schools: true } } },
    });
};

export const createPack = async (input: Record<string, any>) => {
    const data = sanitizeNewPack(input);
    await assertCodeFree(data.code);

    return prisma.pack.create({
        data: { ...data, isDefault: false, active: data.active ?? true, sortOrder: data.sortOrder ?? 0 },
    });
};

export const updatePack = async (id: string, input: Record<string, any>) => {
    assertId('Pack id', id);

    const existing = await prisma.pack.findUnique({ where: { id } });
    if (!existing) throw new Error('Pack not found');

    const data = sanitizePackUpdate(input);

    if (data.code !== undefined && data.code !== existing.code) await assertCodeFree(data.code);
    if (data.active === false && existing.isDefault) {
        throw new Error('The default pack cannot be deactivated; choose another default first');
    }

    return prisma.pack.update({ where: { id }, data });
};

export const setDefaultPack = async (id: string) => {
    assertId('Pack id', id);

    const pack = await prisma.pack.findUnique({ where: { id } });
    if (!pack) throw new Error('Pack not found');
    if (!pack.active) throw new Error('An inactive pack cannot be the default');

    return prisma.$transaction(async (tx) => {
        await tx.pack.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
        return tx.pack.update({ where: { id }, data: { isDefault: true } });
    });
};
```

- [ ] **Step 4: Run to verify pass + typecheck**

Run: `npx jest src/modules/packs && npx tsc --noEmit -p .`
Expected: PASS, tsc silent.

- [ ] **Step 5: Commit**

```bash
git add src/modules/packs
git commit -m "feat(education): packs service (catalogue, public list, default switch)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Packs controller, router and app wiring

**Files:** Create `src/modules/packs/packs.controller.ts`, `packs.routes.ts`; Modify `src/app.ts`

- [ ] **Step 1: Controller** `src/modules/packs/packs.controller.ts`:

```ts
import { Request, Response } from 'express';
import { respond } from '../transport/http';
import { listPublicPacks, listAllPacks, createPack, updatePack, setDefaultPack } from './packs.service';

export const publicList = (req: Request, res: Response) =>
    respond(res, () => listPublicPacks(req.query.type), {
        message: 'Packs retrieved successfully',
        failure: 'Failed to retrieve packs',
    });

export const list = (_req: Request, res: Response) =>
    respond(res, () => listAllPacks(), {
        message: 'Packs retrieved successfully',
        failure: 'Failed to retrieve packs',
    });

export const create = (req: Request, res: Response) =>
    respond(res, () => createPack(req.body ?? {}), {
        message: 'Pack created successfully',
        status: 201,
        failure: 'Failed to create pack',
    });

export const update = (req: Request, res: Response) =>
    respond(res, () => updatePack(req.params.id, req.body ?? {}), {
        message: 'Pack updated successfully',
        failure: 'Failed to update pack',
    });

export const makeDefault = (req: Request, res: Response) =>
    respond(res, () => setDefaultPack(req.params.id), {
        message: 'Default pack updated successfully',
        failure: 'Failed to set default pack',
    });
```

- [ ] **Step 2: Router** `src/modules/packs/packs.routes.ts`:

```ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { publicList, list, create, update, makeDefault } from './packs.controller';

const router = Router();

const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public, no auth — feeds the landing page and the signup page. Must come before the auth middleware below.
router.get('/public', publicLimiter, publicList);

router.use(authMiddleware);
router.use(roleMiddleware('SUPER_ADMIN'));

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/default', makeDefault);

export default router;
```

- [ ] **Step 3: Register** in `src/app.ts`: add `import packsRoutes from './modules/packs/packs.routes';` after the `holidaysRoutes`/`transportRoutes` imports, and `apiRouter.use('/packs', packsRoutes);` after the `/transport` mount.

- [ ] **Step 4: Typecheck, full suite, smoke test**

Run: `npx tsc --noEmit -p . && npx jest` → tsc silent, all pass.
Smoke (start `npm run dev`, port in the startup log; do not read `.env`): `curl -s localhost:3010/api/packs/public` → `{"success":true,"data":[],...}` (empty until seeded); `curl -s -o /dev/null -w "%{http_code}" localhost:3010/api/packs` → `401`; `curl -s "localhost:3010/api/packs/public?type=NOPE"` → `400` with `Invalid institution type`. Stop the server afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/modules/packs src/app.ts
git commit -m "feat(education): packs controller, router and public endpoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Schools — institution type, pack at signup, pack assignment

**Files:** Modify `src/modules/schools/schools.service.ts`, `schools.controller.ts`, `schools.routes.ts`, `schools.service.test.ts`

- [ ] **Step 1: Replace the whole test file** `src/modules/schools/schools.service.test.ts` with:

```ts
import prisma from '../../config/database';
import {
    signupSchool,
    getSchoolBySchoolId,
    updateSchoolProfile,
    listSchools,
    updateSchoolStatus,
    assignPackToSchool,
} from './schools.service';
import * as bcryptUtil from '../../utils/bcrypt';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
        school: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
        pack: { findFirst: jest.fn() },
        $transaction: jest.fn(),
    },
}));

const baseInput = {
    ownerName: 'Owner',
    ownerEmail: 'owner@example.com',
    password: 'secret123',
    institutionType: 'PRIVATE_SCHOOL' as const,
};

const arrangeSignup = () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);
    jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed-secret');

    const school = { id: 'school1', name: 'Ecole A' };
    const branch = { id: 'branch1', schoolId: 'school1' };
    const user = { id: 'user1', email: 'owner@example.com', role: 'OWNER', schoolId: 'school1' };
    const txClient = {
        school: { create: jest.fn().mockResolvedValue(school) },
        branch: { create: jest.fn().mockResolvedValue(branch) },
        user: { create: jest.fn().mockResolvedValue(user) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(txClient));
    return { school, branch, user, txClient };
};

const pack = (over: Record<string, unknown> = {}) => ({
    id: 'pack1',
    code: 'pro',
    active: true,
    isDefault: true,
    institutionTypes: ['PRIVATE_SCHOOL', 'TUTORING_CENTER'],
    ...over,
});

describe('signupSchool', () => {
    afterEach(() => jest.restoreAllMocks());

    it('throws if the owner email is already registered', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

        await expect(
            signupSchool({ ...baseInput, schoolName: 'Ecole A', ownerPhone: '0600000000', branchName: 'Main', branchCity: 'Casablanca' })
        ).rejects.toThrow('Email already exists');
    });

    it('creates School, Branch, and an OWNER User atomically with a hashed password', async () => {
        const { school, branch, user, txClient } = arrangeSignup();

        const result = await signupSchool({
            ...baseInput,
            schoolName: 'Ecole A',
            ownerPhone: '0600000000',
            branchName: 'Main',
            branchCity: 'Casablanca',
        });

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: 'Ecole A',
                    status: 'PENDING',
                    institutionType: 'PRIVATE_SCHOOL',
                    packId: null,
                }),
            })
        );
        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ schoolId: 'school1', name: 'Main', city: 'Casablanca' }),
            })
        );
        expect(txClient.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    email: 'owner@example.com',
                    password: 'hashed-secret',
                    role: 'OWNER',
                    schoolId: 'school1',
                }),
            })
        );
        expect(result).toEqual({ school, branch, user });
    });

    it('translates a P2002 unique-constraint race into the friendly duplicate-email message', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);
        jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed-secret');
        (prisma.$transaction as jest.Mock).mockRejectedValue(
            Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
                code: 'P2002',
                name: 'PrismaClientKnownRequestError',
            })
        );

        await expect(signupSchool({ ...baseInput, schoolName: 'Ecole A' })).rejects.toThrow('Email already exists');
    });

    it('fills in schoolName, branchName and branchCity when omitted, and stamps a 15-day trialEndsAt', async () => {
        const { txClient } = arrangeSignup();

        const before = Date.now();
        await signupSchool(baseInput);
        const after = Date.now();

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: 'École de Owner', status: 'PENDING' }),
            })
        );
        const createdTrialEndsAt: Date = (txClient.school.create as jest.Mock).mock.calls[0][0].data.trialEndsAt;
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        expect(createdTrialEndsAt.getTime()).toBeGreaterThanOrEqual(before + fifteenDaysMs - 1000);
        expect(createdTrialEndsAt.getTime()).toBeLessThanOrEqual(after + fifteenDaysMs + 1000);
        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ schoolId: 'school1', name: 'Établissement principal', city: '' }),
            })
        );
    });

    it('still honors explicit schoolName/branchName/branchCity', async () => {
        const { txClient } = arrangeSignup();

        await signupSchool({ ...baseInput, schoolName: 'Ecole A', branchName: 'Main', branchCity: 'Casablanca' });

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ name: 'Ecole A' }) })
        );
        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ name: 'Main', city: 'Casablanca' }) })
        );
    });
});

describe('signupSchool — institution type and pack', () => {
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.restoreAllMocks());

    it('rejects a missing or invalid institutionType before touching the database', async () => {
        await expect(signupSchool({ ...baseInput, institutionType: undefined as any })).rejects.toThrow(
            'institutionType is required and must be valid'
        );
        await expect(signupSchool({ ...baseInput, institutionType: 'UNIVERSITY' as any })).rejects.toThrow(
            'institutionType is required and must be valid'
        );
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('assigns the pack named by packCode when it is active and serves the type', async () => {
        const { txClient } = arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack({ isDefault: false }));

        await signupSchool({ ...baseInput, packCode: 'pro' });

        expect(prisma.pack.findFirst).toHaveBeenCalledWith({ where: { code: 'pro', active: true } });
        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ institutionType: 'PRIVATE_SCHOOL', packId: 'pack1' }),
            })
        );
    });

    it('rejects an unknown or inactive packCode', async () => {
        arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(signupSchool({ ...baseInput, packCode: 'nope' })).rejects.toThrow('Unknown or unavailable pack');
    });

    it('rejects a pack that does not serve the chosen institution type', async () => {
        arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());

        await expect(signupSchool({ ...baseInput, institutionType: 'CRECHE', packCode: 'pro' })).rejects.toThrow(
            'Unknown or unavailable pack'
        );
    });

    it('uses the default pack when no packCode is given and it serves the type', async () => {
        const { txClient } = arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());

        await signupSchool(baseInput);

        expect(prisma.pack.findFirst).toHaveBeenCalledWith({ where: { isDefault: true, active: true } });
        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ packId: 'pack1' }) })
        );
    });

    it('leaves packId null when the default pack does not serve the type, and still succeeds', async () => {
        const { txClient } = arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());

        await signupSchool({ ...baseInput, institutionType: 'CRECHE' });

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ institutionType: 'CRECHE', packId: null }),
            })
        );
    });

    it('does not store the legacy packTier', async () => {
        const { txClient } = arrangeSignup();

        await signupSchool(baseInput);

        expect((txClient.school.create as jest.Mock).mock.calls[0][0].data).not.toHaveProperty('packTier');
    });
});

describe('getSchoolBySchoolId', () => {
    afterEach(() => jest.clearAllMocks());

    it('throws when the school does not exist', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getSchoolBySchoolId('missing')).rejects.toThrow('School not found');
    });

    it('returns the school with its pack', async () => {
        const school = { id: 's1', name: 'Ecole A' };
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(school);

        await expect(getSchoolBySchoolId('s1')).resolves.toEqual(school);
        expect(prisma.school.findUnique).toHaveBeenCalledWith({ where: { id: 's1' }, include: { pack: true } });
    });
});

describe('updateSchoolProfile', () => {
    afterEach(() => jest.clearAllMocks());

    it('updates only the provided fields on the given school', async () => {
        const updated = { id: 's1', name: 'New Name' };
        (prisma.school.update as jest.Mock).mockResolvedValue(updated);

        const result = await updateSchoolProfile('s1', { name: 'New Name' });

        expect(prisma.school.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { name: 'New Name' } });
        expect(result).toEqual(updated);
    });
});

describe('listSchools', () => {
    afterEach(() => jest.clearAllMocks());

    it('returns all schools ordered by newest first, with type and pack', async () => {
        const schools = [{ id: 's1' }, { id: 's2' }];
        (prisma.school.findMany as jest.Mock).mockResolvedValue(schools);

        await expect(listSchools()).resolves.toEqual(schools);
        expect(prisma.school.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { createdAt: 'desc' },
                select: expect.objectContaining({
                    institutionType: true,
                    packId: true,
                    pack: { select: { id: true, code: true, name: true } },
                }),
            })
        );
    });
});

describe('updateSchoolStatus', () => {
    afterEach(() => jest.clearAllMocks());

    it('updates the school status', async () => {
        const updated = { id: 's1', status: 'ACTIVE' };
        (prisma.school.update as jest.Mock).mockResolvedValue(updated);

        const result = await updateSchoolStatus('s1', 'ACTIVE');

        expect(prisma.school.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'ACTIVE' } });
        expect(result).toEqual(updated);
    });
});

describe('assignPackToSchool', () => {
    afterEach(() => jest.resetAllMocks());

    it('requires both ids', async () => {
        await expect(assignPackToSchool('', 'p1')).rejects.toThrow('School id is required');
        await expect(assignPackToSchool('s1', undefined as any)).rejects.toThrow('Pack id is required');
    });

    it('throws for an unknown school', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(assignPackToSchool('s1', 'p1')).rejects.toThrow('School not found');
    });

    it('throws for an unknown or inactive pack', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1', institutionType: 'PRIVATE_SCHOOL' });
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(assignPackToSchool('s1', 'p1')).rejects.toThrow('Pack not found');
        expect(prisma.pack.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', active: true } });
    });

    it('refuses a pack that does not serve the school type (null type counts as PRIVATE_SCHOOL)', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1', institutionType: 'CRECHE' });
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());

        await expect(assignPackToSchool('s1', 'pack1')).rejects.toThrow('Pack does not serve this institution type');

        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1', institutionType: null });
        (prisma.school.update as jest.Mock).mockResolvedValue({ id: 's1' });
        await expect(assignPackToSchool('s1', 'pack1')).resolves.toBeDefined();
    });

    it('updates packId and returns the school with its pack', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1', institutionType: 'PRIVATE_SCHOOL' });
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());
        (prisma.school.update as jest.Mock).mockResolvedValue({ id: 's1', packId: 'pack1' });

        await assignPackToSchool('s1', 'pack1');

        expect(prisma.school.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { packId: 'pack1' },
            include: { pack: true },
        });
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/schools`
Expected: FAIL (TypeScript errors: `institutionType`/`packCode`/`assignPackToSchool` unknown).

- [ ] **Step 3: Implement the service.** In `src/modules/schools/schools.service.ts`:

Replace the imports/interface/head of `signupSchool` so the top of the file is:

```ts
import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';
import { assertId } from '../transport/ids';
import { DEFAULT_INSTITUTION_TYPE, InstitutionTypeValue, isInstitutionType } from '../packs/packs.constants';

export interface SignupSchoolData {
    schoolName?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password: string;
    branchName?: string;
    branchCity?: string;
    institutionType: InstitutionTypeValue;
    packCode?: string;
}

const TRIAL_DAYS = 15;

// The pack named by the visitor (must be active and serve the type), else the default pack if it
// serves the type, else none — signup never fails because no default pack exists.
const resolveSignupPack = async (packCode: string | undefined, type: InstitutionTypeValue) => {
    if (packCode) {
        const pack = await prisma.pack.findFirst({ where: { code: packCode, active: true } });
        if (!pack || !pack.institutionTypes.includes(type)) throw new Error('Unknown or unavailable pack');
        return pack;
    }

    const defaultPack = await prisma.pack.findFirst({ where: { isDefault: true, active: true } });
    return defaultPack && defaultPack.institutionTypes.includes(type) ? defaultPack : null;
};

export const signupSchool = async (data: SignupSchoolData) => {
    if (!isInstitutionType(data.institutionType)) {
        throw new Error('institutionType is required and must be valid');
    }

    const email = data.ownerEmail.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('Email already exists');
    }

    const pack = await resolveSignupPack(data.packCode, data.institutionType);

    const hashedPassword = await hashPassword(data.password);

    const schoolName = data.schoolName || `École de ${data.ownerName}`;
    const branchName = data.branchName || 'Établissement principal';
    const branchCity = data.branchCity ?? '';

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
```

In the `tx.school.create` data, replace the line `packTier,` with:

```ts
                    institutionType: data.institutionType,
                    packId: pack?.id ?? null,
```

Replace `getSchoolBySchoolId`'s query with `prisma.school.findUnique({ where: { id: schoolId }, include: { pack: true } })`. In `listSchools`'s `select`, add after `createdAt: true,`:

```ts
            institutionType: true,
            packId: true,
            pack: { select: { id: true, code: true, name: true } },
```

Append at the end of the file:

```ts
export const assignPackToSchool = async (schoolId: string, packId: string) => {
    assertId('School id', schoolId);
    assertId('Pack id', packId);

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    const pack = await prisma.pack.findFirst({ where: { id: packId, active: true } });
    if (!pack) throw new Error('Pack not found');

    const type = school.institutionType ?? DEFAULT_INSTITUTION_TYPE;
    if (!pack.institutionTypes.includes(type)) throw new Error('Pack does not serve this institution type');

    return prisma.school.update({ where: { id: schoolId }, data: { packId }, include: { pack: true } });
};
```

- [ ] **Step 4: Controller and route.** In `schools.controller.ts`: add `assignPackToSchool` to the service import and `import { respond } from '../transport/http';`. In `signup`, remove `packTier` from the destructuring and from the `signupSchool({...})` call, add `institutionType,` and `packCode,` to both (destructure them from `req.body`). Append:

```ts
export const assignPack = (req: AuthRequest, res: Response) =>
    respond(res, () => assignPackToSchool(req.params.id, req.body?.packId), {
        message: 'School pack updated',
        failure: 'Failed to update school pack',
    });
```

In `schools.routes.ts`: import `assignPack` with the other controller functions and add below the `updateStatus` route:

```ts
router.patch('/:id/pack', authMiddleware, roleMiddleware('SUPER_ADMIN'), assignPack);
```

- [ ] **Step 5: Run all + typecheck**

Run: `npx jest && npx tsc --noEmit -p .`
Expected: all PASS; tsc silent. (`school.institutionType` and `pack.institutionTypes` come from the generated client.)

- [ ] **Step 6: Commit**

```bash
git add src/modules/schools
git commit -m "feat(education): institution type and pack at signup, pack assignment for schools

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Seed the four packs and backfill existing schools

**Files:** Create `src/modules/packs/packs.seed.ts`, `packs.seed.test.ts`, `prisma/seed-packs.ts`; Modify `package.json`

- [ ] **Step 1: Write the failing test** `src/modules/packs/packs.seed.test.ts`:

```ts
import { DEFAULT_PACKS, seedPacks } from './packs.seed';

const makeClient = (defaultExists: boolean, defaultPackId = 'pro-id') => ({
    pack: {
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(defaultExists ? 1 : 0),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({ id: defaultPackId }),
    },
    school: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
});

describe('DEFAULT_PACKS', () => {
    it('defines the four agreed packs with prices, limits and types', () => {
        expect(DEFAULT_PACKS.map((p) => [p.code, p.monthlyPrice, p.yearlyPrice, p.maxStudents, p.maxBranches])).toEqual([
            ['essentiel', 250, 2500, 100, 1],
            ['pro', 400, 4000, 300, 2],
            ['premium', 800, 8000, null, null],
            ['creche', 200, 2000, 40, 1],
        ]);
        expect(DEFAULT_PACKS.find((p) => p.code === 'creche')!.institutionTypes).toEqual(['CRECHE']);
        expect(DEFAULT_PACKS.find((p) => p.code === 'premium')!.features).toContain('TRANSPORT');
        expect(DEFAULT_PACKS.find((p) => p.code === 'creche')!.features).toEqual(['PARENT_PORTAL', 'DAILY_LOG']);
        expect(DEFAULT_PACKS.filter((p) => p.institutionTypes.includes('CRECHE')).map((p) => p.code)).toEqual(['creche']);
    });
});

describe('seedPacks', () => {
    it('upserts every pack by code without overwriting existing ones', async () => {
        const client = makeClient(true);

        await seedPacks(client as any);

        expect(client.pack.upsert).toHaveBeenCalledTimes(4);
        const call = client.pack.upsert.mock.calls[1][0];
        expect(call.where).toEqual({ code: 'pro' });
        expect(call.update).toEqual({});
        expect(call.create).toEqual(expect.objectContaining({ code: 'pro', isDefault: false }));
    });

    it('makes Pro the default only when no default exists', async () => {
        const noDefault = makeClient(false);
        await seedPacks(noDefault as any);
        expect(noDefault.pack.update).toHaveBeenCalledWith({ where: { code: 'pro' }, data: { isDefault: true } });

        const hasDefault = makeClient(true);
        await seedPacks(hasDefault as any);
        expect(hasDefault.pack.update).not.toHaveBeenCalled();
    });

    it('backfills institutionType and packId on schools that lack them (missing or null)', async () => {
        const client = makeClient(true, 'default-id');

        await seedPacks(client as any);

        expect(client.school.updateMany).toHaveBeenCalledWith({
            where: { OR: [{ institutionType: null }, { institutionType: { isSet: false } }] },
            data: { institutionType: 'PRIVATE_SCHOOL' },
        });
        expect(client.school.updateMany).toHaveBeenCalledWith({
            where: { OR: [{ packId: null }, { packId: { isSet: false } }], institutionType: 'PRIVATE_SCHOOL' },
            data: { packId: 'default-id' },
        });
    });

    it('skips the pack backfill when there is no default pack', async () => {
        const client = makeClient(true);
        client.pack.findFirst.mockResolvedValue(null);

        await seedPacks(client as any);

        expect(client.school.updateMany).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/packs/packs.seed.test.ts`
Expected: FAIL — `Cannot find module './packs.seed'`.

- [ ] **Step 3: Implement** `src/modules/packs/packs.seed.ts`:

```ts
import type { PrismaClient } from '@prisma/client';
import type { InstitutionTypeValue, PackFeature } from './packs.constants';

interface SeedPack {
    code: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionTypeValue[];
    sortOrder: number;
}

const GENERAL_TYPES: InstitutionTypeValue[] = [
    'PRIVATE_SCHOOL',
    'TUTORING_CENTER',
    'VOCATIONAL_TRAINING',
    'LANGUAGE_CENTER',
];

export const DEFAULT_PACKS: SeedPack[] = [
    {
        code: 'essentiel',
        name: 'Essentiel',
        monthlyPrice: 250,
        yearlyPrice: 2500,
        maxStudents: 100,
        maxBranches: 1,
        features: [],
        institutionTypes: GENERAL_TYPES,
        sortOrder: 1,
    },
    {
        code: 'pro',
        name: 'Pro',
        monthlyPrice: 400,
        yearlyPrice: 4000,
        maxStudents: 300,
        maxBranches: 2,
        features: ['PARENT_PORTAL', 'STUDENT_PORTAL', 'QR_ATTENDANCE', 'ANNOUNCEMENTS', 'FINANCE_ANALYTICS'],
        institutionTypes: GENERAL_TYPES,
        sortOrder: 2,
    },
    {
        code: 'premium',
        name: 'Premium',
        monthlyPrice: 800,
        yearlyPrice: 8000,
        maxStudents: null,
        maxBranches: null,
        features: [
            'PARENT_PORTAL',
            'STUDENT_PORTAL',
            'QR_ATTENDANCE',
            'ANNOUNCEMENTS',
            'FINANCE_ANALYTICS',
            'TRANSPORT',
        ],
        institutionTypes: GENERAL_TYPES,
        sortOrder: 3,
    },
    {
        code: 'creche',
        name: 'Crèche',
        monthlyPrice: 200,
        yearlyPrice: 2000,
        maxStudents: 40,
        maxBranches: 1,
        features: ['PARENT_PORTAL', 'DAILY_LOG'],
        institutionTypes: ['CRECHE'],
        sortOrder: 4,
    },
];

// Idempotent: existing packs are never overwritten (a Super Admin may have edited them), Pro becomes
// the default only if no default exists, and legacy schools are backfilled to PRIVATE_SCHOOL + the default pack.
export const seedPacks = async (client: PrismaClient) => {
    for (const pack of DEFAULT_PACKS) {
        await client.pack.upsert({
            where: { code: pack.code },
            update: {},
            create: { ...pack, isDefault: false, active: true },
        });
    }

    if ((await client.pack.count({ where: { isDefault: true } })) === 0) {
        await client.pack.update({ where: { code: 'pro' }, data: { isDefault: true } });
    }

    await client.school.updateMany({
        where: { OR: [{ institutionType: null }, { institutionType: { isSet: false } }] },
        data: { institutionType: 'PRIVATE_SCHOOL' },
    });

    const defaultPack = await client.pack.findFirst({ where: { isDefault: true, active: true } });
    if (defaultPack) {
        await client.school.updateMany({
            where: { OR: [{ packId: null }, { packId: { isSet: false } }], institutionType: 'PRIVATE_SCHOOL' },
            data: { packId: defaultPack.id },
        });
    }
};
```

- [ ] **Step 4: Runner and script.** `prisma/seed-packs.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { seedPacks } from '../src/modules/packs/packs.seed';

const prisma = new PrismaClient();

seedPacks(prisma)
    .then(async () => {
        const packs = await prisma.pack.findMany({ orderBy: { sortOrder: 'asc' }, select: { code: true, isDefault: true, active: true } });
        console.log('Packs in database:', packs);
    })
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
```

In `package.json` scripts, after `"prisma:seed": ...` add: `"prisma:seed-packs": "ts-node prisma/seed-packs.ts",`.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest src/modules/packs && npx tsc --noEmit -p .`
Expected: PASS, tsc silent.

- [ ] **Step 6: Run the seed on the dev database — ASK THE USER FIRST**

This writes to the dev Atlas DB: it creates 4 packs and backfills every existing school with `institutionType` and the default pack. Get the user's approval, then run `npm run prisma:seed-packs` twice. Expected: first run prints 4 packs with Pro `isDefault: true`; second run prints the same, no changes.

- [ ] **Step 7: Commit**

```bash
git add src/modules/packs prisma/seed-packs.ts package.json
git commit -m "feat(education): idempotent seed for Essentiel, Pro, Premium and Crèche packs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Drop the legacy `packTier`

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Confirm nothing uses it**

Run: `grep -rn "packTier" src prisma frontend/lib frontend/app frontend/components 2>/dev/null | grep -v node_modules`
Expected: only `prisma/schema.prisma` (the frontend signup payload does not send it). If anything else appears, remove that usage first.

- [ ] **Step 2: Remove the field.** In `model School`, delete the line `packTier    String?`. Then run `npx prisma format && npx prisma generate && npx tsc --noEmit -p . && npx jest`.
Expected: tsc silent, all tests pass. Then `npx prisma db push` (expected: in sync; documents keep the extra `packTier` field harmlessly).

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "refactor(education): drop legacy School.packTier

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Live API smoke test

No code. Start the backend (`npm run dev`, port from the startup log; never print `.env`).

- [ ] `GET /api/packs/public` → 4 packs ordered essentiel/pro/premium/creche, only public fields, `recommended: true` on Pro only.
- [ ] `GET /api/packs/public?type=CRECHE` → only Crèche; `?type=PRIVATE_SCHOOL` → the three general packs; `?type=NOPE` → `400`.
- [ ] `POST /api/schools/signup` (create a QA owner such as `qa-packs@example.test`, school name `QA-PACKS`): with `{institutionType:'PRIVATE_SCHOOL', packCode:'premium'}` → 201, then `GET /api/schools/me` with that token shows `pack.code === 'premium'`; with `{institutionType:'CRECHE', packCode:'pro'}` → 400 `Unknown or unavailable pack`; without `institutionType` → 400; `{institutionType:'CRECHE'}` alone → 201 with `pack: null` (default Pro does not serve crèches).
- [ ] As SUPER_ADMIN (seed admin `admin@injahi.com` has role ADMIN, not SUPER_ADMIN — find or create a SUPER_ADMIN user through the existing seed/scripts, or skip these checks and say so): `GET /api/packs` (with `_count`), `POST /api/packs`, `PUT /api/packs/:id`, `PATCH /api/packs/:id/default`, deactivate-default → 400, `PATCH /api/schools/:id/pack` (valid → 200, type mismatch → 400, inactive pack → 404).
- [ ] Non-SUPER_ADMIN token on `/api/packs` → 403; no token → 401.
- [ ] Clean up ONLY the QA records you created (school, branch, user, plus any test pack) by recorded ids, stop the server, confirm the port is free. Report results faithfully.

---

## Self-Review

**Spec coverage:** Pack model + `institutionTypes` + `DAILY_LOG` feature + seed table (four packs) → Tasks 1, 2, 6. `School.institutionType`/`packId`, `packTier` dropped → Tasks 1, 5, 7. Public endpoint with `type` filter and `recommended` → Tasks 3, 4. SUPER_ADMIN CRUD, default switch in one `$transaction`, cannot deactivate default, code uniqueness, validation rules → Tasks 2, 3, 4. Assign school pack (active + serves type) → Task 5. Signup: required `institutionType`, `packCode` rules, default-pack fallback (serves type, else null), `packTier` removed, 15-day trial unchanged → Task 5. `GET /schools` and `GET /schools/me` include the pack → Task 5. Idempotent seed and backfill → Task 6. Frontend items are in the second plan.
**Placeholder scan:** none.
**Type consistency:** `InstitutionTypeValue`, `PackFeature`, `sanitizeNewPack/sanitizePackUpdate`, `listPublicPacks/listAllPacks/createPack/updatePack/setDefaultPack`, `assignPackToSchool`, `DEFAULT_PACKS/seedPacks`, and the controller names (`publicList/list/create/update/makeDefault`, `assignPack`) match between tasks and tests.
**Known limits:** pack type changes don't re-validate assigned schools; the "at most one default" rule relies on the transaction (no DB constraint).
