# Education: Inscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a seventh full-stack Education slice — a course/offering catalog plus student inscriptions against it, each inscription atomically producing a linked Payment+Transaction (reusing Finance's existing atomic write), with a thermal-receipt print flow after each inscription.

**Architecture:** Two new Prisma models (`Offering`, `Inscription`). `education-service` gets a new `inscriptions/` module containing `OfferingsService`+`OfferingsController` and `InscriptionsService`+`InscriptionsController`, plus a small backward-compatible extension to the existing `PaymentsService.create`/`CreatePaymentDto` (optional `category`/`description` overrides). `education-app` gets two new hook files, one new "Inscriptions" page (catalogue section + inscriptions section, following Finance's two-table-on-one-page pattern), a `ThermalReceipt` print component, and a new sidebar nav entry.

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB), class-validator — Next.js 15, React 19, `@smartcity/ui`, `@tanstack/react-query`, `lucide-react`.

---

## Deviations from app-injahi (and why)

Documented in full in `docs/superpowers/specs/2026-08-23-education-inscriptions-design.md` —
summary:

- **`Offering` unifies app-injahi's two disconnected pieces** — a hardcoded `SOUTIEN` category
  string list and a separate, teacher-less `Formation` model — into one real, admin-manageable
  catalog entity covering both types, each with an optional linked `Teacher`. This was a deliberate
  scope decision made with the user mid-brainstorm, not a literal port.
- **`Inscription.paymentId` is a required foreign key** — app-injahi's `Inscription`/`Payment` have
  no relation between them at all, same unlinked-pair gap Finance already fixed once for
  `Payment`/`Transaction`.
- **A thermal-receipt print button** after creating an inscription, ported from app-injahi's
  `ThermalReceipt.tsx` — explicitly requested by the user, client-side only, no new dependency.
- **Payment method stays a free-text string at the API/schema level** (matches app-injahi and the
  existing `Payment.method` shape) — only the frontend form changes, rendering it as a `<select>`
  with common options instead of a plain text input.
- **No `/inscriptions/analytics` endpoint, no `SECRETARY` role, no `Documents`/`Settings` modules**
  — all deferred, same rationale as every prior slice.
- **No automated tests** — same as every prior slice; verification is `tsc --noEmit`, `nest
  build`, and manual `curl`/Playwright checks.

---

## File Structure

```
packages/database/prisma/schema.prisma          # modify: + InscriptionType enum, Offering/Inscription models, back-refs
packages/shared-types/src/education.types.ts    # modify: + InscriptionType, IOffering, IInscription

packages/i18n/locales/{en,fr,ar}.json           # modify: + inscriptions education.* keys

services/education-service/
  src/app.module.ts                                    # modify: + InscriptionsModule
  src/finance/dto/create-payment.dto.ts                # modify: + optional category/description
  src/finance/payments.service.ts                       # modify: use category/description overrides
  src/inscriptions/dto/create-offering.dto.ts           # create
  src/inscriptions/dto/update-offering.dto.ts           # create
  src/inscriptions/dto/create-inscription.dto.ts        # create
  src/inscriptions/offerings.service.ts                 # create
  src/inscriptions/offerings.controller.ts              # create
  src/inscriptions/inscriptions.service.ts              # create
  src/inscriptions/inscriptions.controller.ts            # create
  src/inscriptions/inscriptions.module.ts               # create

services/gateway/src/proxy/proxy.middleware.ts   # modify: + /api/offerings, /api/inscriptions routes

apps/education-app/
  src/components/StatCard.tsx                      # modify: + teal color
  src/components/InitialsAvatar.tsx                # modify: + teal color
  src/components/ThermalReceipt.tsx                # create
  src/lib/offerings.ts                             # create
  src/lib/inscriptions.ts                          # create
  src/app/[locale]/(admin)/layout.tsx             # modify: + Inscriptions sidebar nav entry
  src/app/[locale]/(admin)/inscriptions/page.tsx  # create
```

---

## Task 1: Prisma schema — `InscriptionType`, `Offering`, `Inscription`

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add the enum and two models**

At the end of `packages/database/prisma/schema.prisma` (after the `Payment` model, which currently
ends the file around line 711), add:

```prisma
enum InscriptionType {
  SOUTIEN
  FORMATION
}

model Offering {
  id          String           @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String           @db.ObjectId
  type        InscriptionType
  name        String
  description String?
  duration    String?
  price       Float
  teacherId   String?          @db.ObjectId
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  teacher      Teacher?      @relation(fields: [teacherId], references: [id])
  inscriptions Inscription[]

  @@map("offerings")
}

model Inscription {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId   String   @db.ObjectId
  studentId  String   @db.ObjectId
  offeringId String   @db.ObjectId
  paymentId  String   @unique @db.ObjectId
  amount     Float
  date       DateTime
  note       String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tenant   Tenant   @relation(fields: [tenantId], references: [id])
  student  Student  @relation(fields: [studentId], references: [id])
  offering Offering @relation(fields: [offeringId], references: [id])
  payment  Payment  @relation(fields: [paymentId], references: [id])

  @@map("inscriptions")
}
```

- [ ] **Step 2: Add back-refs to `Tenant`, `Student`, `Teacher`, `Payment`**

In `Tenant` (around line 135-150), change:

```prisma
  transactions      Transaction[]
  payments          Payment[]

  @@map("tenants")
```

to:

```prisma
  transactions      Transaction[]
  payments          Payment[]
  offerings         Offering[]
  inscriptions      Inscription[]

  @@map("tenants")
```

In `Student` (around line 543-552), change:

```prisma
  attendances Attendance[]
  payments    Payment[]

  @@unique([tenantId, registrationNumber])
  @@map("students")
```

to:

```prisma
  attendances Attendance[]
  payments    Payment[]
  inscriptions Inscription[]

  @@unique([tenantId, registrationNumber])
  @@map("students")
```

In `Teacher` (around line 600-619), change:

```prisma
  tenant Tenant  @relation(fields: [tenantId], references: [id])
  groups Group[]

  @@map("teachers")
```

to:

```prisma
  tenant    Tenant     @relation(fields: [tenantId], references: [id])
  groups    Group[]
  offerings Offering[]

  @@map("teachers")
```

In `Payment` (around line 694-711), change:

```prisma
  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  student     Student     @relation(fields: [studentId], references: [id])
  transaction Transaction @relation(fields: [transactionId], references: [id])

  @@map("payments")
```

to:

```prisma
  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  student     Student     @relation(fields: [studentId], references: [id])
  transaction Transaction @relation(fields: [transactionId], references: [id])
  inscription Inscription?

  @@map("payments")
```

- [ ] **Step 3: Regenerate the Prisma client and verify**

Run: `cd /Users/mac/Documents/smartcity/packages/database && pnpm run db:generate`
Expected: `✔ Generated Prisma Client` with no errors.

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: no errors (nothing references the new models yet, so this just confirms the schema
change itself didn't break existing code).

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add InscriptionType enum, Offering and Inscription models"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared-types/src/education.types.ts`

- [ ] **Step 1: Append the new types**

At the end of `packages/shared-types/src/education.types.ts` (after `IPayment`), add:

```typescript
export enum InscriptionType {
  SOUTIEN = "SOUTIEN",
  FORMATION = "FORMATION",
}

export interface IOffering {
  id: string;
  tenantId: string;
  type: InscriptionType;
  name: string;
  description?: string;
  duration?: string;
  price: number;
  teacherId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInscription {
  id: string;
  tenantId: string;
  studentId: string;
  offeringId: string;
  paymentId: string;
  amount: number;
  date: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/packages/shared-types && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/education.types.ts
git commit -m "feat(shared-types): add InscriptionType, IOffering, IInscription"
```

---

## Task 3: Extend `PaymentsService`/`CreatePaymentDto` with optional category/description

**Files:**
- Modify: `services/education-service/src/finance/dto/create-payment.dto.ts`
- Modify: `services/education-service/src/finance/payments.service.ts`

**Context:** `PaymentsService.create` currently hardcodes the linked `Transaction`'s `category` to
`'Tuition Payment'` and always composes the same description. Inscriptions need the ledger entry
to reflect what was actually purchased. This task adds two optional fields that default to the
existing behavior when omitted — the Finance page's existing calls are unaffected.

- [ ] **Step 1: Add optional fields to `create-payment.dto.ts`**

Current file:

```typescript
import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  studentId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(2)
  method: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
```

Change to:

```typescript
import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  studentId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(2)
  method: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
```

- [ ] **Step 2: Use the overrides in `payments.service.ts`**

Current `create` method body (inside `payments.service.ts`):

```typescript
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          type: 'INCOME',
          amount: dto.amount,
          category: 'Tuition Payment',
          description: `Payment from ${student.firstName} ${student.lastName} (${dto.method})`,
          date,
        },
      });
```

Change to:

```typescript
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          type: 'INCOME',
          amount: dto.amount,
          category: dto.category ?? 'Tuition Payment',
          description:
            dto.description ??
            `Payment from ${student.firstName} ${student.lastName} (${dto.method})`,
          date,
        },
      });
```

(The rest of the method — the `payment.create` call below it — is unchanged.)

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add services/education-service/src/finance/dto/create-payment.dto.ts services/education-service/src/finance/payments.service.ts
git commit -m "feat(education-service): let PaymentsService.create accept category/description overrides

Backward compatible -- both fields are optional and default to the
existing hardcoded 'Tuition Payment' behavior when omitted, so the
Finance page's existing calls are unaffected. Needed by the upcoming
Inscriptions module so ledger entries reflect what was actually
purchased instead of always reading 'Tuition Payment'."
```

---

## Task 4: `OfferingsService` + `OfferingsController` + DTOs

**Files:**
- Create: `services/education-service/src/inscriptions/dto/create-offering.dto.ts`
- Create: `services/education-service/src/inscriptions/dto/update-offering.dto.ts`
- Create: `services/education-service/src/inscriptions/offerings.service.ts`
- Create: `services/education-service/src/inscriptions/offerings.controller.ts`

- [ ] **Step 1: Write `create-offering.dto.ts`**

```typescript
import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { InscriptionType } from '@prisma/client';

export class CreateOfferingDto {
  @IsEnum(InscriptionType)
  type: InscriptionType;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsMongoId()
  @IsOptional()
  teacherId?: string;
}
```

- [ ] **Step 2: Write `update-offering.dto.ts`**

```typescript
import { IsBoolean, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { InscriptionType } from '@prisma/client';

export class UpdateOfferingDto {
  @IsEnum(InscriptionType)
  @IsOptional()
  type?: InscriptionType;

  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsMongoId()
  @IsOptional()
  teacherId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
```

- [ ] **Step 3: Write `offerings.service.ts`**

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

interface FindAllParams {
  page: number;
  limit: number;
  type?: string;
}

const INCLUDE_RELATIONS = {
  teacher: true,
} as const;

@Injectable()
export class OfferingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTeacherInTenant(tenantId: string, teacherId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
    });

    if (!teacher) {
      throw new BadRequestException('teacherId does not belong to this tenant');
    }
  }

  async create(tenantId: string, dto: CreateOfferingDto) {
    if (dto.teacherId) {
      await this.assertTeacherInTenant(tenantId, dto.teacherId);
    }

    return this.prisma.offering.create({
      data: { ...dto, tenantId },
      include: INCLUDE_RELATIONS,
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, type } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (type) where.type = type;

    const [offerings, total] = await Promise.all([
      this.prisma.offering.findMany({
        where,
        skip,
        take: limit,
        include: INCLUDE_RELATIONS,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.offering.count({ where }),
    ]);

    return {
      data: offerings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(tenantId: string, id: string, dto: UpdateOfferingDto) {
    const offering = await this.prisma.offering.findFirst({ where: { id, tenantId } });
    if (!offering) {
      throw new NotFoundException('Offering not found');
    }

    if (dto.teacherId) {
      await this.assertTeacherInTenant(tenantId, dto.teacherId);
    }

    return this.prisma.offering.update({
      where: { id },
      data: dto,
      include: INCLUDE_RELATIONS,
    });
  }
}
```

- [ ] **Step 4: Write `offerings.controller.ts`**

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { OfferingsService } from './offerings.service';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('offerings')
export class OfferingsController {
  constructor(private readonly offeringsService: OfferingsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateOfferingDto) {
    return this.offeringsService.create(requireTenantId(user), dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.offeringsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
      type,
    });
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateOfferingDto,
  ) {
    return this.offeringsService.update(requireTenantId(user), id, dto);
  }
}
```

- [ ] **Step 5: Verify it compiles (module not registered yet — expect no new errors from these files themselves, since nothing imports them yet)**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add services/education-service/src/inscriptions/dto/create-offering.dto.ts services/education-service/src/inscriptions/dto/update-offering.dto.ts services/education-service/src/inscriptions/offerings.service.ts services/education-service/src/inscriptions/offerings.controller.ts
git commit -m "feat(education-service): add OfferingsService and OfferingsController"
```

---

## Task 5: `InscriptionsService` + `InscriptionsController` + module registration

**Files:**
- Create: `services/education-service/src/inscriptions/dto/create-inscription.dto.ts`
- Create: `services/education-service/src/inscriptions/inscriptions.service.ts`
- Create: `services/education-service/src/inscriptions/inscriptions.controller.ts`
- Create: `services/education-service/src/inscriptions/inscriptions.module.ts`
- Modify: `services/education-service/src/app.module.ts`
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`

- [ ] **Step 1: Write `create-inscription.dto.ts`**

```typescript
import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateInscriptionDto {
  @IsMongoId()
  studentId: string;

  @IsMongoId()
  offeringId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(2)
  method: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
```

- [ ] **Step 2: Write `inscriptions.service.ts`**

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaymentsService } from '../finance/payments.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';

interface FindAllParams {
  page: number;
  limit: number;
  studentId?: string;
  type?: string;
}

const INCLUDE_RELATIONS = {
  student: true,
  offering: { include: { teacher: true } },
} as const;

@Injectable()
export class InscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async create(tenantId: string, dto: CreateInscriptionDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });
    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }

    const offering = await this.prisma.offering.findFirst({
      where: { id: dto.offeringId, tenantId, isActive: true },
    });
    if (!offering) {
      throw new BadRequestException('offeringId does not belong to this tenant or is inactive');
    }

    const date = dto.date ? new Date(dto.date) : new Date();
    const typeLabel = offering.type === 'SOUTIEN' ? 'soutien' : 'formation';

    const payment = await this.paymentsService.create(tenantId, {
      studentId: dto.studentId,
      amount: dto.amount,
      method: dto.method,
      category: offering.name,
      description: `Inscription ${typeLabel}: ${offering.name} — ${student.firstName} ${student.lastName}`,
      date: date.toISOString(),
    });

    const inscription = await this.prisma.inscription.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        offeringId: dto.offeringId,
        paymentId: payment.id,
        amount: dto.amount,
        date,
        note: dto.note,
      },
      include: INCLUDE_RELATIONS,
    });

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true },
    });

    return { ...inscription, tenantName: tenant?.name ?? '', method: dto.method };
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, studentId, type } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (studentId) where.studentId = studentId;
    if (type) where.offering = { type };

    const [inscriptions, total] = await Promise.all([
      this.prisma.inscription.findMany({
        where,
        skip,
        take: limit,
        include: INCLUDE_RELATIONS,
        orderBy: { date: 'desc' },
      }),
      this.prisma.inscription.count({ where }),
    ]);

    return {
      data: inscriptions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

Note the deliberate non-atomicity between `paymentsService.create(...)` and
`this.prisma.inscription.create(...)` — documented in the design spec as an accepted trade-off
(reusing `PaymentsService.create` as a self-contained unit rather than duplicating its
`$transaction` logic three ways). Also note `method` in `CreateInscriptionDto` is passed straight
through to `PaymentsService.create` as its own `method` field, and the payment's `date` must be
converted with `.toISOString()` since `PaymentsService.create` expects `CreatePaymentDto.date` as
an ISO string, not a `Date` object.

- [ ] **Step 3: Write `inscriptions.controller.ts`**

```typescript
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { InscriptionsService } from './inscriptions.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('inscriptions')
export class InscriptionsController {
  constructor(private readonly inscriptionsService: InscriptionsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateInscriptionDto) {
    return this.inscriptionsService.create(requireTenantId(user), dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('studentId') studentId?: string,
    @Query('type') type?: string,
  ) {
    return this.inscriptionsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
      studentId,
      type,
    });
  }
}
```

- [ ] **Step 4: Write `inscriptions.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { OfferingsController } from './offerings.controller';
import { OfferingsService } from './offerings.service';
import { InscriptionsController } from './inscriptions.controller';
import { InscriptionsService } from './inscriptions.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [OfferingsController, InscriptionsController],
  providers: [OfferingsService, InscriptionsService, PrismaService],
})
export class InscriptionsModule {}
```

`FinanceModule` must export `PaymentsService` for this to resolve — it already does (see
`services/education-service/src/finance/finance.module.ts`'s `exports: [TransactionsService,
PaymentsService]`), no change needed there.

- [ ] **Step 5: Register `InscriptionsModule` in `app.module.ts`**

Current file:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { StudentsModule } from './students/students.module';
import { GuardiansModule } from './guardians/guardians.module';
import { TeachersModule } from './teachers/teachers.module';
import { GroupsModule } from './groups/groups.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FinanceModule } from './finance/finance.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    BranchesModule,
    StudentsModule,
    GuardiansModule,
    TeachersModule,
    GroupsModule,
    AttendanceModule,
    FinanceModule,
    HealthModule,
  ],
})
export class AppModule {}
```

Change to:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { StudentsModule } from './students/students.module';
import { GuardiansModule } from './guardians/guardians.module';
import { TeachersModule } from './teachers/teachers.module';
import { GroupsModule } from './groups/groups.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FinanceModule } from './finance/finance.module';
import { InscriptionsModule } from './inscriptions/inscriptions.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    BranchesModule,
    StudentsModule,
    GuardiansModule,
    TeachersModule,
    GroupsModule,
    AttendanceModule,
    FinanceModule,
    InscriptionsModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Add gateway routes**

In `services/gateway/src/proxy/proxy.middleware.ts`, change:

```typescript
      '/api/attendance': educationServiceUrl,
      '/api/finance': educationServiceUrl,
    };
```

to:

```typescript
      '/api/attendance': educationServiceUrl,
      '/api/finance': educationServiceUrl,
      '/api/offerings': educationServiceUrl,
      '/api/inscriptions': educationServiceUrl,
    };
```

- [ ] **Step 7: Verify the whole service builds**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/services/education-service && rm -f tsconfig.tsbuildinfo && pnpm exec nest build`
Expected: build succeeds with no errors.

Run: `cd /Users/mac/Documents/smartcity/services/gateway && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add services/education-service/src/inscriptions services/education-service/src/app.module.ts services/gateway/src/proxy/proxy.middleware.ts
git commit -m "feat(education-service): add InscriptionsService/Controller, register InscriptionsModule, route gateway"
```

---

## Task 6: `StatCard` and `InitialsAvatar` gain a `teal` color

**Files:**
- Modify: `apps/education-app/src/components/StatCard.tsx`
- Modify: `apps/education-app/src/components/InitialsAvatar.tsx`

- [ ] **Step 1: Edit `StatCard.tsx`**

Change:

```typescript
const colorClasses = {
  sky: 'bg-sky-50 text-sky-600',
  primary: 'bg-primary-50 text-primary-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
  green: 'bg-green-50 text-green-600',
  indigo: 'bg-indigo-50 text-indigo-600',
} as const;
```

to:

```typescript
const colorClasses = {
  sky: 'bg-sky-50 text-sky-600',
  primary: 'bg-primary-50 text-primary-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
  green: 'bg-green-50 text-green-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  teal: 'bg-teal-50 text-teal-600',
} as const;
```

- [ ] **Step 2: Edit `InitialsAvatar.tsx`**

Change:

```typescript
const gradientClasses = {
  sky: 'from-sky-500 to-sky-600',
  primary: 'from-primary-500 to-primary-600',
  amber: 'from-amber-500 to-amber-600',
  violet: 'from-violet-500 to-violet-600',
  rose: 'from-rose-500 to-rose-600',
  indigo: 'from-indigo-500 to-indigo-600',
} as const;
```

to:

```typescript
const gradientClasses = {
  sky: 'from-sky-500 to-sky-600',
  primary: 'from-primary-500 to-primary-600',
  amber: 'from-amber-500 to-amber-600',
  violet: 'from-violet-500 to-violet-600',
  rose: 'from-rose-500 to-rose-600',
  indigo: 'from-indigo-500 to-indigo-600',
  teal: 'from-teal-500 to-teal-600',
} as const;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/education-app/src/components/StatCard.tsx apps/education-app/src/components/InitialsAvatar.tsx
git commit -m "feat(education-app): add teal color to StatCard and InitialsAvatar"
```

---

## Task 7: Frontend API hooks — `lib/offerings.ts` and `lib/inscriptions.ts`

**Files:**
- Create: `apps/education-app/src/lib/offerings.ts`
- Create: `apps/education-app/src/lib/inscriptions.ts`

- [ ] **Step 1: Write `lib/offerings.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IOffering, ITeacher, InscriptionType } from '@smartcity/types';
import { apiClient } from './api';

export interface OfferingWithTeacher extends IOffering {
  teacher: ITeacher | null;
}

interface OfferingListResponse {
  data: OfferingWithTeacher[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateOfferingInput {
  type: InscriptionType;
  name: string;
  description?: string;
  duration?: string;
  price: number;
  teacherId?: string;
}

export type UpdateOfferingInput = Partial<CreateOfferingInput> & { isActive?: boolean };

export function useOfferings(page = 1, limit = 20, type?: InscriptionType) {
  return useQuery({
    queryKey: ['offerings', page, limit, type],
    queryFn: () =>
      apiClient<OfferingListResponse>(
        `/offerings?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`,
      ),
  });
}

export function useCreateOffering() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOfferingInput) =>
      apiClient<OfferingWithTeacher>('/offerings', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
    },
  });
}

export function useUpdateOffering(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOfferingInput) =>
      apiClient<OfferingWithTeacher>(`/offerings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
    },
  });
}
```

- [ ] **Step 2: Write `lib/inscriptions.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IInscription, IStudent } from '@smartcity/types';
import { apiClient } from './api';
import type { OfferingWithTeacher } from './offerings';

export interface InscriptionWithRelations extends IInscription {
  student: IStudent;
  offering: OfferingWithTeacher;
}

export interface CreatedInscription extends InscriptionWithRelations {
  tenantName: string;
  method: string;
}

interface InscriptionListResponse {
  data: InscriptionWithRelations[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateInscriptionInput {
  studentId: string;
  offeringId: string;
  amount: number;
  method: string;
  note?: string;
}

export function useInscriptions(page = 1, limit = 20, studentId?: string) {
  return useQuery({
    queryKey: ['inscriptions', page, limit, studentId],
    queryFn: () =>
      apiClient<InscriptionListResponse>(
        `/inscriptions?page=${page}&limit=${limit}${studentId ? `&studentId=${studentId}` : ''}`,
      ),
  });
}

export function useCreateInscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInscriptionInput) =>
      apiClient<CreatedInscription>('/inscriptions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}
```

Note: `useCreateInscription`'s `onSuccess` also invalidates the `['finance']` query key — an
inscription's payment shows up in Finance's payments/transactions lists too (via the shared
`PaymentsService.create` call), so Finance's cached data should refresh if the user has that page
open elsewhere.

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/education-app/src/lib/offerings.ts apps/education-app/src/lib/inscriptions.ts
git commit -m "feat(education-app): add Offerings and Inscriptions API hooks"
```

---

## Task 8: Sidebar nav entry

**Files:**
- Modify: `apps/education-app/src/app/[locale]/(admin)/layout.tsx`

**Context:** Needs a fresh icon not already claimed in this file's imports (`GraduationCap`,
`Building2`, `Users`, `UserRound`, `LogOut`, `Menu`, `X`, `Presentation`, `Layers`, `Calendar`,
`Wallet`, `UserCog`). Uses `ClipboardList`.

- [ ] **Step 1: Add the `ClipboardList` import**

Change:

```typescript
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
  Calendar,
  Wallet,
  UserCog,
} from 'lucide-react';
```

to:

```typescript
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
  Calendar,
  Wallet,
  UserCog,
  ClipboardList,
} from 'lucide-react';
```

- [ ] **Step 2: Add the nav entry**

Change the end of the `navItems` array from:

```typescript
    {
      href: `/${locale}/users`,
      label: t('education.users'),
      icon: UserCog,
      accent: 'text-indigo-400',
      activeBg: 'bg-indigo-500/10',
      activeBorder: 'border-indigo-400',
    },
  ];
```

to:

```typescript
    {
      href: `/${locale}/users`,
      label: t('education.users'),
      icon: UserCog,
      accent: 'text-indigo-400',
      activeBg: 'bg-indigo-500/10',
      activeBorder: 'border-indigo-400',
    },
    {
      href: `/${locale}/inscriptions`,
      label: t('education.inscriptions'),
      icon: ClipboardList,
      accent: 'text-teal-400',
      activeBg: 'bg-teal-500/10',
      activeBorder: 'border-teal-400',
    },
  ];
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/education-app/src/app/[locale]/(admin)/layout.tsx"
git commit -m "feat(education-app): add Inscriptions sidebar navigation entry"
```

---

## Task 9: i18n keys

**Files:**
- Modify: `packages/i18n/locales/en.json`
- Modify: `packages/i18n/locales/fr.json`
- Modify: `packages/i18n/locales/ar.json`

- [ ] **Step 1: Add keys to `en.json`**

The `"education"` object currently ends with:

```json
    "totalStaff": "Total staff",
    "activeStaff": "Active staff",
    "staffByRole": "Manager / Staff / Accountant"
  }
}
```

Change to:

```json
    "totalStaff": "Total staff",
    "activeStaff": "Active staff",
    "staffByRole": "Manager / Staff / Accountant",
    "inscriptions": "Inscriptions",
    "offerings": "Catalogue",
    "addOffering": "Add offering",
    "editOffering": "Edit offering",
    "offeringName": "Name",
    "offeringDescription": "Description (optional)",
    "offeringDuration": "Duration (optional)",
    "offeringPrice": "Price",
    "offeringTeacher": "Teacher (optional)",
    "offeringType": "Type",
    "noOfferingsYet": "No offerings in the catalogue yet.",
    "addInscription": "Add inscription",
    "inscriptionStudent": "Student",
    "inscriptionOffering": "Offering",
    "inscriptionAmount": "Amount",
    "inscriptionMethod": "Payment method",
    "inscriptionMethodOther": "Specify method",
    "inscriptionNote": "Note (optional)",
    "noInscriptionsYet": "No inscriptions recorded yet.",
    "totalInscriptions": "Total inscriptions",
    "soutienInscriptions": "Soutien",
    "formationInscriptions": "Formation",
    "typeSoutien": "Soutien",
    "typeFormation": "Formation",
    "methodCash": "Cash",
    "methodCard": "Card",
    "methodTransfer": "Bank transfer",
    "methodCheck": "Check",
    "methodOther": "Other",
    "printReceipt": "Print receipt",
    "receiptThankYou": "Thank you"
  }
}
```

- [ ] **Step 2: Add keys to `fr.json`**

The `"education"` object currently ends with:

```json
    "totalStaff": "Total du personnel",
    "activeStaff": "Personnel actif",
    "staffByRole": "Manager / Personnel / Comptable"
  }
}
```

Change to:

```json
    "totalStaff": "Total du personnel",
    "activeStaff": "Personnel actif",
    "staffByRole": "Manager / Personnel / Comptable",
    "inscriptions": "Inscriptions",
    "offerings": "Catalogue",
    "addOffering": "Ajouter une offre",
    "editOffering": "Modifier l'offre",
    "offeringName": "Nom",
    "offeringDescription": "Description (optionnel)",
    "offeringDuration": "Durée (optionnel)",
    "offeringPrice": "Prix",
    "offeringTeacher": "Enseignant (optionnel)",
    "offeringType": "Type",
    "noOfferingsYet": "Aucune offre dans le catalogue pour l'instant.",
    "addInscription": "Ajouter une inscription",
    "inscriptionStudent": "Étudiant",
    "inscriptionOffering": "Offre",
    "inscriptionAmount": "Montant",
    "inscriptionMethod": "Mode de paiement",
    "inscriptionMethodOther": "Préciser le mode",
    "inscriptionNote": "Note (optionnel)",
    "noInscriptionsYet": "Aucune inscription enregistrée pour l'instant.",
    "totalInscriptions": "Total des inscriptions",
    "soutienInscriptions": "Soutien",
    "formationInscriptions": "Formation",
    "typeSoutien": "Soutien",
    "typeFormation": "Formation",
    "methodCash": "Espèces",
    "methodCard": "Carte bancaire",
    "methodTransfer": "Virement bancaire",
    "methodCheck": "Chèque",
    "methodOther": "Autre",
    "printReceipt": "Imprimer le reçu",
    "receiptThankYou": "Merci"
  }
}
```

- [ ] **Step 3: Add keys to `ar.json`**

The `"education"` object currently ends with:

```json
    "totalStaff": "إجمالي الموظفين",
    "activeStaff": "الموظفون النشطون",
    "staffByRole": "مدير / موظف / محاسب"
  }
}
```

Change to:

```json
    "totalStaff": "إجمالي الموظفين",
    "activeStaff": "الموظفون النشطون",
    "staffByRole": "مدير / موظف / محاسب",
    "inscriptions": "التسجيلات",
    "offerings": "الكتالوج",
    "addOffering": "إضافة عرض",
    "editOffering": "تعديل العرض",
    "offeringName": "الاسم",
    "offeringDescription": "الوصف (اختياري)",
    "offeringDuration": "المدة (اختياري)",
    "offeringPrice": "الثمن",
    "offeringTeacher": "الأستاذ (اختياري)",
    "offeringType": "النوع",
    "noOfferingsYet": "لا توجد عروض في الكتالوج بعد.",
    "addInscription": "إضافة تسجيل",
    "inscriptionStudent": "الطالب",
    "inscriptionOffering": "العرض",
    "inscriptionAmount": "المبلغ",
    "inscriptionMethod": "طريقة الأداء",
    "inscriptionMethodOther": "حدد الطريقة",
    "inscriptionNote": "ملاحظة (اختياري)",
    "noInscriptionsYet": "لا توجد تسجيلات مسجلة بعد.",
    "totalInscriptions": "إجمالي التسجيلات",
    "soutienInscriptions": "دعم",
    "formationInscriptions": "تكوين",
    "typeSoutien": "دعم",
    "typeFormation": "تكوين",
    "methodCash": "نقدا",
    "methodCard": "بطاقة بنكية",
    "methodTransfer": "تحويل بنكي",
    "methodCheck": "شيك",
    "methodOther": "أخرى",
    "printReceipt": "طباعة الوصل",
    "receiptThankYou": "شكرا"
  }
}
```

- [ ] **Step 4: Verify all three files are valid JSON**

Run: `python3 -c "import json; [json.load(open(f'/Users/mac/Documents/smartcity/packages/i18n/locales/{l}.json')) for l in ['en','fr','ar']]; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/locales/en.json packages/i18n/locales/fr.json packages/i18n/locales/ar.json
git commit -m "feat(i18n): add inscriptions education namespace keys (en/fr/ar)"
```

---

## Task 10: `ThermalReceipt` print component

**Files:**
- Create: `apps/education-app/src/components/ThermalReceipt.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

interface ThermalReceiptProps {
  tenantName: string;
  receiptId: string;
  date: string;
  studentName: string;
  offeringName: string;
  method: string;
  amount: number;
  thankYouLabel: string;
}

export function ThermalReceipt({
  tenantName,
  receiptId,
  date,
  studentName,
  offeringName,
  method,
  amount,
  thankYouLabel,
}: ThermalReceiptProps) {
  return (
    <div
      id="thermal-receipt"
      style={{ width: 384, padding: 8, fontFamily: 'monospace', color: '#000', background: '#fff' }}
    >
      <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{tenantName}</div>
      <div style={{ marginTop: 8 }}>Reçu: {receiptId}</div>
      <div>Date: {date}</div>
      <div>Étudiant: {studentName}</div>
      <div>Offre: {offeringName}</div>
      <div>Méthode: {method}</div>
      <div style={{ marginTop: 8, fontWeight: 'bold' }}>Montant: {amount} MAD</div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>--- {thankYouLabel} ---</div>
    </div>
  );
}
```

This is a plain presentational component — the printing page (Task 11) is responsible for
rendering it inside a container that's hidden on screen and visible via a `@media print` rule, then
calling `window.print()`.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/education-app/src/components/ThermalReceipt.tsx
git commit -m "feat(education-app): add ThermalReceipt print component"
```

---

## Task 11: Inscriptions page

**Files:**
- Create: `apps/education-app/src/app/[locale]/(admin)/inscriptions/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import {
  ClipboardList,
  GraduationCap,
  BookOpen,
  Printer,
  Pencil,
} from 'lucide-react';
import { Button, Input, Badge, Modal, Skeleton } from '@smartcity/ui';
import { InscriptionType } from '@smartcity/types';
import { useTeachers } from '@/lib/teachers';
import { useStudents } from '@/lib/students';
import {
  useOfferings,
  useCreateOffering,
  useUpdateOffering,
  type OfferingWithTeacher,
  type CreateOfferingInput,
} from '@/lib/offerings';
import {
  useInscriptions,
  useCreateInscription,
  type CreatedInscription,
} from '@/lib/inscriptions';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';
import { InitialsAvatar } from '@/components/InitialsAvatar';
import { ThermalReceipt } from '@/components/ThermalReceipt';

const PAYMENT_METHODS = [
  { value: 'Espèces', labelKey: 'education.methodCash' },
  { value: 'Carte bancaire', labelKey: 'education.methodCard' },
  { value: 'Virement bancaire', labelKey: 'education.methodTransfer' },
  { value: 'Chèque', labelKey: 'education.methodCheck' },
  { value: 'Autre', labelKey: 'education.methodOther' },
] as const;

const TYPE_LABEL_KEY: Record<InscriptionType, string> = {
  [InscriptionType.SOUTIEN]: 'education.typeSoutien',
  [InscriptionType.FORMATION]: 'education.typeFormation',
};

interface OfferingFormState {
  type: InscriptionType;
  name: string;
  description: string;
  duration: string;
  price: string;
  teacherId: string;
}

const EMPTY_OFFERING_FORM: OfferingFormState = {
  type: InscriptionType.SOUTIEN,
  name: '',
  description: '',
  duration: '',
  price: '',
  teacherId: '',
};

interface InscriptionFormState {
  studentId: string;
  offeringId: string;
  amount: string;
  method: string;
  otherMethod: string;
  note: string;
}

const EMPTY_INSCRIPTION_FORM: InscriptionFormState = {
  studentId: '',
  offeringId: '',
  amount: '',
  method: 'Espèces',
  otherMethod: '',
  note: '',
};

export default function InscriptionsPage() {
  const { t } = useTranslation();

  const { data: offeringsData, isLoading: isLoadingOfferings } = useOfferings(1, 100);
  const { data: teachersData } = useTeachers(1, 100);
  const { data: studentsData } = useStudents(1, 100);
  const { data: inscriptionsData, isLoading: isLoadingInscriptions } = useInscriptions(1, 100);

  const createOffering = useCreateOffering();
  const createInscription = useCreateInscription();

  const [isOfferingModalOpen, setIsOfferingModalOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<OfferingWithTeacher | null>(null);
  const [offeringForm, setOfferingForm] = useState<OfferingFormState>(EMPTY_OFFERING_FORM);
  const [offeringError, setOfferingError] = useState<string | null>(null);

  const updateOffering = useUpdateOffering(editingOffering?.id ?? '');

  const [isInscriptionModalOpen, setIsInscriptionModalOpen] = useState(false);
  const [inscriptionForm, setInscriptionForm] = useState<InscriptionFormState>(EMPTY_INSCRIPTION_FORM);
  const [inscriptionError, setInscriptionError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<CreatedInscription | null>(null);

  const openCreateOfferingModal = () => {
    setEditingOffering(null);
    setOfferingForm(EMPTY_OFFERING_FORM);
    setOfferingError(null);
    setIsOfferingModalOpen(true);
  };

  const openEditOfferingModal = (offering: OfferingWithTeacher) => {
    setEditingOffering(offering);
    setOfferingForm({
      type: offering.type,
      name: offering.name,
      description: offering.description ?? '',
      duration: offering.duration ?? '',
      price: String(offering.price),
      teacherId: offering.teacherId ?? '',
    });
    setOfferingError(null);
    setIsOfferingModalOpen(true);
  };

  const handleOfferingSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setOfferingError(null);

    const input: CreateOfferingInput = {
      type: offeringForm.type,
      name: offeringForm.name,
      description: offeringForm.description || undefined,
      duration: offeringForm.duration || undefined,
      price: Number(offeringForm.price),
      teacherId: offeringForm.teacherId || undefined,
    };

    try {
      if (editingOffering) {
        await updateOffering.mutateAsync(input);
      } else {
        await createOffering.mutateAsync(input);
      }
      setIsOfferingModalOpen(false);
      setOfferingForm(EMPTY_OFFERING_FORM);
      setEditingOffering(null);
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const openCreateInscriptionModal = () => {
    setInscriptionForm(EMPTY_INSCRIPTION_FORM);
    setInscriptionError(null);
    setLastCreated(null);
    setIsInscriptionModalOpen(true);
  };

  const handleOfferingSelect = (offeringId: string) => {
    const offering = offerings.find((o) => o.id === offeringId);
    setInscriptionForm({
      ...inscriptionForm,
      offeringId,
      amount: offering ? String(offering.price) : inscriptionForm.amount,
    });
  };

  const handleInscriptionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setInscriptionError(null);

    const method =
      inscriptionForm.method === 'Autre' ? inscriptionForm.otherMethod : inscriptionForm.method;

    try {
      const created = await createInscription.mutateAsync({
        studentId: inscriptionForm.studentId,
        offeringId: inscriptionForm.offeringId,
        amount: Number(inscriptionForm.amount),
        method,
        note: inscriptionForm.note || undefined,
      });
      setLastCreated(created);
    } catch (err) {
      setInscriptionError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const offerings = offeringsData?.data ?? [];
  const inscriptions = inscriptionsData?.data ?? [];
  const soutienCount = inscriptions.filter((i) => i.offering.type === InscriptionType.SOUTIEN).length;
  const formationCount = inscriptions.filter((i) => i.offering.type === InscriptionType.FORMATION).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.inscriptions')}</h1>
      </div>

      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('education.offerings')}</h2>
          <Button onClick={openCreateOfferingModal}>{t('education.addOffering')}</Button>
        </div>

        {isLoadingOfferings && <Skeleton height="4rem" />}

        {!isLoadingOfferings && offerings.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noOfferingsYet')}</p>
        )}

        {!isLoadingOfferings && offerings.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringName')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringType')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringPrice')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringDuration')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringTeacher')}
                  </th>
                  <th className="p-3 text-end font-medium text-gray-500">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((offering) => (
                  <tr key={offering.id} className="border-b border-gray-100 last:border-0 hover:bg-teal-50/30">
                    <td className="p-3 font-medium text-gray-900">{offering.name}</td>
                    <td className="p-3">
                      <Badge variant={offering.type === InscriptionType.SOUTIEN ? 'info' : 'success'}>
                        {t(TYPE_LABEL_KEY[offering.type])}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-600">{offering.price}</td>
                    <td className="p-3 text-gray-600">{offering.duration ?? '—'}</td>
                    <td className="p-3 text-gray-600">
                      {offering.teacher ? `${offering.teacher.firstName} ${offering.teacher.lastName}` : '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEditOfferingModal(offering)}
                          title={t('common.edit')}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-sky-50 hover:text-sky-600"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('education.inscriptions')}</h2>
          <Button onClick={openCreateInscriptionModal}>{t('education.addInscription')}</Button>
        </div>

        {!isLoadingInscriptions && inscriptions.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={ClipboardList}
              color="teal"
              label={t('education.totalInscriptions')}
              value={inscriptions.length}
            />
            <StatCard
              icon={GraduationCap}
              color="teal"
              label={t('education.soutienInscriptions')}
              value={soutienCount}
            />
            <StatCard
              icon={BookOpen}
              color="teal"
              label={t('education.formationInscriptions')}
              value={formationCount}
            />
          </div>
        )}

        {isLoadingInscriptions && <Skeleton height="4rem" />}

        {!isLoadingInscriptions && inscriptions.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noInscriptionsYet')}</p>
        )}

        {!isLoadingInscriptions && inscriptions.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.inscriptionStudent')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.inscriptionOffering')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringType')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.inscriptionAmount')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.inscriptionMethod')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {inscriptions.map((inscription) => (
                  <tr key={inscription.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar
                          name={`${inscription.student.firstName} ${inscription.student.lastName}`}
                          color="indigo"
                        />
                        <span className="font-medium text-gray-900">
                          {inscription.student.firstName} {inscription.student.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">{inscription.offering.name}</td>
                    <td className="p-3">
                      <Badge variant={inscription.offering.type === InscriptionType.SOUTIEN ? 'info' : 'success'}>
                        {t(TYPE_LABEL_KEY[inscription.offering.type])}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-600">{inscription.amount}</td>
                    <td className="p-3 text-gray-600">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={isOfferingModalOpen}
        onClose={() => setIsOfferingModalOpen(false)}
        title={editingOffering ? t('education.editOffering') : t('education.addOffering')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsOfferingModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleOfferingSubmit}
              loading={createOffering.isPending || updateOffering.isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleOfferingSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{t('education.offeringType')}</label>
            <select
              value={offeringForm.type}
              onChange={(e) => setOfferingForm({ ...offeringForm, type: e.target.value as InscriptionType })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={InscriptionType.SOUTIEN}>{t('education.typeSoutien')}</option>
              <option value={InscriptionType.FORMATION}>{t('education.typeFormation')}</option>
            </select>
          </div>
          <Input
            label={t('education.offeringName')}
            value={offeringForm.name}
            onChange={(e) => setOfferingForm({ ...offeringForm, name: e.target.value })}
            required
          />
          <Input
            label={t('education.offeringDescription')}
            value={offeringForm.description}
            onChange={(e) => setOfferingForm({ ...offeringForm, description: e.target.value })}
          />
          <Input
            label={t('education.offeringDuration')}
            value={offeringForm.duration}
            onChange={(e) => setOfferingForm({ ...offeringForm, duration: e.target.value })}
          />
          <Input
            label={t('education.offeringPrice')}
            type="number"
            min="0"
            step="0.01"
            value={offeringForm.price}
            onChange={(e) => setOfferingForm({ ...offeringForm, price: e.target.value })}
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{t('education.offeringTeacher')}</label>
            <select
              value={offeringForm.teacherId}
              onChange={(e) => setOfferingForm({ ...offeringForm, teacherId: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">—</option>
              {(teachersData?.data ?? []).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
                </option>
              ))}
            </select>
          </div>
          {offeringError && <p className="text-sm text-red-600">{offeringError}</p>}
        </form>
      </Modal>

      <Modal
        open={isInscriptionModalOpen}
        onClose={() => setIsInscriptionModalOpen(false)}
        title={t('education.addInscription')}
        footer={
          lastCreated ? (
            <>
              <Button variant="outline" onClick={() => setIsInscriptionModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handlePrint}>
                <Printer size={16} className="me-2" />
                {t('education.printReceipt')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsInscriptionModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleInscriptionSubmit} loading={createInscription.isPending}>
                {t('common.save')}
              </Button>
            </>
          )
        }
      >
        {!lastCreated && (
          <form onSubmit={handleInscriptionSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionStudent')}
              </label>
              <select
                value={inscriptionForm.studentId}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, studentId: e.target.value })}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="" disabled>
                  —
                </option>
                {(studentsData?.data ?? []).map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.firstName} {student.lastName} ({student.registrationNumber})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionOffering')}
              </label>
              <select
                value={inscriptionForm.offeringId}
                onChange={(e) => handleOfferingSelect(e.target.value)}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="" disabled>
                  —
                </option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {t(TYPE_LABEL_KEY[offering.type])} — {offering.name} ({offering.price})
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('education.inscriptionAmount')}
              type="number"
              min="0.01"
              step="0.01"
              value={inscriptionForm.amount}
              onChange={(e) => setInscriptionForm({ ...inscriptionForm, amount: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionMethod')}
              </label>
              <select
                value={inscriptionForm.method}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, method: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            {inscriptionForm.method === 'Autre' && (
              <Input
                label={t('education.inscriptionMethodOther')}
                value={inscriptionForm.otherMethod}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, otherMethod: e.target.value })}
                required
              />
            )}
            <Input
              label={t('education.inscriptionNote')}
              value={inscriptionForm.note}
              onChange={(e) => setInscriptionForm({ ...inscriptionForm, note: e.target.value })}
            />
            {inscriptionError && <p className="text-sm text-red-600">{inscriptionError}</p>}
          </form>
        )}

        {lastCreated && (
          <>
            <div className="print:hidden">
              <p className="text-sm text-gray-600">
                {lastCreated.student.firstName} {lastCreated.student.lastName} — {lastCreated.offering.name}
              </p>
            </div>
            <div className="hidden print:block">
              <ThermalReceipt
                tenantName={lastCreated.tenantName}
                receiptId={lastCreated.id}
                date={new Date(lastCreated.date).toLocaleDateString()}
                studentName={`${lastCreated.student.firstName} ${lastCreated.student.lastName}`}
                offeringName={lastCreated.offering.name}
                method={lastCreated.method}
                amount={lastCreated.amount}
                thankYouLabel={t('education.receiptThankYou')}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
```

Notes on this page:
- `lastCreated.method` (used for the `ThermalReceipt`'s `method` prop above) comes from the
  `method: string` field `InscriptionsService.create` adds to its response (Task 5) and
  `CreatedInscription` declares (Task 7) — the receipt's data is fully self-contained in the
  create-inscription response, matching how `tenantName` is sourced the same way, so the page never
  needs a second API call just to print the record it just created.
- `print:hidden`/`hidden print:block` Tailwind classes rely on Tailwind's `print:` variant, which
  is enabled by default in Tailwind 3+ (no config change needed) — verify this still renders
  correctly in the build; if `print:` utilities don't apply, add a plain
  `<style>{'@media print { .screen-only { display: none; } .print-only { display: block; } }'}</style>`
  fallback instead of the Tailwind variant classes.

- [ ] **Step 2: Verify it compiles and builds**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec next build`
Expected: build succeeds, route table includes `/[locale]/inscriptions`.

IMPORTANT: do not run `next build` while a `next dev` server is running in the same directory —
stop any running dev server first, or `rm -rf .next` before building if you see stale-cache errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/education-app/src/app/[locale]/(admin)/inscriptions/page.tsx"
git commit -m "feat(education-app): add Inscriptions page (offerings catalogue + inscriptions + receipt printing)"
```

---

## Task 12: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend and frontend**

Start `user-service`, `gateway`, `education-service`, `education-app`, plus a local
`redis-server`, per prior Education testing sessions' setup notes (local `REDIS_URL` override
needed for `user-service`; copy untracked `.env` files into the worktree for each service that
needs one).

- [ ] **Step 2: Log in and create an offering via curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test-education.local","password":"TestEdu123!"}' \
  -o /tmp/login.json && python3 -c "import json; print(json.load(open('/tmp/login.json'))['accessToken'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"SOUTIEN","name":"Mathématiques","description":"Soutien scolaire","duration":"1 mois","price":300}' \
  http://localhost:3004/offerings
```

Expected: JSON response with the created offering, `teacher: null` (no `teacherId` was passed).

- [ ] **Step 3: Create an inscription against it**

```bash
OFFERING_ID="<id from step 2's response>"
STUDENT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/students \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT_ID\",\"offeringId\":\"$OFFERING_ID\",\"amount\":300,\"method\":\"Espèces\"}" \
  http://localhost:3004/inscriptions
```

Expected: JSON response with the created inscription, including nested `student` and `offering`
objects, plus `tenantName` and `method` fields at the top level.

- [ ] **Step 4: Verify the linked Payment/Transaction reflect the offering, not a generic label**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3004/finance/transactions?limit=5"
```

Expected: the most recent transaction has `category: "Mathématiques"` (the offering's name, NOT
`"Tuition Payment"`) and a `description` mentioning "Inscription soutien" and the student's name.

- [ ] **Step 5: Verify tenant scoping on offerings/inscriptions**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3004/offerings"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3004/inscriptions"
```

Expected: both lists only contain records for the logged-in admin's own tenant (no cross-tenant
leakage — same tenant-scoping pattern every prior Education slice already enforces via
`requireTenantId`).

- [ ] **Step 6: Verify the UI end-to-end in the browser**

Open `http://localhost:3103/fr/login`, log in, confirm "Inscriptions" appears in the sidebar with a
teal accent (last item). Open it, confirm the Catalogue section shows the Mathématiques offering,
and the Inscriptions section shows the stat cards and the inscription created in Step 3. Click
"Ajouter une offre", create a FORMATION offering with a teacher assigned, save, confirm it appears
in the catalogue table with the teacher's name shown. Click "Ajouter une inscription", select a
student and the new offering (confirm the amount field prefills from the offering's price), select
a payment method from the dropdown (try "Autre" and confirm the extra text input appears), submit,
confirm the modal switches to a "Imprimer le reçu" button instead of closing. Click it and confirm
the browser's print dialog opens (visually confirm the print preview shows the receipt content —
institution name, receipt id, date, student, offering, method, amount — not a blank page).

- [ ] **Step 7: Report results**

No commit for this task — it's verification only. If any step fails, fix the underlying code in
the relevant earlier task and re-commit there, then re-run this task's steps.
