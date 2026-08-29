# Education Multi-Tenancy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ArwaEduc the multi-school/multi-branch foundation — School/Branch data model, an `OWNER` role scoped to all branches of one school, a centrally-enforced `tenantScope` middleware, self-serve school signup, and a branch switcher — with `Student` fully retrofitted end-to-end as the reference module for the rest of the app.

**Architecture:** One shared MongoDB database and one Express/Next.js deployment serve every school. Every tenant-scoped row gets a `branchId`; a single `tenantScope` middleware resolves and validates the authoritative `branchId` for each request (fixed for `ADMIN`/`SECRETARY` from their JWT, client-selected-but-server-validated for `OWNER`) so individual modules never compute this themselves. `Student` is retrofitted fully in this plan as the proof of the pattern; the remaining existing modules (Groups, Teachers, Payments, Attendance, Inscriptions, Parents, Formations, Transactions, Pricing, Settings) are deliberately left for a follow-up plan — this plan adds `branchId` as an **optional** field to those models now (safe schema evolution, doesn't break their still-unmodified `create` calls) and tightens it to required per-model only as each one gets retrofitted later.

**Tech Stack:** Express + Prisma (MongoDB) + TypeScript backend, Next.js 14 App Router frontend, Jest (already set up), Zustand (frontend state).

**Spec:** `docs/superpowers/specs/2026-08-29-education-multi-tenancy-design.md`

---

## Notes on scope decisions carried from the spec

- This is the **Foundation** phase only. The spec's "Implementation Phasing" section explicitly calls for a follow-up plan to retrofit the remaining modules one at a time — do not attempt that here.
- No production data exists yet (confirmed with the user) — no migration tasks are needed.
- `SUPER_ADMIN` is explicitly out of scope for any UI in this plan (handled by the separate super-admin-dashboard project). The `tenantScope` middleware denies `SUPER_ADMIN` on branch-scoped routes for now (safe, explicit `403`) rather than building unused behavior.
- No real payment integration — `School.status` starts at `PENDING` and is informational only in this plan.
- **Incremental migration detail not spelled out in the spec**: `branchId` is added as **required** only on `Student` (the module being fully retrofitted here). On every other existing tenant-scoped model (`Group`, `Teacher`, `Payment`, `Attendance`, `Inscription`, `Parent`, `Formation`, `Transaction`, `Pricing`, `Settings`, `AttendanceNotification`), it's added as **optional** in this plan, so their still-unmodified `create()` calls keep working. The follow-up module-rollout plan tightens each one to required as it retrofits that specific module. The new `GET /api/branches/summary` endpoint (Task 6) queries some of these optional fields directly — until those modules are retrofitted, it will correctly show zero students/revenue for any branch, since no rows have a `branchId` set yet. This is expected during the rollout window, not a bug.

---

## File Structure

**Backend (`apps/education-apps/`)**
- `prisma/schema.prisma` — modify: add `School`, `Branch` models, `SchoolStatus` enum, `OWNER` to `UserRole`, `schoolId`/`branchId` on `User`, required `branchId` on `Student`, optional `branchId` on every other existing tenant-scoped model.
- `src/utils/jwt.ts` — modify: `JwtPayload` gains `schoolId?`/`branchId?`.
- `src/middlewares/auth.middleware.ts` — modify: `AuthRequest.user` gains `schoolId?`/`branchId?`.
- `src/middlewares/tenantScope.middleware.ts` — new: resolves/validates `req.branchId`.
- `src/auth/auth.service.ts` — modify: `loginUser` includes `schoolId`/`branchId` in the generated token.
- `src/modules/students/students.service.ts` / `.controller.ts` / `.routes.ts` — modify: every function branch-scoped via `req.branchId`.
- `src/modules/schools/schools.service.ts` / `.controller.ts` / `.routes.ts` — new: public self-serve signup.
- `src/modules/branches/branches.service.ts` / `.controller.ts` / `.routes.ts` — new: `OWNER`-only branch list + cross-branch summary.
- `src/app.ts` — modify: mount `schoolsRoutes`, `branchesRoutes`.
- Test files co-located per module, matching the existing convention (`*.test.ts` next to the source file).

**Frontend (`apps/education-apps/frontend/`)**
- `types/index.ts` — modify: `UserRole` gains `'OWNER'`, `User` gains `schoolId?`/`branchId?`.
- `store/useAuthStore.ts` — modify: adds `activeBranchId` state (persisted like `accessToken`).
- `lib/api.ts` — modify: request interceptor attaches `X-Branch-Id` header when an active branch is set.
- `lib/services/schools.ts` — new: `signupSchool`.
- `lib/services/branches.ts` — new: `getBranches`, `getBranchSummary`.
- `app/signup/page.tsx` — new: public self-serve signup form.
- `app/admin/select-branch/page.tsx` — new: branch switcher for `OWNER`.
- `app/admin/branches/page.tsx` — new: cross-branch summary dashboard for `OWNER`.
- `app/login/page.tsx` — modify: redirect `OWNER` to the branch switcher instead of `/admin` directly.
- `app/admin/layout.tsx` — modify: allow `OWNER` role.

---

## Task 1: Prisma schema — School, Branch, User roles, Student.branchId (required), other models' branchId (optional)

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`

- [ ] **Step 1: Add the `SchoolStatus` enum, `School`, and `Branch` models**

Add near the other enums:

```prisma
enum SchoolStatus {
  PENDING
  ACTIVE
  SUSPENDED
}
```

Add after the `Parent` model:

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

model Branch {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  schoolId  String   @db.ObjectId
  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  name      String
  city      String
  address   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users     User[]
  students  Student[]

  @@map("branches")
}
```

- [ ] **Step 2: Add `OWNER` to `UserRole` and `schoolId`/`branchId` to `User`**

Change:
```prisma
enum UserRole {
  ADMIN
  SECRETARY
  SUPER_ADMIN
}
```
to:
```prisma
enum UserRole {
  ADMIN
  SECRETARY
  OWNER
  SUPER_ADMIN
}
```

Add these fields inside the `User` model (keep every existing field untouched):
```prisma
  schoolId String? @db.ObjectId
  school   School? @relation(fields: [schoolId], references: [id])
  branchId String? @db.ObjectId
  branch   Branch? @relation(fields: [branchId], references: [id])
```

- [ ] **Step 3: Add required `branchId` to `Student`**

Add inside the `Student` model (keep every existing field untouched):
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 4: Add optional `branchId` to every other existing tenant-scoped model**

Add this single line to each of these models (do not make it required — see the plan's scope note above): `Group`, `Teacher`, `Inscription`, `Payment`, `Attendance`, `Settings`, `Formation`, `Transaction`, `Pricing`, `AttendanceNotification`:
```prisma
  branchId String? @db.ObjectId
```
(No `@relation` needed for these optional ones in this plan — a bare scalar is sufficient since nothing queries through the relation yet; the follow-up rollout plan can add the full relation when it makes the field required for that specific model.)

Do NOT add `branchId` to `AccessLog` (intentionally excluded per the spec).

- [ ] **Step 5: Generate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate`
Expected: `Generated Prisma Client` with no errors.

Run: `cd apps/education-apps && npx prisma db push`
Expected: schema applied with no errors. Since there is no existing data, the new required `Student.branchId` will not conflict with any existing rows.

- [ ] **Step 6: Commit**

```bash
git add apps/education-apps/prisma/schema.prisma
git commit -m "feat(schema): add School/Branch models, OWNER role, and branchId across tenant-scoped models"
```

---

## Task 2: JWT payload and auth middleware carry schoolId/branchId

**Files:**
- Modify: `apps/education-apps/src/utils/jwt.ts`
- Modify: `apps/education-apps/src/middlewares/auth.middleware.ts`
- Modify: `apps/education-apps/src/auth/auth.service.ts`
- Test: `apps/education-apps/src/auth/auth.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/education-apps/src/auth/auth.service.test.ts`:

```ts
import prisma from '../config/database';
import { loginUser } from './auth.service';
import * as bcryptUtil from '../utils/bcrypt';
import * as jwtUtil from '../utils/jwt';

jest.mock('../config/database', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
    },
}));

describe('loginUser', () => {
    afterEach(() => jest.restoreAllMocks());

    it('includes schoolId and branchId in the generated token payload for an OWNER', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({
            id: 'u1',
            email: 'owner@example.com',
            password: 'hashed',
            role: 'OWNER',
            name: 'Owner',
            schoolId: 's1',
            branchId: null,
        });
        jest.spyOn(bcryptUtil, 'comparePassword').mockResolvedValue(true);
        const generateTokenSpy = jest.spyOn(jwtUtil, 'generateToken').mockReturnValue('signed-token');

        await loginUser({ email: 'owner@example.com', password: 'pw' });

        expect(generateTokenSpy).toHaveBeenCalledWith({
            id: 'u1',
            email: 'owner@example.com',
            role: 'OWNER',
            name: 'Owner',
            schoolId: 's1',
            branchId: null,
        });
    });

    it('includes branchId (and null schoolId) for an ADMIN', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({
            id: 'u2',
            email: 'admin@example.com',
            password: 'hashed',
            role: 'ADMIN',
            name: 'Admin',
            schoolId: null,
            branchId: 'b1',
        });
        jest.spyOn(bcryptUtil, 'comparePassword').mockResolvedValue(true);
        const generateTokenSpy = jest.spyOn(jwtUtil, 'generateToken').mockReturnValue('signed-token');

        await loginUser({ email: 'admin@example.com', password: 'pw' });

        expect(generateTokenSpy).toHaveBeenCalledWith({
            id: 'u2',
            email: 'admin@example.com',
            role: 'ADMIN',
            name: 'Admin',
            schoolId: null,
            branchId: 'b1',
        });
    });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd apps/education-apps && npm test -- auth.service`
Expected: FAIL — the `generateToken` call doesn't yet include `schoolId`/`branchId`.

- [ ] **Step 3: Update the JWT payload type**

In `apps/education-apps/src/utils/jwt.ts`, change:
```ts
interface JwtPayload {
    id: string;
    email: string;
    role: string;
    name: string;
}
```
to:
```ts
interface JwtPayload {
    id: string;
    email: string;
    role: string;
    name: string;
    schoolId: string | null;
    branchId: string | null;
}
```

- [ ] **Step 4: Update `loginUser` to include them**

In `apps/education-apps/src/auth/auth.service.ts`, change the `generateToken` call:
```ts
    const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        schoolId: user.schoolId,
        branchId: user.branchId,
    });
```

- [ ] **Step 5: Update `AuthRequest` in the auth middleware**

In `apps/education-apps/src/middlewares/auth.middleware.ts`, change:
```ts
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}
```
to:
```ts
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        schoolId: string | null;
        branchId: string | null;
    };
}
```

(The `req.user = decoded;` assignment later in the same file already works unchanged, since `decoded` — the `JwtPayload` — now has a matching shape.)

- [ ] **Step 6: Run the test and confirm it passes**

Run: `cd apps/education-apps && npm test -- auth.service`
Expected: `2 passed`.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing. (Existing modules that read `req.user` won't break — they only ever read `.id`/`.email`/`.role`, and the interface is additive.)

- [ ] **Step 8: Commit**

```bash
git add apps/education-apps/src/utils/jwt.ts apps/education-apps/src/middlewares/auth.middleware.ts apps/education-apps/src/auth/auth.service.ts apps/education-apps/src/auth/auth.service.test.ts
git commit -m "feat(auth): carry schoolId/branchId through JWT and AuthRequest"
```

---

## Task 3: `tenantScope` middleware

**Files:**
- Create: `apps/education-apps/src/middlewares/tenantScope.middleware.ts`
- Test: `apps/education-apps/src/middlewares/tenantScope.middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/education-apps/src/middlewares/tenantScope.middleware.test.ts`:

```ts
import { Response } from 'express';
import prisma from '../config/database';
import { tenantScopeMiddleware, TenantRequest } from './tenantScope.middleware';

jest.mock('../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findUnique: jest.fn() },
    },
}));

const makeRes = () => {
    const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    return res as Response;
};

describe('tenantScopeMiddleware', () => {
    afterEach(() => jest.clearAllMocks());

    it('rejects an unauthenticated request', async () => {
        const req = {} as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('uses the fixed branchId from the token for ADMIN, ignoring any header', async () => {
        const req = {
            user: { id: 'u1', email: 'a@b.com', role: 'ADMIN', schoolId: null, branchId: 'b1' },
            header: jest.fn().mockReturnValue('some-other-branch'),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(req.branchId).toBe('b1');
        expect(next).toHaveBeenCalled();
    });

    it('rejects ADMIN with no assigned branch', async () => {
        const req = {
            user: { id: 'u1', email: 'a@b.com', role: 'ADMIN', schoolId: null, branchId: null },
            header: jest.fn(),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('requires an X-Branch-Id header for OWNER', async () => {
        const req = {
            user: { id: 'u1', email: 'o@b.com', role: 'OWNER', schoolId: 's1', branchId: null },
            header: jest.fn().mockReturnValue(undefined),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('accepts a branch header that belongs to the OWNER\'s school', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ id: 'b1', schoolId: 's1' });
        const req = {
            user: { id: 'u1', email: 'o@b.com', role: 'OWNER', schoolId: 's1', branchId: null },
            header: jest.fn().mockReturnValue('b1'),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(req.branchId).toBe('b1');
        expect(next).toHaveBeenCalled();
    });

    it('rejects a branch header belonging to a different school', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ id: 'b2', schoolId: 'some-other-school' });
        const req = {
            user: { id: 'u1', email: 'o@b.com', role: 'OWNER', schoolId: 's1', branchId: null },
            header: jest.fn().mockReturnValue('b2'),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects SUPER_ADMIN on branch-scoped routes (out of scope for now)', async () => {
        const req = {
            user: { id: 'u1', email: 's@b.com', role: 'SUPER_ADMIN', schoolId: null, branchId: null },
            header: jest.fn(),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- tenantScope`
Expected: FAIL — `Cannot find module './tenantScope.middleware'`.

- [ ] **Step 3: Implement**

Create `apps/education-apps/src/middlewares/tenantScope.middleware.ts`:

```ts
import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { sendError } from '../utils/response';

export interface TenantRequest extends AuthRequest {
    branchId?: string;
}

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

    if (user.role === 'ADMIN' || user.role === 'SECRETARY') {
        if (!user.branchId) {
            sendError(res, 'User has no assigned branch', 'Access denied', 403);
            return;
        }
        req.branchId = user.branchId;
        next();
        return;
    }

    if (user.role === 'OWNER') {
        const requestedBranchId = req.header('x-branch-id');

        if (!requestedBranchId) {
            sendError(res, 'A branch must be selected', 'Branch required', 400);
            return;
        }

        const branch = await prisma.branch.findUnique({ where: { id: requestedBranchId } });

        if (!branch || branch.schoolId !== user.schoolId) {
            sendError(res, 'Branch does not belong to your school', 'Access denied', 403);
            return;
        }

        req.branchId = requestedBranchId;
        next();
        return;
    }

    sendError(res, 'This role cannot access branch-scoped resources', 'Access denied', 403);
};
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- tenantScope`
Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src/middlewares/tenantScope.middleware.ts apps/education-apps/src/middlewares/tenantScope.middleware.test.ts
git commit -m "feat: add tenantScope middleware for centralized branch isolation"
```

---

## Task 4: Retrofit the Students module (reference pattern)

**Files:**
- Modify: `apps/education-apps/src/modules/students/students.service.ts`
- Modify: `apps/education-apps/src/modules/students/students.controller.ts`
- Modify: `apps/education-apps/src/modules/students/students.routes.ts`
- Modify: `apps/education-apps/src/modules/students/students.service.test.ts`

Read the current content of all three source files in full before editing — you are modifying existing, working code (already covered by tests from prior work), not writing from scratch. Preserve every existing field/behavior; only add branch scoping.

- [ ] **Step 1: Write the failing tests (extend the existing test file)**

Add these tests to the existing `apps/education-apps/src/modules/students/students.service.test.ts` (keep the existing `regenerateStudentToken` and `updateStudent` describe blocks — add a new one; extend the `jest.mock('../../config/database', ...)` call's `student` mock object to also include `findMany` and `create` if those aren't already present, without removing `findUnique`/`update`):

```ts
describe('branch scoping', () => {
    it('createStudent sets branchId from the passed-in value, not from arbitrary client data', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });

        await createStudent({ name: 'A', surname: 'B', branchId: 'b1' } as any);

        expect(prisma.student.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ branchId: 'b1' }),
            })
        );
    });

    it('getAllStudents only returns students in the given branch', async () => {
        (prisma.student.findMany as jest.Mock).mockResolvedValue([]);

        await getAllStudents('b1');

        expect(prisma.student.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('getStudentById returns null-equivalent (throws) for a student outside the given branch', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(getStudentById('s1', 'b1')).rejects.toThrow('Student not found');

        expect(prisma.student.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 's1', branchId: 'b1' } })
        );
    });
});
```

Add `findMany`, `create`, `findFirst` to the mocked `student` object in the file's `jest.mock('../../config/database', ...)` call if they're not already there (check the current mock shape first — merge in, don't duplicate the `jest.mock` call).

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- students.service`
Expected: FAIL — `getAllStudents`/`getStudentById`/`createStudent` don't yet accept/use a `branchId`.

- [ ] **Step 3: Update the service**

In `apps/education-apps/src/modules/students/students.service.ts`:

Add `branchId: string;` to `CreateStudentData` interface, and inside `createStudent`'s `tx.student.create` call, add `branchId: data.branchId,` to the `data` object (alongside the existing fields — keep `accessTokenHash: hashToken(generateRawToken())` from prior work untouched).

Change `getAllStudents`:
```ts
export const getAllStudents = async (branchId: string) => {
    const students = await prisma.student.findMany({
        where: { branchId },
        include: {
            inscriptions: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return students;
};
```

Change `getStudentById` to use `findFirst` scoped by branch (not `findUnique` by id alone — this is the actual security boundary, preventing one branch from fetching another branch's student by guessing/reusing an id):
```ts
export const getStudentById = async (id: string, branchId: string) => {
    const student = await prisma.student.findFirst({
        where: { id, branchId },
        include: {
            inscriptions: true,
            payments: true,
            attendances: true,
            parent: true,
        },
    });

    if (!student) {
        throw new Error('Student not found');
    }

    return student;
};
```

Change `updateStudent` and `deleteStudent` and `regenerateStudentToken` the same way — scope every lookup by `branchId`, not just `id`:
```ts
export const updateStudent = async (id: string, branchId: string, data: UpdateStudentData) => {
    const existingStudent = await prisma.student.findFirst({ where: { id, branchId } });

    if (!existingStudent) {
        throw new Error('Student not found');
    }

    const student = await prisma.student.update({
        where: { id },
        data,
    });

    return student;
};

export const deleteStudent = async (id: string, branchId: string) => {
    const existingStudent = await prisma.student.findFirst({ where: { id, branchId } });

    if (!existingStudent) {
        throw new Error('Student not found');
    }

    await prisma.student.delete({
        where: { id },
    });

    return { message: 'Student deleted successfully' };
};

export const regenerateStudentToken = async (id: string, branchId: string) => {
    const existingStudent = await prisma.student.findFirst({ where: { id, branchId } });

    if (!existingStudent) {
        throw new Error('Student not found');
    }

    const rawToken = generateRawToken();

    const student = await prisma.student.update({
        where: { id },
        data: { accessTokenHash: hashToken(rawToken) },
    });

    return { student, rawToken };
};
```

Leave `getStudentAnalytics` unchanged for now (it's an aggregate report, not per-record access — scoping it by branch belongs to a dedicated task if/when the analytics page itself is retrofitted, out of scope here since this task is about `Student` CRUD, not the analytics endpoint).

- [ ] **Step 4: Update the controller**

In `apps/education-apps/src/modules/students/students.controller.ts`, every handler must read `req.branchId` (set by `tenantScopeMiddleware`) and pass it to the service — never trust a `branchId` from `req.body`/`req.query`/`req.params`. Import the type:
```ts
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
```
Change every handler's `req: Request` parameter to `req: TenantRequest`, and thread `req.branchId!` (the middleware guarantees it's set by the time a handler runs) into each service call — e.g.:
```ts
export const create = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const studentData = { ...req.body, branchId: req.branchId! };
        const student = await createStudent(studentData);
        sendSuccess(res, stripTokenHash(student), 'Student created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create student', 400);
    }
};

export const getAll = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const students = await getAllStudents(req.branchId!);
        sendSuccess(res, students.map(stripTokenHash), 'Students retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve students', 400);
    }
};

export const getById = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const student = await getStudentById(req.params.id, req.branchId!);
        sendSuccess(res, stripTokenHash(student), 'Student retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve student', 404);
    }
};

export const update = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const student = await updateStudent(req.params.id, req.branchId!, req.body);
        sendSuccess(res, stripTokenHash(student), 'Student updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update student', 400);
    }
};

export const remove = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const result = await deleteStudent(req.params.id, req.branchId!);
        sendSuccess(res, result, 'Student deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete student', 400);
    }
};

export const regenerateToken = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { student, rawToken } = await regenerateStudentToken(req.params.id, req.branchId!);
        sendSuccess(res, { student: stripTokenHash(student), rawToken }, 'Token regenerated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to regenerate token', 400);
    }
};
```
Adjust names/exact bodies to match whatever the current handlers are actually called and structured as (read the file first) — the key requirement is: every handler takes `TenantRequest`, reads `req.branchId!`, and every service call is scoped by it. Leave the analytics handler unchanged (matches the service-layer decision above).

- [ ] **Step 5: Wire the middleware into the routes**

In `apps/education-apps/src/modules/students/students.routes.ts`, add the import and insert the middleware, and add `'OWNER'` to the allowed roles:
```ts
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
```
Change:
```ts
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY'));
```
to:
```ts
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);
```
(Leave the analytics route's own middleware chain alone if it's declared separately with different roles — only touch the CRUD routes covered by this task.)

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- students.service`
Expected: all passing (old + 3 new).

- [ ] **Step 7: Run the full suite and typecheck**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean. (You will likely need to fix call sites in `students.controller.ts` further if `tsc` flags anything — resolve them, this is expected iteration, not a sign something else is wrong.)

- [ ] **Step 8: Commit**

```bash
git add apps/education-apps/src/modules/students
git commit -m "feat(students): retrofit branch scoping via tenantScope middleware (reference module)"
```

---

## Task 5: School self-serve signup

**Files:**
- Create: `apps/education-apps/src/modules/schools/schools.service.ts`
- Create: `apps/education-apps/src/modules/schools/schools.controller.ts`
- Create: `apps/education-apps/src/modules/schools/schools.routes.ts`
- Test: `apps/education-apps/src/modules/schools/schools.service.test.ts`
- Modify: `apps/education-apps/src/app.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/education-apps/src/modules/schools/schools.service.test.ts`:

```ts
import prisma from '../../config/database';
import { signupSchool } from './schools.service';
import * as bcryptUtil from '../../utils/bcrypt';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
        $transaction: jest.fn(),
    },
}));

describe('signupSchool', () => {
    afterEach(() => jest.restoreAllMocks());

    it('throws if the owner email is already registered', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

        await expect(
            signupSchool({
                schoolName: 'Ecole A',
                ownerName: 'Owner',
                ownerEmail: 'owner@example.com',
                ownerPhone: '0600000000',
                password: 'secret123',
                branchName: 'Main',
                branchCity: 'Casablanca',
                packTier: 'basic',
            })
        ).rejects.toThrow('Email already exists');
    });

    it('creates School, Branch, and an OWNER User atomically with a hashed password', async () => {
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

        const result = await signupSchool({
            schoolName: 'Ecole A',
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            ownerPhone: '0600000000',
            password: 'secret123',
            branchName: 'Main',
            branchCity: 'Casablanca',
            packTier: 'basic',
        });

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: 'Ecole A', status: 'PENDING', packTier: 'basic' }),
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
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- schools.service`
Expected: FAIL — `Cannot find module './schools.service'`.

- [ ] **Step 3: Implement the service**

Create `apps/education-apps/src/modules/schools/schools.service.ts`:

```ts
import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';

export interface SignupSchoolData {
    schoolName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password: string;
    branchName: string;
    branchCity: string;
    packTier: string;
}

export const signupSchool = async (data: SignupSchoolData) => {
    const email = data.ownerEmail.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('Email already exists');
    }

    const hashedPassword = await hashPassword(data.password);

    return prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
            data: {
                name: data.schoolName,
                status: 'PENDING',
                packTier: data.packTier,
                ownerName: data.ownerName,
                ownerEmail: email,
                ownerPhone: data.ownerPhone,
            },
        });

        const branch = await tx.branch.create({
            data: {
                schoolId: school.id,
                name: data.branchName,
                city: data.branchCity,
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
};
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- schools.service`
Expected: `2 passed`.

- [ ] **Step 5: Implement the controller**

Create `apps/education-apps/src/modules/schools/schools.controller.ts`:

```ts
import { Request, Response } from 'express';
import { signupSchool } from './schools.service';
import { generateToken } from '../../utils/jwt';
import { sendSuccess, sendError } from '../../utils/response';

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

        if (!schoolName || !ownerName || !ownerEmail || !password || !branchName || !branchCity || !packTier) {
            sendError(res, 'schoolName, ownerName, ownerEmail, password, branchName, branchCity, and packTier are required', 'Validation error', 400);
            return;
        }

        const { user } = await signupSchool({
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
            { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId } },
            'School created successfully',
            201
        );
    } catch (error: any) {
        sendError(res, error.message, 'Signup failed', 400);
    }
};
```

- [ ] **Step 6: Implement the routes**

Create `apps/education-apps/src/modules/schools/schools.routes.ts`:

```ts
import { Router } from 'express';
import { signup } from './schools.controller';

const router = Router();

// Public — no auth, this is how a new school gets created
router.post('/signup', signup);

export default router;
```

- [ ] **Step 7: Mount the routes**

In `apps/education-apps/src/app.ts`, add the import near the other module imports:
```ts
import schoolsRoutes from './modules/schools/schools.routes';
```
And mount it:
```ts
apiRouter.use('/schools', schoolsRoutes);
```

- [ ] **Step 8: Run the full suite and typecheck**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing.

- [ ] **Step 9: Commit**

```bash
git add apps/education-apps/src/modules/schools apps/education-apps/src/app.ts
git commit -m "feat: add self-serve school signup endpoint"
```

---

## Task 6: Branch listing and owner cross-branch summary

**Files:**
- Create: `apps/education-apps/src/modules/branches/branches.service.ts`
- Create: `apps/education-apps/src/modules/branches/branches.controller.ts`
- Create: `apps/education-apps/src/modules/branches/branches.routes.ts`
- Test: `apps/education-apps/src/modules/branches/branches.service.test.ts`
- Modify: `apps/education-apps/src/app.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/education-apps/src/modules/branches/branches.service.test.ts`:

```ts
import prisma from '../../config/database';
import { getBranchesForSchool, getBranchSummary } from './branches.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findMany: jest.fn() },
        student: { count: jest.fn() },
        attendance: { count: jest.fn() },
        inscription: { aggregate: jest.fn() },
        payment: { aggregate: jest.fn() },
    },
}));

describe('branches.service', () => {
    afterEach(() => jest.clearAllMocks());

    it('getBranchesForSchool scopes by schoolId', async () => {
        (prisma.branch.findMany as jest.Mock).mockResolvedValue([]);

        await getBranchesForSchool('school1');

        expect(prisma.branch.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { schoolId: 'school1' } })
        );
    });

    it('getBranchSummary aggregates student count and balance per branch, plus totals', async () => {
        (prisma.branch.findMany as jest.Mock).mockResolvedValue([
            { id: 'b1', name: 'Branch 1' },
            { id: 'b2', name: 'Branch 2' },
        ]);
        (prisma.student.count as jest.Mock).mockResolvedValueOnce(10).mockResolvedValueOnce(5);
        (prisma.attendance.count as jest.Mock).mockResolvedValue(0);
        (prisma.inscription.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 1000 } });
        (prisma.payment.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 400 } });

        const result = await getBranchSummary('school1');

        expect(result.totalStudents).toBe(15);
        expect(result.totalBalanceDue).toBe(1200); // (1000-400) * 2 branches
        expect(result.branches).toHaveLength(2);
        expect(result.branches[0]).toEqual(
            expect.objectContaining({ studentCount: 10, balanceDue: 600 })
        );
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- branches.service`
Expected: FAIL — `Cannot find module './branches.service'`.

- [ ] **Step 3: Implement the service**

Create `apps/education-apps/src/modules/branches/branches.service.ts`:

```ts
import prisma from '../../config/database';

export const getBranchesForSchool = async (schoolId: string) => {
    return prisma.branch.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'asc' },
    });
};

export const getBranchSummary = async (schoolId: string) => {
    const branches = await prisma.branch.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'asc' },
    });

    const branchSummaries = await Promise.all(
        branches.map(async (branch) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [studentCount, presentToday, inscriptionTotal, paymentTotal] = await Promise.all([
                prisma.student.count({ where: { branchId: branch.id } }),
                prisma.attendance.count({
                    where: { branchId: branch.id, date: today, status: { in: ['PRESENT', 'LATE'] } },
                }),
                prisma.inscription.aggregate({ where: { branchId: branch.id }, _sum: { amount: true } }),
                prisma.payment.aggregate({ where: { branchId: branch.id }, _sum: { amount: true } }),
            ]);

            const balanceDue = (inscriptionTotal._sum.amount || 0) - (paymentTotal._sum.amount || 0);

            return { branch, studentCount, presentToday, balanceDue };
        })
    );

    const totalStudents = branchSummaries.reduce((sum, b) => sum + b.studentCount, 0);
    const totalBalanceDue = branchSummaries.reduce((sum, b) => sum + b.balanceDue, 0);

    return { branches: branchSummaries, totalStudents, totalBalanceDue };
};
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- branches.service`
Expected: `2 passed`.

- [ ] **Step 5: Implement the controller**

Create `apps/education-apps/src/modules/branches/branches.controller.ts`:

```ts
import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { getBranchesForSchool, getBranchSummary } from './branches.service';
import { sendSuccess, sendError } from '../../utils/response';

export const getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schoolId = req.user!.schoolId;
        if (!schoolId) {
            sendError(res, 'No school associated with this account', 'Access denied', 403);
            return;
        }
        const branches = await getBranchesForSchool(schoolId);
        sendSuccess(res, branches, 'Branches retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve branches', 400);
    }
};

export const getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schoolId = req.user!.schoolId;
        if (!schoolId) {
            sendError(res, 'No school associated with this account', 'Access denied', 403);
            return;
        }
        const summary = await getBranchSummary(schoolId);
        sendSuccess(res, summary, 'Branch summary retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve branch summary', 400);
    }
};
```

- [ ] **Step 6: Implement the routes**

Create `apps/education-apps/src/modules/branches/branches.routes.ts`:

```ts
import { Router } from 'express';
import { getAll, getSummary } from './branches.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('OWNER'));

router.get('/', getAll);
router.get('/summary', getSummary);

export default router;
```

- [ ] **Step 7: Mount the routes**

In `apps/education-apps/src/app.ts`, add the import:
```ts
import branchesRoutes from './modules/branches/branches.routes';
```
And mount it:
```ts
apiRouter.use('/branches', branchesRoutes);
```

- [ ] **Step 8: Run the full suite and typecheck**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing.

- [ ] **Step 9: Commit**

```bash
git add apps/education-apps/src/modules/branches apps/education-apps/src/app.ts
git commit -m "feat: add OWNER-only branch listing and cross-branch summary endpoints"
```

---

## Task 7: Frontend types and auth-store branch state

**Files:**
- Modify: `apps/education-apps/frontend/types/index.ts`
- Modify: `apps/education-apps/frontend/store/useAuthStore.ts`
- Modify: `apps/education-apps/frontend/lib/api.ts`

- [ ] **Step 1: Extend `UserRole` and `User`**

In `apps/education-apps/frontend/types/index.ts`, change:
```ts
export type UserRole = 'ADMIN' | 'SECRETARY' | 'SUPER_ADMIN';
```
to:
```ts
export type UserRole = 'ADMIN' | 'SECRETARY' | 'OWNER' | 'SUPER_ADMIN';
```
And add to the `User` interface (keep existing fields): `schoolId?: string | null;`.

- [ ] **Step 2: Add active-branch state to the auth store**

In `apps/education-apps/frontend/store/useAuthStore.ts`, add alongside the existing `_accessToken` module-level state:
```ts
let _activeBranchId: string | null = null;

export const getActiveBranchId = () => _activeBranchId;
export const setActiveBranchId = (id: string | null) => {
    _activeBranchId = id;
    if (typeof window !== 'undefined') {
        if (id) localStorage.setItem('activeBranchId', id);
        else localStorage.removeItem('activeBranchId');
    }
};

if (typeof window !== 'undefined') {
    _activeBranchId = localStorage.getItem('activeBranchId');
}
```
Add `activeBranchId: string | null;` and `setActiveBranchId: (id: string | null) => void;` to the `AuthState` type, and wire them into the store body:
```ts
    activeBranchId: _activeBranchId,
    setActiveBranchId: (id) => { setActiveBranchId(id); set({ activeBranchId: id }); },
```
Also clear the active branch on logout — inside the existing `logout: () => { ... }` function, add `setActiveBranchId(null);` before the `clearTokens()` call.

- [ ] **Step 3: Attach the branch header in the API client**

In `apps/education-apps/frontend/lib/api.ts`, import the new getter and use it in the existing request interceptor:
```ts
import { getAccessToken, setAccessToken, clearTokens, getActiveBranchId } from "../store/useAuthStore";
```
Change the request interceptor:
```ts
api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    const branchId = getActiveBranchId();
    if (branchId && config.headers) config.headers['X-Branch-Id'] = branchId;
    return config;
});
```

- [ ] **Step 4: Type-check**

Run: `cd apps/education-apps/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/frontend/types/index.ts apps/education-apps/frontend/store/useAuthStore.ts apps/education-apps/frontend/lib/api.ts
git commit -m "feat(frontend): add OWNER role, active-branch state, and X-Branch-Id header"
```

---

## Task 8: Signup page and service

**Files:**
- Create: `apps/education-apps/frontend/lib/services/schools.ts`
- Create: `apps/education-apps/frontend/app/signup/page.tsx`

This route is public (outside `app/admin`), same reasoning as the existing `/p/[token]` page — no auth layout wraps it.

- [ ] **Step 1: Add the API service**

Create `apps/education-apps/frontend/lib/services/schools.ts`:

```ts
import api from '../api';
import type { ApiResponse, User } from '@/types';

export interface SignupSchoolData {
    schoolName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password: string;
    branchName: string;
    branchCity: string;
    packTier: string;
}

export async function signupSchool(data: SignupSchoolData): Promise<{ token: string; user: User }> {
    const response = await api.post<ApiResponse<{ token: string; user: User }>>('/schools/signup', data);
    return response.data.data;
}
```

- [ ] **Step 2: Implement the page**

Before writing this, read `apps/education-apps/frontend/app/login/page.tsx` to match its visual language (Tailwind classes, layout) — this is the first page a prospective customer sees, keep it visually consistent with the existing login screen rather than introducing a new look.

Create `apps/education-apps/frontend/app/signup/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signupSchool } from '@/lib/services/schools';
import useAuthStore, { setAccessToken, setActiveBranchId } from '@/store/useAuthStore';

const PACK_OPTIONS = ['basic', 'standard', 'premium'];

export default function SignupPage() {
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);
    const setAccessTokenState = useAuthStore((state) => state.setAccessToken);

    const [form, setForm] = useState({
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

    const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

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
            setError(err.response?.data?.error || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900">Créer votre école</h1>

                {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

                <input required placeholder="Nom de l'école" value={form.schoolName} onChange={update('schoolName')}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2" />
                <input required placeholder="Votre nom" value={form.ownerName} onChange={update('ownerName')}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2" />
                <input required type="email" placeholder="Email" value={form.ownerEmail} onChange={update('ownerEmail')}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2" />
                <input placeholder="Téléphone" value={form.ownerPhone} onChange={update('ownerPhone')}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2" />
                <input required type="password" placeholder="Mot de passe" value={form.password} onChange={update('password')}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2" />
                <input required placeholder="Nom du premier établissement" value={form.branchName} onChange={update('branchName')}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2" />
                <input required placeholder="Ville" value={form.branchCity} onChange={update('branchCity')}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2" />
                <select value={form.packTier} onChange={update('packTier')}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2">
                    {PACK_OPTIONS.map((pack) => (
                        <option key={pack} value={pack}>{pack}</option>
                    ))}
                </select>

                <button type="submit" disabled={loading}
                    className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                    {loading ? 'Création…' : 'Créer mon compte'}
                </button>
            </form>
        </div>
    );
}
```

Note: `useAuthStore`'s module exports `setAccessToken`/`setActiveBranchId` as plain functions (module-level, outside the hook) per the existing pattern already in that file — import them from there directly as shown, alongside the default hook export. If the actual export names differ slightly from what Task 7 produced, adjust this import to match exactly what you wrote there.

- [ ] **Step 3: Type-check**

Run: `cd apps/education-apps/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification**

Boot backend + frontend (pattern from prior work in this codebase — `timeout 10 npm run dev; true` style, or full `next build && next start` if more reliable in this environment). Submit the signup form with test data, confirm a 201 response and that `useAuthStore`'s state has a token set afterward (check via the network tab / a temporary `console.log` if no browser is available — a curl `POST /api/schools/signup` with the same payload is an acceptable substitute to confirm the backend side works, paired with a code read of the page to confirm the frontend wiring is correct).

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/frontend/lib/services/schools.ts apps/education-apps/frontend/app/signup
git commit -m "feat(frontend): add self-serve school signup page"
```

---

## Task 9: Branch switcher page

**Files:**
- Create: `apps/education-apps/frontend/lib/services/branches.ts`
- Create: `apps/education-apps/frontend/app/admin/select-branch/page.tsx`

- [ ] **Step 1: Add the API service**

Create `apps/education-apps/frontend/lib/services/branches.ts`:

```ts
import api from '../api';
import type { ApiResponse } from '@/types';

export interface Branch {
    id: string;
    schoolId: string;
    name: string;
    city: string;
    address?: string;
}

export interface BranchSummaryEntry {
    branch: Branch;
    studentCount: number;
    presentToday: number;
    balanceDue: number;
}

export interface BranchSummary {
    branches: BranchSummaryEntry[];
    totalStudents: number;
    totalBalanceDue: number;
}

export async function getBranches(): Promise<Branch[]> {
    const response = await api.get<ApiResponse<Branch[]>>('/branches');
    return response.data.data;
}

export async function getBranchSummary(): Promise<BranchSummary> {
    const response = await api.get<ApiResponse<BranchSummary>>('/branches/summary');
    return response.data.data;
}
```

- [ ] **Step 2: Implement the switcher page**

Create `apps/education-apps/frontend/app/admin/select-branch/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBranches, Branch } from '@/lib/services/branches';
import useAuthStore, { setActiveBranchId } from '@/store/useAuthStore';

export default function SelectBranchPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.role !== 'OWNER') {
            router.push('/admin');
            return;
        }
        getBranches().then((data) => {
            setBranches(data);
            setLoading(false);
        });
    }, [user, router]);

    const handleSelect = (branchId: string) => {
        setActiveBranchId(branchId);
        router.push('/admin');
    };

    if (loading) return <div className="p-6">Chargement…</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-md space-y-4">
                <h1 className="text-xl font-semibold text-slate-900">Choisissez un établissement</h1>
                {branches.length === 0 && (
                    <p className="text-slate-500">Aucun établissement trouvé pour votre école.</p>
                )}
                <div className="space-y-2">
                    {branches.map((branch) => (
                        <button
                            key={branch.id}
                            onClick={() => handleSelect(branch.id)}
                            className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-indigo-400 hover:bg-indigo-50"
                        >
                            <p className="font-medium text-slate-900">{branch.name}</p>
                            <p className="text-sm text-slate-500">{branch.city}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/education-apps/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/education-apps/frontend/lib/services/branches.ts apps/education-apps/frontend/app/admin/select-branch
git commit -m "feat(frontend): add branch switcher page for OWNER"
```

---

## Task 10: Login redirect and admin layout allow OWNER

**Files:**
- Modify: `apps/education-apps/frontend/app/login/page.tsx`
- Modify: `apps/education-apps/frontend/app/admin/layout.tsx`

- [ ] **Step 1: Update the login redirect**

In `apps/education-apps/frontend/app/login/page.tsx`, change the post-login redirect logic:
```ts
        const user = useAuthStore.getState().user;
        if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') router.push('/admin');
        else if (user?.role === 'SECRETARY') router.push('/secretary');
        else router.push('/');
```
to:
```ts
        const user = useAuthStore.getState().user;
        if (user?.role === 'OWNER') router.push('/admin/select-branch');
        else if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') router.push('/admin');
        else if (user?.role === 'SECRETARY') router.push('/secretary');
        else router.push('/');
```

- [ ] **Step 2: Allow OWNER into the admin layout**

In `apps/education-apps/frontend/app/admin/layout.tsx`, change:
```tsx
<RequireRole allowedRoles={['ADMIN']}>
```
to:
```tsx
<RequireRole allowedRoles={['ADMIN', 'OWNER']}>
```

- [ ] **Step 3: Also update `RequireRole`'s own redirect fallback**

Read `apps/education-apps/frontend/components/auth/RequireRole.tsx`. Its `useEffect` redirects a disallowed user based on their role — add an `OWNER` branch so an `OWNER` landing on a page they're not allowed into (e.g. accidentally hitting `/secretary`) goes somewhere sensible instead of falling through:
```ts
            } else if (user && !allowedRoles.includes(user.role) && user.role !== 'SUPER_ADMIN') {
                // Redirect to appropriate dashboard
                if (user.role === 'ADMIN') {
                    router.push('/admin');
                } else if (user.role === 'SECRETARY') {
                    router.push('/secretary');
                } else if (user.role === 'OWNER') {
                    router.push('/admin/select-branch');
                }
            }
```

- [ ] **Step 4: Type-check**

Run: `cd apps/education-apps/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual verification**

Boot both servers (pattern from prior work). Confirm `/admin` no longer immediately bounces an `OWNER`-role test account (you can check this via code reading plus a direct API login call if a full browser session isn't practical — confirm the JSON response shape returned by `/api/auth/login` for a seeded `OWNER` test user matches what `RequireRole`/the layout expect).

- [ ] **Step 6: Commit**

```bash
git add apps/education-apps/frontend/app/login/page.tsx apps/education-apps/frontend/app/admin/layout.tsx apps/education-apps/frontend/components/auth/RequireRole.tsx
git commit -m "feat(frontend): route OWNER through branch selection, allow OWNER into admin layout"
```

---

## Task 11: Owner cross-branch summary page

**Files:**
- Create: `apps/education-apps/frontend/app/admin/branches/page.tsx`

- [ ] **Step 1: Implement the page**

Before writing this, read `apps/education-apps/frontend/app/admin/students/[id]/page.tsx` for the established Tailwind/dark-mode conventions in this admin section.

Create `apps/education-apps/frontend/app/admin/branches/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getBranchSummary, BranchSummary } from '@/lib/services/branches';
import { setActiveBranchId } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';

export default function BranchesSummaryPage() {
    const router = useRouter();
    const [summary, setSummary] = useState<BranchSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getBranchSummary().then((data) => {
            setSummary(data);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="p-6">Chargement…</div>;
    if (!summary) return <div className="p-6">Aucune donnée</div>;

    const handleOpenBranch = (branchId: string) => {
        setActiveBranchId(branchId);
        router.push('/admin');
    };

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Vue d'ensemble — tous les établissements</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {summary.totalStudents} élèves au total — solde dû combiné: {summary.totalBalanceDue} MAD
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {summary.branches.map(({ branch, studentCount, presentToday, balanceDue }) => (
                    <button
                        key={branch.id}
                        onClick={() => handleOpenBranch(branch.id)}
                        className="rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
                    >
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{branch.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{branch.city}</p>
                        <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                            <p>Élèves: {studentCount}</p>
                            <p>Présents aujourd'hui: {presentToday}</p>
                            <p>Solde dû: {balanceDue} MAD</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/education-apps/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/education-apps/frontend/app/admin/branches
git commit -m "feat(frontend): add owner cross-branch summary dashboard"
```

---

## Task 12: End-to-end manual QA pass

**Files:** none (verification only)

- [ ] **Step 1: Full signup → branch-switch → scoped-data happy path**

With both servers running (backend `.env` pointed at a real dev database):
1. `POST /api/schools/signup` with two different owner emails — creates two separate schools/branches/owners.
2. Log in as the first owner (`POST /api/auth/login`) — confirm the JWT-derived user has `schoolId` set and `role: OWNER`.
3. `GET /api/branches` with that owner's token — confirm only their one branch is returned (not the second school's branch).
4. Create a student via `POST /api/students` with header `X-Branch-Id: <owner 1's branch id>` — confirm success and the student's `branchId` matches.
5. Attempt `GET /api/students` with header `X-Branch-Id: <owner 2's branch id>` using **owner 1's token** — confirm `403` (cross-school branch access correctly rejected by `tenantScopeMiddleware`).
6. `GET /api/students` with the correct `X-Branch-Id` for owner 1 — confirm the created student appears.
7. `GET /api/branches/summary` for owner 1 — confirm `totalStudents` reflects the one student created in step 4.

- [ ] **Step 2: ADMIN/SECRETARY still work unaffected**

If a seed script or existing dev account creates an `ADMIN`/`SECRETARY` user (check `apps/education-apps/scripts/`), confirm their `branchId` is `null` (since they predate this feature) and that hitting `GET /api/students` now correctly returns `403` "User has no assigned branch" rather than silently working — this confirms the middleware is genuinely enforced, not bypassed for legacy accounts. Note this finding; assigning `branchId` to any pre-existing dev/test accounts is a one-off manual data fix, not a task in this plan (no production accounts exist yet per the spec's stated assumption).

- [ ] **Step 3: Clean up**

Delete the two throwaway schools/branches/students/owners created during this QA pass (direct Prisma script is fine, same pattern used in prior QA passes in this codebase).

- [ ] **Step 4: Report results**

Note any failures precisely (endpoint, request, actual vs. expected). Do not silently patch and re-claim success without re-running the specific failing step.

---

## Self-Review Summary

- **Spec coverage**: `School`/`Branch` models + `SchoolStatus` (Task 1), `OWNER` role + JWT/middleware scoping (Tasks 1-3), Students as the fully-retrofitted reference module (Task 4), self-serve signup with deferred billing (`status: PENDING`, no payment fields) (Task 5), owner cross-branch summary endpoint (Task 6), branch switcher UI (Tasks 9-10), resilience notes are process/ops guidance for deployment, not code — correctly not turned into a task. All spec sections covered except the explicitly-deferred module rollout (documented as a follow-up plan) and `SUPER_ADMIN` UI (explicitly out of scope).
- **Type consistency**: `TenantRequest.branchId` (Task 3) is the same field name used throughout Task 4's controller (`req.branchId!`). `JwtPayload`'s `schoolId`/`branchId` (Task 2) match `AuthRequest.user`'s shape (Task 2) and what Tasks 5/6's controllers read (`req.user!.schoolId`). Frontend `Branch`/`BranchSummary` types (Task 9) match the backend `branches.service.ts` response shape (Task 6) field-for-field.
- **No backfill**: confirmed as an explicit assumption (no production data exists); Task 12 explicitly surfaces what happens to any pre-existing dev/test accounts without a `branchId` rather than silently working around it.
