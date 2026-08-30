# Education Multi-Tenancy Module Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit the 10 remaining tenant-scoped modules in `apps/education-apps` — `Group`, `Teacher`, `Inscription`, `Payment`, `Transaction`, `Pricing`, `Attendance`, `AttendanceNotification`, `Formation`, `Settings` — to the same enforced `branchId` scoping pattern `Student` already uses, in dependency order, with cross-module foreign keys validated for branch match.

**Architecture:** Each module's routes gain `tenantScopeMiddleware` (and `'OWNER'` added to `roleMiddleware`, matching `Student`); each service function is scoped by `branchId`; each model's `branchId` is tightened from optional to required in the Prisma schema as its task runs. Two modules (`Group`, `Teacher`) currently have **no auth middleware at all** on their routes — this plan adds it as a prerequisite for `tenantScopeMiddleware` to have a `req.user` to read. Any foreign key from a retrofitted model to another tenant-scoped model (e.g. `Group.teacherId`, `Attendance.studentId`) is validated to belong to the same `branchId` before being accepted — for two cases (`Group.teacherId`, `Group.formationId`) the referenced model isn't retrofitted yet when `Group` is done, so that specific validation is added later, during the referenced model's own task, as a small revisit to `groups.service.ts`. Three internal (non-HTTP) call chains also need updating as their target model's `branchId` becomes required: `inscriptions.service.ts` → `createPayment`, `payments.service.ts`/`salary-payments.service.ts` → `createTransaction`, and `attendance.service.ts`/`absence-job.ts` → `sendAttendanceNotification`.

**Tech Stack:** Express + Prisma (MongoDB) + TypeScript backend, Jest.

**Spec:** `docs/superpowers/specs/2026-08-30-education-multi-tenancy-module-rollout-design.md`

---

## Notes on scope decisions

- `Parent` is out of scope (no `branchId` field, not added by this plan — see spec's Non-Goals).
- No production data exists — every model's `branchId` goes straight to `required`, no migration step needed.
- Analytics/aggregate endpoints that summarize *across* the whole dataset (`getStudentAnalytics` pattern from the foundation plan) are intentionally left unscoped in this plan too, **except** where the aggregate lives inside a module being retrofitted and reads a field this plan is tightening to required — those are called out per-task below. Endpoints not mentioned in a task are unchanged.
- `pricing.service.ts`'s `getPriceForSubject` function has zero call sites anywhere in the codebase (confirmed via `grep -rn "getPriceForSubject" src/`) — it is not modified by this plan (nothing to break; adding branch-scoping to genuinely dead code is not useful work).
- `formations.controller.ts` currently has no service layer and instantiates its own `new PrismaClient()` instead of using the shared `prisma` from `config/database` — this plan extracts a `formations.service.ts` (needed to unit-test branch scoping the same way every other module does) and switches it to the shared client (needed so `jest.mock('../../config/database')` can intercept its calls, the same mechanism every other test in this codebase relies on).

---

## Task 1: Group — branchId scoping (+ add missing auth)

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/groups/groups.service.ts`
- Modify: `apps/education-apps/src/modules/groups/groups.controller.ts`
- Modify: `apps/education-apps/src/modules/groups/groups.routes.ts`
- Test: `apps/education-apps/src/modules/groups/groups.service.test.ts` (new)

`groups.routes.ts` currently has **no `authMiddleware` at all** — anyone can hit `/api/groups` unauthenticated today. This task fixes that as part of wiring in `tenantScopeMiddleware` (which needs `req.user` to already be set).

- [ ] **Step 1: Tighten `Group.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, change (around line 191-194):
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```
(This is inside the `Group` model, right before `@@map("groups")`.)

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors (no existing `Group` rows in dev to conflict with the new required field).

- [ ] **Step 3: Write the failing tests**

Create `apps/education-apps/src/modules/groups/groups.service.test.ts`:

```ts
import prisma from '../../config/database';
import { createGroup, getAllGroups, getGroupById, updateGroup } from './groups.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        group: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
        student: { findMany: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createGroup stamps branchId from the given value and rejects students outside that branch', async () => {
        (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 's1', branchId: 'b1' }]);
        (prisma.group.create as jest.Mock).mockResolvedValue({ id: 'g1', branchId: 'b1' });

        await createGroup({ name: 'G1', type: 'SOUTIEN', studentIds: ['s1'], branchId: 'b1' } as any);

        expect(prisma.group.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('createGroup throws when a given studentId belongs to a different branch', async () => {
        (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 's1', branchId: 'b1' }]);

        await expect(
            createGroup({ name: 'G1', type: 'SOUTIEN', studentIds: ['s1', 's2'], branchId: 'b1' } as any)
        ).rejects.toThrow('One or more students do not belong to this branch');
    });

    it('getAllGroups only returns groups in the given branch', async () => {
        (prisma.group.findMany as jest.Mock).mockResolvedValue([]);

        await getAllGroups('b1');

        expect(prisma.group.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getGroupById throws for a group outside the given branch', async () => {
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({ id: 'g1', branchId: 'other-branch' });

        await expect(getGroupById('g1', 'b1')).rejects.toThrow('Group not found');
    });

    it('updateGroup validates new studentIds belong to the group\'s branch', async () => {
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({ id: 'g1', branchId: 'b1' });
        (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 's1', branchId: 'b1' }]);
        (prisma.group.update as jest.Mock).mockResolvedValue({ id: 'g1', branchId: 'b1' });

        await updateGroup('g1', 'b1', { studentIds: ['s1'] });

        expect(prisma.group.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'g1' } })
        );
    });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- groups.service`
Expected: FAIL — `createGroup`/`getAllGroups`/`getGroupById`/`updateGroup` don't yet take/use a `branchId`.

- [ ] **Step 5: Update the service**

Replace `apps/education-apps/src/modules/groups/groups.service.ts` in full:

```ts
import prisma from '../../config/database';
import { InscriptionType, Prisma } from '@prisma/client';

export interface CreateGroupData {
    name: string;
    type: InscriptionType;
    branchId: string;
    level?: string;
    subject?: string;
    formationId?: string;
    teacherId?: string;
    room?: string;
    whatsappUrl?: string;
    studentIds?: string[];
    timeSlots?: any;
}

export interface UpdateGroupData {
    name?: string;
    level?: string;
    subject?: string;
    formationId?: string;
    teacherId?: string;
    room?: string;
    whatsappUrl?: string;
    studentIds?: string[];
    timeSlots?: any;
}

const assertStudentsInBranch = async (studentIds: string[] | undefined, branchId: string) => {
    if (!studentIds || studentIds.length === 0) return;

    const students = await prisma.student.findMany({ where: { id: { in: studentIds } } });
    const allInBranch = students.length === studentIds.length && students.every((s) => s.branchId === branchId);

    if (!allInBranch) {
        throw new Error('One or more students do not belong to this branch');
    }
};

export const createGroup = async (data: CreateGroupData) => {
    if (data.type === 'FORMATION' && !data.formationId) {
        throw new Error('Formation Group requires a formationId');
    }

    await assertStudentsInBranch(data.studentIds, data.branchId);

    return await prisma.group.create({
        data: {
            name: data.name,
            type: data.type,
            branchId: data.branchId,
            level: data.level,
            subject: data.subject,
            formationId: data.formationId || undefined,
            teacherId: data.teacherId || undefined,
            room: data.room,
            whatsappUrl: data.whatsappUrl,
            timeSlots: data.timeSlots,
            students: {
                connect: data.studentIds?.map(id => ({ id })) || []
            }
        },
        include: {
            teacher: true,
            students: true,
            formation: true
        }
    });
};

export const getAllGroups = async (branchId: string, type?: InscriptionType) => {
    const where: Prisma.GroupWhereInput = { branchId };
    if (type) {
        where.type = type;
    }

    return await prisma.group.findMany({
        where,
        include: {
            teacher: true,
            students: true,
            formation: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
};

export const getGroupById = async (id: string, branchId: string) => {
    const group = await prisma.group.findUnique({
        where: { id },
        include: {
            teacher: true,
            students: true,
            formation: true
        }
    });

    if (!group || group.branchId !== branchId) throw new Error('Group not found');
    return group;
};

export const updateGroup = async (id: string, branchId: string, data: UpdateGroupData) => {
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing || existing.branchId !== branchId) throw new Error('Group not found');

    await assertStudentsInBranch(data.studentIds, branchId);

    return await prisma.group.update({
        where: { id },
        data: {
            ...data,
            formationId: data.formationId || undefined,
            teacherId: data.teacherId || undefined,
            students: data.studentIds ? {
                set: data.studentIds.map(sid => ({ id: sid }))
            } : undefined
        },
        include: {
            teacher: true,
            students: true,
            formation: true
        }
    });
};

export const deleteGroup = async (id: string, branchId: string) => {
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing || existing.branchId !== branchId) throw new Error('Group not found');

    return await prisma.group.delete({
        where: { id }
    });
};
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- groups.service`
Expected: all passing.

- [ ] **Step 7: Update the controller**

Replace `apps/education-apps/src/modules/groups/groups.controller.ts` in full:

```ts
import { Response } from 'express';
import * as groupsService from './groups.service';
import { sendSuccess, sendError } from '../../utils/response';
import { InscriptionType } from '@prisma/client';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const createGroup = async (req: TenantRequest, res: Response) => {
    try {
        const group = await groupsService.createGroup({ ...req.body, branchId: req.branchId! });
        sendSuccess(res, group, 'Group created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create group', 400);
    }
};

export const getAllGroups = async (req: TenantRequest, res: Response) => {
    try {
        const { type } = req.query;
        const groups = await groupsService.getAllGroups(req.branchId!, type as InscriptionType);
        sendSuccess(res, groups, 'Groups retrieved successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve groups');
    }
};

export const getGroupById = async (req: TenantRequest, res: Response) => {
    try {
        const group = await groupsService.getGroupById(req.params.id, req.branchId!);
        sendSuccess(res, group, 'Group details retrieved successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Group not found', 404);
    }
};

export const updateGroup = async (req: TenantRequest, res: Response) => {
    try {
        const group = await groupsService.updateGroup(req.params.id, req.branchId!, req.body);
        sendSuccess(res, group, 'Group updated successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update group', 400);
    }
};

export const deleteGroup = async (req: TenantRequest, res: Response) => {
    try {
        await groupsService.deleteGroup(req.params.id, req.branchId!);
        sendSuccess(res, null, 'Group deleted successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete group', 400);
    }
};
```

- [ ] **Step 8: Wire up the routes**

Replace `apps/education-apps/src/modules/groups/groups.routes.ts` in full:

```ts
import { Router } from 'express';
import * as groupsController from './groups.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.post('/', groupsController.createGroup);
router.get('/', groupsController.getAllGroups);
router.get('/:id', groupsController.getGroupById);
router.put('/:id', groupsController.updateGroup);
router.delete('/:id', groupsController.deleteGroup);

export default router;
```

- [ ] **Step 9: Run the full suite and typecheck**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

- [ ] **Step 10: Commit**

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/groups
git commit -m "feat(groups): retrofit branch scoping, add missing auth middleware"
```

---

## Task 2: Teacher — branchId scoping (+ add missing auth, + revisit Group.teacherId)

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/teachers/teachers.service.ts`
- Modify: `apps/education-apps/src/modules/teachers/teachers.controller.ts`
- Modify: `apps/education-apps/src/modules/teachers/teachers.routes.ts`
- Modify: `apps/education-apps/src/modules/groups/groups.service.ts` (add `teacherId` cross-branch validation, deferred from Task 1)
- Modify: `apps/education-apps/src/modules/groups/groups.service.test.ts`
- Test: `apps/education-apps/src/modules/teachers/teachers.service.test.ts` (new)

`teachers.routes.ts` also currently has **no `authMiddleware`** — fixed here the same way as Task 1.

`calculateMonthlyTeacherExpenses` is an aggregate used by `payments.service.ts`'s analytics — left unscoped in this task per the "Notes on scope decisions" above (same treatment as `getStudentAnalytics`); it is not touched here.

- [ ] **Step 1: Tighten `Teacher.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, inside the `Teacher` model, change:
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors.

- [ ] **Step 3: Write the failing tests**

Create `apps/education-apps/src/modules/teachers/teachers.service.test.ts`:

```ts
import prisma from '../../config/database';
import { createTeacher, getAllTeachers, updateTeacher, deleteTeacher } from './teachers.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        teacher: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createTeacher stamps branchId from the given value', async () => {
        (prisma.teacher.create as jest.Mock).mockResolvedValue({ id: 't1', branchId: 'b1' });

        await createTeacher({ name: 'Prof A', branchId: 'b1' } as any);

        expect(prisma.teacher.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAllTeachers only returns teachers in the given branch', async () => {
        (prisma.teacher.findMany as jest.Mock).mockResolvedValue([]);

        await getAllTeachers('b1');

        expect(prisma.teacher.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('updateTeacher throws for a teacher outside the given branch', async () => {
        (prisma.teacher.findUnique as jest.Mock).mockResolvedValue({ id: 't1', branchId: 'other-branch' });

        await expect(updateTeacher('t1', 'b1', { name: 'New Name' })).rejects.toThrow('Teacher not found');
    });

    it('deleteTeacher throws for a teacher outside the given branch', async () => {
        (prisma.teacher.findUnique as jest.Mock).mockResolvedValue({ id: 't1', branchId: 'other-branch' });

        await expect(deleteTeacher('t1', 'b1')).rejects.toThrow('Teacher not found');
    });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- teachers.service`
Expected: FAIL — none of these functions accept/use `branchId` yet.

- [ ] **Step 5: Update the service**

Replace `apps/education-apps/src/modules/teachers/teachers.service.ts` in full:

```ts
import prisma from '../../config/database';

export interface CreateTeacherData {
    name: string;
    branchId: string;
    email?: string;
    phone?: string;
    cin?: string;
    dob?: Date | string;
    gender?: string;
    picture?: string;
    status?: string;
    socialMedia?: any;
    hourlyRate?: number;
    paymentType?: string;
    commission?: number;
    specialties?: string[];
    levels?: string[];
}

export const createTeacher = async (data: CreateTeacherData) => {
    return await prisma.teacher.create({
        data
    });
};

export const getAllTeachers = async (branchId: string) => {
    return await prisma.teacher.findMany({
        where: { branchId },
        orderBy: { name: 'asc' },
        include: {
            _count: {
                select: { groups: true }
            }
        }
    });
};

export const updateTeacher = async (id: string, branchId: string, data: Partial<CreateTeacherData>) => {
    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing || existing.branchId !== branchId) throw new Error('Teacher not found');

    return await prisma.teacher.update({
        where: { id },
        data
    });
};

export const deleteTeacher = async (id: string, branchId: string) => {
    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing || existing.branchId !== branchId) throw new Error('Teacher not found');

    return await prisma.teacher.delete({
        where: { id }
    });
};

export const calculateMonthlyTeacherExpenses = async () => {
    // Aggregate across all branches — intentionally left unscoped, see plan notes.
    const teachers = await prisma.teacher.findMany({
        include: {
            groups: {
                include: {
                    students: true,
                    _count: {
                        select: { students: true }
                    }
                }
            }
        }
    });

    let totalExpenses = 0;

    for (const teacher of teachers) {
        let teacherExpense = 0;

        if (teacher.paymentType === 'FIXED') {
            teacherExpense = teacher.hourlyRate || 0;
        } else if (teacher.paymentType === 'HOURLY') {
            const totalHours = teacher.groups.length * 8;
            teacherExpense = totalHours * (teacher.hourlyRate || 0);
        } else if (teacher.paymentType === 'PERCENTAGE') {
            const totalStudents = teacher.groups.reduce((sum, group) => sum + group._count.students, 0);
            const estimatedRevenue = totalStudents * 500;
            teacherExpense = estimatedRevenue * ((teacher.commission || 0) / 100);
        }

        totalExpenses += teacherExpense;
    }

    return {
        totalTeacherExpenses: totalExpenses,
        teacherCount: teachers.length
    };
};
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- teachers.service`
Expected: all passing.

- [ ] **Step 7: Update the controller**

Replace `apps/education-apps/src/modules/teachers/teachers.controller.ts` in full:

```ts
import { Response } from 'express';
import * as teachersService from './teachers.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const createTeacher = async (req: TenantRequest, res: Response) => {
    try {
        const teacher = await teachersService.createTeacher({ ...req.body, branchId: req.branchId! });
        sendSuccess(res, teacher, 'Teacher created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create teacher', 400);
    }
};

export const getAllTeachers = async (req: TenantRequest, res: Response) => {
    try {
        const teachers = await teachersService.getAllTeachers(req.branchId!);
        sendSuccess(res, teachers, 'Teachers retrieved successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve teachers');
    }
};

export const updateTeacher = async (req: TenantRequest, res: Response) => {
    try {
        const teacher = await teachersService.updateTeacher(req.params.id, req.branchId!, req.body);
        sendSuccess(res, teacher, 'Teacher updated successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update teacher', 400);
    }
};

export const deleteTeacher = async (req: TenantRequest, res: Response) => {
    try {
        await teachersService.deleteTeacher(req.params.id, req.branchId!);
        sendSuccess(res, null, 'Teacher deleted successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete teacher', 400);
    }
};
```

- [ ] **Step 8: Wire up the routes**

Replace `apps/education-apps/src/modules/teachers/teachers.routes.ts` in full:

```ts
import { Router } from 'express';
import * as teachersController from './teachers.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.post('/', teachersController.createTeacher);
router.get('/', teachersController.getAllTeachers);
router.put('/:id', teachersController.updateTeacher);
router.delete('/:id', teachersController.deleteTeacher);

export default router;
```

- [ ] **Step 9: Run the full suite and typecheck**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

- [ ] **Step 10: Commit the Teacher retrofit**

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/teachers
git commit -m "feat(teachers): retrofit branch scoping, add missing auth middleware"
```

- [ ] **Step 11: Revisit Group — write the failing test for teacherId validation**

Add to `apps/education-apps/src/modules/groups/groups.service.test.ts`, inside the existing `describe('branch scoping', ...)` block (extend the `jest.mock('../../config/database', ...)` call's mocked object to also include `teacher: { findUnique: jest.fn() }`, alongside the existing `group`/`student` mocks — merge in, don't duplicate the `jest.mock` call):

```ts
    it('createGroup throws when teacherId belongs to a different branch', async () => {
        (prisma.teacher.findUnique as jest.Mock).mockResolvedValue({ id: 'te1', branchId: 'other-branch' });

        await expect(
            createGroup({ name: 'G1', type: 'SOUTIEN', teacherId: 'te1', branchId: 'b1' } as any)
        ).rejects.toThrow('Teacher does not belong to this branch');
    });
```

- [ ] **Step 12: Run and confirm it fails**

Run: `cd apps/education-apps && npm test -- groups.service`
Expected: FAIL — `createGroup` doesn't validate `teacherId` yet.

- [ ] **Step 13: Add the validation to `groups.service.ts`**

In `apps/education-apps/src/modules/groups/groups.service.ts`, add this helper below `assertStudentsInBranch`:

```ts
const assertTeacherInBranch = async (teacherId: string | undefined, branchId: string) => {
    if (!teacherId) return;

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.branchId !== branchId) {
        throw new Error('Teacher does not belong to this branch');
    }
};
```

Then call it at the top of both `createGroup` and `updateGroup`, right after the existing `assertStudentsInBranch` call:
```ts
    await assertTeacherInBranch(data.teacherId, data.branchId);
```
(In `updateGroup`, use `branchId` — the function's own parameter — as the second argument, same as the existing `assertStudentsInBranch(data.studentIds, branchId)` call there.)

- [ ] **Step 14: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- groups.service`
Expected: all passing.

- [ ] **Step 15: Run the full suite and typecheck, then commit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/src/modules/groups
git commit -m "feat(groups): validate teacherId belongs to the same branch"
```

---

## Task 3: Inscription — branchId scoping

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/inscriptions/inscriptions.service.ts`
- Modify: `apps/education-apps/src/modules/inscriptions/inscriptions.controller.ts`
- Modify: `apps/education-apps/src/modules/inscriptions/inscriptions.routes.ts`
- Test: `apps/education-apps/src/modules/inscriptions/inscriptions.service.test.ts` (new)

`inscriptions.routes.ts` already has `authMiddleware` + `roleMiddleware('ADMIN', 'SECRETARY')` — this task adds `'OWNER'` and `tenantScopeMiddleware`, matching `Student`.

`createInscription` internally calls `createPayment` (auto-recording a payment for the inscription amount) — `payments.service.ts`'s `createPayment` doesn't require a `branchId` yet at this point in the rollout (`Payment` is retrofitted next, in Task 4), so this call is left as-is for now; Task 4 revisits it once `Payment.branchId` becomes required.

`getInscriptionAnalytics` is a dashboard aggregate — left unscoped per the plan's notes (not touched here).

- [ ] **Step 1: Tighten `Inscription.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, inside the `Inscription` model, change:
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors.

- [ ] **Step 3: Write the failing tests**

Create `apps/education-apps/src/modules/inscriptions/inscriptions.service.test.ts`:

```ts
import prisma from '../../config/database';
import { createInscription, getAllInscriptions, getInscriptionById } from './inscriptions.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findUnique: jest.fn() },
        inscription: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    },
}));

jest.mock('../payments/payments.service', () => ({
    createPayment: jest.fn().mockResolvedValue({}),
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createInscription throws when the student belongs to a different branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'other-branch' });

        await expect(
            createInscription({ studentId: 's1', type: 'SOUTIEN', category: 'math', amount: 100, branchId: 'b1' } as any)
        ).rejects.toThrow('Student not found');
    });

    it('createInscription stamps branchId from the given value when the student matches', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.inscription.create as jest.Mock).mockResolvedValue({ id: 'i1', branchId: 'b1' });

        await createInscription({ studentId: 's1', type: 'SOUTIEN', category: 'math', amount: 100, branchId: 'b1' } as any);

        expect(prisma.inscription.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAllInscriptions only returns inscriptions in the given branch', async () => {
        (prisma.inscription.findMany as jest.Mock).mockResolvedValue([]);

        await getAllInscriptions('b1');

        expect(prisma.inscription.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('getInscriptionById throws for an inscription outside the given branch', async () => {
        (prisma.inscription.findUnique as jest.Mock).mockResolvedValue({ id: 'i1', branchId: 'other-branch' });

        await expect(getInscriptionById('i1', 'b1')).rejects.toThrow('Inscription not found');
    });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- inscriptions.service`
Expected: FAIL — none of these functions accept/use `branchId` or validate the student's branch yet.

- [ ] **Step 5: Update the service**

Replace `apps/education-apps/src/modules/inscriptions/inscriptions.service.ts` in full:

```ts
import prisma from '../../config/database';
import { InscriptionType } from '@prisma/client';
import { createPayment } from '../payments/payments.service';

interface CreateInscriptionData {
    studentId: string;
    branchId: string;
    type: InscriptionType;
    category: string;
    amount: number;
    date?: Date;
    note?: string;
}

interface UpdateInscriptionData {
    type?: InscriptionType;
    category?: string;
    amount?: number;
    date?: Date;
    note?: string;
}

const SOUTIEN_CATEGORIES = [
    'math',
    'physique',
    'svt',
    'francais',
    'anglais',
    'calcul_mental',
    'couran',
    'autre',
];

const validateCategory = (type: InscriptionType, category: string): void => {
    if (type === 'SOUTIEN' && !SOUTIEN_CATEGORIES.includes(category)) {
        // Intentionally not enforced — see original implementation notes.
    }
};

export const createInscription = async (data: CreateInscriptionData) => {
    const { studentId, branchId, type, category, amount, date, note } = data;

    validateCategory(type, category);

    const student = await prisma.student.findUnique({
        where: { id: studentId },
    });

    if (!student || student.branchId !== branchId) {
        throw new Error('Student not found');
    }

    const inscription = await prisma.inscription.create({
        data: {
            studentId,
            branchId,
            type,
            category,
            amount,
            date: date || new Date(),
            note,
        },
        include: {
            student: true,
        },
    });

    if (amount > 0) {
        try {
            await createPayment({
                studentId,
                amount,
                method: 'CASH',
                date: date || new Date(),
                note: `Paiement pour inscription: ${type} - ${category}`,
            } as any);
        } catch (error) {
            console.error('Failed to auto-create payment for inscription:', error);
        }
    }

    return inscription;
};

export const getAllInscriptions = async (branchId: string) => {
    const inscriptions = await prisma.inscription.findMany({
        where: { branchId },
        include: {
            student: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return inscriptions;
};

export const getInscriptionById = async (id: string, branchId: string) => {
    const inscription = await prisma.inscription.findUnique({
        where: { id },
        include: {
            student: true,
        },
    });

    if (!inscription || inscription.branchId !== branchId) {
        throw new Error('Inscription not found');
    }

    return inscription;
};

export const updateInscription = async (
    id: string,
    branchId: string,
    data: UpdateInscriptionData
) => {
    const existingInscription = await prisma.inscription.findUnique({
        where: { id },
    });

    if (!existingInscription || existingInscription.branchId !== branchId) {
        throw new Error('Inscription not found');
    }

    const newType = data.type || existingInscription.type;
    const newCategory = data.category || existingInscription.category;
    validateCategory(newType, newCategory);

    const inscription = await prisma.inscription.update({
        where: { id },
        data,
        include: {
            student: true,
        },
    });

    return inscription;
};

export const deleteInscription = async (id: string, branchId: string) => {
    const existingInscription = await prisma.inscription.findUnique({
        where: { id },
    });

    if (!existingInscription || existingInscription.branchId !== branchId) {
        throw new Error('Inscription not found');
    }

    await prisma.inscription.delete({
        where: { id },
    });

    return { message: 'Inscription deleted successfully' };
};

export const getInscriptionAnalytics = async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyInscriptions = await prisma.inscription.findMany({
        where: {
            createdAt: {
                gte: startOfDay,
            },
        },
    });

    const dailyCount = dailyInscriptions.length;
    const dailyTotal = dailyInscriptions.reduce((sum, ins) => sum + ins.amount, 0);
    const dailySoutien = dailyInscriptions.filter(i => i.type === 'SOUTIEN').length;
    const dailyFormation = dailyInscriptions.filter(i => i.type === 'FORMATION').length;

    const monthlyInscriptions = await prisma.inscription.findMany({
        where: {
            createdAt: {
                gte: startOfMonth,
            },
        },
    });

    const monthlyCount = monthlyInscriptions.length;
    const monthlyTotal = monthlyInscriptions.reduce((sum, ins) => sum + ins.amount, 0);
    const monthlySoutien = monthlyInscriptions.filter(i => i.type === 'SOUTIEN').length;
    const monthlyFormation = monthlyInscriptions.filter(i => i.type === 'FORMATION').length;

    return {
        daily: {
            count: dailyCount,
            total: dailyTotal,
            soutien: dailySoutien,
            formation: dailyFormation,
        },
        monthly: {
            count: monthlyCount,
            total: monthlyTotal,
            soutien: monthlySoutien,
            formation: monthlyFormation,
        },
    };
};
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- inscriptions.service`
Expected: all passing.

- [ ] **Step 7: Update the controller**

In `apps/education-apps/src/modules/inscriptions/inscriptions.controller.ts`:

Change the import line:
```ts
import { Request, Response } from 'express';
```
to:
```ts
import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
```

Change every handler's `req: Request` to `req: TenantRequest`, and in `create`, add `branchId: req.branchId!` to `inscriptionData`:
```ts
        const inscriptionData: any = { studentId, type, category, amount, branchId: req.branchId! };
```

In `getAll`, pass the branch through:
```ts
        const inscriptions = await getAllInscriptions(req.branchId!);
```

In `getById`, `update`, and `remove`, thread `req.branchId!` as the second argument to `getInscriptionById`/`updateInscription`/`deleteInscription`, matching their new signatures — e.g.:
```ts
        const inscription = await getInscriptionById(id, req.branchId!);
```
```ts
        const inscription = await updateInscription(id, req.branchId!, updateData);
```
```ts
        const result = await deleteInscription(id, req.branchId!);
```
`getAnalytics` keeps `req: Request` (import it alongside `Response` for that one handler) since `getInscriptionAnalytics` remains unscoped.

- [ ] **Step 8: Wire up the routes**

In `apps/education-apps/src/modules/inscriptions/inscriptions.routes.ts`, add the import:
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

- [ ] **Step 9: Run the full suite and typecheck**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean (fix any remaining `req: Request` vs `TenantRequest` mismatches `tsc` surfaces in `inscriptions.controller.ts`).

- [ ] **Step 10: Commit**

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/inscriptions
git commit -m "feat(inscriptions): retrofit branch scoping"
```

---

## Task 4: Payment — branchId scoping (+ revisit Inscription's auto-payment call)

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/payments/payments.service.ts`
- Modify: `apps/education-apps/src/modules/payments/payments.controller.ts`
- Modify: `apps/education-apps/src/modules/payments/payments.routes.ts`
- Modify: `apps/education-apps/src/modules/inscriptions/inscriptions.service.ts` (pass `branchId` into `createPayment`, deferred from Task 3)
- Modify: `apps/education-apps/src/modules/inscriptions/inscriptions.service.test.ts`
- Test: `apps/education-apps/src/modules/payments/payments.service.test.ts` (new)

`payments.routes.ts` already has `authMiddleware` + `roleMiddleware('ADMIN')` (no `SECRETARY` — unchanged, this plan only adds `OWNER` for tenancy, not new role access). `createPayment` internally calls `createTransaction` — `Transaction.branchId` isn't required yet at this point (Task 5 handles that revisit). `getPaymentAnalytics` is a dashboard aggregate — left unscoped.

- [ ] **Step 1: Tighten `Payment.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, inside the `Payment` model, change:
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors.

- [ ] **Step 3: Write the failing tests**

Create `apps/education-apps/src/modules/payments/payments.service.test.ts`:

```ts
import prisma from '../../config/database';
import { createPayment, getAllPayments, getPaymentById } from './payments.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findUnique: jest.fn() },
        payment: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    },
}));

jest.mock('../transactions/transactions.service', () => ({
    createTransaction: jest.fn().mockResolvedValue({}),
    getMonthlyTransactionStats: jest.fn(),
}));

jest.mock('../teachers/teachers.service', () => ({
    calculateMonthlyTeacherExpenses: jest.fn(),
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createPayment throws when the student belongs to a different branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'other-branch' });

        await expect(
            createPayment({ studentId: 's1', amount: 100, method: 'CASH', branchId: 'b1' } as any)
        ).rejects.toThrow('Student not found');
    });

    it('createPayment stamps branchId from the given value when the student matches', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1', name: 'A', surname: 'B' });
        (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });

        await createPayment({ studentId: 's1', amount: 100, method: 'CASH', branchId: 'b1' } as any);

        expect(prisma.payment.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAllPayments only returns payments in the given branch', async () => {
        (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

        await getAllPayments('b1');

        expect(prisma.payment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('getPaymentById throws for a payment outside the given branch', async () => {
        (prisma.payment.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'other-branch' });

        await expect(getPaymentById('p1', 'b1')).rejects.toThrow('Payment not found');
    });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- payments.service`
Expected: FAIL — none of these functions accept/use `branchId` or validate the student's branch yet.

- [ ] **Step 5: Update the service**

Replace `apps/education-apps/src/modules/payments/payments.service.ts` in full:

```ts
import prisma from '../../config/database';
import { createTransaction, getMonthlyTransactionStats } from '../transactions/transactions.service';
import { calculateMonthlyTeacherExpenses } from '../teachers/teachers.service';

interface CreatePaymentData {
    studentId: string;
    branchId: string;
    amount: number;
    method: string;
    note?: string;
    date?: Date;
}

export const createPayment = async (data: CreatePaymentData) => {
    const { studentId, branchId, amount, method, note, date } = data;

    const student = await prisma.student.findUnique({
        where: { id: studentId },
    });

    if (!student || student.branchId !== branchId) {
        throw new Error('Student not found');
    }

    const payment = await prisma.payment.create({
        data: {
            studentId,
            branchId,
            amount,
            method,
            note,
            date: date || new Date(),
        },
        include: {
            student: true,
        },
    });

    await createTransaction({
        type: 'INCOME',
        amount: amount,
        category: 'Paiement Scolarité',
        description: `Paiement de ${student.name} ${student.surname} (${method})`,
        date: date || new Date(),
    } as any);

    return payment;
};

export const getAllPayments = async (branchId: string) => {
    const payments = await prisma.payment.findMany({
        where: { branchId },
        include: {
            student: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return payments;
};

export const getPaymentById = async (id: string, branchId: string) => {
    const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
            student: true,
        },
    });

    if (!payment || payment.branchId !== branchId) {
        throw new Error('Payment not found');
    }

    return payment;
};

export const getPaymentAnalytics = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const paymentsThisMonth = await prisma.payment.aggregate({
        where: {
            date: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        },
        _sum: {
            amount: true
        }
    });

    const totalReceived = paymentsThisMonth._sum.amount || 0;

    const transactionStats = await getMonthlyTransactionStats();
    const teacherExpenses = await calculateMonthlyTeacherExpenses();
    const totalExpenses = transactionStats.totalExpense;

    return {
        totalReceivedMonth: totalReceived,
        totalExpenses: totalExpenses,
        totalIncome: transactionStats.totalIncome,
        teacherExpenses: teacherExpenses.totalTeacherExpenses,
        otherExpenses: transactionStats.totalExpense
    };
};
```
(The `console.log` debug lines from the original `getPaymentAnalytics` are dropped as incidental cleanup while rewriting this function — not a behavior change.)

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- payments.service`
Expected: all passing.

- [ ] **Step 7: Update the controller**

Replace `apps/education-apps/src/modules/payments/payments.controller.ts` in full:

```ts
import { Request, Response } from 'express';
import {
    createPayment,
    getAllPayments,
    getPaymentById,
    getPaymentAnalytics,
} from './payments.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const create = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { studentId, amount, method, note, date } = req.body;

        if (!studentId || amount === undefined || !method) {
            sendError(
                res,
                'StudentId, amount, and method are required',
                'Validation error',
                400
            );
            return;
        }

        const paymentData: any = { studentId, amount, method, branchId: req.branchId! };
        if (note) paymentData.note = note;
        if (date) paymentData.date = new Date(date);

        const payment = await createPayment(paymentData);

        sendSuccess(res, payment, 'Payment created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create payment', 400);
    }
};

export const getAll = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const payments = await getAllPayments(req.branchId!);
        sendSuccess(res, payments, 'Payments retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve payments', 500);
    }
};

export const getById = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const payment = await getPaymentById(id, req.branchId!);
        sendSuccess(res, payment, 'Payment retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve payment', 404);
    }
};

export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const analytics = await getPaymentAnalytics();
        sendSuccess(res, analytics, 'Payment analytics retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve payment analytics', 500);
    }
};
```

- [ ] **Step 8: Wire up the routes**

In `apps/education-apps/src/modules/payments/payments.routes.ts`, add the import:
```ts
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
```
Change:
```ts
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN')); // Ensure this line exists as viewed
```
to:
```ts
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'OWNER'));
router.use(tenantScopeMiddleware);
```
(The `/salary` route on this same router now also runs through `tenantScopeMiddleware` — `req.branchId` will be available to it once Task 5 updates `salary-payments.service.ts` to use it; no change to `salary-payments.controller.ts` in this task.)

- [ ] **Step 9: Run the full suite and typecheck**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

- [ ] **Step 10: Commit the Payment retrofit**

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/payments
git commit -m "feat(payments): retrofit branch scoping"
```

- [ ] **Step 11: Revisit Inscription — write the failing test for the branchId pass-through**

In `apps/education-apps/src/modules/inscriptions/inscriptions.service.test.ts`, replace the existing `jest.mock('../payments/payments.service', ...)` block with one that captures the call:
```ts
jest.mock('../payments/payments.service', () => ({
    createPayment: jest.fn().mockResolvedValue({}),
}));
```
(unchanged — already present from Task 3) and add this test inside the `describe('branch scoping', ...)` block:
```ts
    it('passes branchId through to the auto-created payment', async () => {
        const { createPayment } = require('../payments/payments.service');
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.inscription.create as jest.Mock).mockResolvedValue({ id: 'i1', branchId: 'b1' });

        await createInscription({ studentId: 's1', type: 'SOUTIEN', category: 'math', amount: 100, branchId: 'b1' } as any);

        expect(createPayment).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'b1' }));
    });
```

- [ ] **Step 12: Run and confirm it fails**

Run: `cd apps/education-apps && npm test -- inscriptions.service`
Expected: FAIL — the current `createPayment` call in `inscriptions.service.ts` doesn't pass `branchId`.

- [ ] **Step 13: Fix the call site**

In `apps/education-apps/src/modules/inscriptions/inscriptions.service.ts`, inside `createInscription`, change:
```ts
            await createPayment({
                studentId,
                amount,
                method: 'CASH',
                date: date || new Date(),
                note: `Paiement pour inscription: ${type} - ${category}`,
            } as any);
```
to:
```ts
            await createPayment({
                studentId,
                branchId,
                amount,
                method: 'CASH',
                date: date || new Date(),
                note: `Paiement pour inscription: ${type} - ${category}`,
            } as any);
```

- [ ] **Step 14: Run the tests and confirm they pass, then typecheck and commit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/src/modules/inscriptions
git commit -m "feat(inscriptions): pass branchId through to the auto-created payment"
```

---

## Task 5: Transaction — branchId scoping (+ revisit Payment and salary-payments call sites)

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/transactions/transactions.service.ts`
- Modify: `apps/education-apps/src/modules/transactions/transactions.controller.ts`
- Modify: `apps/education-apps/src/modules/transactions/transactions.routes.ts`
- Modify: `apps/education-apps/src/modules/payments/payments.service.ts` (pass `branchId` into `createTransaction`, deferred from Task 4)
- Modify: `apps/education-apps/src/modules/payments/payments.service.test.ts`
- Modify: `apps/education-apps/src/modules/payments/salary-payments.service.ts`
- Modify: `apps/education-apps/src/modules/payments/salary-payments.controller.ts`
- Test: `apps/education-apps/src/modules/transactions/transactions.service.test.ts` (new)

`getMonthlyTransactionStats` is used by `payments.service.ts`'s analytics — left unscoped (dashboard aggregate, per plan notes).

- [ ] **Step 1: Tighten `Transaction.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, inside the `Transaction` model, change:
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors.

- [ ] **Step 3: Write the failing tests**

Create `apps/education-apps/src/modules/transactions/transactions.service.test.ts`:

```ts
import prisma from '../../config/database';
import { createTransaction, getAllTransactions, getTransactionStats, deleteTransaction } from './transactions.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        transaction: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createTransaction stamps branchId from the given value', async () => {
        (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: 'tx1', branchId: 'b1' });

        await createTransaction({ type: 'INCOME', amount: 100, category: 'Test', branchId: 'b1' } as any);

        expect(prisma.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAllTransactions only returns transactions in the given branch', async () => {
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

        await getAllTransactions('b1');

        expect(prisma.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('getTransactionStats only aggregates transactions in the given branch', async () => {
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
            { type: 'INCOME', amount: 100 },
            { type: 'EXPENSE', amount: 40 },
        ]);

        const result = await getTransactionStats('b1');

        expect(prisma.transaction.findMany).toHaveBeenCalledWith({ where: { branchId: 'b1' } });
        expect(result).toEqual({ totalIncome: 100, totalExpense: 40, balance: 60 });
    });

    it('deleteTransaction throws for a transaction outside the given branch', async () => {
        (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({ id: 'tx1', branchId: 'other-branch' });

        await expect(deleteTransaction('tx1', 'b1')).rejects.toThrow('Transaction not found');
    });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- transactions.service`
Expected: FAIL — none of these functions accept/use `branchId` yet, and `deleteTransaction` doesn't check ownership before deleting.

- [ ] **Step 5: Update the service**

Replace `apps/education-apps/src/modules/transactions/transactions.service.ts` in full:

```ts
import prisma from '../../config/database';
import { TransactionType } from '@prisma/client';

interface CreateTransactionData {
    type: TransactionType;
    amount: number;
    category: string;
    branchId: string;
    description?: string;
    date?: Date;
}

export const createTransaction = async (data: CreateTransactionData) => {
    const { type, amount, category, branchId, description, date } = data;

    const transaction = await prisma.transaction.create({
        data: {
            type,
            amount,
            category,
            branchId,
            description,
            date: date || new Date(),
        },
    });

    return transaction;
};

export const getAllTransactions = async (branchId: string) => {
    const transactions = await prisma.transaction.findMany({
        where: { branchId },
        orderBy: {
            date: 'desc',
        },
    });

    return transactions;
};

export const getTransactionStats = async (branchId: string) => {
    const transactions = await prisma.transaction.findMany({ where: { branchId } });

    const totalIncome = transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    return {
        totalIncome,
        totalExpense,
        balance,
    };
};

export const getMonthlyTransactionStats = async () => {
    // Aggregate across all branches — intentionally left unscoped, see plan notes.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
        where: {
            date: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        }
    });

    const totalIncome = transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    return {
        totalIncome,
        totalExpense,
        balance,
    };
};

export const deleteTransaction = async (id: string, branchId: string) => {
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.branchId !== branchId) {
        throw new Error('Transaction not found');
    }

    await prisma.transaction.delete({
        where: { id },
    });
    return { message: 'Transaction deleted successfully' };
};
```
(The `console.log` debug lines from the original `getMonthlyTransactionStats`/controller are dropped as incidental cleanup — not a behavior change. `deleteTransaction` previously deleted by `id` alone with no existence/ownership check at all; this is now fixed as part of branch-scoping it.)

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- transactions.service`
Expected: all passing.

- [ ] **Step 7: Update the controller**

Replace `apps/education-apps/src/modules/transactions/transactions.controller.ts` in full:

```ts
import { Response } from 'express';
import {
    createTransaction,
    getAllTransactions,
    getTransactionStats,
    deleteTransaction,
} from './transactions.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const create = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { type, amount, category, description, date } = req.body;

        if (!type || !amount || !category) {
            sendError(res, 'Type, amount, and category are required', 'Validation error', 400);
            return;
        }

        const transaction = await createTransaction({
            type,
            amount: parseFloat(amount),
            category,
            branchId: req.branchId!,
            description,
            date: date ? new Date(date) : undefined,
        });

        sendSuccess(res, transaction, 'Transaction created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create transaction', 400);
    }
};

export const getAll = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const transactions = await getAllTransactions(req.branchId!);
        sendSuccess(res, transactions, 'Transactions retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve transactions', 500);
    }
};

export const getStats = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const stats = await getTransactionStats(req.branchId!);
        sendSuccess(res, stats, 'Transaction stats retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve stats', 500);
    }
};

export const remove = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await deleteTransaction(id, req.branchId!);
        sendSuccess(res, result, 'Transaction deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete transaction', 400);
    }
};
```

- [ ] **Step 8: Wire up the routes**

In `apps/education-apps/src/modules/transactions/transactions.routes.ts`, add the import:
```ts
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
```
Change:
```ts
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));
```
to:
```ts
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'OWNER'));
router.use(tenantScopeMiddleware);
```

- [ ] **Step 9: Run the full suite and typecheck, then commit the Transaction retrofit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/transactions
git commit -m "feat(transactions): retrofit branch scoping"
```

- [ ] **Step 10: Revisit Payment — write the failing test for the branchId pass-through**

Add to `apps/education-apps/src/modules/payments/payments.service.test.ts`, inside the existing `describe('branch scoping', ...)` block:
```ts
    it('passes branchId through to the auto-created INCOME transaction', async () => {
        const { createTransaction } = require('../transactions/transactions.service');
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1', name: 'A', surname: 'B' });
        (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });

        await createPayment({ studentId: 's1', amount: 100, method: 'CASH', branchId: 'b1' } as any);

        expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'b1' }));
    });
```

- [ ] **Step 11: Run and confirm it fails**

Run: `cd apps/education-apps && npm test -- payments.service`
Expected: FAIL — the current `createTransaction` call in `payments.service.ts` doesn't pass `branchId`.

- [ ] **Step 12: Fix the call site**

In `apps/education-apps/src/modules/payments/payments.service.ts`, inside `createPayment`, change:
```ts
    await createTransaction({
        type: 'INCOME',
        amount: amount,
        category: 'Paiement Scolarité',
        description: `Paiement de ${student.name} ${student.surname} (${method})`,
        date: date || new Date(),
    } as any);
```
to:
```ts
    await createTransaction({
        type: 'INCOME',
        amount: amount,
        category: 'Paiement Scolarité',
        branchId,
        description: `Paiement de ${student.name} ${student.surname} (${method})`,
        date: date || new Date(),
    });
```
(The `as any` cast can be dropped now that `CreateTransactionData` and this call agree on shape.)

- [ ] **Step 13: Run the tests and confirm they pass, then typecheck and commit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/src/modules/payments
git commit -m "feat(payments): pass branchId through to the auto-created transaction"
```

- [ ] **Step 14: Revisit salary-payments — add branchId to the request chain**

Replace `apps/education-apps/src/modules/payments/salary-payments.service.ts` in full:

```ts
import prisma from '../../config/database';
import { createTransaction } from '../transactions/transactions.service';

interface CreateSalaryData {
    personnelId: string;
    personnelType: 'TEACHER' | 'SECRETARY';
    amount: number;
    month: string;
    branchId: string;
    method?: string;
    note?: string;
    date?: Date;
}

export const createSalaryPayment = async (data: CreateSalaryData) => {
    const { personnelId, personnelType, amount, month, branchId, date } = data;

    let personnelName = '';
    if (personnelType === 'TEACHER') {
        const teacher = await prisma.teacher.findUnique({ where: { id: personnelId } });
        if (!teacher || teacher.branchId !== branchId) throw new Error('Teacher not found');
        personnelName = teacher.name;
    } else {
        const user = await prisma.user.findUnique({ where: { id: personnelId } });
        if (!user || user.branchId !== branchId) throw new Error('User not found');
        personnelName = user.name;
    }

    const transaction = await createTransaction({
        type: 'EXPENSE',
        amount: amount,
        category: 'Salaire',
        branchId,
        description: `Salaire ${personnelType === 'TEACHER' ? 'Prof' : 'Secrétaire'}: ${personnelName} (${month})`,
        date: date || new Date(),
    });

    return transaction;
};
```

Replace `apps/education-apps/src/modules/payments/salary-payments.controller.ts` in full:

```ts
import { Response } from 'express';
import { createSalaryPayment } from './salary-payments.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const createSalary = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const result = await createSalaryPayment({ ...req.body, branchId: req.branchId! });
        sendSuccess(res, result, 'Salary payment recorded successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to record salary payment', 400);
    }
};
```
(No route change needed — `POST /api/payments/salary` already runs through `tenantScopeMiddleware` since Task 4 applied it to the whole `payments.routes.ts` router.)

- [ ] **Step 15: Run the full suite and typecheck, then commit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/src/modules/payments
git commit -m "feat(payments): branch-scope salary payments"
```

---

## Task 6: Pricing — branchId scoping

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/pricing/pricing.service.ts`
- Modify: `apps/education-apps/src/modules/pricing/pricing.controller.ts`
- Modify: `apps/education-apps/src/modules/pricing/pricing.routes.ts`
- Test: `apps/education-apps/src/modules/pricing/pricing.service.test.ts` (new)

No cross-references to other tenant-scoped models. `getPriceForSubject` has no call sites anywhere (confirmed via `grep -rn "getPriceForSubject" src/`) — left untouched per plan notes.

- [ ] **Step 1: Tighten `Pricing.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, inside the `Pricing` model, change:
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors.

- [ ] **Step 3: Write the failing tests**

Create `apps/education-apps/src/modules/pricing/pricing.service.test.ts`:

```ts
import prisma from '../../config/database';
import { getAllPricing, getPricingByCategory, createPricing, updatePricing, deletePricing } from './pricing.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        pricing: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('getAllPricing filters by branchId', async () => {
        (prisma.pricing.findMany as jest.Mock).mockResolvedValue([]);

        await getAllPricing('b1');

        expect(prisma.pricing.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ branchId: 'b1', active: true }) })
        );
    });

    it('getPricingByCategory filters by branchId', async () => {
        (prisma.pricing.findMany as jest.Mock).mockResolvedValue([]);

        await getPricingByCategory('SOUTIEN', 'b1');

        expect(prisma.pricing.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ category: 'SOUTIEN', branchId: 'b1', active: true }) })
        );
    });

    it('createPricing stamps branchId from the given value', async () => {
        (prisma.pricing.create as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });

        await createPricing({ category: 'SOUTIEN', level: 'LYCEE', subject: 'MATHS', price: 100, branchId: 'b1' } as any);

        expect(prisma.pricing.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('updatePricing throws for a pricing row outside the given branch', async () => {
        (prisma.pricing.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updatePricing('p1', 'b1', { price: 200 })).rejects.toThrow('Pricing not found');
    });

    it('deletePricing (soft-delete) throws for a pricing row outside the given branch', async () => {
        (prisma.pricing.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(deletePricing('p1', 'b1')).rejects.toThrow('Pricing not found');
    });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- pricing.service`
Expected: FAIL — none of these functions accept/use `branchId` yet, and `updatePricing`/`deletePricing` don't check ownership before writing.

- [ ] **Step 5: Update the service**

Replace `apps/education-apps/src/modules/pricing/pricing.service.ts` in full:

```ts
import prisma from '../../config/database';

export interface PricingData {
    category: string;
    level: string;
    subject: string;
    price: number;
    branchId: string;
    description?: string;
    active?: boolean;
}

export const getAllPricing = async (branchId: string) => {
    return await prisma.pricing.findMany({
        where: { branchId, active: true },
        orderBy: [
            { category: 'asc' },
            { level: 'asc' },
            { subject: 'asc' }
        ]
    });
};

export const getPricingByCategory = async (category: string, branchId: string) => {
    return await prisma.pricing.findMany({
        where: {
            category,
            branchId,
            active: true
        },
        orderBy: [
            { level: 'asc' },
            { subject: 'asc' }
        ]
    });
};

export const getPriceForSubject = async (category: string, level: string, subject: string): Promise<number> => {
    const pricing = await prisma.pricing.findFirst({
        where: {
            category,
            level,
            subject,
            active: true
        }
    });
    return pricing?.price || 0;
};

export const createPricing = async (data: PricingData) => {
    return await prisma.pricing.create({
        data: {
            category: data.category,
            level: data.level,
            subject: data.subject,
            price: data.price,
            branchId: data.branchId,
            description: data.description,
            active: data.active ?? true
        }
    });
};

export const updatePricing = async (id: string, branchId: string, data: Partial<PricingData>) => {
    const existing = await prisma.pricing.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Pricing not found');

    return await prisma.pricing.update({
        where: { id },
        data
    });
};

export const deletePricing = async (id: string, branchId: string) => {
    const existing = await prisma.pricing.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Pricing not found');

    return await prisma.pricing.update({
        where: { id },
        data: { active: false }
    });
};

export const upsertPricing = async (data: PricingData) => {
    const existing = await prisma.pricing.findFirst({
        where: {
            category: data.category,
            level: data.level,
            subject: data.subject,
            branchId: data.branchId
        }
    });

    if (existing) {
        return await prisma.pricing.update({
            where: { id: existing.id },
            data: { price: data.price, active: true }
        });
    } else {
        return await createPricing(data);
    }
};

export const bulkUpsertPricing = async (items: PricingData[]) => {
    const results = [];
    for (const item of items) {
        const result = await upsertPricing(item);
        results.push(result);
    }
    return results;
};
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- pricing.service`
Expected: all passing.

- [ ] **Step 7: Update the controller**

Replace `apps/education-apps/src/modules/pricing/pricing.controller.ts` in full:

```ts
import { Response } from 'express';
import {
    getAllPricing,
    getPricingByCategory,
    createPricing,
    updatePricing,
    deletePricing,
    bulkUpsertPricing
} from './pricing.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const getAll = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { category } = req.query;

        let pricing;
        if (category && typeof category === 'string') {
            pricing = await getPricingByCategory(category, req.branchId!);
        } else {
            pricing = await getAllPricing(req.branchId!);
        }

        sendSuccess(res, pricing, 'Pricing retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve pricing', 500);
    }
};

export const create = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { category, level, subject, price, description } = req.body;

        if (!category || !level || !subject || price === undefined) {
            sendError(res, 'Category, level, subject and price are required', 'Validation error', 400);
            return;
        }

        const pricing = await createPricing({
            category,
            level,
            subject,
            price: parseFloat(price),
            branchId: req.branchId!,
            description
        });

        sendSuccess(res, pricing, 'Pricing created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create pricing', 400);
    }
};

export const update = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { category, level, subject, price, description, active } = req.body;

        const updateData: any = {};
        if (category) updateData.category = category;
        if (level) updateData.level = level;
        if (subject) updateData.subject = subject;
        if (price !== undefined) updateData.price = parseFloat(price);
        if (description !== undefined) updateData.description = description;
        if (active !== undefined) updateData.active = active;

        const pricing = await updatePricing(id, req.branchId!, updateData);

        sendSuccess(res, pricing, 'Pricing updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update pricing', 400);
    }
};

export const remove = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await deletePricing(id, req.branchId!);
        sendSuccess(res, null, 'Pricing deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete pricing', 404);
    }
};

export const bulkUpsert = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items)) {
            sendError(res, 'Items array is required', 'Validation error', 400);
            return;
        }

        const itemsWithBranch = items.map((item: any) => ({ ...item, branchId: req.branchId! }));
        const results = await bulkUpsertPricing(itemsWithBranch);
        sendSuccess(res, results, 'Pricing bulk updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to bulk update pricing', 400);
    }
};
```

- [ ] **Step 8: Wire up the routes**

In `apps/education-apps/src/modules/pricing/pricing.routes.ts`, add the import:
```ts
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
```
Change:
```ts
// All routes require authentication
router.use(authMiddleware);
```
to:
```ts
// All routes require authentication
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);
```
(`pricing.routes.ts` previously had no blanket `roleMiddleware` — only per-route calls for write operations, implicitly leaving `GET /` open to any authenticated role. Adding a blanket `roleMiddleware('ADMIN', 'SECRETARY', 'OWNER')` here is required so `tenantScopeMiddleware` — which 403s any role it doesn't recognize — doesn't lock out a role that could read pricing before. The existing per-route `roleMiddleware('ADMIN')` calls on the write routes are unchanged and still apply on top.)

- [ ] **Step 9: Run the full suite and typecheck, then commit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/pricing
git commit -m "feat(pricing): retrofit branch scoping"
```

---

## Task 7: Attendance — branchId scoping

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/attendance/attendance.service.ts`
- Modify: `apps/education-apps/src/modules/attendance/attendance.controller.ts`
- Modify: `apps/education-apps/src/modules/attendance/attendance.routes.ts`
- Modify: `apps/education-apps/src/modules/attendance/attendance.service.test.ts`
- Modify: `apps/education-apps/src/modules/attendance/absence-job.ts` (system-wide cron — stamps `branchId` from each `Group.branchId` it processes, has no `req.branchId` of its own)

This is the module with the most call sites: three ways an `Attendance` row gets created (`createAttendance`, `scanAttendance`, and the `absence-job.ts` cron), each needs its own source for `branchId`.

- [ ] **Step 1: Tighten `Attendance.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, inside the `Attendance` model, change:
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors.

- [ ] **Step 3: Write the failing tests**

Replace `apps/education-apps/src/modules/attendance/attendance.service.test.ts` in full:

```ts
import prisma from '../../config/database';
import { scanAttendance, createAttendance, getAttendanceByStudent } from './attendance.service';
import * as accessToken from '../../utils/accessToken';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findUnique: jest.fn() },
        group: { findUnique: jest.fn() },
        attendance: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
        attendanceNotification: { create: jest.fn() },
    },
}));

jest.mock('../notifications/notification.provider', () => ({
    ConsoleNotificationProvider: jest.fn().mockImplementation(() => ({
        send: jest.fn().mockResolvedValue(undefined),
    })),
}));

// 2026-08-31 is a Monday
const MONDAY_9AM = new Date(2026, 7, 31, 9, 0, 0);

describe('scanAttendance', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(MONDAY_9AM);
        jest.clearAllMocks();
    });

    afterEach(() => jest.useRealTimers());

    it('throws when the token matches no student', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(scanAttendance('bad-token', 'group1', 'b1')).rejects.toThrow('Student not found');
    });

    it('throws when the student belongs to a different branch than the scanning device', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'other-branch',
            groupIds: ['group1'],
        });

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Student not found');
    });

    it('throws when the student is not enrolled in the given group', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'b1',
            groupIds: ['other-group'],
        });

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Student is not enrolled in this group');
    });

    it('throws when the group belongs to a different branch than the scanning device', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'b1',
            groupIds: ['group1'],
        });
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            branchId: 'other-branch',
            timeSlots: [],
        });

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Group not found');
    });

    it('creates a PRESENT attendance stamped with the scanning branch, and rejects a second scan for the same session', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'b1',
            groupIds: ['group1'],
        });
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            branchId: 'b1',
            timeSlots: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        });
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce(null);
        (prisma.attendance.create as jest.Mock).mockResolvedValue({ id: 'att1', status: 'PRESENT' });

        const result = await scanAttendance('tok', 'group1', 'b1');
        expect(result.status).toBe('PRESENT');
        expect(prisma.attendance.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );

        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'att1' });
        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Attendance already marked for this session');
    });

    it('translates a P2002 unique-constraint race into the friendly duplicate-scan message', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'b1',
            groupIds: ['group1'],
        });
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            branchId: 'b1',
            timeSlots: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        });
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce(null);
        (prisma.attendance.create as jest.Mock).mockRejectedValueOnce(
            Object.assign(new Error('Unique constraint failed on the fields: (`studentId`,`groupId`,`date`)'), {
                code: 'P2002',
                name: 'PrismaClientKnownRequestError',
            })
        );

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Attendance already marked for this session');
    });
});

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createAttendance throws when the student belongs to a different branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'other-branch' });

        await expect(
            createAttendance({ studentId: 's1', date: new Date(), status: 'PRESENT', branchId: 'b1' } as any)
        ).rejects.toThrow('Student not found');
    });

    it('createAttendance stamps branchId from the given value when the student matches', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.attendance.create as jest.Mock).mockResolvedValue({ id: 'a1', branchId: 'b1' });

        await createAttendance({ studentId: 's1', date: new Date(), status: 'PRESENT', branchId: 'b1' } as any);

        expect(prisma.attendance.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAttendanceByStudent throws when the student belongs to a different branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'other-branch' });

        await expect(getAttendanceByStudent('s1', 'b1')).rejects.toThrow('Student not found');
    });

    it('getAttendanceByStudent filters attendance by branchId', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);

        await getAttendanceByStudent('s1', 'b1');

        expect(prisma.attendance.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { studentId: 's1', branchId: 'b1' } })
        );
    });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- attendance.service`
Expected: FAIL — `scanAttendance` doesn't take a third `branchId` argument yet, `createAttendance`/`getAttendanceByStudent` don't validate/filter by branch.

- [ ] **Step 5: Update the service**

Replace `apps/education-apps/src/modules/attendance/attendance.service.ts` in full:

```ts
import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';
import { deriveAttendanceStatus, TimeSlot } from '../../utils/attendanceStatus';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';
import { sendAttendanceNotification } from '../notifications/notification.service';

interface CreateAttendanceData {
    studentId: string;
    branchId: string;
    date: Date;
    status: string;
}

export const createAttendance = async (data: CreateAttendanceData) => {
    const { studentId, branchId, date, status } = data;

    if (!['PRESENT', 'LATE', 'ABSENT'].includes(status)) {
        throw new Error('Status must be one of PRESENT, LATE, ABSENT');
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.branchId !== branchId) {
        throw new Error('Student not found');
    }

    const attendance = await prisma.attendance.create({
        data: { studentId, branchId, date, status: status as any },
        include: { student: true },
    });

    return attendance;
};

export const getAttendanceByStudent = async (studentId: string, branchId: string) => {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.branchId !== branchId) {
        throw new Error('Student not found');
    }

    return prisma.attendance.findMany({
        where: { studentId, branchId },
        include: { student: true },
        orderBy: { date: 'desc' },
    });
};

export const scanAttendance = async (rawStudentToken: string, groupId: string, branchId: string) => {
    const accessTokenHash = hashToken(rawStudentToken);

    const student = await prisma.student.findUnique({
        where: { accessTokenHash },
    });

    if (!student || student.branchId !== branchId) {
        throw new Error('Student not found');
    }

    if (!student.groupIds.includes(groupId)) {
        throw new Error('Student is not enrolled in this group');
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.branchId !== branchId) {
        throw new Error('Group not found');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.attendance.findUnique({
        where: {
            studentId_groupId_date: {
                studentId: student.id,
                groupId,
                date: today,
            },
        },
    });

    if (existing) {
        throw new Error('Attendance already marked for this session');
    }

    const status = deriveAttendanceStatus((group.timeSlots as unknown as TimeSlot[]) || [], now);

    let attendance;
    try {
        attendance = await prisma.attendance.create({
            data: {
                studentId: student.id,
                groupId,
                branchId,
                date: today,
                scannedAt: now,
                status: status as any,
            },
        });
    } catch (error) {
        if ((error as any)?.code === 'P2002') {
            throw new Error('Attendance already marked for this session');
        }
        throw error;
    }

    if (student.parentId) {
        const message = status === 'LATE'
            ? `Your child ${student.name} arrived late to class at ${now.toLocaleTimeString()}`
            : `Your child ${student.name} checked into class at ${now.toLocaleTimeString()}`;

        try {
            await sendAttendanceNotification(new ConsoleNotificationProvider(), {
                attendanceId: attendance.id,
                parentId: student.parentId,
                channel: 'WHATSAPP',
                message,
            });
        } catch (error) {
            console.error('[attendance] failed to send notification, attendance was still recorded:', error);
        }
    }

    return attendance;
};
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- attendance.service`
Expected: all passing.

- [ ] **Step 7: Update the controller**

Replace `apps/education-apps/src/modules/attendance/attendance.controller.ts` in full:

```ts
import { Response } from 'express';
import {
    createAttendance,
    getAttendanceByStudent,
    scanAttendance,
} from './attendance.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const create = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { studentId, date, status } = req.body;

        if (!studentId || !date || !status) {
            sendError(
                res,
                'StudentId, date, and status are required',
                'Validation error',
                400
            );
            return;
        }

        if (!['PRESENT', 'LATE', 'ABSENT'].includes(status)) {
            sendError(
                res,
                'Invalid status',
                'Status must be one of PRESENT, LATE, ABSENT',
                400
            );
            return;
        }

        const attendance = await createAttendance({
            studentId,
            branchId: req.branchId!,
            date: new Date(date),
            status,
        });

        sendSuccess(res, attendance, 'Attendance created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create attendance', 400);
    }
};

export const getByStudent = async (
    req: TenantRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const attendances = await getAttendanceByStudent(id, req.branchId!);
        sendSuccess(res, attendances, 'Attendance retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve attendance', 404);
    }
};

export const scan = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { studentToken, groupId } = req.body;

        if (!studentToken || !groupId) {
            sendError(res, 'studentToken and groupId are required', 'Validation error', 400);
            return;
        }

        const attendance = await scanAttendance(studentToken, groupId, req.branchId!);
        sendSuccess(res, attendance, 'Attendance recorded', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to record attendance', 400);
    }
};
```

- [ ] **Step 8: Wire up the routes**

In `apps/education-apps/src/modules/attendance/attendance.routes.ts`, add the import:
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

- [ ] **Step 9: Run the full suite and typecheck, then commit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/attendance
git commit -m "feat(attendance): retrofit branch scoping"
```

- [ ] **Step 10: Fix the absence-job cron (no request context — derives branchId from each Group)**

`runAbsenceSweep` iterates every `Group` system-wide (it's a scheduled job, not an HTTP handler) and creates `Attendance` rows directly — now that `Attendance.branchId` is required, each created row must be stamped from the `branchId` of the `Group` it came from (already a required field since Task 1).

In `apps/education-apps/src/modules/attendance/absence-job.ts`, change:
```ts
                    const attendance = await prisma.attendance.create({
                        data: {
                            studentId: student.id,
                            groupId: group.id,
                            date: today,
                            status: 'ABSENT',
                        },
                    });
```
to:
```ts
                    const attendance = await prisma.attendance.create({
                        data: {
                            studentId: student.id,
                            groupId: group.id,
                            branchId: group.branchId,
                            date: today,
                            status: 'ABSENT',
                        },
                    });
```

- [ ] **Step 11: Typecheck and commit**

Run: `cd apps/education-apps && npx tsc --noEmit`
Expected: clean.

```bash
git add apps/education-apps/src/modules/attendance/absence-job.ts
git commit -m "fix(attendance): stamp absence-sweep rows with the group's branchId"
```

---

## Task 8: AttendanceNotification — branchId scoping

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/notifications/notification.service.ts`
- Modify: `apps/education-apps/src/modules/notifications/notification.service.test.ts`

`sendAttendanceNotification` is never called from an HTTP route directly — it's called internally from `attendance.service.ts`'s `scanAttendance` and `absence-job.ts`'s `runAbsenceSweep`, both of which already have an `attendanceId` for a row that (as of Task 7) always has a `branchId`. So instead of adding a `branchId` parameter to `sendAttendanceNotification`'s own input (which would let a caller pass a mismatched one), this task derives it by looking up the `Attendance` row itself — the same lookup doubles as validating the `attendanceId` is real.

- [ ] **Step 1: Tighten `AttendanceNotification.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, inside the `AttendanceNotification` model, change:
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors.

- [ ] **Step 3: Write the failing test**

Replace `apps/education-apps/src/modules/notifications/notification.service.test.ts` in full:

```ts
import { sendAttendanceNotification } from './notification.service';
import { NotificationProvider } from './notification.provider';
import prisma from '../../config/database';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        attendance: { findUnique: jest.fn() },
        attendanceNotification: { create: jest.fn() },
    },
}));

describe('sendAttendanceNotification', () => {
    afterEach(() => jest.clearAllMocks());

    it('throws when the attendanceId does not resolve to a real Attendance row', async () => {
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValue(null);
        const fakeProvider: NotificationProvider = { send: jest.fn() };

        await expect(
            sendAttendanceNotification(fakeProvider, {
                attendanceId: 'missing',
                parentId: 'parent1',
                channel: 'WHATSAPP',
                message: 'Your child checked in',
            })
        ).rejects.toThrow('Attendance not found');
    });

    it('sends via the provider and records a SENT AttendanceNotification stamped with the attendance\'s branchId', async () => {
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValue({ id: 'att1', branchId: 'b1' });
        const fakeProvider: NotificationProvider = {
            send: jest.fn().mockResolvedValue(undefined),
        };
        (prisma.attendanceNotification.create as jest.Mock).mockResolvedValue({});

        await sendAttendanceNotification(fakeProvider, {
            attendanceId: 'att1',
            parentId: 'parent1',
            channel: 'WHATSAPP',
            message: 'Your child checked in',
        });

        expect(fakeProvider.send).toHaveBeenCalledWith('parent1', 'Your child checked in');
        expect(prisma.attendanceNotification.create).toHaveBeenCalledWith({
            data: {
                attendanceId: 'att1',
                branchId: 'b1',
                parentId: 'parent1',
                channel: 'WHATSAPP',
                message: 'Your child checked in',
                status: 'SENT',
            },
        });
    });

    it('records FAILED when the provider throws', async () => {
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValue({ id: 'att1', branchId: 'b1' });
        const fakeProvider: NotificationProvider = {
            send: jest.fn().mockRejectedValue(new Error('provider down')),
        };
        (prisma.attendanceNotification.create as jest.Mock).mockResolvedValue({});

        await sendAttendanceNotification(fakeProvider, {
            attendanceId: 'att1',
            parentId: 'parent1',
            channel: 'WHATSAPP',
            message: 'Your child checked in',
        });

        expect(prisma.attendanceNotification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ status: 'FAILED', branchId: 'b1' }),
        });
    });
});
```

- [ ] **Step 4: Run the test and confirm it fails**

Run: `cd apps/education-apps && npm test -- notification.service`
Expected: FAIL — `sendAttendanceNotification` doesn't look up the `Attendance` row or stamp `branchId` yet.

- [ ] **Step 5: Update the service**

Replace `apps/education-apps/src/modules/notifications/notification.service.ts` in full:

```ts
import prisma from '../../config/database';
import { NotificationProvider } from './notification.provider';

interface SendAttendanceNotificationInput {
    attendanceId: string;
    parentId: string;
    channel: 'WHATSAPP' | 'SMS' | 'PUSH';
    message: string;
}

export const sendAttendanceNotification = async (
    provider: NotificationProvider,
    input: SendAttendanceNotificationInput
): Promise<void> => {
    const attendance = await prisma.attendance.findUnique({ where: { id: input.attendanceId } });
    if (!attendance) {
        throw new Error('Attendance not found');
    }

    let status: 'SENT' | 'FAILED' = 'SENT';

    try {
        await provider.send(input.parentId, input.message);
    } catch (error) {
        console.error('[notification] failed to send:', error);
        status = 'FAILED';
    }

    await prisma.attendanceNotification.create({
        data: {
            attendanceId: input.attendanceId,
            branchId: attendance.branchId,
            parentId: input.parentId,
            channel: input.channel,
            message: input.message,
            status,
        },
    });
};
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- notification.service`
Expected: all passing.

- [ ] **Step 7: Run the full suite and typecheck, then commit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean. (`attendance.service.ts`'s and `absence-job.ts`'s existing calls to `sendAttendanceNotification` need no changes — they already pass a real `attendanceId` for a row that has a `branchId` as of Task 7.)

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/notifications
git commit -m "feat(notifications): derive branchId from the referenced attendance record"
```

---

## Task 9: Formation — extract a service layer, branchId scoping (+ revisit Group.formationId)

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Create: `apps/education-apps/src/modules/formations/formations.service.ts`
- Modify: `apps/education-apps/src/modules/formations/formations.controller.ts`
- Modify: `apps/education-apps/src/modules/formations/formations.routes.ts`
- Modify: `apps/education-apps/src/modules/groups/groups.service.ts` (add `formationId` cross-branch validation, deferred from Task 1)
- Modify: `apps/education-apps/src/modules/groups/groups.service.test.ts`
- Test: `apps/education-apps/src/modules/formations/formations.service.test.ts` (new)

`formations.controller.ts` currently has no service layer at all and instantiates its own `new PrismaClient()` instead of using the shared `prisma` from `config/database` — this task extracts the logic into a proper service (needed to unit-test branch scoping the same way as every other module) and switches it to the shared client (needed so `jest.mock('../../config/database')` can intercept it). **The controller's response shape is preserved exactly as-is** (bare `res.json(formation)` / `res.status(201).json(formation)`, not the `sendSuccess`/`sendError` wrapper used elsewhere) — the frontend's `lib/services/formations.ts` reads the response body directly as a `Formation`/`Formation[]`, not `{ data: Formation }`, so changing that shape would break the frontend independently of this retrofit.

`getAnalytics` reads across `Formation` and `Inscription` — left unscoped in this task (dashboard aggregate, per plan notes), matching the treatment `getStudentAnalytics`/`getInscriptionAnalytics`/`getPaymentAnalytics` already got.

- [ ] **Step 1: Tighten `Formation.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, inside the `Formation` model, change:
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors.

- [ ] **Step 3: Write the failing tests**

Create `apps/education-apps/src/modules/formations/formations.service.test.ts`:

```ts
import prisma from '../../config/database';
import { createFormation, getFormations, updateFormation, deleteFormation } from './formations.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        formation: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createFormation stamps branchId from the given value', async () => {
        (prisma.formation.create as jest.Mock).mockResolvedValue({ id: 'f1', branchId: 'b1' });

        await createFormation({ name: 'Anglais Intensif', duration: '3 mois', price: 1000, branchId: 'b1' } as any);

        expect(prisma.formation.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getFormations only returns formations in the given branch', async () => {
        (prisma.formation.findMany as jest.Mock).mockResolvedValue([]);

        await getFormations('b1');

        expect(prisma.formation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('updateFormation throws for a formation outside the given branch', async () => {
        (prisma.formation.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
            updateFormation('f1', 'b1', { name: 'New Name', duration: '1 mois', price: 500 } as any)
        ).rejects.toThrow('Formation not found');
    });

    it('deleteFormation throws for a formation outside the given branch', async () => {
        (prisma.formation.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(deleteFormation('f1', 'b1')).rejects.toThrow('Formation not found');
    });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- formations.service`
Expected: FAIL — `Cannot find module './formations.service'`.

- [ ] **Step 5: Create the service**

Create `apps/education-apps/src/modules/formations/formations.service.ts`:

```ts
import prisma from '../../config/database';

export interface CreateFormationData {
    name: string;
    duration: string;
    price: number;
    branchId: string;
    description?: string;
}

export interface UpdateFormationData {
    name?: string;
    duration?: string;
    price?: number;
    description?: string;
}

export const createFormation = async (data: CreateFormationData) => {
    return await prisma.formation.create({
        data: {
            name: data.name,
            duration: data.duration,
            price: data.price,
            branchId: data.branchId,
            description: data.description,
        },
    });
};

export const getFormations = async (branchId: string) => {
    return await prisma.formation.findMany({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
    });
};

export const updateFormation = async (id: string, branchId: string, data: UpdateFormationData) => {
    const existing = await prisma.formation.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Formation not found');

    return await prisma.formation.update({
        where: { id },
        data,
    });
};

export const deleteFormation = async (id: string, branchId: string) => {
    const existing = await prisma.formation.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Formation not found');

    await prisma.formation.delete({ where: { id } });
};

export const getFormationAnalytics = async () => {
    // Aggregate across all branches — intentionally left unscoped, see plan notes.
    const totalFormations = await prisma.formation.count();
    const totalInscriptions = await prisma.inscription.count({
        where: { type: 'FORMATION' }
    });
    const revenue = await prisma.inscription.aggregate({
        where: { type: 'FORMATION' },
        _sum: { amount: true }
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const monthlyRevenue = await prisma.inscription.aggregate({
        where: {
            type: 'FORMATION',
            createdAt: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        },
        _sum: { amount: true }
    });

    const recentInscriptions = await prisma.inscription.findMany({
        where: { type: 'FORMATION' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            student: true
        }
    });

    return {
        totalFormations,
        totalInscriptions,
        totalRevenue: revenue._sum.amount || 0,
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        recentInscriptions
    };
};
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- formations.service`
Expected: all passing.

- [ ] **Step 7: Rewrite the controller to use the service, preserving the exact response shape**

Replace `apps/education-apps/src/modules/formations/formations.controller.ts` in full:

```ts
import { Response } from 'express';
import {
    createFormation,
    getFormations,
    updateFormation,
    deleteFormation,
    getFormationAnalytics,
} from './formations.service';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const createFormationHandler = async (req: TenantRequest, res: Response) => {
    try {
        const { name, duration, price, description } = req.body;
        const formation = await createFormation({
            name,
            duration,
            price: parseFloat(price),
            branchId: req.branchId!,
            description,
        });
        res.status(201).json(formation);
    } catch (error) {
        res.status(500).json({ error: 'Error creating formation' });
    }
};

export const getFormationsHandler = async (req: TenantRequest, res: Response) => {
    try {
        const formations = await getFormations(req.branchId!);
        res.json(formations);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching formations' });
    }
};

export const updateFormationHandler = async (req: TenantRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, duration, price, description } = req.body;
        const formation = await updateFormation(id, req.branchId!, {
            name,
            duration,
            price: parseFloat(price),
            description,
        });
        res.json(formation);
    } catch (error) {
        res.status(500).json({ error: 'Error updating formation' });
    }
};

export const deleteFormationHandler = async (req: TenantRequest, res: Response) => {
    try {
        const { id } = req.params;
        await deleteFormation(id, req.branchId!);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting formation' });
    }
};

export const getAnalytics = async (req: TenantRequest, res: Response) => {
    try {
        const analytics = await getFormationAnalytics();
        res.json(analytics);
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Error fetching analytics' });
    }
};
```
(Handler names `createFormationHandler`/`getFormationsHandler`/`updateFormationHandler`/`deleteFormationHandler` are renamed from the original `createFormation`/`getFormations`/`updateFormation`/`deleteFormation` to avoid colliding with the same-named functions now imported from `formations.service.ts` — `formations.routes.ts` is updated in Step 8 to match.)

- [ ] **Step 8: Wire up the routes**

Replace `apps/education-apps/src/modules/formations/formations.routes.ts` in full:

```ts
import { Router } from 'express';
import {
    createFormationHandler,
    getFormationsHandler,
    updateFormationHandler,
    deleteFormationHandler,
    getAnalytics,
} from './formations.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/analytics', roleMiddleware('ADMIN', 'OWNER'), getAnalytics);
router.post('/', roleMiddleware('ADMIN', 'OWNER'), createFormationHandler);
router.get('/', getFormationsHandler);
router.put('/:id', roleMiddleware('ADMIN', 'OWNER'), updateFormationHandler);
router.delete('/:id', roleMiddleware('ADMIN', 'OWNER'), deleteFormationHandler);

export default router;
```
(The original per-route `roleMiddleware('ADMIN')` calls are preserved as `roleMiddleware('ADMIN', 'OWNER')` — same restriction, `OWNER` added for tenancy consistency with every other module in this plan. `GET /` remains open to any of the router-level roles, unchanged from the original `authMiddleware`-only restriction on that one route.)

- [ ] **Step 9: Run the full suite and typecheck, then commit the Formation retrofit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/formations
git commit -m "feat(formations): extract service layer, retrofit branch scoping"
```

- [ ] **Step 10: Revisit Group — write the failing test for formationId validation**

Add to `apps/education-apps/src/modules/groups/groups.service.test.ts`, inside the existing `describe('branch scoping', ...)` block (extend the `jest.mock('../../config/database', ...)` call's mocked object to also include `formation: { findUnique: jest.fn() }`, merging into the existing mocks):

```ts
    it('createGroup throws when formationId belongs to a different branch', async () => {
        (prisma.formation.findUnique as jest.Mock).mockResolvedValue({ id: 'f1', branchId: 'other-branch' });

        await expect(
            createGroup({ name: 'G1', type: 'FORMATION', formationId: 'f1', branchId: 'b1' } as any)
        ).rejects.toThrow('Formation does not belong to this branch');
    });
```

- [ ] **Step 11: Run and confirm it fails**

Run: `cd apps/education-apps && npm test -- groups.service`
Expected: FAIL — `createGroup` doesn't validate `formationId` yet.

- [ ] **Step 12: Add the validation to `groups.service.ts`**

In `apps/education-apps/src/modules/groups/groups.service.ts`, add this helper below `assertTeacherInBranch`:

```ts
const assertFormationInBranch = async (formationId: string | undefined, branchId: string) => {
    if (!formationId) return;

    const formation = await prisma.formation.findUnique({ where: { id: formationId } });
    if (!formation || formation.branchId !== branchId) {
        throw new Error('Formation does not belong to this branch');
    }
};
```

Then call it in both `createGroup` and `updateGroup`, right after the existing `assertTeacherInBranch` call:
```ts
    await assertFormationInBranch(data.formationId, data.branchId);
```
(In `updateGroup`, use `branchId` — the function's own parameter — as the second argument, same as the existing calls there.)

- [ ] **Step 13: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- groups.service`
Expected: all passing.

- [ ] **Step 14: Run the full suite and typecheck, then commit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/src/modules/groups
git commit -m "feat(groups): validate formationId belongs to the same branch"
```

---

## Task 10: Settings — branchId scoping

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/settings/settings.service.ts`
- Modify: `apps/education-apps/src/modules/settings/settings.controller.ts`
- Modify: `apps/education-apps/src/modules/settings/settings.routes.ts`
- Test: `apps/education-apps/src/modules/settings/settings.service.test.ts` (new)

Each branch gets its own `Settings` row (confirmed: branch-specific, not school-wide). `getSettings`/`updateSettings` currently call `prisma.settings.findFirst()` with no filter at all (a single global singleton) — this task keys both off `branchId` instead, auto-creating a branch's default row the first time it's requested, same "lazy default" behavior as before but now per-branch.

- [ ] **Step 1: Tighten `Settings.branchId` to required with a real relation**

In `apps/education-apps/prisma/schema.prisma`, inside the `Settings` model, change:
```prisma
  // branchId is intentionally a bare scalar (no @relation) here — this model
  // hasn't been retrofitted for multi-tenancy yet. A follow-up plan adds the
  // real Branch relation when this module's queries are branch-scoped.
  branchId String? @db.ObjectId
```
to:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```

- [ ] **Step 2: Regenerate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate && npx prisma db push`
Expected: both succeed with no errors.

- [ ] **Step 3: Write the failing tests**

Create `apps/education-apps/src/modules/settings/settings.service.test.ts`:

```ts
import prisma from '../../config/database';
import { getSettings, updateSettings } from './settings.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        settings: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('getSettings returns the existing row for the given branch', async () => {
        (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1' });

        const result = await getSettings('b1');

        expect(prisma.settings.findFirst).toHaveBeenCalledWith({ where: { branchId: 'b1' } });
        expect(prisma.settings.create).not.toHaveBeenCalled();
        expect(result).toEqual({ id: 'set1', branchId: 'b1' });
    });

    it('getSettings creates a default row scoped to the branch when none exists', async () => {
        (prisma.settings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.settings.create as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1' });

        await getSettings('b1');

        expect(prisma.settings.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('updateSettings updates the row scoped to the branch when one exists', async () => {
        (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1' });
        (prisma.settings.update as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1', schoolName: 'New Name' });

        await updateSettings('b1', { schoolName: 'New Name' });

        expect(prisma.settings.update).toHaveBeenCalledWith({
            where: { id: 'set1' },
            data: { schoolName: 'New Name' },
        });
    });

    it('updateSettings creates a branch-scoped row when none exists yet', async () => {
        (prisma.settings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.settings.create as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1' });

        await updateSettings('b1', { schoolName: 'New Name' });

        expect(prisma.settings.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1', schoolName: 'New Name' }) })
        );
    });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- settings.service`
Expected: FAIL — `getSettings`/`updateSettings` don't take a `branchId` argument yet.

- [ ] **Step 5: Update the service**

Replace `apps/education-apps/src/modules/settings/settings.service.ts` in full:

```ts
import prisma from '../../config/database';

interface UpdateSettingsData {
    schoolName?: string;
    logo?: string;
    academicYear?: string;
    contactInfo?: string;
}

export const getSettings = async (branchId: string) => {
    let settings = await prisma.settings.findFirst({ where: { branchId } });

    if (!settings) {
        settings = await prisma.settings.create({
            data: {
                branchId,
                schoolName: 'School Name',
                academicYear: '2024-2025',
                logo: null,
                contactInfo: null,
            },
        });
    }

    return settings;
};

export const updateSettings = async (branchId: string, data: UpdateSettingsData) => {
    let settings = await prisma.settings.findFirst({ where: { branchId } });

    if (!settings) {
        settings = await prisma.settings.create({
            data: {
                branchId,
                schoolName: data.schoolName || 'School Name',
                academicYear: data.academicYear || '2024-2025',
                logo: data.logo || null,
                contactInfo: data.contactInfo || null,
            },
        });
    } else {
        settings = await prisma.settings.update({
            where: { id: settings.id },
            data,
        });
    }

    return settings;
};
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- settings.service`
Expected: all passing.

- [ ] **Step 7: Update the controller**

Replace `apps/education-apps/src/modules/settings/settings.controller.ts` in full:

```ts
import { Response } from 'express';
import { getSettings, updateSettings } from './settings.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const get = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const settings = await getSettings(req.branchId!);
        sendSuccess(res, settings, 'Settings retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve settings', 500);
    }
};

export const update = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { schoolName, logo, academicYear, contactInfo } = req.body;

        const updateData: any = {};
        if (schoolName) updateData.schoolName = schoolName;
        if (logo !== undefined) updateData.logo = logo;
        if (academicYear) updateData.academicYear = academicYear;
        if (contactInfo !== undefined) updateData.contactInfo = contactInfo;

        const settings = await updateSettings(req.branchId!, updateData);

        sendSuccess(res, settings, 'Settings updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update settings', 400);
    }
};
```

- [ ] **Step 8: Wire up the routes**

In `apps/education-apps/src/modules/settings/settings.routes.ts`, add the import:
```ts
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
```
Change:
```ts
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));
```
to:
```ts
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'OWNER'));
router.use(tenantScopeMiddleware);
```

- [ ] **Step 9: Run the full suite and typecheck, then commit**

Run: `cd apps/education-apps && npm test && npx tsc --noEmit`
Expected: all passing, clean.

```bash
git add apps/education-apps/prisma/schema.prisma apps/education-apps/src/modules/settings
git commit -m "feat(settings): retrofit branch scoping, one row per branch"
```

---

## Task 11: End-to-end manual QA pass

**Files:** none (verification only)

This mirrors Task 12 of the foundation plan, extended to cover every module retrofitted in this plan.

- [ ] **Step 1: Boot the backend against a real dev database**

Run: `cd apps/education-apps && npm run dev`
Expected: starts cleanly, `GET /health` returns `{"success":true,...}`.

- [ ] **Step 2: Full cross-module happy path for one branch**

Using owner signup from the foundation plan (`POST /api/schools/signup`) to get an `OWNER` token and a branch id (call it `branchA`), then with `X-Branch-Id: branchA` on every request:
1. `POST /api/teachers` — create a teacher. Confirm `201` and the returned `branchId` matches `branchA`.
2. `POST /api/groups` with that `teacherId` — confirm `201`.
3. `POST /api/students` — create a student (per the foundation plan's pattern).
4. `PUT /api/groups/:id` adding the student's id to `studentIds` — confirm `200`.
5. `POST /api/inscriptions` for that student — confirm `201`, and `GET /api/payments` shows an auto-created payment, and `GET /api/transactions` shows an auto-created `INCOME` transaction.
6. `POST /api/attendance` for that student — confirm `201`.
7. `POST /api/pricing` — confirm `201`.
8. `POST /api/formations` — confirm `201`.
9. `GET /api/settings` — confirm it auto-creates and returns a row with `branchId: branchA`.

- [ ] **Step 3: Cross-branch isolation, second school**

Sign up a second school/owner (`branchB`). For every resource id created in Step 2, repeat the request with owner B's token and `X-Branch-Id: branchB` (or, for `ADMIN`/`SECRETARY`-only routes like `/payments` and `/settings`, note that `OWNER` access is what's being tested here since only `OWNER` can switch branches):
- `GET /api/teachers/:id`-equivalent list endpoints (`GET /api/teachers`, `/api/groups`, `/api/students`, `/api/inscriptions`, `/api/payments`, `/api/attendance/student/:id`, `/api/pricing`, `/api/formations`, `/api/settings`) must never return branch A's rows.
- Attempt `PUT /api/groups/:groupIdFromBranchA` using owner B's token with `X-Branch-Id: branchB` — confirm `404` ("Group not found"), not branch A's data and not a 500.
- Attempt creating a `Group` in `branchB` with `teacherId` set to branch A's teacher id — confirm it's rejected with "Teacher does not belong to this branch".

- [ ] **Step 4: Legacy accounts still correctly denied**

Confirm (as the foundation plan's QA already established for `Student`) that a pre-existing `ADMIN`/`SECRETARY` account with `branchId: null` gets `403 "User has no assigned branch"` on `GET /api/groups`, `GET /api/teachers`, and at least two more of the newly-scoped list endpoints — not a silent empty-but-200 response.

- [ ] **Step 5: Clean up**

Delete the two throwaway schools/branches/teachers/groups/students/inscriptions/payments/transactions/attendance/pricing/formations/settings rows created during this QA pass (direct Prisma script, same pattern as the foundation plan's QA cleanup).

- [ ] **Step 6: Report results**

Note any failures precisely (endpoint, request, actual vs. expected). Do not silently patch and re-claim success without re-running the specific failing step.

---

## Self-Review Summary

- **Spec coverage**: all 10 modules from the spec's rollout table are covered as their own task, in the specified order, each tightening `branchId` to required with a real `@relation` (Tasks 1-10). Cross-reference validation is added for every FK the spec calls out: `Group.studentIds`/`teacherId`/`formationId` (Tasks 1, 2, 9), `Inscription.studentId`/`Payment.studentId` (Tasks 3, 4), `Attendance.studentId`/`groupId` (Task 7), `AttendanceNotification.attendanceId` derivation (Task 8). `Settings` keyed per-branch (Task 10). Final QA (Task 11) mirrors the foundation plan's Task 12, extended across all ten modules. `Parent` and dead code (`getPriceForSubject`) are explicitly left untouched per the spec's Non-Goals and this plan's notes.
- **Type consistency**: `TenantRequest`/`req.branchId!` (from the foundation plan's `tenantScope.middleware.ts`) is used identically across all ten controllers. Every service function's `branchId` parameter position and the `CreateXData`/`UpdateXData` interface shapes are consistent with how each task's controller calls them. The three deferred cross-file revisits (Group→Teacher in Task 2, Group→Formation in Task 9, Inscription→Payment in Task 4, Payment→Transaction in Task 5, salary-payments in Task 5) are each written as an explicit numbered step in the task that makes the target model's `branchId` required, not left as an unstated gap.
- **No backfill**: confirmed no production data exists (re-verified via direct DB query during brainstorming, and again matches the foundation plan's original assumption); every `branchId` goes straight to `required` with no migration task.

