# Onboarding Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guide a newly signed-up establishment through its setup (profile, prices, classes, teachers, staff, transport, first student) with a checklist whose steps tick automatically from the data.

**Architecture:** A new backend module `src/modules/onboarding/` computes the steps from `count` queries on each request. Nothing stores "done". Only skipped optional steps and a dismissed flag are stored, on `Settings`. On the frontend, a shared hook feeds a dashboard card and a thin banner shown on the page of the current step.

**Tech Stack:** Express + Prisma (MongoDB), Jest + supertest; Next.js App Router + Tailwind; `tr()` with the `lib/i18n/ar` dictionary.

Spec: `docs/superpowers/specs/2026-11-25-education-onboarding-checklist-design.md`.

All paths below are relative to `apps/education-apps/`. Run backend commands from `apps/education-apps/`, and frontend commands from `apps/education-apps/frontend/`.

---

## File structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` (modify `model Settings`) | `onboardingSkipped`, `onboardingDismissed` |
| `src/modules/onboarding/onboarding.service.ts` (create) | Step definitions, state computation, skip/dismiss update |
| `src/modules/onboarding/onboarding.controller.ts` (create) | HTTP mapping through `respond` |
| `src/modules/onboarding/onboarding.routes.ts` (create) | ADMIN/OWNER, tenant-scoped |
| `src/app.ts` (modify) | Mount `/onboarding` |
| `src/modules/onboarding/onboarding.service.test.ts` (create) | Service tests |
| `src/modules/onboarding/onboarding.routes.test.ts` (create) | Role tests |
| `frontend/lib/services/onboarding.ts` (create) | API calls and types |
| `frontend/hooks/useOnboarding.ts` (create) | Shared state, refetched on route change |
| `frontend/components/onboarding/OnboardingCard.tsx` (create) | Dashboard card |
| `frontend/components/onboarding/OnboardingStepBanner.tsx` (create) | Banner on the page of a step |
| `frontend/lib/onboarding/labels.ts` (create) | French step labels (the `tr` keys) |
| `frontend/lib/i18n/ar/onboarding.ts` (create) + `index.ts` (modify) | Arabic texts |
| `frontend/app/admin/page.tsx`, `frontend/app/admin/layout.tsx`, `frontend/app/signup/page.tsx` (modify) | Wiring |

---

### Task 1: Settings fields

**Files:**
- Modify: `prisma/schema.prisma` (`model Settings`, after `schoolYear`)

- [ ] **Step 1: Add the fields**

In `model Settings`, after the line `schoolYear     String? ...`, add:

```prisma
  // Onboarding checklist: optional steps the admin skipped, and the checklist hidden by the admin.
  onboardingSkipped   String[]
  onboardingDismissed Boolean  @default(false)
```

- [ ] **Step 2: Regenerate the client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`. The code is not pushed to the database here; `npx prisma db push` is run by the user when deploying.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(education): Settings onboarding fields"
```

---

### Task 2: Onboarding service (TDD)

**Files:**
- Create: `src/modules/onboarding/onboarding.service.ts`
- Test: `src/modules/onboarding/onboarding.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/onboarding/onboarding.service.test.ts`:

```ts
import prisma from '../../config/database';
import { getOnboarding, updateOnboarding } from './onboarding.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findUnique: jest.fn() },
        settings: { findUnique: jest.fn(), update: jest.fn() },
        tuitionFee: { count: jest.fn() },
        pricing: { count: jest.fn() },
        formation: { count: jest.fn() },
        group: { count: jest.fn() },
        teacher: { count: jest.fn() },
        user: { count: jest.fn() },
        vehicle: { count: jest.fn() },
        transportRoute: { count: jest.fn() },
        student: { count: jest.fn() },
    },
}));

const m = (fn: unknown) => fn as jest.Mock;
const B = 'b1';
const COUNTED = ['tuitionFee', 'pricing', 'formation', 'group', 'teacher', 'user', 'vehicle', 'transportRoute', 'student'] as const;

const setup = (opts: {
    type?: string | null;
    phone?: string | null;
    features?: string[] | null; // null = no pack
    settings?: Record<string, unknown> | null;
    counts?: Partial<Record<(typeof COUNTED)[number], number>>;
}) => {
    m(prisma.branch.findUnique).mockResolvedValue({
        school: {
            institutionType: opts.type === undefined ? 'TUTORING_CENTER' : opts.type,
            phone: opts.phone ?? null,
            pack: opts.features === null || opts.features === undefined ? null : { features: opts.features },
        },
    });
    m(prisma.settings.findUnique).mockResolvedValue(
        opts.settings === null
            ? null
            : { schoolName: 'Al Amal', contactInfo: '0600000000', schoolCycles: [], onboardingSkipped: [], onboardingDismissed: false, ...opts.settings },
    );
    for (const key of COUNTED) m((prisma as any)[key].count).mockResolvedValue(opts.counts?.[key] ?? 0);
};

const keys = (r: { steps: { key: string }[] }) => r.steps.map((s) => s.key);
const step = (r: { steps: { key: string }[] }, key: string) => r.steps.find((s) => s.key === key) as any;

beforeEach(() => jest.clearAllMocks());

describe('visible steps', () => {
    it('centre with no pack: every step but formations, transport shown', async () => {
        setup({});
        expect(keys(await getOnboarding(B))).toEqual(['profile', 'prices', 'groups', 'teachers', 'staff', 'transport', 'firstStudent']);
    });

    it('formations only for vocational training', async () => {
        setup({ type: 'VOCATIONAL_TRAINING' });
        expect(keys(await getOnboarding(B))).toContain('formations');
        expect(keys(await getOnboarding(B)).indexOf('formations')).toBe(2);
    });

    it('transport hidden when the pack lacks TRANSPORT, shown when it has it', async () => {
        setup({ features: ['PARENT_PORTAL'] });
        expect(keys(await getOnboarding(B))).not.toContain('transport');
        setup({ features: ['TRANSPORT'] });
        expect(keys(await getOnboarding(B))).toContain('transport');
    });
});

describe('done', () => {
    it('profile needs a name and a phone; a private school also needs cycles', async () => {
        setup({ settings: { contactInfo: null } });
        expect(step(await getOnboarding(B), 'profile').done).toBe(false);
        setup({ settings: { contactInfo: null }, phone: '0522000000' });
        expect(step(await getOnboarding(B), 'profile').done).toBe(true);
        setup({ type: 'PRIVATE_SCHOOL' });
        expect(step(await getOnboarding(B), 'profile').done).toBe(false);
        setup({ type: 'PRIVATE_SCHOOL', settings: { schoolCycles: ['PRIMAIRE'] } });
        expect(step(await getOnboarding(B), 'profile').done).toBe(true);
    });

    it('profile is not done without settings', async () => {
        setup({ settings: null });
        expect(step(await getOnboarding(B), 'profile').done).toBe(false);
    });

    it('prices use TuitionFee in school mode and active Pricing otherwise', async () => {
        setup({ counts: { pricing: 1 } });
        expect(step(await getOnboarding(B), 'prices').done).toBe(true);
        setup({ settings: { schoolCycles: ['COLLEGE'] }, counts: { pricing: 1 } });
        expect(step(await getOnboarding(B), 'prices').done).toBe(false);
        setup({ type: 'PRIVATE_SCHOOL', counts: { tuitionFee: 2 } });
        expect(step(await getOnboarding(B), 'prices').done).toBe(true);
    });

    it('transport needs a vehicle and a route', async () => {
        setup({ counts: { vehicle: 1 } });
        expect(step(await getOnboarding(B), 'transport').done).toBe(false);
        setup({ counts: { vehicle: 1, transportRoute: 1 } });
        expect(step(await getOnboarding(B), 'transport').done).toBe(true);
    });

    it('counts only the branch, and staff only SECRETARY users', async () => {
        setup({ counts: { group: 1, teacher: 1, user: 1, student: 1 } });
        const r = await getOnboarding(B);
        for (const k of ['groups', 'teachers', 'staff', 'firstStudent']) expect(step(r, k).done).toBe(true);
        expect(m(prisma.group.count)).toHaveBeenCalledWith({ where: { branchId: B } });
        expect(m(prisma.user.count)).toHaveBeenCalledWith({ where: { branchId: B, role: 'SECRETARY' } });
    });
});

describe('completed, skipped, href', () => {
    it('completed when every step is done or skipped', async () => {
        setup({
            counts: { pricing: 1, group: 1, teacher: 1, student: 1 },
            settings: { onboardingSkipped: ['staff', 'transport'] },
        });
        const r = await getOnboarding(B);
        expect(r.completed).toBe(true);
        expect(step(r, 'staff')).toMatchObject({ skipped: true, optional: true, done: false });
    });

    it('not completed while a required step is missing', async () => {
        setup({ counts: { pricing: 1, group: 1, teacher: 1 }, settings: { onboardingSkipped: ['staff', 'transport'] } });
        expect((await getOnboarding(B)).completed).toBe(false);
    });

    it('returns the page of each step and the dismissed flag', async () => {
        setup({ settings: { onboardingDismissed: true } });
        const r = await getOnboarding(B);
        expect(r.dismissed).toBe(true);
        expect(step(r, 'groups').href).toBe('/admin/groups');
        expect(step(r, 'firstStudent').href).toBe('/admin/inscriptions');
    });
});

describe('updateOnboarding', () => {
    beforeEach(() => {
        setup({});
        m(prisma.settings.update).mockResolvedValue({});
    });

    it('skips and unskips an optional step', async () => {
        await updateOnboarding(B, { skip: 'transport' });
        expect(m(prisma.settings.update)).toHaveBeenCalledWith({ where: { branchId: B }, data: { onboardingSkipped: ['transport'] } });
        setup({ settings: { onboardingSkipped: ['transport', 'staff'] } });
        await updateOnboarding(B, { unskip: 'transport' });
        expect(m(prisma.settings.update)).toHaveBeenLastCalledWith({ where: { branchId: B }, data: { onboardingSkipped: ['staff'] } });
    });

    it('does not add the same key twice', async () => {
        setup({ settings: { onboardingSkipped: ['staff'] } });
        await updateOnboarding(B, { skip: 'staff' });
        expect(m(prisma.settings.update)).toHaveBeenCalledWith({ where: { branchId: B }, data: { onboardingSkipped: ['staff'] } });
    });

    it('refuses a required or unknown key', async () => {
        await expect(updateOnboarding(B, { skip: 'groups' })).rejects.toThrow('Only optional steps can be skipped');
        await expect(updateOnboarding(B, { skip: 'nope' })).rejects.toThrow('Only optional steps can be skipped');
    });

    it('sets dismissed', async () => {
        await updateOnboarding(B, { dismissed: true });
        expect(m(prisma.settings.update)).toHaveBeenCalledWith({ where: { branchId: B }, data: { onboardingDismissed: true } });
        await expect(updateOnboarding(B, { dismissed: 'yes' })).rejects.toThrow('dismissed must be a boolean');
    });

    it('needs the branch settings and one action', async () => {
        setup({ settings: null });
        await expect(updateOnboarding(B, { dismissed: true })).rejects.toThrow('Settings not found');
        setup({});
        await expect(updateOnboarding(B, {})).rejects.toThrow('Nothing to update');
    });
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx jest src/modules/onboarding/onboarding.service`
Expected: FAIL with `Cannot find module './onboarding.service'`.

- [ ] **Step 3: Write the service**

Create `src/modules/onboarding/onboarding.service.ts`:

```ts
import prisma from '../../config/database';

// Onboarding checklist of a new establishment. A step is "done" from the data itself, never stored:
// only skipped optional steps and the hidden flag live on Settings.
export const STEP_KEYS = ['profile', 'prices', 'formations', 'groups', 'teachers', 'staff', 'transport', 'firstStudent'] as const;
export type StepKey = (typeof STEP_KEYS)[number];
export const OPTIONAL_STEPS: StepKey[] = ['staff', 'transport'];

export const STEP_HREF: Record<StepKey, string> = {
    profile: '/admin/settings',
    prices: '/admin/finance/prix',
    formations: '/admin/formation-pro/new',
    groups: '/admin/groups',
    teachers: '/admin/teachers',
    staff: '/admin/secretaire',
    transport: '/admin/transport',
    firstStudent: '/admin/inscriptions',
};

export interface OnboardingStep {
    key: StepKey;
    done: boolean;
    skipped: boolean;
    optional: boolean;
    href: string;
}

export interface OnboardingState {
    steps: OnboardingStep[];
    completed: boolean;
    dismissed: boolean;
}

export const getOnboarding = async (branchId: string): Promise<OnboardingState> => {
    const [branch, settings] = await Promise.all([
        prisma.branch.findUnique({
            where: { id: branchId },
            select: { school: { select: { institutionType: true, phone: true, pack: { select: { features: true } } } } },
        }),
        prisma.settings.findUnique({ where: { branchId } }),
    ]);
    const school = branch?.school;
    const type = school?.institutionType ?? 'PRIVATE_SCHOOL';
    const cycles = settings?.schoolCycles ?? [];
    // Same rule as schoolModeGate.
    const schoolMode = type === 'PRIVATE_SCHOOL' || cycles.length > 0;
    const features = school?.pack ? school.pack.features : null;

    const visible: StepKey[] = STEP_KEYS.filter((key) => {
        if (key === 'formations') return type === 'VOCATIONAL_TRAINING';
        if (key === 'transport') return features === null || features.includes('TRANSPORT');
        return true;
    });

    const where = { branchId };
    const [prices, formations, groups, teachers, staff, vehicles, routes, students] = await Promise.all([
        schoolMode ? prisma.tuitionFee.count({ where }) : prisma.pricing.count({ where: { branchId, active: true } }),
        visible.includes('formations') ? prisma.formation.count({ where }) : Promise.resolve(0),
        prisma.group.count({ where }),
        prisma.teacher.count({ where }),
        prisma.user.count({ where: { branchId, role: 'SECRETARY' } }),
        visible.includes('transport') ? prisma.vehicle.count({ where }) : Promise.resolve(0),
        visible.includes('transport') ? prisma.transportRoute.count({ where }) : Promise.resolve(0),
        prisma.student.count({ where }),
    ]);

    const hasPhone = !!(school?.phone?.trim() || settings?.contactInfo?.trim());
    const done: Record<StepKey, boolean> = {
        profile: !!settings?.schoolName?.trim() && hasPhone && (type !== 'PRIVATE_SCHOOL' || cycles.length > 0),
        prices: prices > 0,
        formations: formations > 0,
        groups: groups > 0,
        teachers: teachers > 0,
        staff: staff > 0,
        transport: vehicles > 0 && routes > 0,
        firstStudent: students > 0,
    };
    const skippedKeys = settings?.onboardingSkipped ?? [];

    const steps = visible.map((key) => {
        const optional = OPTIONAL_STEPS.includes(key);
        return { key, done: done[key], skipped: optional && skippedKeys.includes(key), optional, href: STEP_HREF[key] };
    });
    return {
        steps,
        completed: steps.every((s) => s.done || s.skipped),
        dismissed: settings?.onboardingDismissed ?? false,
    };
};

export const updateOnboarding = async (branchId: string, body: Record<string, unknown>): Promise<OnboardingState> => {
    const settings = await prisma.settings.findUnique({ where: { branchId } });
    if (!settings) throw new Error('Settings not found');
    const isOptional = (v: unknown): v is StepKey => typeof v === 'string' && (OPTIONAL_STEPS as string[]).includes(v);
    const skipped = settings.onboardingSkipped ?? [];

    if ('skip' in body) {
        if (!isOptional(body.skip)) throw new Error('Only optional steps can be skipped');
        const key = body.skip;
        await prisma.settings.update({ where: { branchId }, data: { onboardingSkipped: skipped.includes(key) ? skipped : [...skipped, key] } });
    } else if ('unskip' in body) {
        if (!isOptional(body.unskip)) throw new Error('Only optional steps can be skipped');
        const key = body.unskip;
        await prisma.settings.update({ where: { branchId }, data: { onboardingSkipped: skipped.filter((k) => k !== key) } });
    } else if ('dismissed' in body) {
        if (typeof body.dismissed !== 'boolean') throw new Error('dismissed must be a boolean');
        await prisma.settings.update({ where: { branchId }, data: { onboardingDismissed: body.dismissed } });
    } else {
        throw new Error('Nothing to update');
    }
    return getOnboarding(branchId);
};
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `npx jest src/modules/onboarding/onboarding.service`
Expected: PASS, every test green.

- [ ] **Step 5: Commit**

```bash
git add src/modules/onboarding/onboarding.service.ts src/modules/onboarding/onboarding.service.test.ts
git commit -m "feat(education): onboarding checklist service"
```

---

### Task 3: Routes, controller, mount (TDD)

**Files:**
- Create: `src/modules/onboarding/onboarding.controller.ts`, `src/modules/onboarding/onboarding.routes.ts`
- Modify: `src/app.ts` (imports near line 40, mounts near line 98)
- Test: `src/modules/onboarding/onboarding.routes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/onboarding/onboarding.routes.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import onboardingRoutes from './onboarding.routes';
import { getOnboarding, updateOnboarding } from './onboarding.service';

jest.mock('./onboarding.service', () => ({
    getOnboarding: jest.fn().mockResolvedValue({ steps: [], completed: false, dismissed: false }),
    updateOnboarding: jest.fn().mockResolvedValue({ steps: [], completed: false, dismissed: true }),
}));
jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { branch: { findUnique: jest.fn().mockResolvedValue({ id: 'b-token', schoolId: 's1', school: { status: 'ACTIVE' } }) } },
}));
// The token is the role; ADMIN carries its own branch.
jest.mock('../../utils/jwt', () => ({
    verifyToken: jest.fn((token: string) => ({ id: 'u1', email: 'u@test.local', role: token, schoolId: 's1', branchId: token === 'ADMIN' ? 'b-token' : null })),
}));

const app = express();
app.use(express.json());
app.use('/api/onboarding', onboardingRoutes);

beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.clearAllMocks());

it('reads the checklist of the caller branch', async () => {
    const res = await request(app).get('/api/onboarding').set('Authorization', 'Bearer ADMIN').set('x-branch-id', 'b-other');
    expect(res.status).toBe(200);
    expect(getOnboarding).toHaveBeenCalledWith('b-token');
});

it('updates with the body', async () => {
    const res = await request(app).patch('/api/onboarding').set('Authorization', 'Bearer ADMIN').send({ dismissed: true });
    expect(res.status).toBe(200);
    expect(updateOnboarding).toHaveBeenCalledWith('b-token', { dismissed: true });
});

it.each(['SECRETARY', 'TEACHER', 'SUPER_ADMIN', 'SALES_AGENT', 'PARENT'])('refuses %s', async (role) => {
    const res = await request(app).get('/api/onboarding').set('Authorization', `Bearer ${role}`);
    expect(res.status).toBe(403);
    expect(getOnboarding).not.toHaveBeenCalled();
});

it('requires a login', async () => {
    expect((await request(app).get('/api/onboarding')).status).toBe(401);
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `npx jest src/modules/onboarding/onboarding.routes`
Expected: FAIL with `Cannot find module './onboarding.routes'`.

- [ ] **Step 3: Write the controller and routes**

Create `src/modules/onboarding/onboarding.controller.ts`:

```ts
import { Response } from 'express';
import type { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import { getOnboarding, updateOnboarding } from './onboarding.service';

export const get = (req: TenantRequest, res: Response) =>
    respond(res, () => getOnboarding(req.branchId!), { message: 'Onboarding retrieved', failure: 'Failed to retrieve onboarding' });

export const update = (req: TenantRequest, res: Response) =>
    respond(res, () => updateOnboarding(req.branchId!, req.body ?? {}), { message: 'Onboarding updated', failure: 'Failed to update onboarding' });
```

Create `src/modules/onboarding/onboarding.routes.ts`:

```ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { get, update } from './onboarding.controller';

// Setup checklist of the caller's branch, for the school admin.
const router = Router();
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/', get);
router.patch('/', update);

export default router;
```

- [ ] **Step 4: Mount it**

In `src/app.ts`, next to `import schoolRequestsRoutes from './modules/school-requests/schoolRequests.routes';` add:

```ts
import onboardingRoutes from './modules/onboarding/onboarding.routes';
```

and next to `apiRouter.use('/school-requests', schoolRequestsRoutes);` add:

```ts
apiRouter.use('/onboarding', onboardingRoutes);
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npx jest src/modules/onboarding && npx tsc --noEmit -p .`
Expected: every test PASS, tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/modules/onboarding src/app.ts
git commit -m "feat(education): onboarding routes for school admins"
```

---

### Task 4: Frontend service, labels, hook, Arabic texts

**Files:**
- Create: `frontend/lib/services/onboarding.ts`, `frontend/lib/onboarding/labels.ts`, `frontend/hooks/useOnboarding.ts`, `frontend/lib/i18n/ar/onboarding.ts`
- Modify: `frontend/lib/i18n/ar/index.ts`

- [ ] **Step 1: Service**

Create `frontend/lib/services/onboarding.ts`:

```ts
import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export type OnboardingStepKey = 'profile' | 'prices' | 'formations' | 'groups' | 'teachers' | 'staff' | 'transport' | 'firstStudent';

export interface OnboardingStep {
    key: OnboardingStepKey;
    done: boolean;
    skipped: boolean;
    optional: boolean;
    href: string;
}

export interface OnboardingState {
    steps: OnboardingStep[];
    completed: boolean;
    dismissed: boolean;
}

export type OnboardingUpdate = { skip: OnboardingStepKey } | { unskip: OnboardingStepKey } | { dismissed: boolean };

export async function getOnboarding(): Promise<OnboardingState> {
    const response = await api.get<ApiResponse<OnboardingState>>('/onboarding');
    return response.data.data;
}

export async function updateOnboarding(body: OnboardingUpdate): Promise<OnboardingState> {
    const response = await api.patch<ApiResponse<OnboardingState>>('/onboarding', body);
    return response.data.data;
}

/** First step neither done nor skipped, or null when the checklist is complete. */
export const nextStep = (state: OnboardingState) => state.steps.find((s) => !s.done && !s.skipped) ?? null;
```

- [ ] **Step 2: Labels (French source text, also the `tr` keys)**

Create `frontend/lib/onboarding/labels.ts`:

```ts
import type { OnboardingStepKey } from '@/lib/services/onboarding';

export const STEP_LABELS: Record<OnboardingStepKey, string> = {
    profile: "Profil de l'établissement",
    prices: 'Prix et frais de scolarité',
    formations: 'Formations',
    groups: 'Classes et groupes',
    teachers: 'Enseignants',
    staff: 'Staff (secrétaire)',
    transport: 'Transport',
    firstStudent: 'Premier élève',
};

export const STEP_HINTS: Record<OnboardingStepKey, string> = {
    profile: 'Nom, téléphone et, pour une école privée, les cycles.',
    prices: 'Les prix servent à chaque inscription.',
    formations: 'Créez vos formations avant les inscriptions.',
    groups: 'Les élèves sont inscrits dans un groupe ou une classe.',
    teachers: 'Ajoutez vos enseignants pour les affecter aux groupes.',
    staff: 'Un compte secrétaire pour l’accueil et les paiements.',
    transport: 'Véhicules et circuits, si vous proposez le transport.',
    firstStudent: 'Inscrivez un élève ou importez une liste Excel.',
};
```

- [ ] **Step 3: Hook**

Create `frontend/hooks/useOnboarding.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getOnboarding, updateOnboarding, type OnboardingState, type OnboardingUpdate } from '@/lib/services/onboarding';

export const ONBOARDING_CHANGED = 'onboarding:changed';

/**
 * Checklist state of the current branch. Refetched on every route change (so a step ticks as soon as the admin
 * comes back from saving) and when another component changes it. A load error leaves `state` null: callers
 * render nothing rather than breaking the page.
 */
export function useOnboarding(enabled: boolean) {
    const pathname = usePathname();
    const [state, setState] = useState<OnboardingState | null>(null);

    const load = useCallback(() => {
        if (!enabled) return;
        getOnboarding().then(setState).catch(() => setState(null));
    }, [enabled]);

    useEffect(() => {
        load();
    }, [load, pathname]);

    useEffect(() => {
        window.addEventListener(ONBOARDING_CHANGED, load);
        return () => window.removeEventListener(ONBOARDING_CHANGED, load);
    }, [load]);

    const update = useCallback(async (body: OnboardingUpdate) => {
        const next = await updateOnboarding(body);
        setState(next);
        window.dispatchEvent(new Event(ONBOARDING_CHANGED));
    }, []);

    return { state, update };
}
```

- [ ] **Step 4: Arabic dictionary**

Create `frontend/lib/i18n/ar/onboarding.ts`:

```ts
// Onboarding checklist (dashboard card and step banner).
export const onboarding: Record<string, string> = {
    'Configurer votre établissement': 'إعداد مؤسستك',
    'Suivez ces étapes dans l’ordre : les inscriptions seront ensuite rapides.': 'اتبع هذه الخطوات بالترتيب: ستصبح التسجيلات بعدها سريعة.',
    Continuer: 'متابعة',
    Masquer: 'إخفاء',
    Passer: 'تخطي',
    Reprendre: 'استئناف',
    'Suivant': 'التالي',
    'Étape': 'الخطوة',
    'Optionnel': 'اختياري',
    "Profil de l'établissement": 'ملف المؤسسة',
    'Prix et frais de scolarité': 'الأسعار ورسوم التمدرس',
    Formations: 'التكوينات',
    'Classes et groupes': 'الأقسام والمجموعات',
    Enseignants: 'الأساتذة',
    'Staff (secrétaire)': 'الطاقم (الكاتبة)',
    Transport: 'النقل',
    'Premier élève': 'أول تلميذ',
    'Nom, téléphone et, pour une école privée, les cycles.': 'الاسم والهاتف، والأسلاك بالنسبة للمدرسة الخاصة.',
    'Les prix servent à chaque inscription.': 'تُستعمل الأسعار في كل تسجيل.',
    'Créez vos formations avant les inscriptions.': 'أنشئ تكويناتك قبل التسجيلات.',
    'Les élèves sont inscrits dans un groupe ou une classe.': 'يُسجَّل التلاميذ في مجموعة أو قسم.',
    'Ajoutez vos enseignants pour les affecter aux groupes.': 'أضف أساتذتك لتعيينهم في المجموعات.',
    'Un compte secrétaire pour l’accueil et les paiements.': 'حساب كاتبة للاستقبال والأداءات.',
    'Véhicules et circuits, si vous proposez le transport.': 'المركبات والمسارات، إذا كنت تقدم خدمة النقل.',
    'Inscrivez un élève ou importez une liste Excel.': 'سجّل تلميذًا أو استورد لائحة Excel.',
    'Importer Excel': 'استيراد Excel',
};
```

In `frontend/lib/i18n/ar/index.ts`, add `import { onboarding } from './onboarding';` with the other imports, and add `...onboarding` at the end of the `AR` spread:

```ts
export const AR: Record<string, string> = { ...shell, ...auth, ...school, ...settings, ...finance, ...pedagogy, ...schoolMode, ...subscription, ...onboarding };
```

- [ ] **Step 5: Type check**

Run (in `frontend/`): `npx tsc --noEmit -p .`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/services/onboarding.ts frontend/lib/onboarding frontend/hooks/useOnboarding.ts frontend/lib/i18n/ar/onboarding.ts frontend/lib/i18n/ar/index.ts
git commit -m "feat(education): onboarding client, hook and Arabic texts"
```

---

### Task 5: Dashboard card

**Files:**
- Create: `frontend/components/onboarding/OnboardingCard.tsx`
- Modify: `frontend/app/admin/page.tsx` (render after `<PlatformBanner />`, around line 228)

- [ ] **Step 1: Card**

Create `frontend/components/onboarding/OnboardingCard.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { STEP_HINTS, STEP_LABELS } from '@/lib/onboarding/labels';
import { nextStep } from '@/lib/services/onboarding';
import { useOnboarding } from '@/hooks/useOnboarding';
import useAuthStore from '@/store/useAuthStore';

/** «Configurer votre établissement»: the ordered setup steps, ticked from the data. Hidden when complete or hidden. */
export default function OnboardingCard() {
    const { tr } = useI18n();
    const role = useAuthStore((s) => s.user?.role);
    const { state, update } = useOnboarding(role === 'ADMIN' || role === 'OWNER');
    const [error, setError] = useState('');

    if (!state || state.completed || state.dismissed) return null;
    const doneCount = state.steps.filter((s) => s.done || s.skipped).length;
    const next = nextStep(state);
    const act = (body: Parameters<typeof update>[0]) =>
        update(body).catch((err) => setError(err?.response?.data?.error || err?.message || 'Erreur'));

    return (
        <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="onb-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id="onb-title" className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {tr('Configurer votre établissement')} <span className="tabular-nums text-indigo-600">· {doneCount}/{state.steps.length}</span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{tr('Suivez ces étapes dans l’ordre : les inscriptions seront ensuite rapides.')}</p>
                </div>
                <button type="button" onClick={() => act({ dismissed: true })} className="text-sm font-semibold text-slate-500 hover:underline">
                    {tr('Masquer')}
                </button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(doneCount / state.steps.length) * 100}%` }} />
            </div>
            <ol className="mt-4 space-y-2">
                {state.steps.map((s, i) => (
                    <li key={s.key} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${s.key === next?.key ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''} ${s.skipped ? 'opacity-60' : ''}`}>
                        {s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />}
                        <div className="min-w-0 flex-1">
                            <Link href={s.href} className="font-semibold text-slate-800 hover:underline dark:text-slate-100">
                                {i + 1}. {tr(STEP_LABELS[s.key])}
                            </Link>
                            {s.optional && <span className="ms-2 text-xs text-slate-400">{tr('Optionnel')}</span>}
                            {!s.done && <div className="text-xs text-slate-500 dark:text-slate-400">{tr(STEP_HINTS[s.key])}</div>}
                        </div>
                        {s.key === 'firstStudent' && !s.done && (
                            <Link href="/admin/inscriptions/import" className="text-xs font-semibold text-indigo-600 hover:underline">{tr('Importer Excel')}</Link>
                        )}
                        {s.optional && !s.done && (
                            <button type="button" onClick={() => act(s.skipped ? { unskip: s.key } : { skip: s.key })} className="text-xs font-semibold text-slate-500 hover:underline">
                                {s.skipped ? tr('Reprendre') : tr('Passer')}
                            </button>
                        )}
                    </li>
                ))}
            </ol>
            {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
            {next && (
                <div className="mt-4 flex justify-end">
                    <Link href={next.href} className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                        {tr('Continuer')} <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                    </Link>
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 2: Render it on the dashboard**

In `frontend/app/admin/page.tsx`, add the import with the others:

```tsx
import OnboardingCard from '@/components/onboarding/OnboardingCard';
```

and right after `<PlatformBanner />` in the returned JSX:

```tsx
            <OnboardingCard />
```

- [ ] **Step 3: Type check**

Run (in `frontend/`): `npx tsc --noEmit -p .`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/onboarding/OnboardingCard.tsx frontend/app/admin/page.tsx
git commit -m "feat(education): onboarding card on the admin dashboard"
```

---

### Task 6: Step banner, signup redirect

**Files:**
- Create: `frontend/components/onboarding/OnboardingStepBanner.tsx`
- Modify: `frontend/app/admin/layout.tsx` (inside the container, next to `{pathname === '/admin' && <PackUpgradeBanner />}`), `frontend/app/signup/page.tsx:181`

- [ ] **Step 1: Banner**

Create `frontend/components/onboarding/OnboardingStepBanner.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { STEP_LABELS } from '@/lib/onboarding/labels';
import { nextStep } from '@/lib/services/onboarding';
import { useOnboarding } from '@/hooks/useOnboarding';
import useAuthStore from '@/store/useAuthStore';

/** «Étape 4/7 · Classes et groupes» on the page of a setup step, while the checklist is open. */
export default function OnboardingStepBanner() {
    const { tr } = useI18n();
    const pathname = usePathname();
    const role = useAuthStore((s) => s.user?.role);
    const { state, update } = useOnboarding(role === 'ADMIN' || role === 'OWNER');

    if (!state || state.completed || state.dismissed || !pathname) return null;
    const index = state.steps.findIndex((s) => s.href === pathname);
    if (index < 0) return null;
    const step = state.steps[index];
    const next = nextStep(state);
    const showNext = step.done && next && next.key !== step.key;

    return (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm dark:border-indigo-900 dark:bg-indigo-950/40">
            <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                {tr('Étape')} <span className="tabular-nums">{index + 1}/{state.steps.length}</span> · {tr(STEP_LABELS[step.key])}
                {step.done && ' ✅'}
            </span>
            <span className="flex items-center gap-3">
                {step.optional && !step.done && (
                    <button type="button" onClick={() => update({ skip: step.key }).catch(() => {})} className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
                        {tr('Passer')}
                    </button>
                )}
                {showNext && (
                    <Link href={next.href} className="rounded-full bg-indigo-600 px-4 py-1 font-bold text-white hover:bg-indigo-700">
                        {tr('Suivant')} ›
                    </Link>
                )}
            </span>
        </div>
    );
}
```

- [ ] **Step 2: Render it in the admin layout**

In `frontend/app/admin/layout.tsx`, add the import:

```tsx
import OnboardingStepBanner from '@/components/onboarding/OnboardingStepBanner';
```

and under `{pathname === '/admin' && <PackUpgradeBanner />}`:

```tsx
                            <OnboardingStepBanner />
```

- [ ] **Step 3: Land on the dashboard after signup**

In `frontend/app/signup/page.tsx`, replace `router.push('/admin/settings');` with:

```tsx
            router.push('/admin');
```

- [ ] **Step 4: Type check and lint**

Run (in `frontend/`): `npx tsc --noEmit -p . && npx next lint --dir components/onboarding --dir hooks`
Expected: no type errors; lint reports no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/onboarding/OnboardingStepBanner.tsx frontend/app/admin/layout.tsx frontend/app/signup/page.tsx
git commit -m "feat(education): onboarding step banner and dashboard landing after signup"
```

---

### Task 7: Full verification

- [ ] **Step 1: Backend tests and types**

Run (in `apps/education-apps/`): `npx jest && npx tsc --noEmit -p .`
Expected: every suite passes, and tsc prints nothing.

- [ ] **Step 2: Frontend types**

Run (in `frontend/`): `npx tsc --noEmit -p .`
Expected: no output.

- [ ] **Step 3: Manual check (local)**

Start the backend (port 3010) and the frontend (port 3011). The database must first get the new fields with `npx prisma db push`; it is the demo Atlas db, so ask the user before pushing. Then:

1. Sign up a new demo school. It should land on `/admin`, with the card at 0/7 or 1/7.
2. Click «Continuer». It should open `/admin/settings` with the banner «Étape 1/7». Fill in the profile and save, then come back: step 1 is ticked.
3. On Transport, click «Passer». The step is greyed out in the card.
4. Click «Masquer». The card and the banners disappear.
