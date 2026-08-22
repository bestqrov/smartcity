# Education: Attendance (Présence) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third full-stack Education slice — group-based attendance tracking with a bulk mark-attendance UI, per-group attendance-rate stats, and per-student attendance history — following the exact tenant-scoped-CRUD pattern the Guardians and Teachers/Groups modules already established.

**Architecture:** One new Prisma model (`Attendance`, linking `Group` + `Student`, unique per group+student+day). `education-service` gets an `attendance/` module (one controller, one service — no join-table split needed since `Attendance` itself is the join). `education-app` gets a new `lib/attendance.ts` hook file, a new "Présence" page with a bulk mark-attendance UI, an attendance-rate stat added to the Group detail page, an attendance-history section added to the Student detail page, and a new sidebar nav entry.

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB), class-validator — Next.js 15, React 19, `@smartcity/ui`, `@tanstack/react-query`, `lucide-react`.

---

## Deviations from app-injahi (and why)

Documented in full in `docs/superpowers/specs/2026-08-22-education-attendance-design.md` — summary:

- **Four statuses (PRESENT/ABSENT/LATE/EXCUSED), not app-injahi's two** (present/absent) — the
  "professional improvement" the user explicitly asked for.
- **Attendance is linked to `Group`**, which app-injahi's `Attendance` model is not — without it,
  there's no way to know which session/subject an attendance record belongs to when a student is
  in multiple groups.
- **Not app-injahi's monthly week/session grid UI** — that UI reads/writes `localStorage` only
  and never calls its own backend, so it doesn't actually persist data server-side. This plan
  builds a properly persisted one-group-one-date-at-a-time UI instead.
- **No automated tests** — same as every prior slice in this repo; verification is `tsc --noEmit`,
  `nest build`, and manual `curl` + Playwright checks.

---

## File Structure

```
packages/database/prisma/schema.prisma        # modify: + AttendanceStatus enum, Attendance model, back-refs
packages/shared-types/src/education.types.ts  # modify: + AttendanceStatus, IAttendance

packages/i18n/locales/{en,fr,ar}.json         # modify: + attendance education.* keys

services/education-service/
  src/app.module.ts                            # modify: + AttendanceModule
  src/attendance/dto/mark-attendance-entry.dto.ts   # create
  src/attendance/dto/bulk-mark-attendance.dto.ts    # create
  src/attendance/dto/find-attendance-query.dto.ts   # create
  src/attendance/attendance.service.ts              # create
  src/attendance/attendance.controller.ts           # create
  src/attendance/attendance.module.ts               # create

services/gateway/src/proxy/proxy.middleware.ts # modify: + /api/attendance route

apps/education-app/
  src/lib/attendance.ts                          # create
  src/app/[locale]/(admin)/layout.tsx             # modify: + Présence nav item
  src/app/[locale]/(admin)/attendance/page.tsx    # create
  src/app/[locale]/(admin)/groups/[id]/page.tsx   # modify: + attendance-rate stat card
  src/app/[locale]/(admin)/students/[id]/page.tsx # modify: + attendance history section
```

---

## Task 1: Prisma schema — Attendance

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add the `AttendanceStatus` enum**

Find `enum PaymentType` (added by the Teachers/Groups plan) and, directly above it, insert:

```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

```

- [ ] **Step 2: Add `attendances` back-ref to `Tenant`, `Group`, `Student`**

In the `Tenant` model, find the `groupStudents GroupStudent[]` line (added by the Teachers/Groups
plan) and add a sibling immediately after it:

```prisma
  attendances       Attendance[]
```

In the `Group` model, find `students GroupStudent[]` and add a sibling:

```prisma
  students    GroupStudent[]
  attendances Attendance[]
```

In the `Student` model, find `groupLinks GroupStudent[]` and add a sibling:

```prisma
  groupLinks  GroupStudent[]
  attendances Attendance[]
```

(These are additive edits only — read the current exact surrounding lines in the file before
editing, since prior slices may have formatted them slightly differently than shown here; the
goal is simply that each of the three models ends up with an `attendances Attendance[]` field
added to whatever relation list it already has, with nothing removed.)

- [ ] **Step 3: Append the `Attendance` model**

At the very end of `packages/database/prisma/schema.prisma`, append:

```prisma

model Attendance {
  id        String           @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String           @db.ObjectId
  groupId   String           @db.ObjectId
  studentId String           @db.ObjectId
  date      DateTime
  status    AttendanceStatus
  notes     String?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  group   Group   @relation(fields: [groupId], references: [id])
  student Student @relation(fields: [studentId], references: [id])

  @@unique([groupId, studentId, date])
  @@map("attendances")
}
```

- [ ] **Step 4: Regenerate the Prisma client**

Run: `cd /Users/mac/Documents/smartcity && pnpm --filter @smartcity/database run db:generate`
Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 5: Push the new model to the database**

Run: `cd /Users/mac/Documents/smartcity && pnpm --filter @smartcity/database run db:push`
Expected: output confirming an `attendances` collection and its compound unique index
(`groupId_studentId_date`) are in sync. (If the worktree is missing a `.env`/
`packages/database/.env`, copy them from the main repo's root `.env` first — they're gitignored
and not checked out into a fresh worktree; this is expected, not an error.)

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add Attendance model"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared-types/src/education.types.ts`

- [ ] **Step 1: Append to `packages/shared-types/src/education.types.ts`**

```ts
export enum AttendanceStatus {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
  LATE = "LATE",
  EXCUSED = "EXCUSED",
}

export interface IAttendance {
  id: string;
  tenantId: string;
  groupId: string;
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Verify the package still compiles**

Run: `cd /Users/mac/Documents/smartcity/packages/shared-types && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/shared-types/src/education.types.ts
git commit -m "feat(shared-types): add AttendanceStatus/IAttendance types"
```

---

## Task 3: i18n — attendance keys

**Files:**
- Modify: `packages/i18n/locales/en.json`
- Modify: `packages/i18n/locales/fr.json`
- Modify: `packages/i18n/locales/ar.json`

- [ ] **Step 1: Read the current last key in each file's `education` block**

Run: `python3 -c "import json; [print(l, list(json.load(open('/Users/mac/Documents/smartcity/packages/i18n/locales/'+l+'.json'))['education'].keys())[-1]) for l in ['en','fr','ar']]"`

This tells you the exact last key to insert after (prior slices may have added keys after this
plan was drafted — insert after whatever key is actually last, don't assume it's `fullName`).

- [ ] **Step 2: Add these keys to the end of `packages/i18n/locales/en.json`'s `education` block**
  (comma after the previous last key's value, these keys before the block's closing `}`):

```json
    "attendance": "Attendance",
    "markAttendance": "Mark attendance",
    "selectGroupForAttendance": "Select a group",
    "selectDate": "Date",
    "markAllPresent": "Mark all present",
    "statusPresent": "Present",
    "statusAbsent": "Absent",
    "statusLate": "Late",
    "statusExcused": "Excused",
    "attendanceNotes": "Notes (optional)",
    "saveAttendance": "Save attendance",
    "attendanceRate": "Attendance rate",
    "attendanceHistory": "Attendance history",
    "noAttendanceRecordsYet": "No attendance recorded yet.",
    "selectGroupAndDatePrompt": "Select a group and a date to take attendance."
```

- [ ] **Step 3: Add the equivalent French block to `packages/i18n/locales/fr.json`**, same
  position:

```json
    "attendance": "Présence",
    "markAttendance": "Prendre la présence",
    "selectGroupForAttendance": "Sélectionner un groupe",
    "selectDate": "Date",
    "markAllPresent": "Tout marquer présent",
    "statusPresent": "Présent",
    "statusAbsent": "Absent",
    "statusLate": "En retard",
    "statusExcused": "Excusé",
    "attendanceNotes": "Notes (optionnel)",
    "saveAttendance": "Enregistrer la présence",
    "attendanceRate": "Taux de présence",
    "attendanceHistory": "Historique de présence",
    "noAttendanceRecordsYet": "Aucune présence enregistrée pour l'instant.",
    "selectGroupAndDatePrompt": "Sélectionnez un groupe et une date pour prendre la présence."
```

- [ ] **Step 4: Add the equivalent Arabic block to `packages/i18n/locales/ar.json`**, same
  position:

```json
    "attendance": "الحضور",
    "markAttendance": "تسجيل الحضور",
    "selectGroupForAttendance": "اختر فوجًا",
    "selectDate": "التاريخ",
    "markAllPresent": "تعليم الكل حاضر",
    "statusPresent": "حاضر",
    "statusAbsent": "غائب",
    "statusLate": "متأخر",
    "statusExcused": "معذور",
    "attendanceNotes": "ملاحظات (اختياري)",
    "saveAttendance": "حفظ الحضور",
    "attendanceRate": "نسبة الحضور",
    "attendanceHistory": "سجل الحضور",
    "noAttendanceRecordsYet": "لا يوجد حضور مسجل بعد.",
    "selectGroupAndDatePrompt": "اختر فوجًا وتاريخًا لتسجيل الحضور."
```

- [ ] **Step 5: Validate all three files are still valid JSON**

Run: `node -e "['en','fr','ar'].forEach(l => { require('/Users/mac/Documents/smartcity/packages/i18n/locales/'+l+'.json'); console.log(l, 'OK'); })"`
Expected: `en OK`, `fr OK`, `ar OK`.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/i18n/locales/en.json packages/i18n/locales/fr.json packages/i18n/locales/ar.json
git commit -m "feat(i18n): add attendance education namespace keys (en/fr/ar)"
```

---

## Task 4: Attendance module (backend)

**Files:**
- Create: `services/education-service/src/attendance/dto/mark-attendance-entry.dto.ts`
- Create: `services/education-service/src/attendance/dto/bulk-mark-attendance.dto.ts`
- Create: `services/education-service/src/attendance/dto/find-attendance-query.dto.ts`
- Create: `services/education-service/src/attendance/attendance.service.ts`
- Create: `services/education-service/src/attendance/attendance.controller.ts`
- Create: `services/education-service/src/attendance/attendance.module.ts`
- Modify: `services/education-service/src/app.module.ts`

- [ ] **Step 1: Write `services/education-service/src/attendance/dto/mark-attendance-entry.dto.ts`**

```ts
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class MarkAttendanceEntryDto {
  @IsMongoId()
  studentId: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
```

- [ ] **Step 2: Write `services/education-service/src/attendance/dto/bulk-mark-attendance.dto.ts`**

```ts
import { ArrayMinSize, IsArray, IsDateString, IsMongoId, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MarkAttendanceEntryDto } from './mark-attendance-entry.dto';

export class BulkMarkAttendanceDto {
  @IsMongoId()
  groupId: string;

  @IsDateString()
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceEntryDto)
  entries: MarkAttendanceEntryDto[];
}
```

- [ ] **Step 3: Write `services/education-service/src/attendance/dto/find-attendance-query.dto.ts`**

```ts
import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class FindAttendanceQueryDto {
  @IsMongoId()
  @IsOptional()
  groupId?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsMongoId()
  @IsOptional()
  studentId?: string;
}
```

- [ ] **Step 4: Write `services/education-service/src/attendance/attendance.service.ts`**

Every write and read normalizes `date` to UTC midnight first, so the `@@unique([groupId,
studentId, date])` constraint from Task 1 actually holds — two calls for "the same day" always
resolve to the same `Date` value no matter what time of day they're made.

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';

function toUtcMidnight(dateInput: string | Date): Date {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertGroupInTenant(tenantId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });

    if (!group) {
      throw new BadRequestException('groupId does not belong to this tenant');
    }
  }

  private async assertStudentEnrolledInGroup(
    tenantId: string,
    groupId: string,
    studentId: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });

    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }

    const enrollment = await this.prisma.groupStudent.findFirst({
      where: { tenantId, groupId, studentId },
    });

    if (!enrollment) {
      throw new BadRequestException('studentId is not enrolled in this group');
    }
  }

  async bulkMark(tenantId: string, dto: BulkMarkAttendanceDto) {
    await this.assertGroupInTenant(tenantId, dto.groupId);

    const date = toUtcMidnight(dto.date);

    for (const entry of dto.entries) {
      await this.assertStudentEnrolledInGroup(tenantId, dto.groupId, entry.studentId);
    }

    const results = await Promise.all(
      dto.entries.map((entry) =>
        this.prisma.attendance.upsert({
          where: {
            groupId_studentId_date: {
              groupId: dto.groupId,
              studentId: entry.studentId,
              date,
            },
          },
          create: {
            tenantId,
            groupId: dto.groupId,
            studentId: entry.studentId,
            date,
            status: entry.status,
            notes: entry.notes,
          },
          update: {
            status: entry.status,
            notes: entry.notes,
          },
        }),
      ),
    );

    return results;
  }

  async findByGroupAndDate(tenantId: string, groupId: string, date: string) {
    await this.assertGroupInTenant(tenantId, groupId);

    return this.prisma.attendance.findMany({
      where: { tenantId, groupId, date: toUtcMidnight(date) },
    });
  }

  async findByStudent(tenantId: string, studentId: string) {
    return this.prisma.attendance.findMany({
      where: { tenantId, studentId },
      include: { group: true },
      orderBy: { date: 'desc' },
    });
  }

  async getGroupStats(tenantId: string, groupId: string) {
    await this.assertGroupInTenant(tenantId, groupId);

    const [totalRecords, presentCount] = await Promise.all([
      this.prisma.attendance.count({ where: { tenantId, groupId } }),
      this.prisma.attendance.count({
        where: { tenantId, groupId, status: 'PRESENT' },
      }),
    ]);

    const attendanceRate =
      totalRecords === 0 ? 0 : Math.round((presentCount / totalRecords) * 100);

    return { totalRecords, presentCount, attendanceRate };
  }
}
```

- [ ] **Step 5: Write `services/education-service/src/attendance/attendance.controller.ts`**

```ts
import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { FindAttendanceQueryDto } from './dto/find-attendance-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('bulk')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async bulkMark(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: BulkMarkAttendanceDto,
  ) {
    return this.attendanceService.bulkMark(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query() query: FindAttendanceQueryDto,
  ) {
    const tenantId = requireTenantId(user);

    if (query.studentId) {
      return this.attendanceService.findByStudent(tenantId, query.studentId);
    }

    if (query.groupId && query.date) {
      return this.attendanceService.findByGroupAndDate(tenantId, query.groupId, query.date);
    }

    return [];
  }

  @Get('stats/:groupId')
  async getStats(
    @CurrentUser() user: CurrentUserDto,
    @Param('groupId') groupId: string,
  ) {
    return this.attendanceService.getGroupStats(requireTenantId(user), groupId);
  }
}
```

- [ ] **Step 6: Write `services/education-service/src/attendance/attendance.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, PrismaService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
```

- [ ] **Step 7: Register `AttendanceModule` in `app.module.ts`**

Read the current `services/education-service/src/app.module.ts` first to see its exact latest
state (the Teachers/Groups plan added `TeachersModule` and `GroupsModule` imports — add this
plan's import after whichever feature-module import is currently last):

```ts
import { AttendanceModule } from './attendance/attendance.module';
```

Add `AttendanceModule` to the `imports: [` array alongside the existing entries. Do not remove or
reorder anything already there.

- [ ] **Step 8: Verify the whole service builds**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec nest build`
Expected: build succeeds, `dist/main.js` produced, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/src/attendance services/education-service/src/app.module.ts
git commit -m "feat(education-service): add group-based Attendance tracking"
```

---

## Task 5: Gateway routing

**Files:**
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`

- [ ] **Step 1: Add the new route**

Read the current `routeMap` in `services/gateway/src/proxy/proxy.middleware.ts` first, then add,
alongside the existing education-service routes:

```ts
      '/api/attendance': educationServiceUrl,
```

- [ ] **Step 2: Verify the gateway still compiles**

Run: `cd /Users/mac/Documents/smartcity/services/gateway && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/gateway/src/proxy/proxy.middleware.ts
git commit -m "feat(gateway): route /api/attendance to education-service"
```

---

## Task 6: Frontend API hooks

**Files:**
- Create: `apps/education-app/src/lib/attendance.ts`

- [ ] **Step 1: Write `apps/education-app/src/lib/attendance.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttendanceStatus, IAttendance, IGroup } from '@smartcity/types';
import { apiClient } from './api';

export interface AttendanceWithGroup extends IAttendance {
  group: IGroup;
}

export interface MarkAttendanceEntryInput {
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface BulkMarkAttendanceInput {
  groupId: string;
  date: string;
  entries: MarkAttendanceEntryInput[];
}

export interface GroupAttendanceStats {
  totalRecords: number;
  presentCount: number;
  attendanceRate: number;
}

export function useGroupAttendance(groupId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'group', groupId, date],
    queryFn: () =>
      apiClient<IAttendance[]>(`/attendance?groupId=${groupId}&date=${date}`),
    enabled: !!groupId && !!date,
  });
}

export function useStudentAttendance(studentId: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'student', studentId],
    queryFn: () =>
      apiClient<AttendanceWithGroup[]>(`/attendance?studentId=${studentId}`),
    enabled: !!studentId,
  });
}

export function useGroupAttendanceStats(groupId: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'stats', groupId],
    queryFn: () => apiClient<GroupAttendanceStats>(`/attendance/stats/${groupId}`),
    enabled: !!groupId,
  });
}

export function useBulkMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkMarkAttendanceInput) =>
      apiClient<IAttendance[]>('/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['attendance', 'group', variables.groupId, variables.date],
      });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'student'] });
    },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add apps/education-app/src/lib/attendance.ts
git commit -m "feat(education-app): add Attendance API hooks"
```

---

## Task 7: Sidebar navigation

**Files:**
- Modify: `apps/education-app/src/app/[locale]/(admin)/layout.tsx`

- [ ] **Step 1: Add the `Calendar` icon import**

In `apps/education-app/src/app/[locale]/(admin)/layout.tsx`, find the `lucide-react` import block
(currently ends with `Presentation, Layers`) and add `Calendar` to it — do not remove any existing
icon import.

- [ ] **Step 2: Add a Présence entry to `navItems`**

Find the `navItems` array's `groups` entry (the last one) and add a new entry immediately after
it, before the array's closing `];`:

```ts
    {
      href: `/${locale}/attendance`,
      label: t('education.attendance'),
      icon: Calendar,
      accent: 'text-cyan-400',
      activeBg: 'bg-cyan-500/10',
      activeBorder: 'border-cyan-400',
    },
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add "apps/education-app/src/app/[locale]/(admin)/layout.tsx"
git commit -m "feat(education-app): add Présence sidebar navigation"
```

---

## Task 8: Attendance page (mark attendance)

**Files:**
- Create: `apps/education-app/src/app/[locale]/(admin)/attendance/page.tsx`

- [ ] **Step 1: Write `apps/education-app/src/app/[locale]/(admin)/attendance/page.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton } from '@smartcity/ui';
import { AttendanceStatus } from '@smartcity/types';
import { useGroups } from '@/lib/groups';
import { useGroupStudents } from '@/lib/group-students';
import { useGroupAttendance, useBulkMarkAttendance } from '@/lib/attendance';
import { useTranslation } from '@/lib/i18n';

const STATUS_OPTIONS: { value: AttendanceStatus; labelKey: string; activeClass: string }[] = [
  { value: AttendanceStatus.PRESENT, labelKey: 'education.statusPresent', activeClass: 'bg-green-600 text-white border-green-600' },
  { value: AttendanceStatus.ABSENT, labelKey: 'education.statusAbsent', activeClass: 'bg-red-600 text-white border-red-600' },
  { value: AttendanceStatus.LATE, labelKey: 'education.statusLate', activeClass: 'bg-yellow-500 text-white border-yellow-500' },
  { value: AttendanceStatus.EXCUSED, labelKey: 'education.statusExcused', activeClass: 'bg-blue-600 text-white border-blue-600' },
];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { t } = useTranslation();
  const { data: groupsData, isLoading: isLoadingGroups } = useGroups(1, 100);
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [statusByStudent, setStatusByStudent] = useState<Record<string, AttendanceStatus>>({});
  const [notesByStudent, setNotesByStudent] = useState<Record<string, string>>({});

  const { data: enrollments, isLoading: isLoadingEnrollments } = useGroupStudents(
    groupId || undefined,
  );
  const { data: existingAttendance } = useGroupAttendance(
    groupId || undefined,
    groupId ? date : undefined,
  );
  const bulkMark = useBulkMarkAttendance();

  const students = useMemo(() => (enrollments ?? []).map((e) => e.student), [enrollments]);

  useEffect(() => {
    const nextStatus: Record<string, AttendanceStatus> = {};
    const nextNotes: Record<string, string> = {};

    for (const student of students) {
      const existing = existingAttendance?.find((a) => a.studentId === student.id);
      nextStatus[student.id] = existing?.status ?? AttendanceStatus.PRESENT;
      nextNotes[student.id] = existing?.notes ?? '';
    }

    setStatusByStudent(nextStatus);
    setNotesByStudent(nextNotes);
  }, [students, existingAttendance]);

  const markAllPresent = () => {
    const next: Record<string, AttendanceStatus> = {};
    for (const student of students) {
      next[student.id] = AttendanceStatus.PRESENT;
    }
    setStatusByStudent(next);
  };

  const handleSave = async () => {
    if (!groupId) return;

    await bulkMark.mutateAsync({
      groupId,
      date,
      entries: students.map((student) => ({
        studentId: student.id,
        status: statusByStudent[student.id] ?? AttendanceStatus.PRESENT,
        notes: notesByStudent[student.id] || undefined,
      })),
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.attendance')}</h1>
      </div>

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {t('education.selectGroupForAttendance')}
          </label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">—</option>
            {(groupsData?.data ?? []).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">{t('education.selectDate')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {!groupId && (
        <p className="text-sm text-gray-500">{t('education.selectGroupAndDatePrompt')}</p>
      )}

      {groupId && isLoadingEnrollments && <Skeleton height="6rem" />}

      {groupId && !isLoadingEnrollments && students.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <Button variant="outline" size="sm" onClick={markAllPresent}>
              {t('education.markAllPresent')}
            </Button>
            <Button onClick={handleSave} loading={bulkMark.isPending}>
              {t('education.saveAttendance')}
            </Button>
          </div>
          <div className="flex flex-col divide-y divide-gray-100">
            {students.map((student) => (
              <div key={student.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-gray-900">
                  {student.firstName} {student.lastName}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex gap-1.5">
                    {STATUS_OPTIONS.map((option) => {
                      const active = statusByStudent[student.id] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setStatusByStudent({ ...statusByStudent, [student.id]: option.value })
                          }
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active ? option.activeClass : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {t(option.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                  {statusByStudent[student.id] !== AttendanceStatus.PRESENT && (
                    <input
                      type="text"
                      placeholder={t('education.attendanceNotes')}
                      value={notesByStudent[student.id] ?? ''}
                      onChange={(e) =>
                        setNotesByStudent({ ...notesByStudent, [student.id]: e.target.value })
                      }
                      className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoadingGroups && <Skeleton height="4rem" />}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add "apps/education-app/src/app/[locale]/(admin)/attendance"
git commit -m "feat(education-app): add Attendance page with bulk mark-all-present workflow"
```

---

## Task 9: Group detail page — attendance-rate stat

**Files:**
- Modify: `apps/education-app/src/app/[locale]/(admin)/groups/[id]/page.tsx`

- [ ] **Step 1: Add the import**

In `apps/education-app/src/app/[locale]/(admin)/groups/[id]/page.tsx`, find:

```tsx
import { useGroup } from '@/lib/groups';
```

Add a new import line after it:

```tsx
import { useGroupAttendanceStats } from '@/lib/attendance';
```

Also add a `StatCard` import — find:

```tsx
import { Button, Card, CardContent, Modal, Skeleton } from '@smartcity/ui';
```

and, on a new line after it, add:

```tsx
import { CalendarCheck } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
```

- [ ] **Step 2: Call the hook and render the stat card**

Find:

```tsx
  const { data: group, isLoading: isLoadingGroup } = useGroup(groupId);
  const { data: enrollments, isLoading: isLoadingEnrollments } = useGroupStudents(groupId);
```

Replace with:

```tsx
  const { data: group, isLoading: isLoadingGroup } = useGroup(groupId);
  const { data: attendanceStats } = useGroupAttendanceStats(groupId);
  const { data: enrollments, isLoading: isLoadingEnrollments } = useGroupStudents(groupId);
```

Find the block that renders the group's teacher line:

```tsx
        <p className="mt-1 text-sm text-gray-500">
          {group.teacher
            ? `${group.teacher.firstName} ${group.teacher.lastName}`
            : t('education.noTeacherAssigned')}
        </p>
      </div>
```

Replace with (adding the stat card right after the existing info block, before the "students"
section header):

```tsx
        <p className="mt-1 text-sm text-gray-500">
          {group.teacher
            ? `${group.teacher.firstName} ${group.teacher.lastName}`
            : t('education.noTeacherAssigned')}
        </p>
      </div>

      {attendanceStats && attendanceStats.totalRecords > 0 && (
        <div className="mb-6">
          <StatCard
            icon={CalendarCheck}
            color="rose"
            label={t('education.attendanceRate')}
            value={`${attendanceStats.attendanceRate}%`}
          />
        </div>
      )}
```

(The stat card only renders once at least one attendance record exists for the group — a freshly
created group with zero recorded sessions has no meaningful rate to show.)

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add "apps/education-app/src/app/[locale]/(admin)/groups/[id]/page.tsx"
git commit -m "feat(education-app): show attendance rate on Group detail page"
```

---

## Task 10: Student detail page — attendance history

**Files:**
- Modify: `apps/education-app/src/app/[locale]/(admin)/students/[id]/page.tsx`

- [ ] **Step 1: Add the imports**

In `apps/education-app/src/app/[locale]/(admin)/students/[id]/page.tsx`, find the existing
`@smartcity/ui` import (it currently imports `Button, Input, Badge, Card, CardContent, Modal,
Skeleton`) and confirm `Badge` is already imported (it is, from the guardian-relationship
badges further down this same file — no change needed to that import line).

Find:

```tsx
import { useStudent } from '@/lib/students';
```

Add a new import line after it:

```tsx
import { useStudentAttendance } from '@/lib/attendance';
```

- [ ] **Step 2: Call the hook**

Find:

```tsx
  const { data: student, isLoading: isLoadingStudent } = useStudent(studentId);
  const { data: links, isLoading: isLoadingLinks } = useStudentGuardians(studentId);
```

Replace with:

```tsx
  const { data: student, isLoading: isLoadingStudent } = useStudent(studentId);
  const { data: links, isLoading: isLoadingLinks } = useStudentGuardians(studentId);
  const { data: attendanceHistory, isLoading: isLoadingAttendance } =
    useStudentAttendance(studentId);
```

- [ ] **Step 3: Add a status-to-badge-variant map near the top of the file**

Find the existing `RELATIONSHIP_LABEL_KEY` constant near the top of the file and add a new
constant after it (before the `RELATIONSHIP_METADATA_FIELDS` array or after — either position is
fine as long as it's a top-level constant, not inside the component function):

```tsx
const ATTENDANCE_STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
  PRESENT: 'success',
  ABSENT: 'error',
  LATE: 'warning',
  EXCUSED: 'info',
};

const ATTENDANCE_STATUS_LABEL_KEY: Record<string, string> = {
  PRESENT: 'education.statusPresent',
  ABSENT: 'education.statusAbsent',
  LATE: 'education.statusLate',
  EXCUSED: 'education.statusExcused',
};
```

- [ ] **Step 4: Render the attendance history section**

Find the file's closing structure — the second `</Modal>` (the relationship-edit modal) followed
by the component's final `</div>`:

```tsx
        </form>
      </Modal>
    </div>
  );
}
```

Replace with (inserting a new section between the second `</Modal>` and the final `</div>`):

```tsx
        </form>
      </Modal>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t('education.attendanceHistory')}
        </h2>

        {isLoadingAttendance && <Skeleton height="4rem" />}

        {!isLoadingAttendance && attendanceHistory?.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noAttendanceRecordsYet')}</p>
        )}

        {!isLoadingAttendance && attendanceHistory && attendanceHistory.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.selectDate')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.groups')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.studentStatus')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-3 text-gray-600">
                      {new Date(record.date).toLocaleDateString(locale)}
                    </td>
                    <td className="p-3 text-gray-600">{record.group.name}</td>
                    <td className="p-3">
                      <Badge variant={ATTENDANCE_STATUS_VARIANT[record.status] ?? 'default'}>
                        {t(ATTENDANCE_STATUS_LABEL_KEY[record.status] ?? record.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify the whole app builds**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec next build`
Expected: build succeeds, route table includes `/[locale]/attendance`.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add "apps/education-app/src/app/[locale]/(admin)/students/[id]/page.tsx"
git commit -m "feat(education-app): show attendance history on Student detail page"
```

---

## Task 11: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend and frontend**

Run: `cd /Users/mac/Documents/smartcity && pnpm dev:education` (plus `user-service`, `gateway`,
and a local `redis-server` running, exactly as set up in prior Education testing sessions).

- [ ] **Step 2: Log in and mark attendance via curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test-education.local","password":"TestEdu123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

GROUP_ID=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/groups \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
STUDENT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3004/group-students?groupId=$GROUP_ID" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['studentId'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"groupId\":\"$GROUP_ID\",\"date\":\"2026-08-22\",\"entries\":[{\"studentId\":\"$STUDENT_ID\",\"status\":\"PRESENT\"}]}" \
  http://localhost:3004/attendance/bulk
```

Expected: JSON array with one created attendance record, `status: "PRESENT"`.

- [ ] **Step 3: Verify stats and re-mark (upsert) behavior**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3004/attendance/stats/$GROUP_ID"
```

Expected: `{"totalRecords":1,"presentCount":1,"attendanceRate":100}`.

Re-run the Step 2 curl with `"status":"LATE"` instead of `"PRESENT"` for the same group/date/
student — expect the response to show the same record updated (not a duplicate), and re-checking
stats should now show `presentCount:0`, `attendanceRate:0` (since the only record is now LATE,
not PRESENT).

- [ ] **Step 4: Verify the UI end-to-end in the browser**

Open `http://localhost:3103/fr/login`, log in, confirm "Présence" appears in the sidebar with a
cyan accent. Open it, pick the same group, pick the same date used above — confirm the student's
existing LATE status is prefilled from Step 3, not defaulted to Present. Click "Tout marquer
présent", confirm it flips every row to Present, then save. Open the group's detail page and
confirm the attendance-rate stat card now shows 100%. Open the student's detail page and confirm
the attendance-history table shows the record with a green "Présent" badge.

- [ ] **Step 5: Report results**

No commit for this task — it's verification only. If any step fails, fix the underlying code in
the relevant earlier task and re-commit there, then re-run this task's steps.
