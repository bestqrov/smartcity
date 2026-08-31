# School Signup Simplification + Demo Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce ArwaEduc's `/signup` to 3 fields (owner name, email, password), move all other school setup into a real (backend-persisted) `/admin/settings` profile tab, and gate new schools behind a 15-day demo period that a `SUPER_ADMIN` manually activates.

**Architecture:** Backend defaults fill in the fields the signup form no longer collects; a new `trialEndsAt` on `School` plus an extension to the existing `tenantScopeMiddleware` blocks writes (not reads) once a `PENDING` school's 15 days are up; two new `SUPER_ADMIN`-only endpoints (`GET /schools`, `PATCH /schools/:id/status`) back a minimal activation page. The previously-fake `admin/settings` "Profil École" tab becomes a thin CRUD view over two new `/schools/me` endpoints.

**Tech Stack:** Express + Prisma (MongoDB) backend in `apps/education-apps/src`, Next.js App Router frontend in `apps/education-apps/frontend`, Jest (`ts-jest`) for backend unit tests — this backend already has a real test suite (`*.service.test.ts`, `tenantScope.middleware.test.ts`), so new backend logic follows that same TDD pattern. The frontend has no test framework in this app; frontend tasks are verified manually.

**Reference spec:** `docs/superpowers/specs/2026-08-31-education-school-signup-demo-activation-design.md`

---

## Task 1: Extend the `School` Prisma Schema

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma:89-104`

The `School` model needs the fields the "Profil École" settings tab already collects in its UI (`director`, `city`, `address`, `phone`, `email`, `logo` — none of these exist on `School` today, only on the unrelated `Branch.city`), plus a `trialEndsAt` for the 15-day demo window.

- [ ] **Step 1: Edit the `School` model**

Change:

```prisma
model School {
  id         String       @id @default(auto()) @map("_id") @db.ObjectId
  name       String
  status     SchoolStatus @default(PENDING)
  packTier   String
  ownerName  String
  ownerEmail String
  ownerPhone String?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  branches   Branch[]
  users      User[]

  @@map("schools")
}
```

To:

```prisma
model School {
  id          String       @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  status      SchoolStatus @default(PENDING)
  packTier    String
  ownerName   String
  ownerEmail  String
  ownerPhone  String?
  director    String?
  city        String?
  address     String?
  phone       String?
  email       String?
  logo        String?
  trialEndsAt DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  branches   Branch[]
  users      User[]

  @@map("schools")
}
```

- [ ] **Step 2: Push the schema to the database and regenerate the client**

Run (from `apps/education-apps/`):

```bash
npx prisma db push
npx prisma generate
```

Expected: `db push` reports the `schools` collection schema is in sync (MongoDB has no migration history, so this is the correct command — `prisma migrate` is not supported for the `mongodb` provider), and `generate` regenerates `@prisma/client` with the new optional `School` fields typed.

- [ ] **Step 3: Commit**

```bash
git add apps/education-apps/prisma/schema.prisma
git commit -m "feat(education): add school profile fields and trialEndsAt to School model"
```

---

## Task 2: Signup Defaults + 15-Day Trial (`schools.service.ts`)

**Files:**
- Modify: `apps/education-apps/src/modules/schools/schools.service.ts`
- Test: `apps/education-apps/src/modules/schools/schools.service.test.ts`

Today `SignupSchoolData` requires `schoolName`, `branchName`, `branchCity`, `packTier`. The simplified signup form will stop sending them, so the service must make them optional and fill in defaults, and must stamp a `trialEndsAt` 15 days out.

- [ ] **Step 1: Write the failing tests**

Add to `apps/education-apps/src/modules/schools/schools.service.test.ts`, inside the existing `describe('signupSchool', ...)` block (after the last `it(...)`, before the closing `});`):

```ts
    it('fills in schoolName, branchName, branchCity, and packTier when omitted, and stamps a 15-day trialEndsAt', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed-secret');

        const school = { id: 'school1', name: 'École de Owner' };
        const branch = { id: 'branch1', schoolId: 'school1' };
        const user = { id: 'user1', email: 'owner@example.com', role: 'OWNER', schoolId: 'school1' };

        const txClient = {
            school: { create: jest.fn().mockResolvedValue(school) },
            branch: { create: jest.fn().mockResolvedValue(branch) },
            user: { create: jest.fn().mockResolvedValue(user) },
        };
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(txClient));

        const before = Date.now();
        await signupSchool({
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            password: 'secret123',
        });
        const after = Date.now();

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: 'École de Owner',
                    status: 'PENDING',
                    packTier: 'basic',
                }),
            })
        );
        const createdTrialEndsAt: Date = (txClient.school.create as jest.Mock).mock.calls[0][0].data.trialEndsAt;
        expect(createdTrialEndsAt).toBeInstanceOf(Date);
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        expect(createdTrialEndsAt.getTime()).toBeGreaterThanOrEqual(before + fifteenDaysMs - 1000);
        expect(createdTrialEndsAt.getTime()).toBeLessThanOrEqual(after + fifteenDaysMs + 1000);

        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    schoolId: 'school1',
                    name: 'Établissement principal',
                    city: '',
                }),
            })
        );
    });

    it('still honors explicit schoolName/branchName/branchCity/packTier when the caller supplies them', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
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

        await signupSchool({
            schoolName: 'Ecole A',
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            password: 'secret123',
            branchName: 'Main',
            branchCity: 'Casablanca',
            packTier: 'premium',
        });

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: 'Ecole A', packTier: 'premium' }),
            })
        );
        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: 'Main', city: 'Casablanca' }),
            })
        );
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/education-apps && npx jest schools.service.test.ts -v`
Expected: FAIL — `packTier` etc. are currently required by the `SignupSchoolData` TypeScript interface (a compile error under `ts-jest`) and the service does not set `trialEndsAt` at all.

- [ ] **Step 3: Update `signupSchool` and its interface**

In `apps/education-apps/src/modules/schools/schools.service.ts`, replace the whole file with:

```ts
import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';

export interface SignupSchoolData {
    schoolName?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password: string;
    branchName?: string;
    branchCity?: string;
    packTier?: string;
}

const TRIAL_DAYS = 15;

export const signupSchool = async (data: SignupSchoolData) => {
    const email = data.ownerEmail.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('Email already exists');
    }

    const hashedPassword = await hashPassword(data.password);

    const schoolName = data.schoolName || `École de ${data.ownerName}`;
    const branchName = data.branchName || 'Établissement principal';
    const branchCity = data.branchCity ?? '';
    const packTier = data.packTier || 'basic';

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    try {
        return await prisma.$transaction(async (tx) => {
            const school = await tx.school.create({
                data: {
                    name: schoolName,
                    status: 'PENDING',
                    packTier,
                    ownerName: data.ownerName,
                    ownerEmail: email,
                    ownerPhone: data.ownerPhone,
                    trialEndsAt,
                },
            });

            const branch = await tx.branch.create({
                data: {
                    schoolId: school.id,
                    name: branchName,
                    city: branchCity,
                },
            });

            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: data.ownerName,
                    role: 'OWNER',
                    schoolId: school.id,
                },
            });

            return { school, branch, user };
        });
    } catch (error) {
        if ((error as any)?.code === 'P2002') {
            throw new Error('Email already exists');
        }
        throw error;
    }
};
```

(Task 3 appends more exports to this same file — don't worry about it looking incomplete relative to the design spec yet.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/education-apps && npx jest schools.service.test.ts -v`
Expected: PASS — all tests in `schools.service.test.ts`, old and new, green.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src/modules/schools/schools.service.ts apps/education-apps/src/modules/schools/schools.service.test.ts
git commit -m "feat(education): default schoolName/branch/packTier and stamp a 15-day trialEndsAt on signup"
```

---

## Task 3: School Profile + Super-Admin Service Functions (`schools.service.ts`)

**Files:**
- Modify: `apps/education-apps/src/modules/schools/schools.service.ts`
- Test: `apps/education-apps/src/modules/schools/schools.service.test.ts`

Adds the four functions the new endpoints in Task 4 need: read/update "my school", and list/activate for `SUPER_ADMIN`.

- [ ] **Step 1: Write the failing tests**

Add to the top of `apps/education-apps/src/modules/schools/schools.service.test.ts`, extend the existing `jest.mock('../../config/database', ...)` call to also stub `school` methods:

Change:

```ts
jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
        $transaction: jest.fn(),
    },
}));
```

To:

```ts
jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
        school: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
        $transaction: jest.fn(),
    },
}));
```

Then add this import at the top of the file (alongside the existing `signupSchool` import) and these four new `describe` blocks at the end of the file:

Change:

```ts
import prisma from '../../config/database';
import { signupSchool } from './schools.service';
import * as bcryptUtil from '../../utils/bcrypt';
```

To:

```ts
import prisma from '../../config/database';
import {
    signupSchool,
    getSchoolBySchoolId,
    updateSchoolProfile,
    listSchools,
    updateSchoolStatus,
} from './schools.service';
import * as bcryptUtil from '../../utils/bcrypt';
```

Append at the end of the file, after the closing `});` of `describe('signupSchool', ...)`:

```ts

describe('getSchoolBySchoolId', () => {
    afterEach(() => jest.clearAllMocks());

    it('throws when the school does not exist', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getSchoolBySchoolId('missing')).rejects.toThrow('School not found');
    });

    it('returns the school when found', async () => {
        const school = { id: 's1', name: 'Ecole A' };
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(school);
        await expect(getSchoolBySchoolId('s1')).resolves.toEqual(school);
    });
});

describe('updateSchoolProfile', () => {
    afterEach(() => jest.clearAllMocks());

    it('updates only the provided fields on the given school', async () => {
        const updated = { id: 's1', name: 'New Name' };
        (prisma.school.update as jest.Mock).mockResolvedValue(updated);

        const result = await updateSchoolProfile('s1', { name: 'New Name' });

        expect(prisma.school.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { name: 'New Name' },
        });
        expect(result).toEqual(updated);
    });
});

describe('listSchools', () => {
    afterEach(() => jest.clearAllMocks());

    it('returns all schools ordered by newest first', async () => {
        const schools = [{ id: 's1' }, { id: 's2' }];
        (prisma.school.findMany as jest.Mock).mockResolvedValue(schools);

        await expect(listSchools()).resolves.toEqual(schools);
        expect(prisma.school.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: { createdAt: 'desc' } })
        );
    });
});

describe('updateSchoolStatus', () => {
    afterEach(() => jest.clearAllMocks());

    it('updates the school status', async () => {
        const updated = { id: 's1', status: 'ACTIVE' };
        (prisma.school.update as jest.Mock).mockResolvedValue(updated);

        const result = await updateSchoolStatus('s1', 'ACTIVE');

        expect(prisma.school.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { status: 'ACTIVE' },
        });
        expect(result).toEqual(updated);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/education-apps && npx jest schools.service.test.ts -v`
Expected: FAIL — `getSchoolBySchoolId`, `updateSchoolProfile`, `listSchools`, `updateSchoolStatus` don't exist yet (TypeScript compile error on the import).

- [ ] **Step 3: Append the four functions**

Append to the end of `apps/education-apps/src/modules/schools/schools.service.ts` (after the `signupSchool` function from Task 2):

```ts

export const getSchoolBySchoolId = async (schoolId: string) => {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
        throw new Error('School not found');
    }
    return school;
};

export interface UpdateSchoolProfileData {
    name?: string;
    director?: string;
    city?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
}

export const updateSchoolProfile = async (schoolId: string, data: UpdateSchoolProfileData) => {
    return prisma.school.update({ where: { id: schoolId }, data });
};

export const listSchools = async () => {
    return prisma.school.findMany({
        select: {
            id: true,
            name: true,
            ownerEmail: true,
            status: true,
            trialEndsAt: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
};

export const updateSchoolStatus = async (id: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED') => {
    return prisma.school.update({ where: { id }, data: { status } });
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/education-apps && npx jest schools.service.test.ts -v`
Expected: PASS — all `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src/modules/schools/schools.service.ts apps/education-apps/src/modules/schools/schools.service.test.ts
git commit -m "feat(education): add school-profile read/update and super-admin list/activate service functions"
```

---

## Task 4: Wire the New Endpoints (`schools.controller.ts` + `schools.routes.ts`)

**Files:**
- Modify: `apps/education-apps/src/modules/schools/schools.controller.ts`
- Modify: `apps/education-apps/src/modules/schools/schools.routes.ts`

No new test file here — this codebase doesn't unit-test controllers (only services and middleware), consistent with the existing `schools.controller.ts` having no `.test.ts` counterpart today. Verification is the manual curl checks in Step 3.

- [ ] **Step 1: Replace `schools.controller.ts`**

Replace the full contents of `apps/education-apps/src/modules/schools/schools.controller.ts` with:

```ts
import { Response, Request } from 'express';
import {
    signupSchool,
    getSchoolBySchoolId,
    updateSchoolProfile,
    listSchools,
    updateSchoolStatus,
} from './schools.service';
import { generateToken } from '../../utils/jwt';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const signup = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            schoolName,
            ownerName,
            ownerEmail,
            ownerPhone,
            password,
            branchName,
            branchCity,
            packTier,
        } = req.body;

        if (!ownerName || !ownerEmail || !password) {
            sendError(res, 'ownerName, ownerEmail, and password are required', 'Validation error', 400);
            return;
        }

        if (password.length < 8) {
            sendError(res, 'Password must be at least 8 characters', 'Validation error', 400);
            return;
        }

        const { branch, user } = await signupSchool({
            schoolName,
            ownerName,
            ownerEmail,
            ownerPhone,
            password,
            branchName,
            branchCity,
            packTier,
        });

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            schoolId: user.schoolId,
            branchId: user.branchId,
        });

        sendSuccess(
            res,
            {
                token,
                user: { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId },
                branch: { id: branch.id, name: branch.name },
            },
            'School created successfully',
            201
        );
    } catch (error: any) {
        sendError(res, error.message, 'Signup failed', 400);
    }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schoolId = req.user!.schoolId;
        if (!schoolId) {
            sendError(res, 'No school associated with this account', 'Access denied', 403);
            return;
        }
        const school = await getSchoolBySchoolId(schoolId);
        sendSuccess(res, school, 'School profile retrieved', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve school profile', 404);
    }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schoolId = req.user!.schoolId;
        if (!schoolId) {
            sendError(res, 'No school associated with this account', 'Access denied', 403);
            return;
        }
        const { name, director, city, address, phone, email, logo } = req.body;
        const school = await updateSchoolProfile(schoolId, { name, director, city, address, phone, email, logo });
        sendSuccess(res, school, 'School profile updated', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update school profile', 400);
    }
};

export const list = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schools = await listSchools();
        sendSuccess(res, schools, 'Schools retrieved', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve schools', 500);
    }
};

export const updateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['PENDING', 'ACTIVE', 'SUSPENDED'].includes(status)) {
            sendError(res, 'Invalid status', 'Status must be PENDING, ACTIVE, or SUSPENDED', 400);
            return;
        }
        const school = await updateSchoolStatus(id, status);
        sendSuccess(res, school, 'School status updated', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update school status', 400);
    }
};
```

- [ ] **Step 2: Replace `schools.routes.ts`**

Replace the full contents of `apps/education-apps/src/modules/schools/schools.routes.ts` with:

```ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup, getMe, updateMe, list, updateStatus } from './schools.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public — no auth, this is how a new school gets created
router.post('/signup', signupLimiter, signup);

// School owner/admin manage their own school's profile
router.get('/me', authMiddleware, roleMiddleware('OWNER', 'ADMIN'), getMe);
router.put('/me', authMiddleware, roleMiddleware('OWNER', 'ADMIN'), updateMe);

// Platform-level: SUPER_ADMIN sees and activates every school, bypassing tenant scoping
router.get('/', authMiddleware, roleMiddleware('SUPER_ADMIN'), list);
router.patch('/:id/status', authMiddleware, roleMiddleware('SUPER_ADMIN'), updateStatus);

export default router;
```

- [ ] **Step 3: Manually verify against a running server**

Run (from `apps/education-apps/`): `npm run dev`

In another terminal:

```bash
# Signup with only the 3 new required fields
curl -s -X POST http://localhost:3010/api/schools/signup \
  -H 'Content-Type: application/json' \
  -d '{"ownerName":"Test Owner","ownerEmail":"planverify@example.com","password":"password123"}' | python3 -m json.tool
```

Expected: `success: true`, `data.branch.id` present, `data.user.role` is `"OWNER"`. Copy `data.token` for the next check.

```bash
TOKEN="<paste token here>"
curl -s http://localhost:3010/api/schools/me -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: `data.name` is `"École de Test Owner"`, `data.status` is `"PENDING"`, `data.trialEndsAt` is an ISO date ~15 days out.

```bash
curl -s -X PUT http://localhost:3010/api/schools/me -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"city":"Ouarzazate","phone":"0600000000"}' | python3 -m json.tool
```

Expected: `data.city` is `"Ouarzazate"`, `data.phone` is `"0600000000"`.

```bash
# A non-SUPER_ADMIN must be rejected from the platform-level routes
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3010/api/schools -H "Authorization: Bearer $TOKEN"
```

Expected: `403`.

- [ ] **Step 4: Commit**

```bash
git add apps/education-apps/src/modules/schools/schools.controller.ts apps/education-apps/src/modules/schools/schools.routes.ts
git commit -m "feat(education): add GET/PUT /schools/me and SUPER_ADMIN GET /schools + PATCH /schools/:id/status"
```

---

## Task 5: Trial-Expiry Enforcement (`tenantScope.middleware.ts`)

**Files:**
- Modify: `apps/education-apps/src/middlewares/tenantScope.middleware.ts`
- Test: `apps/education-apps/src/middlewares/tenantScope.middleware.test.ts`

Once a `PENDING` school's `trialEndsAt` has passed, write requests (`POST`/`PUT`/`PATCH`/`DELETE`) to any branch-scoped module (attendance, formations, settings, payments, inscriptions, teachers, groups, students, transactions, pricing — all of which already run through this middleware) get rejected with `403 TRIAL_EXPIRED`. Reads keep working. `ACTIVE` schools are never affected, regardless of `trialEndsAt`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `apps/education-apps/src/middlewares/tenantScope.middleware.test.ts`, before the final closing `});` of the outer `describe('tenantScopeMiddleware', ...)` block (i.e. as new `it(...)` blocks inside that same `describe`):

```ts

    describe('trial expiry (write requests only)', () => {
        it('allows a write when the school is ACTIVE, regardless of trialEndsAt', async () => {
            (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
                id: 'b1',
                schoolId: 's1',
                school: { status: 'ACTIVE', trialEndsAt: null },
            });
            const req = {
                method: 'POST',
                user: { id: 'u1', email: 'a@b.com', role: 'ADMIN', schoolId: 's1', branchId: 'b1' },
                header: jest.fn(),
            } as unknown as TenantRequest;
            const res = makeRes();
            const next = jest.fn();

            await tenantScopeMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('allows a write during an active PENDING trial (trialEndsAt in the future)', async () => {
            const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
            (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
                id: 'b1',
                schoolId: 's1',
                school: { status: 'PENDING', trialEndsAt: future },
            });
            const req = {
                method: 'POST',
                user: { id: 'u1', email: 'a@b.com', role: 'ADMIN', schoolId: 's1', branchId: 'b1' },
                header: jest.fn(),
            } as unknown as TenantRequest;
            const res = makeRes();
            const next = jest.fn();

            await tenantScopeMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('blocks a write with 403 TRIAL_EXPIRED once trialEndsAt has passed and the school is still PENDING', async () => {
            const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
            (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
                id: 'b1',
                schoolId: 's1',
                school: { status: 'PENDING', trialEndsAt: past },
            });
            const req = {
                method: 'POST',
                user: { id: 'u1', email: 'a@b.com', role: 'ADMIN', schoolId: 's1', branchId: 'b1' },
                header: jest.fn(),
            } as unknown as TenantRequest;
            const res = makeRes();
            const next = jest.fn();

            await tenantScopeMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('allows a read (GET) even after the trial has expired', async () => {
            const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
            (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
                id: 'b1',
                schoolId: 's1',
                school: { status: 'PENDING', trialEndsAt: past },
            });
            const req = {
                method: 'GET',
                user: { id: 'u1', email: 'a@b.com', role: 'ADMIN', schoolId: 's1', branchId: 'b1' },
                header: jest.fn(),
            } as unknown as TenantRequest;
            const res = makeRes();
            const next = jest.fn();

            await tenantScopeMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/education-apps && npx jest tenantScope.middleware.test.ts -v`
Expected: FAIL on the 4 new tests — the middleware doesn't check trial status yet, so `next()` is always called for ADMIN with a valid `branchId` and the 403 test gets no rejection.

- [ ] **Step 3: Update the middleware**

Replace the full contents of `apps/education-apps/src/middlewares/tenantScope.middleware.ts` with:

```ts
import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { sendError } from '../utils/response';

export interface TenantRequest extends AuthRequest {
    branchId?: string;
}

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const tenantScopeMiddleware = async (
    req: TenantRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const user = req.user;

    if (!user) {
        sendError(res, 'User not authenticated', 'Access denied', 401);
        return;
    }

    let branchId: string;

    if (user.role === 'ADMIN' || user.role === 'SECRETARY') {
        if (!user.branchId) {
            sendError(res, 'User has no assigned branch', 'Access denied', 403);
            return;
        }
        branchId = user.branchId;
    } else if (user.role === 'OWNER') {
        const requestedBranchId = req.header('x-branch-id');

        if (!requestedBranchId) {
            sendError(res, 'A branch must be selected', 'Branch required', 400);
            return;
        }

        let branch;
        try {
            branch = await prisma.branch.findUnique({ where: { id: requestedBranchId } });
        } catch (error) {
            sendError(res, 'Invalid branch identifier', 'Branch required', 400);
            return;
        }

        if (!branch || branch.schoolId !== user.schoolId) {
            sendError(res, 'Branch does not belong to your school', 'Access denied', 403);
            return;
        }

        branchId = requestedBranchId;
    } else {
        sendError(res, 'This role cannot access branch-scoped resources', 'Access denied', 403);
        return;
    }

    req.branchId = branchId;

    if (WRITE_METHODS.includes(req.method)) {
        let branchWithSchool;
        try {
            branchWithSchool = await prisma.branch.findUnique({
                where: { id: branchId },
                include: { school: true },
            });
        } catch (error) {
            branchWithSchool = null;
        }

        const school = branchWithSchool?.school;
        if (school && school.status === 'PENDING' && school.trialEndsAt && new Date() > school.trialEndsAt) {
            sendError(
                res,
                'TRIAL_EXPIRED',
                "Votre période d'essai de 15 jours est terminée. Contactez-nous pour activer votre école.",
                403
            );
            return;
        }
    }

    next();
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/education-apps && npx jest tenantScope.middleware.test.ts -v`
Expected: PASS — all tests, old and new, green. (The pre-existing ADMIN/OWNER tests don't set `req.method`, so `WRITE_METHODS.includes(undefined)` is `false` and the new code path never runs for them — no changes needed to those tests.)

- [ ] **Step 5: Run the full backend test suite**

Run: `cd apps/education-apps && npx jest -v`
Expected: PASS — no regressions in any other `*.service.test.ts` file (none of them touch `School` or `tenantScopeMiddleware`).

- [ ] **Step 6: Commit**

```bash
git add apps/education-apps/src/middlewares/tenantScope.middleware.ts apps/education-apps/src/middlewares/tenantScope.middleware.test.ts
git commit -m "feat(education): block writes with 403 TRIAL_EXPIRED once a PENDING school's 15-day demo ends"
```

---

## Task 6: Simplify the Signup Form

**Files:**
- Modify: `apps/education-apps/frontend/app/signup/page.tsx`

Reduce the form to `ownerName`, `ownerEmail`, `password`; on success, set the auto-created branch as active and go straight to `/admin/settings`.

- [ ] **Step 1: Replace the form state, submit handler, and inputs**

In `apps/education-apps/frontend/app/signup/page.tsx`:

Change the imports and state (lines 1-28) from:

```tsx
'use client';
import React, { useState } from 'react';
import Input from '../../components/Input';
import Button from '../../components/Button';
import useAuthStore, { setActiveBranchId } from '../../store/useAuthStore';
import { useRouter } from 'next/navigation';
import { signupSchool, SignupSchoolData } from '../../lib/services/schools';
import { GraduationCap, X } from 'lucide-react';

const PACK_OPTIONS = ['basic', 'standard', 'premium'];

export default function SignupPage() {
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);
    const setAccessTokenState = useAuthStore((state) => state.setAccessToken);

    const [form, setForm] = useState<SignupSchoolData>({
        schoolName: '',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        password: '',
        branchName: '',
        branchCity: '',
        packTier: PACK_OPTIONS[0],
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const update = (field: keyof SignupSchoolData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
```

To:

```tsx
'use client';
import React, { useState } from 'react';
import Input from '../../components/Input';
import Button from '../../components/Button';
import useAuthStore, { setActiveBranchId } from '../../store/useAuthStore';
import { useRouter } from 'next/navigation';
import { signupSchool, SignupSchoolData } from '../../lib/services/schools';
import { GraduationCap, X } from 'lucide-react';

export default function SignupPage() {
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);
    const setAccessTokenState = useAuthStore((state) => state.setAccessToken);

    const [form, setForm] = useState<SignupSchoolData>({
        ownerName: '',
        ownerEmail: '',
        password: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const update = (field: keyof SignupSchoolData) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
```

Change the submit handler from:

```tsx
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const { token, user } = await signupSchool(form);
            setAccessTokenState(token);
            setUser(user);
            setActiveBranchId(null);
            router.push('/admin/select-branch');
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'Signup failed';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };
```

To:

```tsx
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const { token, user, branch } = await signupSchool(form);
            setAccessTokenState(token);
            setUser(user);
            setActiveBranchId(branch.id);
            router.push('/admin/settings');
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'Signup failed';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };
```

Change the form body (the block from the first `<Input type="text" value={form.schoolName} ...>` through the `<select value={form.packTier} ...>` block, i.e. the current lines ~111-189) from:

```tsx
                        <Input
                            type="text"
                            value={form.schoolName}
                            onChange={update('schoolName')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Nom de l'école"
                        />

                        <Input
                            type="text"
                            value={form.ownerName}
                            onChange={update('ownerName')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Votre nom"
                        />

                        <Input
                            type="email"
                            value={form.ownerEmail}
                            onChange={update('ownerEmail')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Adresse e-mail"
                        />

                        <Input
                            type="tel"
                            value={form.ownerPhone}
                            onChange={update('ownerPhone')}
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Téléphone (optionnel)"
                        />

                        <Input
                            type="password"
                            value={form.password}
                            onChange={update('password')}
                            required
                            minLength={8}
                            autoComplete="new-password"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Mot de passe (8 caractères min.)"
                        />

                        <Input
                            type="text"
                            value={form.branchName}
                            onChange={update('branchName')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Nom du premier établissement"
                        />

                        <Input
                            type="text"
                            value={form.branchCity}
                            onChange={update('branchCity')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Ville"
                        />

                        <select
                            value={form.packTier}
                            onChange={update('packTier')}
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 font-bold text-lg shadow-sm"
                        >
                            {PACK_OPTIONS.map((pack) => (
                                <option key={pack} value={pack}>{pack.charAt(0).toUpperCase() + pack.slice(1)}</option>
                            ))}
                        </select>
```

To:

```tsx
                        <Input
                            type="text"
                            value={form.ownerName}
                            onChange={update('ownerName')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Votre nom"
                        />

                        <Input
                            type="email"
                            value={form.ownerEmail}
                            onChange={update('ownerEmail')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Adresse e-mail"
                        />

                        <Input
                            type="password"
                            value={form.password}
                            onChange={update('password')}
                            required
                            minLength={8}
                            autoComplete="new-password"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Mot de passe (8 caractères min.)"
                        />
```

- [ ] **Step 2: Manually verify in the browser**

Run: `cd apps/education-apps/frontend && npm run dev` (and the backend from Task 4 in another terminal).

Open `http://localhost:3011/signup`, fill in only name/email/password, submit. Expected: redirected straight to `/admin/settings` (no `/admin/select-branch` stop), logged in as `OWNER`, no console errors about a missing branch.

- [ ] **Step 3: Commit**

```bash
git add apps/education-apps/frontend/app/signup/page.tsx
git commit -m "feat(education): reduce signup to name/email/password, redirect straight to admin/settings"
```

---

## Task 7: Frontend `schools` Service Client

**Files:**
- Modify: `apps/education-apps/frontend/lib/services/schools.ts`

- [ ] **Step 1: Replace the file**

Replace the full contents of `apps/education-apps/frontend/lib/services/schools.ts` with:

```ts
import api from '../api';
import type { ApiResponse, User } from '@/types';

export interface SignupSchoolData {
    ownerName: string;
    ownerEmail: string;
    password: string;
}

export interface SignupSchoolResponse {
    token: string;
    user: User;
    branch: { id: string; name: string };
}

export async function signupSchool(data: SignupSchoolData): Promise<SignupSchoolResponse> {
    const response = await api.post<ApiResponse<SignupSchoolResponse>>('/schools/signup', data);
    return response.data.data;
}

export type SchoolStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface SchoolProfileData {
    id: string;
    name: string;
    status: SchoolStatus;
    trialEndsAt: string | null;
    director?: string | null;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
}

export async function getMySchool(): Promise<SchoolProfileData> {
    const response = await api.get<ApiResponse<SchoolProfileData>>('/schools/me');
    return response.data.data;
}

export interface UpdateSchoolProfilePayload {
    name?: string;
    director?: string;
    city?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
}

export async function updateMySchool(data: UpdateSchoolProfilePayload): Promise<SchoolProfileData> {
    const response = await api.put<ApiResponse<SchoolProfileData>>('/schools/me', data);
    return response.data.data;
}

export interface SchoolListItem {
    id: string;
    name: string;
    ownerEmail: string;
    status: SchoolStatus;
    trialEndsAt: string | null;
    createdAt: string;
}

export async function getAllSchools(): Promise<SchoolListItem[]> {
    const response = await api.get<ApiResponse<SchoolListItem[]>>('/schools');
    return response.data.data;
}

export async function updateSchoolStatus(id: string, status: SchoolStatus): Promise<SchoolListItem> {
    const response = await api.patch<ApiResponse<SchoolListItem>>(`/schools/${id}/status`, { status });
    return response.data.data;
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/education-apps/frontend && npx tsc --noEmit`
Expected: no new errors referencing `lib/services/schools.ts` or `app/signup/page.tsx` (Task 6 already updated the signup page to match this new `SignupSchoolData` shape).

- [ ] **Step 3: Commit**

```bash
git add apps/education-apps/frontend/lib/services/schools.ts
git commit -m "feat(education): add schools.me and super-admin schools API client functions"
```

---

## Task 8: Wire `useSchoolProfile` to the Backend

**Files:**
- Modify: `apps/education-apps/frontend/hooks/useSchoolProfile.ts`

This hook already backs the school name/logo shown in `Sidebar.tsx`, `TopBar.tsx`, `PrintReceipt.tsx`, and a couple of forms — updating it in place means all of those pick up real backend data automatically, no other file needs to change. It must still work on `/login` (no token yet), where it falls back to the `localStorage` cache / default, matching today's behavior.

- [ ] **Step 1: Replace the file**

Replace the full contents of `apps/education-apps/frontend/hooks/useSchoolProfile.ts` with:

```ts
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { getAccessToken } from '@/store/useAuthStore';

export interface SchoolProfile {
    schoolName: string;
    logo?: string | null;
    logoUrl?: string | null;
    director?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
    trialEndsAt?: string | null;
}

const DEFAULT_PROFILE: SchoolProfile = {
    schoolName: 'Smart School',
    logo: null,
};

export function useSchoolProfile() {
    const [profile, setProfile] = useState<SchoolProfile>(DEFAULT_PROFILE);
    const [loading, setLoading] = useState(true);

    const loadFromCache = () => {
        try {
            const savedProfile = localStorage.getItem('school-profile');
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                setProfile({
                    ...parsed,
                    schoolName: parsed.schoolName || 'Smart School',
                    logo: parsed.logo || parsed.logoUrl || null,
                });
            }
        } catch (error) {
            console.error('Failed to load cached school profile:', error);
        }
    };

    const loadProfile = useCallback(async () => {
        if (!getAccessToken()) {
            loadFromCache();
            setLoading(false);
            return;
        }

        try {
            const response = await api.get('/schools/me');
            const school = response.data.data;
            const next: SchoolProfile = {
                schoolName: school.name || 'Smart School',
                logo: school.logo || null,
                director: school.director || '',
                email: school.email || '',
                phone: school.phone || '',
                address: school.address || '',
                city: school.city || '',
                status: school.status,
                trialEndsAt: school.trialEndsAt,
            };
            setProfile(next);
            localStorage.setItem('school-profile', JSON.stringify(next));
        } catch (error) {
            console.error('Failed to fetch school profile, falling back to cache:', error);
            loadFromCache();
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'school-profile') {
                loadFromCache();
            }
        };
        const handleCustomUpdate = () => loadProfile();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('school-profile-updated', handleCustomUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('school-profile-updated', handleCustomUpdate);
        };
    }, [loadProfile]);

    return { profile, loading, refreshProfile: loadProfile };
}
```

- [ ] **Step 2: Manually verify**

With backend + frontend dev servers running: log in as the `OWNER` created in Task 4's curl check (or sign up a fresh one), go to `/admin`. Expected: `Sidebar.tsx` shows the real school name (e.g. "École de Test Owner") instead of the "Smart School" default. Then log out and visit `/login` directly. Expected: no console error, sidebar-adjacent branding (wherever `useSchoolProfile` is used on that page, if any) falls back to the default/cached value without crashing.

- [ ] **Step 3: Commit**

```bash
git add apps/education-apps/frontend/hooks/useSchoolProfile.ts
git commit -m "feat(education): source useSchoolProfile from GET /schools/me, cache to localStorage as fallback"
```

---

## Task 9: Wire the Settings "Profil École" Tab + Trial Banner

**Files:**
- Modify: `apps/education-apps/frontend/app/admin/settings/page.tsx`

- [ ] **Step 1: Add the import and trial-info state**

Change the import block (top of file) from:

```tsx
import Button from '@/components/Button';
import Input from '@/components/Input';
import api from '@/lib/api';
import useAuthStore from '@/store/useAuthStore';
```

To:

```tsx
import Button from '@/components/Button';
import Input from '@/components/Input';
import api from '@/lib/api';
import useAuthStore from '@/store/useAuthStore';
import { getMySchool, updateMySchool } from '@/lib/services/schools';
```

Add trial-info state right after the existing `schoolProfile` state declaration:

```tsx
    // School Profile State
    const [schoolProfile, setSchoolProfile] = useState({
        schoolName: 'Smart School',
        city: '',
        address: '',
        phone: '',
        email: '',
        director: '',
        logo: '',
    });
    const [trialInfo, setTrialInfo] = useState<{ status: string; trialEndsAt: string | null } | null>(null);
```

- [ ] **Step 2: Replace the profile-loading `useEffect` and save handler**

Change:

```tsx
    // Load saved school profile on mount
    useEffect(() => {
        const savedProfile = localStorage.getItem('school-profile');
        if (savedProfile) {
            try {
                setSchoolProfile(JSON.parse(savedProfile));
            } catch (e) {
                console.error('Failed to load school profile', e);
            }
        }
        fetchUsers();
    }, []);
```

To:

```tsx
    // Load school profile from the backend on mount
    useEffect(() => {
        loadSchoolProfile();
        fetchUsers();
    }, []);

    const loadSchoolProfile = async () => {
        try {
            const school = await getMySchool();
            setSchoolProfile({
                schoolName: school.name || 'Smart School',
                city: school.city || '',
                address: school.address || '',
                phone: school.phone || '',
                email: school.email || '',
                director: school.director || '',
                logo: school.logo || '',
            });
            setTrialInfo({ status: school.status, trialEndsAt: school.trialEndsAt });
        } catch (e) {
            console.error('Failed to load school profile', e);
        }
    };
```

Change `handleSaveSchoolProfile` from:

```tsx
    const handleSaveSchoolProfile = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Save to localStorage
            localStorage.setItem('school-profile', JSON.stringify(schoolProfile));
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            setSuccess('Profil de l\'école enregistré avec succès');

            // Trigger a custom event to notify sidebar of logo change
            window.dispatchEvent(new Event('school-profile-updated'));
        } catch (err: any) {
            setError('Échec de l\'enregistrement du profil');
        } finally {
            setSaving(false);
        }
    };
```

To:

```tsx
    const handleSaveSchoolProfile = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await updateMySchool({
                name: schoolProfile.schoolName,
                director: schoolProfile.director,
                city: schoolProfile.city,
                address: schoolProfile.address,
                phone: schoolProfile.phone,
                email: schoolProfile.email,
                logo: schoolProfile.logo,
            });
            setSuccess('Profil de l\'école enregistré avec succès');

            // Trigger a custom event to notify sidebar of logo change
            window.dispatchEvent(new Event('school-profile-updated'));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Échec de l\'enregistrement du profil');
        } finally {
            setSaving(false);
        }
    };
```

- [ ] **Step 3: Add the trial banner**

Change:

```tsx
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Tabs */}
```

To:

```tsx
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {trialInfo && trialInfo.status === 'PENDING' && (() => {
                const expired = trialInfo.trialEndsAt ? new Date(trialInfo.trialEndsAt) < new Date() : false;
                const daysLeft = trialInfo.trialEndsAt
                    ? Math.max(0, Math.ceil((new Date(trialInfo.trialEndsAt).getTime() - Date.now()) / 86400000))
                    : null;
                return (
                    <div
                        className={`p-4 rounded-xl border flex items-center gap-3 ${
                            expired
                                ? 'bg-red-50 text-red-700 border-red-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}
                    >
                        <AlertCircle size={20} />
                        {expired
                            ? "Votre période d'essai de 15 jours est terminée. Contactez-nous pour activer votre école."
                            : `Essai gratuit : il vous reste ${daysLeft} jour(s).`}
                    </div>
                );
            })()}

            {/* Tabs */}
```

- [ ] **Step 4: Manually verify**

With both dev servers running, log in as the `OWNER` from Task 4/8, go to `/admin/settings` → "Profil École" tab. Expected: fields are pre-filled from the backend (not blank/localStorage), the amber "Essai gratuit : il vous reste 15 jour(s)." banner shows above the tabs. Edit a field (e.g. "Ville"), click "Enregistrer le profil", reload the page. Expected: the edited value persists after reload (proving it round-tripped through the backend, not just localStorage).

To check the expired-trial banner without waiting 15 days: in a Mongo shell / Compass, manually set that school's `trialEndsAt` to a past date, reload `/admin/settings`. Expected: banner turns red with the "terminée" message. Then try adding a student via `/admin/students`. Expected: the request fails with the `TRIAL_EXPIRED` message from Task 5 (a toast or inline error, depending on how that page surfaces API errors — this app has no global toast/error interceptor beyond the 401 handling in `lib/api.ts`, so confirm the request fails rather than silently succeeding).

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/frontend/app/admin/settings/page.tsx
git commit -m "feat(education): wire Profil École tab to schools.me API and show a trial-status banner"
```

---

## Task 10: Super-Admin "Écoles" Activation Page

**Files:**
- Create: `apps/education-apps/frontend/app/admin/schools/page.tsx`
- Modify: `apps/education-apps/frontend/components/Sidebar.tsx`

`app/admin/layout.tsx` already gates `/admin/*` with `RequireRole allowedRoles={['ADMIN', 'OWNER']}`, and `RequireRole`'s own logic always lets `SUPER_ADMIN` through regardless of `allowedRoles` — so this new route is reachable by URL for `ADMIN`/`OWNER` too unless the page itself checks the role. The page below does that check; the backend endpoints from Task 4 (`roleMiddleware('SUPER_ADMIN')`) are the actual enforcement boundary.

- [ ] **Step 1: Create the page**

Create `apps/education-apps/frontend/app/admin/schools/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/useAuthStore';
import { getAllSchools, updateSchoolStatus, SchoolListItem } from '@/lib/services/schools';
import { Building2, CheckCircle } from 'lucide-react';

export default function SuperAdminSchoolsPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [schools, setSchools] = useState<SchoolListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activatingId, setActivatingId] = useState<string | null>(null);

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') {
            router.push('/admin');
            return;
        }
        if (user?.role === 'SUPER_ADMIN') {
            fetchSchools();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router]);

    const fetchSchools = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getAllSchools();
            setSchools(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Échec du chargement des écoles');
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async (id: string) => {
        setActivatingId(id);
        try {
            await updateSchoolStatus(id, 'ACTIVE');
            await fetchSchools();
        } catch (err: any) {
            setError(err.response?.data?.message || "Échec de l'activation");
        } finally {
            setActivatingId(null);
        }
    };

    if (!user || user.role !== 'SUPER_ADMIN') {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Écoles</h1>
                    <p className="text-gray-600 mt-1">Gérer l'activation des écoles sur la plateforme</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                    <Building2 className="text-blue-600" size={32} />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>
            )}

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-x-auto">
                {loading ? (
                    <p className="p-8 text-gray-500">Chargement…</p>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                            <tr>
                                <th className="px-6 py-4">École</th>
                                <th className="px-6 py-4">Email propriétaire</th>
                                <th className="px-6 py-4">Statut</th>
                                <th className="px-6 py-4">Fin essai</th>
                                <th className="px-6 py-4">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schools.map((school) => (
                                <tr key={school.id} className="border-t border-gray-100">
                                    <td className="px-6 py-4 font-semibold text-gray-800">{school.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{school.ownerEmail}</td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                school.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-700'
                                                    : school.status === 'SUSPENDED'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}
                                        >
                                            {school.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {school.trialEndsAt ? new Date(school.trialEndsAt).toLocaleDateString('fr-FR') : '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {school.status === 'PENDING' && (
                                            <button
                                                onClick={() => handleActivate(school.id)}
                                                disabled={activatingId === school.id}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
                                            >
                                                <CheckCircle size={16} />
                                                {activatingId === school.id ? 'Activation…' : 'Activer'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Add the Sidebar nav item for `SUPER_ADMIN`**

In `apps/education-apps/frontend/components/Sidebar.tsx`, change:

```tsx
  const menuItems = effectiveRole === 'OWNER'
    ? ownerMenuItems
    : (effectiveRole === 'ADMIN' || effectiveRole === 'SUPER_ADMIN') ? adminMenuItems : secretaryMenuItems;
```

To:

```tsx
  const superAdminMenuItems = [
    {
      id: 'schools',
      label: 'Écoles',
      icon: Building,
      path: '/admin/schools',
      activeColor: 'bg-[#334155]/50 border-[#F87171]',
      iconColor: 'text-[#F87171]'
    },
    ...adminMenuItems
  ];

  const menuItems = effectiveRole === 'OWNER'
    ? ownerMenuItems
    : effectiveRole === 'SUPER_ADMIN'
    ? superAdminMenuItems
    : effectiveRole === 'ADMIN' ? adminMenuItems : secretaryMenuItems;
```

(`Building` is already imported in this file for the `ownerMenuItems`/`salles` entries — no new import needed.)

- [ ] **Step 3: Manually verify**

You'll need a `SUPER_ADMIN` user to test this — there is no signup flow for that role (by design, per the spec: platform-level, not self-serve). Create one directly against the dev database, e.g. via `npx prisma studio` (from `apps/education-apps/`) or a one-off script using `createUser`-style logic, setting `role: 'SUPER_ADMIN'` and a `bcrypt`-hashed password.

Log in as that `SUPER_ADMIN`. Expected: Sidebar shows an "Écoles" entry above the usual admin menu. Visit `/admin/schools`. Expected: a table listing every school signed up so far (including the ones from Tasks 4/6/8/9), each `PENDING` one with an "Activer" button. Click it on one row. Expected: that row's status flips to `ACTIVE`, the button disappears, and (per Task 9's verification) that school's `/admin/settings` banner disappears and writes work again even past `trialEndsAt`.

Then log in as a plain `OWNER`/`ADMIN` and navigate directly to `/admin/schools` by URL. Expected: immediately redirected to `/admin` (the page-level guard in Step 1), not shown the table.

- [ ] **Step 4: Commit**

```bash
git add apps/education-apps/frontend/app/admin/schools/page.tsx apps/education-apps/frontend/components/Sidebar.tsx
git commit -m "feat(education): add SUPER_ADMIN-only /admin/schools page to activate demo schools"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (signup form) → Task 6; §2 (signup defaults) → Task 2; §3 (settings wired to backend) → Tasks 3, 4, 9; §4 (15-day demo + restricted access) → Tasks 1, 2, 5, 9; §5 (super-admin activation page) → Tasks 1, 3, 4, 10. Every spec section maps to at least one task.
- **`city` field gap fixed:** the spec's field list for the settings tab (§3) names `city` alongside `director`/`address`/`phone`/`email`/`logo`, but `School` has no `city` field today (only `Branch.city`) and the spec's "add these fields" instruction didn't explicitly call it out. Task 1 adds `city` to `School` too, so the settings tab has a real backing field.
- **Existing tests protected:** Task 5 confirms the pre-existing `tenantScope.middleware.test.ts` cases don't set `req.method`, so the new write-only trial check never triggers for them — verified by reasoning through each existing test in that file, not just by running them after the change (Step 5 in Task 5 still runs the full suite as a backstop).
- **Old/expired data fails open:** schools created before this migration have `trialEndsAt: undefined`; the check `school.trialEndsAt && new Date() > school.trialEndsAt` is `false` for `undefined`, so they're never blocked — intentional, not a gap.
