# Education: Teachers & Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second full-stack Education slice — Teachers and Groups, with a many-to-many Group↔Student enrollment — replicating the exact patterns the Guardians module already established (`services/education-service/src/guardians/`, `apps/education-app/src/lib/guardians.ts`, `apps/education-app/src/app/[locale]/(admin)/guardians/`).

**Architecture:** Two new Prisma models (`Teacher`, `Group`) plus one join model (`GroupStudent`), tenant-scoped exactly like every other Education model. `education-service` gets a `teachers/` module (plain CRUD, copy of `branches/`) and a `groups/` module containing both `GroupsController`/`GroupsService` (CRUD) and `GroupStudentsController`/`GroupStudentsService` (enrollment), copying the internal two-controllers-one-module shape of `guardians/`. `education-app` gets two new sidebar sections, three new `lib/*.ts` TanStack Query hook files, and three new pages (`teachers/page.tsx`, `groups/page.tsx`, `groups/[id]/page.tsx`), all styled like the existing Branches/Students/Guardians pages.

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB), class-validator — Next.js 15, React 19, `@smartcity/ui`, `@tanstack/react-query`, `lucide-react`.

---

## Deviations from the architecture docs (and why)

Same rationale as `docs/superpowers/plans/2026-08-11-education-service-foundation.md`'s own
"Deviations" section — this plan intentionally builds a smaller slice than
`docs/education/architecture/05-module-specifications.md` modules 5/6 describe, matching the
scope of the user's reference project (`bestqrov/app-injahi`) instead:

- **No `Program`/`Subject`/`Level` entities.** `level` and `subject` stay free-text strings on
  `Teacher`/`Group`, not foreign keys to a curriculum hierarchy. `app-injahi`'s actual `Group`
  model does the same (`level String?`, `subject String?`).
- **`Group.teacherId` is optional**, not the stricter "no group without an assigned teacher"
  rule module 6 proposes — matches `app-injahi`'s `teacher Teacher? @relation(...)`.
- **No HR features** (contracts, payroll, performance reviews) — module 5 of the architecture
  doc explicitly recommends deferring these itself ("يمكن تأجيل ميزات HR المتقدمة").
- **No Timetable / room-conflict detection** (module 7) and **no Attendance** (module 8, which
  depends on Timetable existing first per the doc's own dependency note). `Group` has no
  `timeSlots` field in this slice.
- **No automated tests** — same justification as Phase 1: zero `.spec.ts` files or working
  `jest.config` exist anywhere in `services/` or `apps/` in this repo today. Verification here
  uses `tsc --noEmit`, `nest build`, and manual `curl`/browser checks.

---

## File Structure

```
packages/database/prisma/schema.prisma        # modify: + PaymentType enum, Teacher/Group/GroupStudent models, back-refs
packages/shared-types/src/education.types.ts  # modify: + ITeacher, IGroup, IGroupStudent, PaymentType

packages/i18n/locales/{en,fr,ar}.json         # modify: + teacher/group education.* keys

services/education-service/
  src/app.module.ts                            # modify: + TeachersModule, GroupsModule
  src/teachers/dto/create-teacher.dto.ts        # create
  src/teachers/dto/update-teacher.dto.ts        # create
  src/teachers/teachers.service.ts              # create
  src/teachers/teachers.controller.ts           # create
  src/teachers/teachers.module.ts               # create
  src/groups/dto/create-group.dto.ts            # create
  src/groups/dto/update-group.dto.ts            # create
  src/groups/dto/create-group-student.dto.ts    # create
  src/groups/dto/find-group-students-query.dto.ts # create
  src/groups/groups.service.ts                  # create
  src/groups/groups.controller.ts                # create
  src/groups/group-students.service.ts           # create
  src/groups/group-students.controller.ts         # create
  src/groups/groups.module.ts                    # create

services/gateway/src/proxy/proxy.middleware.ts # modify: + /teachers, /groups, /group-students routes

apps/education-app/
  src/lib/teachers.ts                            # create
  src/lib/groups.ts                              # create
  src/lib/group-students.ts                      # create
  src/app/[locale]/(admin)/layout.tsx             # modify: + Teachers/Groups nav items
  src/app/[locale]/(admin)/teachers/page.tsx      # create
  src/app/[locale]/(admin)/groups/page.tsx        # create
  src/app/[locale]/(admin)/groups/[id]/page.tsx   # create
```

---

## Task 1: Prisma schema — Teacher, Group, GroupStudent

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add the `PaymentType` enum and back-reference fields**

Find the `enum StudentStatus` block (near the end of the file, after `PurchaseItem`) and, directly
above it, insert:

```prisma
enum PaymentType {
  HOURLY
  FIXED
  PERCENTAGE
}

```

- [ ] **Step 2: Add `teachers`, `groups`, `groupStudents` back-refs to `Tenant`**

Find (inside the `Tenant` model, the block added by Phase 1):

```prisma
  branches          Branch[]
  students          Student[]
```

Replace with:

```prisma
  branches          Branch[]
  students          Student[]
  teachers          Teacher[]
  groups            Group[]
  groupStudents     GroupStudent[]
```

(If Guardians already added lines after `students Student[]` here — e.g. `guardians
Guardian[]` — append the three new lines after whatever is already there instead of replacing;
the goal is that all six relation arrays end up listed on `Tenant`.)

- [ ] **Step 3: Add `groups` and `groupLinks` back-refs to `Branch` and `Student`**

Find the `Branch` model's `students Student[]` line and add a sibling:

```prisma
  students Student[]
  groups   Group[]
```

Find the `Student` model's relation block (it currently ends with `branch Branch
@relation(...)` plus whatever Guardians added) and add:

```prisma
  groupLinks GroupStudent[]
```

- [ ] **Step 4: Append the `Teacher`, `Group`, `GroupStudent` models**

At the very end of `packages/database/prisma/schema.prisma`, append:

```prisma

model Teacher {
  id          String      @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String      @db.ObjectId
  firstName   String
  lastName    String
  email       String?
  phone       String?
  specialties String[]
  levels      String[]
  hourlyRate  Float       @default(0)
  paymentType PaymentType @default(HOURLY)
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant Tenant  @relation(fields: [tenantId], references: [id])
  groups Group[]

  @@map("teachers")
}

model Group {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String   @db.ObjectId
  branchId  String   @db.ObjectId
  name      String
  level     String?
  subject   String?
  room      String?
  teacherId String?  @db.ObjectId
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant   Tenant         @relation(fields: [tenantId], references: [id])
  branch   Branch         @relation(fields: [branchId], references: [id])
  teacher  Teacher?       @relation(fields: [teacherId], references: [id])
  students GroupStudent[]

  @@map("groups")
}

model GroupStudent {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String   @db.ObjectId
  groupId   String   @db.ObjectId
  studentId String   @db.ObjectId
  createdAt DateTime @default(now())

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  group   Group   @relation(fields: [groupId], references: [id])
  student Student @relation(fields: [studentId], references: [id])

  @@unique([groupId, studentId])
  @@map("group_students")
}
```

- [ ] **Step 5: Regenerate the Prisma client**

Run: `cd /Users/mac/Documents/smartcity && pnpm --filter @smartcity/database run db:generate`
Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 6: Push the new models to the database**

Run: `cd /Users/mac/Documents/smartcity && pnpm --filter @smartcity/database run db:push`
Expected: output confirming `teachers`, `groups`, `group_students` collections are in sync.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add Teacher, Group, GroupStudent models"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared-types/src/education.types.ts`

- [ ] **Step 1: Append to `packages/shared-types/src/education.types.ts`**

```ts
export enum PaymentType {
  HOURLY = "HOURLY",
  FIXED = "FIXED",
  PERCENTAGE = "PERCENTAGE",
}

export interface ITeacher {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  specialties: string[];
  levels: string[];
  hourlyRate: number;
  paymentType: PaymentType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroup {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  level?: string;
  subject?: string;
  room?: string;
  teacherId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroupStudent {
  id: string;
  tenantId: string;
  groupId: string;
  studentId: string;
  createdAt: Date;
}
```

- [ ] **Step 2: Verify the package still compiles**

Run: `cd /Users/mac/Documents/smartcity/packages/shared-types && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/shared-types/src/education.types.ts
git commit -m "feat(shared-types): add ITeacher/IGroup/IGroupStudent types"
```

---

## Task 3: i18n — teacher/group keys

**Files:**
- Modify: `packages/i18n/locales/en.json`
- Modify: `packages/i18n/locales/fr.json`
- Modify: `packages/i18n/locales/ar.json`

- [ ] **Step 1: Add keys to `packages/i18n/locales/en.json`**

Find the `education` block's `"confirmRemoveGuardian"` line (its last key) and change the line
from:

```json
    "confirmRemoveGuardian": "Remove this guardian from the student?"
```

to (adding a trailing comma and the new keys, keeping the block's closing `}` right after):

```json
    "confirmRemoveGuardian": "Remove this guardian from the student?",
    "teachers": "Teachers",
    "addTeacher": "Add teacher",
    "editTeacher": "Edit teacher",
    "teacherFirstName": "First name",
    "teacherLastName": "Last name",
    "teacherEmail": "Email",
    "teacherPhone": "Phone",
    "teacherSpecialties": "Specialties (comma-separated)",
    "teacherLevels": "Levels (comma-separated)",
    "teacherHourlyRate": "Hourly rate",
    "noTeachersYet": "No teachers yet. Add your first teacher to get started.",
    "groups": "Groups",
    "addGroup": "Add group",
    "groupName": "Group name",
    "groupLevel": "Level",
    "groupSubject": "Subject",
    "groupRoom": "Room",
    "groupBranch": "Branch",
    "groupTeacher": "Teacher",
    "noGroupsYet": "No groups yet. Add your first group to get started.",
    "noTeacherAssigned": "No teacher assigned",
    "groupStudents": "Students in this group",
    "enrollStudent": "Enroll student",
    "selectStudent": "Select a student",
    "noStudentsEnrolledYet": "No students enrolled yet.",
    "removeFromGroup": "Remove",
    "confirmRemoveFromGroup": "Remove this student from the group?",
    "backToGroups": "Back to groups"
```

(Note the exact `"confirmRemoveGuardian"` line's original trailing content — whatever punctuation
follows it in the file today — must be preserved, only its trailing character changes from `}`-
adjacent (no comma, since it was the last key) to a comma before the new keys. Read the file first
to confirm the exact current text before editing, since Guardians work landed after this plan was
drafted and the exact final key/line may differ slightly.)

- [ ] **Step 2: Add the equivalent French block to `packages/i18n/locales/fr.json`**, same
  position:

```json
    "teachers": "Enseignants",
    "addTeacher": "Ajouter un enseignant",
    "editTeacher": "Modifier l'enseignant",
    "teacherFirstName": "Prénom",
    "teacherLastName": "Nom",
    "teacherEmail": "Email",
    "teacherPhone": "Téléphone",
    "teacherSpecialties": "Spécialités (séparées par des virgules)",
    "teacherLevels": "Niveaux (séparés par des virgules)",
    "teacherHourlyRate": "Taux horaire",
    "noTeachersYet": "Aucun enseignant pour l'instant. Ajoutez votre premier enseignant.",
    "groups": "Groupes",
    "addGroup": "Ajouter un groupe",
    "groupName": "Nom du groupe",
    "groupLevel": "Niveau",
    "groupSubject": "Matière",
    "groupRoom": "Salle",
    "groupBranch": "Filiale",
    "groupTeacher": "Enseignant",
    "noGroupsYet": "Aucun groupe pour l'instant. Ajoutez votre premier groupe.",
    "noTeacherAssigned": "Aucun enseignant assigné",
    "groupStudents": "Étudiants du groupe",
    "enrollStudent": "Inscrire un étudiant",
    "selectStudent": "Sélectionner un étudiant",
    "noStudentsEnrolledYet": "Aucun étudiant inscrit pour l'instant.",
    "removeFromGroup": "Retirer",
    "confirmRemoveFromGroup": "Retirer cet étudiant du groupe ?",
    "backToGroups": "Retour aux groupes"
```

- [ ] **Step 3: Add the equivalent Arabic block to `packages/i18n/locales/ar.json`**, same
  position:

```json
    "teachers": "الأساتذة",
    "addTeacher": "إضافة أستاذ",
    "editTeacher": "تعديل الأستاذ",
    "teacherFirstName": "الاسم الشخصي",
    "teacherLastName": "الاسم العائلي",
    "teacherEmail": "البريد الإلكتروني",
    "teacherPhone": "الهاتف",
    "teacherSpecialties": "التخصصات (مفصولة بفاصلة)",
    "teacherLevels": "المستويات (مفصولة بفاصلة)",
    "teacherHourlyRate": "الأجر بالساعة",
    "noTeachersYet": "لا يوجد أساتذة بعد. أضف أول أستاذ للبدء.",
    "groups": "الأفواج",
    "addGroup": "إضافة فوج",
    "groupName": "اسم الفوج",
    "groupLevel": "المستوى",
    "groupSubject": "المادة",
    "groupRoom": "القاعة",
    "groupBranch": "الفرع",
    "groupTeacher": "الأستاذ",
    "noGroupsYet": "لا توجد أفواج بعد. أضف أول فوج للبدء.",
    "noTeacherAssigned": "لم يُعيَّن أستاذ",
    "groupStudents": "طلبة الفوج",
    "enrollStudent": "تسجيل طالب",
    "selectStudent": "اختر طالبًا",
    "noStudentsEnrolledYet": "لا يوجد طلبة مسجلين بعد.",
    "removeFromGroup": "إزالة",
    "confirmRemoveFromGroup": "إزالة هذا الطالب من الفوج؟",
    "backToGroups": "العودة إلى الأفواج"
```

- [ ] **Step 4: Validate all three files are still valid JSON**

Run: `node -e "['en','fr','ar'].forEach(l => { require('/Users/mac/Documents/smartcity/packages/i18n/locales/'+l+'.json'); console.log(l, 'OK'); })"`
Expected: `en OK`, `fr OK`, `ar OK`.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/i18n/locales/en.json packages/i18n/locales/fr.json packages/i18n/locales/ar.json
git commit -m "feat(i18n): add teacher/group education namespace keys (en/fr/ar)"
```

---

## Task 4: Teachers module (backend)

**Files:**
- Create: `services/education-service/src/teachers/dto/create-teacher.dto.ts`
- Create: `services/education-service/src/teachers/dto/update-teacher.dto.ts`
- Create: `services/education-service/src/teachers/teachers.service.ts`
- Create: `services/education-service/src/teachers/teachers.controller.ts`
- Create: `services/education-service/src/teachers/teachers.module.ts`
- Modify: `services/education-service/src/app.module.ts`

- [ ] **Step 1: Write `services/education-service/src/teachers/dto/create-teacher.dto.ts`**

```ts
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentType } from '@prisma/client';
import { IsValidPhone } from '../../common/is-valid-phone.validator';

export class CreateTeacherDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsValidPhone()
  @IsOptional()
  phone?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specialties?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  levels?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  hourlyRate?: number;

  @IsEnum(PaymentType)
  @IsOptional()
  paymentType?: PaymentType;
}
```

- [ ] **Step 2: Write `services/education-service/src/teachers/dto/update-teacher.dto.ts`**

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateTeacherDto } from './create-teacher.dto';

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}
```

- [ ] **Step 3: Write `services/education-service/src/teachers/teachers.service.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

interface FindAllParams {
  page: number;
  limit: number;
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateTeacherDto) {
    return this.prisma.teacher.create({
      data: {
        ...dto,
        specialties: dto.specialties ?? [],
        levels: dto.levels ?? [],
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = { tenantId, isActive: true };

    const [teachers, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return {
      data: teachers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return teacher;
  }

  async update(tenantId: string, id: string, dto: UpdateTeacherDto) {
    await this.findById(tenantId, id);

    return this.prisma.teacher.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    await this.prisma.teacher.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Teacher deactivated successfully' };
  }
}
```

- [ ] **Step 4: Write `services/education-service/src/teachers/teachers.controller.ts`**

```ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateTeacherDto) {
    return this.teachersService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.teachersService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.teachersService.findById(requireTenantId(user), id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teachersService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.teachersService.deactivate(requireTenantId(user), id);
  }
}
```

- [ ] **Step 5: Write `services/education-service/src/teachers/teachers.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TeachersController],
  providers: [TeachersService, PrismaService],
  exports: [TeachersService],
})
export class TeachersModule {}
```

- [ ] **Step 6: Register `TeachersModule` in `app.module.ts`**

In `services/education-service/src/app.module.ts`, find:

```ts
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { StudentsModule } from './students/students.module';
```

Add a new import line after the last feature-module import (whatever that is — Guardians work may
have already added a `GuardiansModule` import; add this line after it):

```ts
import { TeachersModule } from './teachers/teachers.module';
```

Then find the `imports: [` array inside `@Module({...})` and add `TeachersModule` to it, in the
same list as `BranchesModule`, `StudentsModule`, etc.

- [ ] **Step 7: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/src/teachers services/education-service/src/app.module.ts
git commit -m "feat(education-service): add tenant-scoped Teachers CRUD"
```

---

## Task 5: Groups + GroupStudents module (backend)

**Files:**
- Create: `services/education-service/src/groups/dto/create-group.dto.ts`
- Create: `services/education-service/src/groups/dto/update-group.dto.ts`
- Create: `services/education-service/src/groups/dto/create-group-student.dto.ts`
- Create: `services/education-service/src/groups/dto/find-group-students-query.dto.ts`
- Create: `services/education-service/src/groups/groups.service.ts`
- Create: `services/education-service/src/groups/groups.controller.ts`
- Create: `services/education-service/src/groups/group-students.service.ts`
- Create: `services/education-service/src/groups/group-students.controller.ts`
- Create: `services/education-service/src/groups/groups.module.ts`
- Modify: `services/education-service/src/app.module.ts`

- [ ] **Step 1: Write `services/education-service/src/groups/dto/create-group.dto.ts`**

```ts
import { IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsMongoId()
  branchId: string;

  @IsString()
  @IsOptional()
  level?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsMongoId()
  @IsOptional()
  teacherId?: string;
}
```

- [ ] **Step 2: Write `services/education-service/src/groups/dto/update-group.dto.ts`**

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateGroupDto } from './create-group.dto';

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}
```

- [ ] **Step 3: Write `services/education-service/src/groups/dto/create-group-student.dto.ts`**

```ts
import { IsMongoId } from 'class-validator';

export class CreateGroupStudentDto {
  @IsMongoId()
  groupId: string;

  @IsMongoId()
  studentId: string;
}
```

- [ ] **Step 4: Write `services/education-service/src/groups/dto/find-group-students-query.dto.ts`**

```ts
import { IsMongoId, IsOptional } from 'class-validator';

export class FindGroupStudentsQueryDto {
  @IsMongoId()
  @IsOptional()
  groupId?: string;

  @IsMongoId()
  @IsOptional()
  studentId?: string;
}
```

- [ ] **Step 5: Write `services/education-service/src/groups/groups.service.ts`**

Same tenant-scoping discipline as `StudentsService`/`GuardiansService`: `create`/`update`
re-validate that `branchId` (and `teacherId`, when given) belong to the same tenant before
writing.

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

interface FindAllParams {
  page: number;
  limit: number;
}

const INCLUDE_RELATIONS = { teacher: true, branch: true } as const;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertBranchInTenant(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new BadRequestException('branchId does not belong to this tenant');
    }
  }

  private async assertTeacherInTenant(tenantId: string, teacherId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
    });

    if (!teacher) {
      throw new BadRequestException('teacherId does not belong to this tenant');
    }
  }

  async create(tenantId: string, dto: CreateGroupDto) {
    await this.assertBranchInTenant(tenantId, dto.branchId);
    if (dto.teacherId) {
      await this.assertTeacherInTenant(tenantId, dto.teacherId);
    }

    return this.prisma.group.create({
      data: { ...dto, tenantId },
      include: INCLUDE_RELATIONS,
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = { tenantId, isActive: true };

    const [groups, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: INCLUDE_RELATIONS,
      }),
      this.prisma.group.count({ where }),
    ]);

    return {
      data: groups,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, tenantId },
      include: INCLUDE_RELATIONS,
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async update(tenantId: string, id: string, dto: UpdateGroupDto) {
    await this.findById(tenantId, id);

    if (dto.branchId) {
      await this.assertBranchInTenant(tenantId, dto.branchId);
    }
    if (dto.teacherId) {
      await this.assertTeacherInTenant(tenantId, dto.teacherId);
    }

    return this.prisma.group.update({
      where: { id },
      data: dto,
      include: INCLUDE_RELATIONS,
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    await this.prisma.group.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Group deactivated successfully' };
  }
}
```

- [ ] **Step 6: Write `services/education-service/src/groups/groups.controller.ts`**

```ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.groupsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.groupsService.findById(requireTenantId(user), id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.groupsService.deactivate(requireTenantId(user), id);
  }
}
```

- [ ] **Step 7: Write `services/education-service/src/groups/group-students.service.ts`**

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateGroupStudentDto } from './dto/create-group-student.dto';

interface FindAllParams {
  groupId?: string;
  studentId?: string;
}

@Injectable()
export class GroupStudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertGroupInTenant(tenantId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });

    if (!group) {
      throw new BadRequestException('groupId does not belong to this tenant');
    }
  }

  private async assertStudentInTenant(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });

    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }
  }

  async create(tenantId: string, dto: CreateGroupStudentDto) {
    await this.assertGroupInTenant(tenantId, dto.groupId);
    await this.assertStudentInTenant(tenantId, dto.studentId);

    const existing = await this.prisma.groupStudent.findFirst({
      where: { tenantId, groupId: dto.groupId, studentId: dto.studentId },
    });

    if (existing) {
      throw new ConflictException('This student is already enrolled in this group');
    }

    return this.prisma.groupStudent.create({
      data: { tenantId, groupId: dto.groupId, studentId: dto.studentId },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { groupId, studentId } = params;

    const where: Record<string, unknown> = { tenantId };
    if (groupId) where.groupId = groupId;
    if (studentId) where.studentId = studentId;

    return this.prisma.groupStudent.findMany({
      where,
      include: { student: true, group: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const link = await this.prisma.groupStudent.findFirst({
      where: { id, tenantId },
    });

    if (!link) {
      throw new NotFoundException('Enrollment not found');
    }

    return link;
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    await this.prisma.groupStudent.delete({ where: { id } });

    return { message: 'Student removed from group successfully' };
  }
}
```

- [ ] **Step 8: Write `services/education-service/src/groups/group-students.controller.ts`**

```ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { GroupStudentsService } from './group-students.service';
import { CreateGroupStudentDto } from './dto/create-group-student.dto';
import { FindGroupStudentsQueryDto } from './dto/find-group-students-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('group-students')
export class GroupStudentsController {
  constructor(private readonly groupStudentsService: GroupStudentsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateGroupStudentDto,
  ) {
    return this.groupStudentsService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query() query: FindGroupStudentsQueryDto,
  ) {
    return this.groupStudentsService.findAll(requireTenantId(user), {
      groupId: query.groupId,
      studentId: query.studentId,
    });
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.groupStudentsService.remove(requireTenantId(user), id);
  }
}
```

- [ ] **Step 9: Write `services/education-service/src/groups/groups.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupStudentsController } from './group-students.controller';
import { GroupStudentsService } from './group-students.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GroupsController, GroupStudentsController],
  providers: [GroupsService, GroupStudentsService, PrismaService],
  exports: [GroupsService, GroupStudentsService],
})
export class GroupsModule {}
```

- [ ] **Step 10: Register `GroupsModule` in `app.module.ts`**

In `services/education-service/src/app.module.ts`, add:

```ts
import { GroupsModule } from './groups/groups.module';
```

after the `TeachersModule` import from Task 4, and add `GroupsModule` to the `imports: [` array.

- [ ] **Step 11: Verify the whole service builds**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec nest build`
Expected: build succeeds, `dist/main.js` produced, no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/src/groups services/education-service/src/app.module.ts
git commit -m "feat(education-service): add tenant-scoped Groups CRUD and GroupStudent enrollment"
```

---

## Task 6: Gateway routing

**Files:**
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`

- [ ] **Step 1: Add the three new routes**

In `services/gateway/src/proxy/proxy.middleware.ts`, find the `routeMap` entries added by Phase 1
(`'/api/branches': educationServiceUrl,` and `'/api/students': educationServiceUrl,` — Guardians
work may have already added `'/api/guardians'`/`'/api/student-guardians'` here too). Add, in the
same object, alongside whichever of those lines already exist:

```ts
      '/api/teachers': educationServiceUrl,
      '/api/groups': educationServiceUrl,
      '/api/group-students': educationServiceUrl,
```

- [ ] **Step 2: Verify the gateway still compiles**

Run: `cd /Users/mac/Documents/smartcity/services/gateway && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/gateway/src/proxy/proxy.middleware.ts
git commit -m "feat(gateway): route /api/teachers, /api/groups, /api/group-students to education-service"
```

---

## Task 7: Frontend API hooks

**Files:**
- Create: `apps/education-app/src/lib/teachers.ts`
- Create: `apps/education-app/src/lib/groups.ts`
- Create: `apps/education-app/src/lib/group-students.ts`

- [ ] **Step 1: Write `apps/education-app/src/lib/teachers.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ITeacher, PaymentType } from '@smartcity/types';
import { apiClient } from './api';

interface TeacherListResponse {
  data: ITeacher[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateTeacherInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  specialties?: string[];
  levels?: string[];
  hourlyRate?: number;
  paymentType?: PaymentType;
}

export type UpdateTeacherInput = Partial<CreateTeacherInput>;

export function useTeachers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['teachers', page, limit],
    queryFn: () =>
      apiClient<TeacherListResponse>(`/teachers?page=${page}&limit=${limit}`),
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTeacherInput) =>
      apiClient<ITeacher>('/teachers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useUpdateTeacher(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTeacherInput) =>
      apiClient<ITeacher>(`/teachers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/teachers/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}
```

- [ ] **Step 2: Write `apps/education-app/src/lib/groups.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IBranch, IGroup, ITeacher } from '@smartcity/types';
import { apiClient } from './api';

export interface GroupWithRelations extends IGroup {
  teacher?: ITeacher | null;
  branch?: IBranch;
}

interface GroupListResponse {
  data: GroupWithRelations[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateGroupInput {
  name: string;
  branchId: string;
  level?: string;
  subject?: string;
  room?: string;
  teacherId?: string;
}

export type UpdateGroupInput = Partial<CreateGroupInput>;

export function useGroups(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['groups', page, limit],
    queryFn: () => apiClient<GroupListResponse>(`/groups?page=${page}&limit=${limit}`),
  });
}

export function useGroup(id: string | undefined) {
  return useQuery({
    queryKey: ['groups', id],
    queryFn: () => apiClient<GroupWithRelations>(`/groups/${id}`),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGroupInput) =>
      apiClient<GroupWithRelations>('/groups', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useUpdateGroup(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateGroupInput) =>
      apiClient<GroupWithRelations>(`/groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/groups/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}
```

- [ ] **Step 3: Write `apps/education-app/src/lib/group-students.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IGroupStudent, IStudent } from '@smartcity/types';
import { apiClient } from './api';

export interface GroupStudentWithStudent extends IGroupStudent {
  student: IStudent;
}

export interface CreateGroupStudentInput {
  groupId: string;
  studentId: string;
}

export function useGroupStudents(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-students', groupId],
    queryFn: () =>
      apiClient<GroupStudentWithStudent[]>(`/group-students?groupId=${groupId}`),
    enabled: !!groupId,
  });
}

export function useCreateGroupStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGroupStudentInput) =>
      apiClient<IGroupStudent>('/group-students', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['group-students', variables.groupId],
      });
    },
  });
}

export function useRemoveGroupStudent(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/group-students/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-students', groupId] });
    },
  });
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: errors only about the not-yet-created page files from Tasks 8–10 (if any are already
referenced) — no errors inside `src/lib/`.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add apps/education-app/src/lib/teachers.ts apps/education-app/src/lib/groups.ts apps/education-app/src/lib/group-students.ts
git commit -m "feat(education-app): add Teachers/Groups/GroupStudents API hooks"
```

---

## Task 8: Sidebar navigation

**Files:**
- Modify: `apps/education-app/src/app/[locale]/(admin)/layout.tsx`

- [ ] **Step 1: Add two new icon imports**

In `apps/education-app/src/app/[locale]/(admin)/layout.tsx`, find:

```ts
import {
  GraduationCap,
  Building2,
  Users,
  UserRound,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
```

Replace with:

```ts
import {
  GraduationCap,
  Building2,
  Users,
  UserRound,
  LogOut,
  Menu,
  X,
  Presentation,
  Layers,
} from 'lucide-react';
```

- [ ] **Step 2: Add Teachers and Groups to `navItems`**

Find the `navItems` array (three entries: branches, students, guardians) and add two more entries
after the `guardians` one:

```ts
    {
      href: `/${locale}/teachers`,
      label: t('education.teachers'),
      icon: Presentation,
      accent: 'text-violet-400',
      activeBg: 'bg-violet-500/10',
      activeBorder: 'border-violet-400',
    },
    {
      href: `/${locale}/groups`,
      label: t('education.groups'),
      icon: Layers,
      accent: 'text-rose-400',
      activeBg: 'bg-rose-500/10',
      activeBorder: 'border-rose-400',
    },
```

(Insert this right after the closing `},` of the `guardians` entry and before the closing `];` of
the `navItems` array.)

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no new errors from this file (page-not-found errors for `/teachers`/`/groups` routes
don't surface as TypeScript errors — Next.js resolves `href` strings at runtime, not compile
time).

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add "apps/education-app/src/app/[locale]/(admin)/layout.tsx"
git commit -m "feat(education-app): add Teachers/Groups sidebar navigation"
```

---

## Task 9: Teachers page

**Files:**
- Create: `apps/education-app/src/app/[locale]/(admin)/teachers/page.tsx`

- [ ] **Step 1: Write `apps/education-app/src/app/[locale]/(admin)/teachers/page.tsx`**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import {
  Button,
  Input,
  Card,
  CardContent,
  Modal,
  Skeleton,
} from '@smartcity/ui';
import { PaymentType } from '@smartcity/types';
import type { ITeacher } from '@smartcity/types';
import {
  useTeachers,
  useCreateTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
} from '@/lib/teachers';
import { useTranslation } from '@/lib/i18n';

interface TeacherFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialties: string;
  levels: string;
  hourlyRate: string;
}

const EMPTY_FORM: TeacherFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  specialties: '',
  levels: '',
  hourlyRate: '',
};

function toCommaList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function TeachersPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useTeachers();
  const createTeacher = useCreateTeacher();
  const deleteTeacher = useDeleteTeacher();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<ITeacher | null>(null);
  const [form, setForm] = useState<TeacherFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const updateTeacher = useUpdateTeacher(editingTeacher?.id ?? '');

  const openCreateModal = () => {
    setEditingTeacher(null);
    setForm(EMPTY_FORM);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (teacher: ITeacher) => {
    setEditingTeacher(teacher);
    setForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email ?? '',
      phone: teacher.phone ?? '',
      specialties: teacher.specialties.join(', '),
      levels: teacher.levels.join(', '),
      hourlyRate: String(teacher.hourlyRate),
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const input = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      specialties: toCommaList(form.specialties),
      levels: toCommaList(form.levels),
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
      paymentType: PaymentType.HOURLY,
    };

    try {
      if (editingTeacher) {
        await updateTeacher.mutateAsync(input);
      } else {
        await createTeacher.mutateAsync(input);
      }
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      setEditingTeacher(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTeacher.mutateAsync(id);
  };

  const isSaving = createTeacher.isPending || updateTeacher.isPending;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.teachers')}</h1>
        <Button onClick={openCreateModal}>{t('education.addTeacher')}</Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noTeachersYet')}</p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((teacher) => (
            <Card key={teacher.id}>
              <CardContent>
                <p className="font-medium text-gray-900">
                  {teacher.firstName} {teacher.lastName}
                </p>
                {teacher.email && (
                  <p className="mt-1 text-sm text-gray-500">{teacher.email}</p>
                )}
                {teacher.phone && <p className="text-sm text-gray-500">{teacher.phone}</p>}
                {teacher.specialties.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    {teacher.specialties.join(', ')}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditModal(teacher)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(teacher.id)}
                    loading={deleteTeacher.isPending}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeacher ? t('education.editTeacher') : t('education.addTeacher')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.teacherFirstName')}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <Input
            label={t('education.teacherLastName')}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
          <Input
            label={t('education.teacherEmail')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label={t('education.teacherPhone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label={t('education.teacherSpecialties')}
            value={form.specialties}
            onChange={(e) => setForm({ ...form, specialties: e.target.value })}
          />
          <Input
            label={t('education.teacherLevels')}
            value={form.levels}
            onChange={(e) => setForm({ ...form, levels: e.target.value })}
          />
          <Input
            label={t('education.teacherHourlyRate')}
            type="number"
            min="0"
            step="0.01"
            value={form.hourlyRate}
            onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
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
git add "apps/education-app/src/app/[locale]/(admin)/teachers"
git commit -m "feat(education-app): add Teachers page"
```

---

## Task 10: Groups list page

**Files:**
- Create: `apps/education-app/src/app/[locale]/(admin)/groups/page.tsx`

- [ ] **Step 1: Write `apps/education-app/src/app/[locale]/(admin)/groups/page.tsx`**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Button,
  Input,
  Card,
  CardContent,
  Modal,
  Skeleton,
} from '@smartcity/ui';
import { useGroups, useCreateGroup } from '@/lib/groups';
import { useBranches } from '@/lib/branches';
import { useTeachers } from '@/lib/teachers';
import { useTranslation } from '@/lib/i18n';

interface GroupFormState {
  name: string;
  branchId: string;
  level: string;
  subject: string;
  room: string;
  teacherId: string;
}

const EMPTY_FORM: GroupFormState = {
  name: '',
  branchId: '',
  level: '',
  subject: '',
  room: '',
  teacherId: '',
};

export default function GroupsPage() {
  const { t } = useTranslation();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const { data, isLoading } = useGroups();
  const { data: branchesData } = useBranches(1, 100);
  const { data: teachersData } = useTeachers(1, 100);
  const createGroup = useCreateGroup();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<GroupFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await createGroup.mutateAsync({
        name: form.name,
        branchId: form.branchId,
        level: form.level || undefined,
        subject: form.subject || undefined,
        room: form.room || undefined,
        teacherId: form.teacherId || undefined,
      });
      setForm(EMPTY_FORM);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.groups')}</h1>
        <Button onClick={() => setIsModalOpen(true)}>{t('education.addGroup')}</Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noGroupsYet')}</p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((group) => (
            <Link key={group.id} href={`/${locale}/groups/${group.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent>
                  <p className="font-medium text-gray-900">{group.name}</p>
                  {(group.subject || group.level) && (
                    <p className="mt-1 text-sm text-gray-500">
                      {[group.subject, group.level].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    {group.teacher
                      ? `${group.teacher.firstName} ${group.teacher.lastName}`
                      : t('education.noTeacherAssigned')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.addGroup')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={createGroup.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.groupName')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.groupBranch')}
            </label>
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {(branchesData?.data ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label={t('education.groupLevel')}
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
          />
          <Input
            label={t('education.groupSubject')}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <Input
            label={t('education.groupRoom')}
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.groupTeacher')}
            </label>
            <select
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('education.noTeacherAssigned')}</option>
              {(teachersData?.data ?? []).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors. (This assumes `apps/education-app/src/lib/branches.ts` already exports
`useBranches` accepting `(page, limit)` args — it does, from Phase 1's `useBranches()` default-arg
signature `(page = 1, limit = 20)`.)

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add "apps/education-app/src/app/[locale]/(admin)/groups/page.tsx"
git commit -m "feat(education-app): add Groups list page"
```

---

## Task 11: Group detail page (student enrollment)

**Files:**
- Create: `apps/education-app/src/app/[locale]/(admin)/groups/[id]/page.tsx`

- [ ] **Step 1: Write `apps/education-app/src/app/[locale]/(admin)/groups/[id]/page.tsx`**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent, Modal, Skeleton } from '@smartcity/ui';
import { useGroup } from '@/lib/groups';
import { useStudents } from '@/lib/students';
import {
  useGroupStudents,
  useCreateGroupStudent,
  useRemoveGroupStudent,
} from '@/lib/group-students';
import { useTranslation } from '@/lib/i18n';

export default function GroupDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const groupId = params?.id as string;

  const { data: group, isLoading: isLoadingGroup } = useGroup(groupId);
  const { data: enrollments, isLoading: isLoadingEnrollments } = useGroupStudents(groupId);
  const { data: studentsData } = useStudents(1, 100);

  const createEnrollment = useCreateGroupStudent();
  const removeEnrollment = useRemoveGroupStudent(groupId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enrolledStudentIds = new Set((enrollments ?? []).map((e) => e.studentId));
  const availableStudents = (studentsData?.data ?? []).filter(
    (s) => !enrolledStudentIds.has(s.id),
  );

  const handleEnroll = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await createEnrollment.mutateAsync({ groupId, studentId: selectedStudentId });
      setSelectedStudentId('');
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm(t('education.confirmRemoveFromGroup'))) return;
    await removeEnrollment.mutateAsync(id);
  };

  if (isLoadingGroup) {
    return <Skeleton height="6rem" />;
  }

  if (!group) {
    return null;
  }

  return (
    <div>
      <Link href={`/${locale}/groups`} className="text-sm text-primary-700 hover:underline">
        &larr; {t('education.backToGroups')}
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{group.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {[group.subject, group.level, group.room].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {group.teacher
            ? `${group.teacher.firstName} ${group.teacher.lastName}`
            : t('education.noTeacherAssigned')}
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t('education.groupStudents')}</h2>
        <Button onClick={() => setIsModalOpen(true)}>{t('education.enrollStudent')}</Button>
      </div>

      {isLoadingEnrollments && <Skeleton height="4rem" />}

      {!isLoadingEnrollments && enrollments?.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noStudentsEnrolledYet')}</p>
      )}

      {!isLoadingEnrollments && enrollments && enrollments.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {enrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardContent>
                <p className="font-medium text-gray-900">
                  {enrollment.student.firstName} {enrollment.student.lastName}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {enrollment.student.registrationNumber}
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRemove(enrollment.id)}
                    loading={removeEnrollment.isPending}
                  >
                    {t('education.removeFromGroup')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.enrollStudent')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEnroll} loading={createEnrollment.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleEnroll} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.selectStudent')}
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {availableStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName} ({student.registrationNumber})
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verify the whole app builds**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec next build`
Expected: build succeeds (`✓ Compiled successfully`), all routes including `/[locale]/teachers`,
`/[locale]/groups`, `/[locale]/groups/[id]` listed in the output route table.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add "apps/education-app/src/app/[locale]/(admin)/groups/[id]"
git commit -m "feat(education-app): add Group detail page with student enrollment"
```

---

## Task 12: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend and frontend**

Run: `cd /Users/mac/Documents/smartcity && pnpm dev:education` (plus `user-service` and `gateway`
running, exactly as set up earlier in this session for Branches/Students/Guardians testing).

- [ ] **Step 2: Log in and create a teacher via curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test-education.local","password":"TestEdu123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Fatima","lastName":"Zahra","specialties":["Math"],"levels":["Lycée"],"hourlyRate":150}' \
  http://localhost:3004/teachers
```

Expected: JSON response with the created teacher, `id`, `tenantId` matching the test tenant.

- [ ] **Step 3: Create a group referencing that teacher and the existing test branch**

```bash
BRANCH_ID=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/branches \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
TEACHER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/teachers \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Groupe A\",\"branchId\":\"$BRANCH_ID\",\"teacherId\":\"$TEACHER_ID\",\"subject\":\"Math\"}" \
  http://localhost:3004/groups
```

Expected: JSON response with the created group, including nested `teacher` and `branch` objects
(from `INCLUDE_RELATIONS`).

- [ ] **Step 4: Verify the sidebar and pages render in the browser**

Open `http://localhost:3103/fr/login`, log in, confirm "Enseignants" and "Groupes" appear in the
sidebar with violet/rose accents, and that both pages load without console errors. Open the
created group's detail page and confirm the teacher name and subject show correctly.

- [ ] **Step 5: Report results**

No commit for this task — it's verification only. If any step fails, fix the underlying code in
the relevant earlier task and re-commit there, then re-run this task's steps.
