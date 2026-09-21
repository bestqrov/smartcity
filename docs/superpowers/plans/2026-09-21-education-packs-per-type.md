# Per-Type Packs and Default Pack per Institution Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every institution type its own Essentiel/Pro/Premium with its own prices and limits, and make "default pack" per institution type instead of global.

**Architecture:** No schema change (a `Pack` already lists `institutionTypes`, the public endpoint already filters by type, the landing/signup already show the packs of the chosen type). Three backend changes: `setDefaultPack` clears defaults only among packs sharing a type, signup resolves the default of the school's type, and the seed creates 13 packs (+ Crèche) with per-type defaults and normalises the three originally-shared packs to private schools only.

**Tech Stack:** Node/Express, Prisma 5 on MongoDB, Jest + ts-jest with mocked prisma.

**Spec:** `docs/superpowers/specs/2026-09-20-education-packs-landing-design.md` (updated: "Seed" and `isDefault` rows).

**Conventions:** commands run from `apps/education-apps` on branch `feature/education-packs`. Baseline: `npx jest` (33 suites / 247 tests pass) and `npx tsc --noEmit -p .` (silent). Commit trailer, verbatim: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

**Known limitation (accepted):** editing a default pack's `institutionTypes` in the Super Admin form can leave two defaults for one type; re-selecting "Par défaut" on the intended pack fixes it.

## File Structure

**Modify:** `src/modules/packs/packs.service.ts` (+test), `src/modules/schools/schools.service.ts` (+test), `src/modules/packs/packs.seed.ts` (+test — replaced).

---

### Task 1: Default pack is scoped per institution type

**Files:** Modify `src/modules/packs/packs.service.ts`, `src/modules/packs/packs.service.test.ts`

- [ ] **Step 1: Update the failing test.** In `packs.service.test.ts`, test `'clears the previous default and sets the new one in one transaction'` (inside `describe('setDefaultPack')`): replace the `tx.pack.updateMany` expectation with

```ts
        expect(tx.pack.updateMany).toHaveBeenCalledWith({
            where: { isDefault: true, id: { not: 'p1' }, institutionTypes: { hasSome: ['PRIVATE_SCHOOL'] } },
            data: { isDefault: false },
        });
```

and add this test after it:

```ts
    it('only clears defaults of packs that share a type with the new default', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({
            ...stored,
            id: 'p2',
            institutionTypes: ['TUTORING_CENTER', 'LANGUAGE_CENTER'],
            isDefault: false,
        });
        (prisma.$transaction as jest.Mock).mockImplementation((cb: any) => cb(tx));
        tx.pack.update.mockResolvedValue({});

        await setDefaultPack('p2');

        expect(tx.pack.updateMany).toHaveBeenCalledWith({
            where: {
                isDefault: true,
                id: { not: 'p2' },
                institutionTypes: { hasSome: ['TUTORING_CENTER', 'LANGUAGE_CENTER'] },
            },
            data: { isDefault: false },
        });
    });
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/modules/packs/packs.service.test.ts` → FAIL on the two `updateMany` expectations.

- [ ] **Step 3: Implement.** In `setDefaultPack` replace the `updateMany` line with:

```ts
        // "Default" is per institution type: only packs that share a type with this one lose the flag.
        await tx.pack.updateMany({
            where: { isDefault: true, id: { not: id }, institutionTypes: { hasSome: pack.institutionTypes } },
            data: { isDefault: false },
        });
```

- [ ] **Step 4: Verify + commit** — `npx jest src/modules/packs && npx tsc --noEmit -p .` (pass, silent), then:

```bash
git add src/modules/packs/packs.service.ts src/modules/packs/packs.service.test.ts
git commit -m "feat(education): default pack is scoped per institution type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Signup uses the default pack of the school's type

**Files:** Modify `src/modules/schools/schools.service.ts`, `src/modules/schools/schools.service.test.ts`

- [ ] **Step 1: Update the tests** (describe `'signupSchool — institution type and pack'`):
  - In `'uses the default pack when no packCode is given and it serves the type'` change the lookup expectation to `expect(prisma.pack.findFirst).toHaveBeenCalledWith({ where: { isDefault: true, active: true, institutionTypes: { has: 'PRIVATE_SCHOOL' } } });`.
  - Replace the test `'leaves packId null when the default pack does not serve the type, and still succeeds'` with:

```ts
    it('leaves packId null when the chosen type has no default pack, and still succeeds', async () => {
        const { txClient } = arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);

        await signupSchool({ ...baseInput, institutionType: 'CRECHE' });

        expect(prisma.pack.findFirst).toHaveBeenCalledWith({
            where: { isDefault: true, active: true, institutionTypes: { has: 'CRECHE' } },
        });
        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ institutionType: 'CRECHE', packId: null }),
            })
        );
    });
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/modules/schools` → the changed expectations fail.

- [ ] **Step 3: Implement.** In `resolveSignupPack`, replace the last two lines (default lookup + return) with:

```ts
    // Each institution type has its own default pack; none means signup proceeds without a pack.
    return prisma.pack.findFirst({
        where: { isDefault: true, active: true, institutionTypes: { has: type } },
    });
```

(the `packCode` branch above it is unchanged).

- [ ] **Step 4: Verify + commit** — `npx jest src/modules/schools && npx tsc --noEmit -p .`, then:

```bash
git add src/modules/schools
git commit -m "feat(education): signup resolves the default pack of the school's type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Seed per-type packs

**Files:** Modify (replace contents) `src/modules/packs/packs.seed.ts`, `src/modules/packs/packs.seed.test.ts`

- [ ] **Step 1: Replace the test** `src/modules/packs/packs.seed.test.ts` with:

```ts
import { DEFAULT_PACK_BY_TYPE, DEFAULT_PACKS, seedPacks } from './packs.seed';

const makeClient = (opts: { defaultsExist?: boolean; defaultPackId?: string | null } = {}) => ({
    pack: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(opts.defaultsExist ? 1 : 0),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest
            .fn()
            .mockResolvedValue(opts.defaultPackId === null ? null : { id: opts.defaultPackId ?? 'default-id' }),
    },
    school: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
});

const find = (code: string) => DEFAULT_PACKS.find((p) => p.code === code)!;

describe('DEFAULT_PACKS', () => {
    it('has 13 packs with unique codes, each serving exactly one institution type', () => {
        expect(DEFAULT_PACKS).toHaveLength(13);
        expect(new Set(DEFAULT_PACKS.map((p) => p.code)).size).toBe(13);
        expect(DEFAULT_PACKS.every((p) => p.institutionTypes.length === 1)).toBe(true);
    });

    it('matches the agreed prices and student limits per type', () => {
        const row = (code: string) => [find(code).monthlyPrice, find(code).yearlyPrice, find(code).maxStudents];
        expect(row('essentiel')).toEqual([250, 2500, 100]);
        expect(row('pro')).toEqual([400, 4000, 300]);
        expect(row('premium')).toEqual([800, 8000, null]);
        expect(row('essentiel-soutien')).toEqual([200, 2000, 150]);
        expect(row('pro-soutien')).toEqual([350, 3500, 400]);
        expect(row('premium-soutien')).toEqual([600, 6000, null]);
        expect(row('essentiel-formation')).toEqual([300, 3000, 80]);
        expect(row('pro-formation')).toEqual([500, 5000, 250]);
        expect(row('premium-formation')).toEqual([900, 9000, null]);
        expect(row('essentiel-langues')).toEqual([200, 2000, 120]);
        expect(row('pro-langues')).toEqual([350, 3500, 350]);
        expect(row('premium-langues')).toEqual([650, 6500, null]);
        expect(row('creche')).toEqual([200, 2000, 40]);
    });

    it('limits branches to 1 / 2 / unlimited by tier', () => {
        expect([find('essentiel').maxBranches, find('pro').maxBranches, find('premium').maxBranches]).toEqual([1, 2, null]);
        expect(find('creche').maxBranches).toBe(1);
    });

    it('gives TRANSPORT only to the private-school Premium, and DAILY_LOG only to the crèche pack', () => {
        const withTransport = DEFAULT_PACKS.filter((p) => p.features.includes('TRANSPORT')).map((p) => p.code);
        expect(withTransport).toEqual(['premium']);
        const withDailyLog = DEFAULT_PACKS.filter((p) => p.features.includes('DAILY_LOG')).map((p) => p.code);
        expect(withDailyLog).toEqual(['creche']);
        expect(find('essentiel-soutien').features).toEqual([]);
        expect(find('pro-formation').features).toEqual([
            'PARENT_PORTAL',
            'STUDENT_PORTAL',
            'QR_ATTENDANCE',
            'ANNOUNCEMENTS',
            'FINANCE_ANALYTICS',
        ]);
        expect(find('creche').features).toEqual(['PARENT_PORTAL', 'DAILY_LOG']);
    });

    it('names a default pack for every institution type', () => {
        expect(DEFAULT_PACK_BY_TYPE).toEqual({
            PRIVATE_SCHOOL: 'pro',
            TUTORING_CENTER: 'pro-soutien',
            VOCATIONAL_TRAINING: 'pro-formation',
            LANGUAGE_CENTER: 'pro-langues',
            CRECHE: 'creche',
        });
        for (const code of Object.values(DEFAULT_PACK_BY_TYPE)) expect(find(code)).toBeDefined();
    });
});

describe('seedPacks', () => {
    it('narrows the three originally shared packs to private schools, only if their types are still the original list', async () => {
        const client = makeClient({ defaultsExist: true });

        await seedPacks(client as any);

        expect(client.pack.updateMany).toHaveBeenCalledWith({
            where: {
                code: { in: ['essentiel', 'pro', 'premium'] },
                institutionTypes: {
                    equals: ['PRIVATE_SCHOOL', 'TUTORING_CENTER', 'VOCATIONAL_TRAINING', 'LANGUAGE_CENTER'],
                },
            },
            data: { institutionTypes: ['PRIVATE_SCHOOL'] },
        });
    });

    it('upserts every pack by code without overwriting existing ones', async () => {
        const client = makeClient({ defaultsExist: true });

        await seedPacks(client as any);

        expect(client.pack.upsert).toHaveBeenCalledTimes(13);
        const call = client.pack.upsert.mock.calls.find((c: any[]) => c[0].where.code === 'pro-soutien')![0];
        expect(call.update).toEqual({});
        expect(call.create).toEqual(
            expect.objectContaining({ code: 'pro-soutien', institutionTypes: ['TUTORING_CENTER'], isDefault: false, active: true })
        );
    });

    it('makes each type\'s default pack the default only when that type has none', async () => {
        const none = makeClient({ defaultsExist: false });
        await seedPacks(none as any);
        expect(none.pack.update.mock.calls.map((c: any[]) => c[0].where.code)).toEqual([
            'pro',
            'pro-soutien',
            'pro-formation',
            'pro-langues',
            'creche',
        ]);
        expect(none.pack.update).toHaveBeenCalledWith({ where: { code: 'creche' }, data: { isDefault: true } });
        expect(none.pack.count).toHaveBeenCalledWith({ where: { isDefault: true, institutionTypes: { has: 'CRECHE' } } });

        const some = makeClient({ defaultsExist: true });
        await seedPacks(some as any);
        expect(some.pack.update).not.toHaveBeenCalled();
    });

    it('backfills institutionType, then packId per type from that type\'s default pack', async () => {
        const client = makeClient({ defaultsExist: true, defaultPackId: 'default-id' });

        await seedPacks(client as any);

        expect(client.school.updateMany).toHaveBeenCalledWith({
            where: { OR: [{ institutionType: null }, { institutionType: { isSet: false } }] },
            data: { institutionType: 'PRIVATE_SCHOOL' },
        });
        expect(client.pack.findFirst).toHaveBeenCalledWith({
            where: { isDefault: true, active: true, institutionTypes: { has: 'TUTORING_CENTER' } },
        });
        expect(client.school.updateMany).toHaveBeenCalledWith({
            where: { OR: [{ packId: null }, { packId: { isSet: false } }], institutionType: 'TUTORING_CENTER' },
            data: { packId: 'default-id' },
        });
        expect(client.school.updateMany).toHaveBeenCalledTimes(1 + 5);
    });

    it('skips the pack backfill for a type without a default pack', async () => {
        const client = makeClient({ defaultsExist: true, defaultPackId: null });

        await seedPacks(client as any);

        expect(client.school.updateMany).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/modules/packs/packs.seed.test.ts` → FAIL (`DEFAULT_PACK_BY_TYPE` missing, wrong pack counts).

- [ ] **Step 3: Replace** `src/modules/packs/packs.seed.ts` with:

```ts
import type { PrismaClient } from '@prisma/client';
import { INSTITUTION_TYPES, type InstitutionTypeValue, type PackFeature } from './packs.constants';

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

type Tier = 'essentiel' | 'pro' | 'premium';

const TIERS: { tier: Tier; name: string; maxBranches: number | null }[] = [
    { tier: 'essentiel', name: 'Essentiel', maxBranches: 1 },
    { tier: 'pro', name: 'Pro', maxBranches: 2 },
    { tier: 'premium', name: 'Premium', maxBranches: null },
];

const BASE_FEATURES: PackFeature[] = [
    'PARENT_PORTAL',
    'STUDENT_PORTAL',
    'QR_ATTENDANCE',
    'ANNOUNCEMENTS',
    'FINANCE_ANALYTICS',
];

interface TypePricing {
    type: InstitutionTypeValue;
    codeSuffix: string; // '' keeps the original codes (essentiel / pro / premium) for private schools
    monthly: [number, number, number]; // essentiel, pro, premium (MAD)
    students: [number, number, null]; // student limits; Premium is unlimited
    transport: boolean; // whether Premium includes TRANSPORT
}

const TYPE_PRICING: TypePricing[] = [
    { type: 'PRIVATE_SCHOOL', codeSuffix: '', monthly: [250, 400, 800], students: [100, 300, null], transport: true },
    { type: 'TUTORING_CENTER', codeSuffix: '-soutien', monthly: [200, 350, 600], students: [150, 400, null], transport: false },
    { type: 'VOCATIONAL_TRAINING', codeSuffix: '-formation', monthly: [300, 500, 900], students: [80, 250, null], transport: false },
    { type: 'LANGUAGE_CENTER', codeSuffix: '-langues', monthly: [200, 350, 650], students: [120, 350, null], transport: false },
];

const featuresFor = (tier: Tier, transport: boolean): PackFeature[] => {
    if (tier === 'essentiel') return [];
    if (tier === 'pro' || !transport) return [...BASE_FEATURES];
    return [...BASE_FEATURES, 'TRANSPORT'];
};

// Yearly price = 10 months (two months free).
export const DEFAULT_PACKS: SeedPack[] = [
    ...TYPE_PRICING.flatMap((config) =>
        TIERS.map((tier, index) => ({
            code: `${tier.tier}${config.codeSuffix}`,
            name: tier.name,
            monthlyPrice: config.monthly[index],
            yearlyPrice: config.monthly[index] * 10,
            maxStudents: config.students[index],
            maxBranches: tier.maxBranches,
            features: featuresFor(tier.tier, config.transport),
            institutionTypes: [config.type],
            sortOrder: index + 1,
        }))
    ),
    {
        code: 'creche',
        name: 'Crèche',
        monthlyPrice: 200,
        yearlyPrice: 2000,
        maxStudents: 40,
        maxBranches: 1,
        features: ['PARENT_PORTAL', 'DAILY_LOG'],
        institutionTypes: ['CRECHE'],
        sortOrder: 1,
    },
];

// The pack that is the default of each institution type when no default exists yet.
export const DEFAULT_PACK_BY_TYPE: Record<InstitutionTypeValue, string> = {
    PRIVATE_SCHOOL: 'pro',
    TUTORING_CENTER: 'pro-soutien',
    VOCATIONAL_TRAINING: 'pro-formation',
    LANGUAGE_CENTER: 'pro-langues',
    CRECHE: 'creche',
};

// essentiel/pro/premium were first seeded for these four types before packs became per-type.
const ORIGINAL_SHARED_TYPES: InstitutionTypeValue[] = [
    'PRIVATE_SCHOOL',
    'TUTORING_CENTER',
    'VOCATIONAL_TRAINING',
    'LANGUAGE_CENTER',
];

// Idempotent: existing packs are never overwritten (a Super Admin may have edited them), each type gets its
// default pack only if it has none, and legacy schools are backfilled to PRIVATE_SCHOOL + their type's default.
export const seedPacks = async (client: PrismaClient) => {
    // One-time normalisation, only while the types still equal the original shared list exactly.
    await client.pack.updateMany({
        where: { code: { in: ['essentiel', 'pro', 'premium'] }, institutionTypes: { equals: ORIGINAL_SHARED_TYPES } },
        data: { institutionTypes: ['PRIVATE_SCHOOL'] },
    });

    for (const pack of DEFAULT_PACKS) {
        await client.pack.upsert({
            where: { code: pack.code },
            update: {},
            create: { ...pack, isDefault: false, active: true },
        });
    }

    for (const type of INSTITUTION_TYPES) {
        const hasDefault = await client.pack.count({ where: { isDefault: true, institutionTypes: { has: type } } });
        if (hasDefault === 0) {
            await client.pack.update({ where: { code: DEFAULT_PACK_BY_TYPE[type] }, data: { isDefault: true } });
        }
    }

    await client.school.updateMany({
        where: { OR: [{ institutionType: null }, { institutionType: { isSet: false } }] },
        data: { institutionType: 'PRIVATE_SCHOOL' },
    });

    for (const type of INSTITUTION_TYPES) {
        const defaultPack = await client.pack.findFirst({
            where: { isDefault: true, active: true, institutionTypes: { has: type } },
        });
        if (defaultPack) {
            await client.school.updateMany({
                where: { OR: [{ packId: null }, { packId: { isSet: false } }], institutionType: type },
                data: { packId: defaultPack.id },
            });
        }
    }
};
```

- [ ] **Step 4: Verify** — `npx jest src/modules/packs && npx tsc --noEmit -p .` → pass, silent. Also `npx jest` (all pass).

- [ ] **Step 5: Commit**

```bash
git add src/modules/packs/packs.seed.ts src/modules/packs/packs.seed.test.ts
git commit -m "feat(education): seed per-type Essentiel/Pro/Premium packs with per-type defaults

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Apply to the dev database and verify (controller task — needs the user's approval, already given for seeding)

- [ ] Run `npm run prisma:seed-packs` twice. Expected: 13 packs (essentiel, pro, premium, then the type-suffixed ones, and creche) with `isDefault: true` on `pro`, `pro-soutien`, `pro-formation`, `pro-langues`, `creche`; the second run changes nothing.
- [ ] `GET /api/packs/public?type=TUTORING_CENTER` → `essentiel-soutien` / `pro-soutien` (recommended) / `premium-soutien` at 200 / 350 / 600; the same check for `VOCATIONAL_TRAINING` (300/500/900) and `LANGUAGE_CENTER` (200/350/650); `PRIVATE_SCHOOL` → essentiel/pro/premium at 250/400/800 with TRANSPORT only in premium; `CRECHE` → creche.
- [ ] Existing schools keep their pack (`pro`, private school). Report results faithfully.
