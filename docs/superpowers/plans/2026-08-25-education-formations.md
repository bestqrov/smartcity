# Education: Formations (Formation Pro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an eighth full-stack Education slice — a Formation Pro catalog (`Formation` model: name/duration/price/description) with a real tenant-scoped analytics endpoint and a quick "enroll an existing student into a formation" flow that reuses the already-shipped Inscriptions endpoint.

**Architecture:** One new Prisma model (`Formation`, tenant-scoped, standalone — no relation to `Group` or `Payment`/`Transaction`). `education-service` gets a new `formations/` module (`FormationsService`+`FormationsController`) with standard tenant-scoped CRUD plus a `getAnalytics` method computing totals from `Formation` and `Inscription`. `education-app` gets a new `lib/formations.ts` hook file, one new "Formation Pro" page (stat cards from real analytics + table + add-formation modal + enroll-student modal that calls the existing `useCreateInscription()`), and a new sidebar nav entry.

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB), class-validator — Next.js 15, React 19, `@smartcity/ui`, `@tanstack/react-query`, `lucide-react`.

---

## Deviations from the reference (ArwaEduc, at `apps/education-apps`) and why

Documented in full in `docs/superpowers/specs/2026-08-25-education-formations-design.md` —
summary:

- **`Formation` gains a required `tenantId`** — the reference is single-tenant, this SaaS is not.
  Same technical deviation every prior slice has made.
- **`GET /formations/analytics` is built for real** (tenant-scoped aggregation), unlike every
  prior slice which deferred a dedicated analytics endpoint in favor of client-side stat
  computation — explicitly requested by the user this time, since the reference module's whole
  point is this dashboard.
- **No `Formation`↔`Group` link** — the reference's `Group` has an optional `formationId`, this
  monorepo's already-shipped `Group` model doesn't. Reconciling that is a separate, larger
  concern, out of scope here.
- **The "enroll" flow selects an EXISTING student** instead of the reference's inline
  new-student-creation form. The reference's form collects name/email/phone/CIN/address for a
  brand-new student; this monorepo's already-shipped `Student` model has none of those fields —
  only `firstName`/`lastName`/`dateOfBirth` plus a required `branchId` and a required
  `registrationNumber` the reference's form doesn't even collect. This is a genuine technical
  shape mismatch (not a preference), so the enroll flow here picks from existing students instead,
  matching the pattern the already-shipped Inscriptions page already uses.
- **Enrollment reuses the existing `POST /inscriptions` endpoint** with `type: FORMATION`,
  `category: <formation.name>` — confirmed by reading the reference's own frontend
  (`FormationInscriptionForm.tsx`) and backend (`inscriptions` controller/service) directly: the
  reference sends a `formationId` field too, but its own backend silently drops it (only
  destructures `studentId`/`type`/`category`/`amount`/`date`/`note`) — `Inscription` and
  `Formation` are NOT actually linked at runtime in the reference, only loosely by `category`
  happening to equal the formation's `name`.
- **No automated tests** — same as every prior slice; verification is `tsc --noEmit`, `nest
  build`, `next build`, and manual `curl`/Playwright checks.

---

## File Structure

```
packages/database/prisma/schema.prisma          # modify: + Formation model, Tenant back-ref
packages/shared-types/src/education.types.ts    # modify: + IFormation

packages/i18n/locales/{en,fr,ar}.json           # modify: + formations education.* keys

services/education-service/
  src/app.module.ts                                    # modify: + FormationsModule
  src/formations/dto/create-formation.dto.ts            # create
  src/formations/dto/update-formation.dto.ts            # create
  src/formations/formations.service.ts                  # create
  src/formations/formations.controller.ts               # create
  src/formations/formations.module.ts                   # create

services/gateway/src/proxy/proxy.middleware.ts   # modify: + /api/formations route

apps/education-app/
  src/components/StatCard.tsx                      # modify: + orange color
  src/lib/formations.ts                            # create
  src/app/[locale]/(admin)/layout.tsx             # modify: + Formation Pro sidebar nav entry
  src/app/[locale]/(admin)/formations/page.tsx    # create
```

---

## Task 1: Prisma schema — `Formation` model

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add the `Formation` model**

At the end of `packages/database/prisma/schema.prisma` (after the `Inscription` model), add:

```prisma
model Formation {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String   @db.ObjectId
  name        String
  duration    String
  price       Float
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("formations")
}
```

- [ ] **Step 2: Add the back-ref to `Tenant`**

In `Tenant`'s relations block, find the current end of the relations list (it currently ends with
`inscriptions Inscription[]`, since `Offering` was removed in a prior revision):

```prisma
  inscriptions      Inscription[]

  @@map("tenants")
```

Change to:

```prisma
  inscriptions      Inscription[]
  formations        Formation[]

  @@map("tenants")
```

- [ ] **Step 3: Regenerate the Prisma client and verify**

Run: `cd /Users/mac/Documents/smartcity/packages/database && pnpm run db:generate`
Expected: `✔ Generated Prisma Client` with no errors.

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: no errors (nothing references `Formation` yet).

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add Formation model"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared-types/src/education.types.ts`

- [ ] **Step 1: Append `IFormation`**

At the end of `packages/shared-types/src/education.types.ts`, add:

```typescript
export interface IFormation {
  id: string;
  tenantId: string;
  name: string;
  duration: string;
  price: number;
  description?: string;
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
git commit -m "feat(shared-types): add IFormation"
```

---

## Task 3: `FormationsService` + `FormationsController` + module registration

**Files:**
- Create: `services/education-service/src/formations/dto/create-formation.dto.ts`
- Create: `services/education-service/src/formations/dto/update-formation.dto.ts`
- Create: `services/education-service/src/formations/formations.service.ts`
- Create: `services/education-service/src/formations/formations.controller.ts`
- Create: `services/education-service/src/formations/formations.module.ts`
- Modify: `services/education-service/src/app.module.ts`
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`

- [ ] **Step 1: Write `create-formation.dto.ts`**

```typescript
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateFormationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(1)
  duration: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  description?: string;
}
```

- [ ] **Step 2: Write `update-formation.dto.ts`**

```typescript
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateFormationDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  duration?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  description?: string;
}
```

- [ ] **Step 3: Write `formations.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateFormationDto } from './dto/create-formation.dto';
import { UpdateFormationDto } from './dto/update-formation.dto';

interface FindAllParams {
  page: number;
  limit: number;
}

@Injectable()
export class FormationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateFormationDto) {
    return this.prisma.formation.create({
      data: { ...dto, tenantId },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [formations, total] = await Promise.all([
      this.prisma.formation.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.formation.count({ where: { tenantId } }),
    ]);

    return {
      data: formations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(tenantId: string, id: string, dto: UpdateFormationDto) {
    const formation = await this.prisma.formation.findFirst({ where: { id, tenantId } });
    if (!formation) {
      throw new NotFoundException('Formation not found');
    }

    return this.prisma.formation.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    const formation = await this.prisma.formation.findFirst({ where: { id, tenantId } });
    if (!formation) {
      throw new NotFoundException('Formation not found');
    }

    await this.prisma.formation.delete({ where: { id } });

    return { message: 'Formation deleted successfully' };
  }

  async getAnalytics(tenantId: string) {
    const totalFormations = await this.prisma.formation.count({ where: { tenantId } });

    const totalInscriptions = await this.prisma.inscription.count({
      where: { tenantId, type: 'FORMATION' },
    });

    const revenueAgg = await this.prisma.inscription.aggregate({
      where: { tenantId, type: 'FORMATION' },
      _sum: { amount: true },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyRevenueAgg = await this.prisma.inscription.aggregate({
      where: {
        tenantId,
        type: 'FORMATION',
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    const recentInscriptions = await this.prisma.inscription.findMany({
      where: { tenantId, type: 'FORMATION' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { student: true },
    });

    return {
      totalFormations,
      totalInscriptions,
      totalRevenue: revenueAgg._sum.amount ?? 0,
      monthlyRevenue: monthlyRevenueAgg._sum.amount ?? 0,
      recentInscriptions,
    };
  }
}
```

Note: `remove` performs a hard `delete` (matching the reference's own `DELETE /formations/:id`
exactly — a real deletion, not a soft-delete/`isActive` flag). This module has no `isActive`
field on `Formation` at all, matching the reference's actual shape.

- [ ] **Step 4: Write `formations.controller.ts`**

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { FormationsService } from './formations.service';
import { CreateFormationDto } from './dto/create-formation.dto';
import { UpdateFormationDto } from './dto/update-formation.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('formations')
export class FormationsController {
  constructor(private readonly formationsService: FormationsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateFormationDto) {
    return this.formationsService.create(requireTenantId(user), dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.formationsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get('analytics')
  @Roles('ADMIN', 'MANAGER')
  async getAnalytics(@CurrentUser() user: CurrentUserDto) {
    return this.formationsService.getAnalytics(requireTenantId(user));
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateFormationDto,
  ) {
    return this.formationsService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.formationsService.remove(requireTenantId(user), id);
  }
}
```

IMPORTANT: the `@Get('analytics')` route MUST be declared before `@Patch(':id')`/`@Delete(':id')`
in the file (it already is, above) — this doesn't actually matter for Nest's route matching since
`GET` and `PATCH`/`DELETE` are different HTTP methods on different paths, but it DOES matter
relative to a hypothetical `@Get(':id')` if one existed (it doesn't in this controller — there's
no "get formation by id" endpoint in the reference either, only list + analytics).

- [ ] **Step 5: Write `formations.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { FormationsController } from './formations.controller';
import { FormationsService } from './formations.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FormationsController],
  providers: [FormationsService, PrismaService],
})
export class FormationsModule {}
```

- [ ] **Step 6: Register `FormationsModule` in `app.module.ts`**

Change:

```typescript
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

to:

```typescript
import { InscriptionsModule } from './inscriptions/inscriptions.module';
import { FormationsModule } from './formations/formations.module';
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
    FormationsModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 7: Add the gateway route**

In `services/gateway/src/proxy/proxy.middleware.ts`, find:

```typescript
      '/api/inscriptions': educationServiceUrl,
```

Change to:

```typescript
      '/api/inscriptions': educationServiceUrl,
      '/api/formations': educationServiceUrl,
```

- [ ] **Step 8: Verify the whole service builds**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/services/education-service && rm -f tsconfig.tsbuildinfo && pnpm exec nest build`
Expected: build succeeds with no errors.

Run: `cd /Users/mac/Documents/smartcity/services/gateway && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add services/education-service/src/formations services/education-service/src/app.module.ts services/gateway/src/proxy/proxy.middleware.ts
git commit -m "feat(education-service): add FormationsService/Controller with tenant-scoped analytics"
```

---

## Task 4: `StatCard` gains an `orange` color

**Files:**
- Modify: `apps/education-app/src/components/StatCard.tsx`

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
  teal: 'bg-teal-50 text-teal-600',
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
  orange: 'bg-orange-50 text-orange-600',
} as const;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/education-app/src/components/StatCard.tsx
git commit -m "feat(education-app): add orange color to StatCard"
```

---

## Task 5: Frontend API hooks — `lib/formations.ts`

**Files:**
- Create: `apps/education-app/src/lib/formations.ts`

- [ ] **Step 1: Write the hooks**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IFormation, IInscription, IStudent } from '@smartcity/types';
import { apiClient } from './api';

interface FormationListResponse {
  data: IFormation[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateFormationInput {
  name: string;
  duration: string;
  price: number;
  description?: string;
}

export type UpdateFormationInput = Partial<CreateFormationInput>;

export interface FormationAnalytics {
  totalFormations: number;
  totalInscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  recentInscriptions: (IInscription & { student: IStudent })[];
}

export function useFormations(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['formations', page, limit],
    queryFn: () =>
      apiClient<FormationListResponse>(`/formations?page=${page}&limit=${limit}`),
  });
}

export function useCreateFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFormationInput) =>
      apiClient<IFormation>('/formations', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
    },
  });
}

export function useUpdateFormation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateFormationInput) =>
      apiClient<IFormation>(`/formations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
    },
  });
}

export function useDeleteFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/formations/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
    },
  });
}

export function useFormationAnalytics() {
  return useQuery({
    queryKey: ['formations', 'analytics'],
    queryFn: () => apiClient<FormationAnalytics>('/formations/analytics'),
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/education-app/src/lib/formations.ts
git commit -m "feat(education-app): add Formations API hooks"
```

---

## Task 6: Sidebar nav entry

**Files:**
- Modify: `apps/education-app/src/app/[locale]/(admin)/layout.tsx`

**Context:** Needs a fresh icon. `Award` is not yet used anywhere in this file's imports
(`GraduationCap`, `Building2`, `Users`, `UserRound`, `LogOut`, `Menu`, `X`, `Presentation`,
`Layers`, `Calendar`, `Wallet`, `UserCog`, `ClipboardList`).

- [ ] **Step 1: Add the `Award` import**

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
  ClipboardList,
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
  Award,
} from 'lucide-react';
```

- [ ] **Step 2: Add the nav entry**

Change the end of the `navItems` array from:

```typescript
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

to:

```typescript
    {
      href: `/${locale}/inscriptions`,
      label: t('education.inscriptions'),
      icon: ClipboardList,
      accent: 'text-teal-400',
      activeBg: 'bg-teal-500/10',
      activeBorder: 'border-teal-400',
    },
    {
      href: `/${locale}/formations`,
      label: t('education.formations'),
      icon: Award,
      accent: 'text-orange-400',
      activeBg: 'bg-orange-500/10',
      activeBorder: 'border-orange-400',
    },
  ];
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/education-app/src/app/[locale]/(admin)/layout.tsx"
git commit -m "feat(education-app): add Formation Pro sidebar navigation entry"
```

---

## Task 7: i18n keys

**Files:**
- Modify: `packages/i18n/locales/en.json`
- Modify: `packages/i18n/locales/fr.json`
- Modify: `packages/i18n/locales/ar.json`

- [ ] **Step 1: Add keys to `en.json`**

The `"education"` object currently ends with:

```json
    "receiptItem": "Item",
    "receiptMethod": "Method",
    "receiptThankYou": "Thank you"
  }
}
```

Change to:

```json
    "receiptItem": "Item",
    "receiptMethod": "Method",
    "receiptThankYou": "Thank you",
    "formations": "Formation Pro",
    "addFormation": "Add formation",
    "editFormation": "Edit formation",
    "formationName": "Name",
    "formationDuration": "Duration",
    "formationPrice": "Price",
    "formationDescription": "Description (optional)",
    "noFormationsYet": "No formations in the catalogue yet.",
    "enrollStudent": "Enroll a student",
    "enrollStudentField": "Student",
    "enrollFormation": "Formation",
    "totalFormations": "Total formations",
    "totalFormationInscriptions": "Total inscriptions",
    "totalFormationRevenue": "Total revenue",
    "monthlyFormationRevenue": "Revenue this month"
  }
}
```

- [ ] **Step 2: Add keys to `fr.json`**

The `"education"` object currently ends with:

```json
    "receiptItem": "Article",
    "receiptMethod": "Méthode",
    "receiptThankYou": "Merci"
  }
}
```

Change to:

```json
    "receiptItem": "Article",
    "receiptMethod": "Méthode",
    "receiptThankYou": "Merci",
    "formations": "Formation Pro",
    "addFormation": "Ajouter une formation",
    "editFormation": "Modifier la formation",
    "formationName": "Nom",
    "formationDuration": "Durée",
    "formationPrice": "Prix",
    "formationDescription": "Description (optionnel)",
    "noFormationsYet": "Aucune formation dans le catalogue pour l'instant.",
    "enrollStudent": "Inscrire un étudiant",
    "enrollStudentField": "Étudiant",
    "enrollFormation": "Formation",
    "totalFormations": "Total des formations",
    "totalFormationInscriptions": "Total des inscriptions",
    "totalFormationRevenue": "Revenu total",
    "monthlyFormationRevenue": "Revenu ce mois-ci"
  }
}
```

- [ ] **Step 3: Add keys to `ar.json`**

The `"education"` object currently ends with:

```json
    "receiptItem": "العنصر",
    "receiptMethod": "الطريقة",
    "receiptThankYou": "شكرا"
  }
}
```

Change to:

```json
    "receiptItem": "العنصر",
    "receiptMethod": "الطريقة",
    "receiptThankYou": "شكرا",
    "formations": "التكوين المهني",
    "addFormation": "إضافة تكوين",
    "editFormation": "تعديل التكوين",
    "formationName": "الاسم",
    "formationDuration": "المدة",
    "formationPrice": "الثمن",
    "formationDescription": "الوصف (اختياري)",
    "noFormationsYet": "لا توجد تكوينات في الكتالوج بعد.",
    "enrollStudent": "تسجيل طالب",
    "enrollStudentField": "الطالب",
    "enrollFormation": "التكوين",
    "totalFormations": "إجمالي التكوينات",
    "totalFormationInscriptions": "إجمالي التسجيلات",
    "totalFormationRevenue": "إجمالي الإيرادات",
    "monthlyFormationRevenue": "إيرادات هذا الشهر"
  }
}
```

- [ ] **Step 4: Verify all three files are valid JSON**

Run: `python3 -c "import json; [json.load(open(f'/Users/mac/Documents/smartcity/packages/i18n/locales/{l}.json')) for l in ['en','fr','ar']]; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/locales/en.json packages/i18n/locales/fr.json packages/i18n/locales/ar.json
git commit -m "feat(i18n): add formations education namespace keys (en/fr/ar)"
```

---

## Task 8: Formation Pro page

**Files:**
- Create: `apps/education-app/src/app/[locale]/(admin)/formations/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { Award, ClipboardList, TrendingUp, Calendar, Pencil, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Skeleton } from '@smartcity/ui';
import { InscriptionType } from '@smartcity/types';
import { useStudents } from '@/lib/students';
import { useCreateInscription } from '@/lib/inscriptions';
import {
  useFormations,
  useCreateFormation,
  useUpdateFormation,
  useDeleteFormation,
  useFormationAnalytics,
  type CreateFormationInput,
} from '@/lib/formations';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';

interface FormationFormState {
  name: string;
  duration: string;
  price: string;
  description: string;
}

const EMPTY_FORMATION_FORM: FormationFormState = {
  name: '',
  duration: '',
  price: '',
  description: '',
};

const PAYMENT_METHODS = [
  { value: 'Espèces', labelKey: 'education.methodCash' },
  { value: 'Carte bancaire', labelKey: 'education.methodCard' },
  { value: 'Virement bancaire', labelKey: 'education.methodTransfer' },
  { value: 'Chèque', labelKey: 'education.methodCheck' },
  { value: 'Autre', labelKey: 'education.methodOther' },
] as const;

interface EnrollFormState {
  studentId: string;
  formationId: string;
  method: string;
  otherMethod: string;
}

const EMPTY_ENROLL_FORM: EnrollFormState = {
  studentId: '',
  formationId: '',
  method: 'Espèces',
  otherMethod: '',
};

export default function FormationsPage() {
  const { t } = useTranslation();

  const { data: formationsData, isLoading: isLoadingFormations } = useFormations(1, 100);
  const { data: analytics } = useFormationAnalytics();
  const { data: studentsData } = useStudents(1, 100);

  const createFormation = useCreateFormation();
  const deleteFormation = useDeleteFormation();
  const createInscription = useCreateInscription();

  const [isFormationModalOpen, setIsFormationModalOpen] = useState(false);
  const [editingFormationId, setEditingFormationId] = useState<string | null>(null);
  const [formationForm, setFormationForm] = useState<FormationFormState>(EMPTY_FORMATION_FORM);
  const [formationError, setFormationError] = useState<string | null>(null);

  const updateFormation = useUpdateFormation(editingFormationId ?? '');

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState<EnrollFormState>(EMPTY_ENROLL_FORM);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const openCreateFormationModal = () => {
    setEditingFormationId(null);
    setFormationForm(EMPTY_FORMATION_FORM);
    setFormationError(null);
    setIsFormationModalOpen(true);
  };

  const openEditFormationModal = (formation: { id: string; name: string; duration: string; price: number; description?: string }) => {
    setEditingFormationId(formation.id);
    setFormationForm({
      name: formation.name,
      duration: formation.duration,
      price: String(formation.price),
      description: formation.description ?? '',
    });
    setFormationError(null);
    setIsFormationModalOpen(true);
  };

  const handleFormationSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormationError(null);

    const input: CreateFormationInput = {
      name: formationForm.name,
      duration: formationForm.duration,
      price: Number(formationForm.price),
      description: formationForm.description || undefined,
    };

    try {
      if (editingFormationId) {
        await updateFormation.mutateAsync(input);
      } else {
        await createFormation.mutateAsync(input);
      }
      setIsFormationModalOpen(false);
      setFormationForm(EMPTY_FORMATION_FORM);
      setEditingFormationId(null);
    } catch (err) {
      setFormationError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDeleteFormation = async (id: string) => {
    await deleteFormation.mutateAsync(id);
  };

  const openEnrollModal = () => {
    setEnrollForm(EMPTY_ENROLL_FORM);
    setEnrollError(null);
    setIsEnrollModalOpen(true);
  };

  const handleEnrollSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setEnrollError(null);

    const formation = formations.find((f) => f.id === enrollForm.formationId);
    if (!formation) {
      setEnrollError(t('common.error'));
      return;
    }

    const method = enrollForm.method === 'Autre' ? enrollForm.otherMethod : enrollForm.method;

    try {
      await createInscription.mutateAsync({
        studentId: enrollForm.studentId,
        type: InscriptionType.FORMATION,
        category: formation.name,
        amount: formation.price,
        method,
        note: `Inscription Formation: ${formation.name}`,
      });
      setIsEnrollModalOpen(false);
      setEnrollForm(EMPTY_ENROLL_FORM);
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const formations = formationsData?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.formations')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEnrollModal}>
            {t('education.enrollStudent')}
          </Button>
          <Button onClick={openCreateFormationModal}>{t('education.addFormation')}</Button>
        </div>
      </div>

      {analytics && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard
            icon={Award}
            color="orange"
            label={t('education.totalFormations')}
            value={analytics.totalFormations}
          />
          <StatCard
            icon={ClipboardList}
            color="orange"
            label={t('education.totalFormationInscriptions')}
            value={analytics.totalInscriptions}
          />
          <StatCard
            icon={TrendingUp}
            color="orange"
            label={t('education.totalFormationRevenue')}
            value={analytics.totalRevenue}
          />
          <StatCard
            icon={Calendar}
            color="orange"
            label={t('education.monthlyFormationRevenue')}
            value={analytics.monthlyRevenue}
          />
        </div>
      )}

      {isLoadingFormations && <Skeleton height="4rem" />}

      {!isLoadingFormations && formations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-500">
            <Award size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noFormationsYet')}</p>
        </div>
      )}

      {!isLoadingFormations && formations.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.formationName')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.formationDuration')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.formationPrice')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.formationDescription')}
                </th>
                <th className="p-3 text-end font-medium text-gray-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {formations.map((formation) => (
                <tr key={formation.id} className="border-b border-gray-100 last:border-0 hover:bg-orange-50/30">
                  <td className="p-3 font-medium text-gray-900">{formation.name}</td>
                  <td className="p-3 text-gray-600">{formation.duration}</td>
                  <td className="p-3 text-gray-600">{formation.price}</td>
                  <td className="p-3 text-gray-600">{formation.description ?? '—'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditFormationModal(formation)}
                        title={t('common.edit')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-sky-50 hover:text-sky-600"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteFormation(formation.id)}
                        title={t('common.delete')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isFormationModalOpen}
        onClose={() => setIsFormationModalOpen(false)}
        title={editingFormationId ? t('education.editFormation') : t('education.addFormation')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsFormationModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleFormationSubmit}
              loading={createFormation.isPending || updateFormation.isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormationSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.formationName')}
            value={formationForm.name}
            onChange={(e) => setFormationForm({ ...formationForm, name: e.target.value })}
            required
          />
          <Input
            label={t('education.formationDuration')}
            value={formationForm.duration}
            onChange={(e) => setFormationForm({ ...formationForm, duration: e.target.value })}
            required
          />
          <Input
            label={t('education.formationPrice')}
            type="number"
            min="0"
            step="0.01"
            value={formationForm.price}
            onChange={(e) => setFormationForm({ ...formationForm, price: e.target.value })}
            required
          />
          <Input
            label={t('education.formationDescription')}
            value={formationForm.description}
            onChange={(e) => setFormationForm({ ...formationForm, description: e.target.value })}
          />
          {formationError && <p className="text-sm text-red-600">{formationError}</p>}
        </form>
      </Modal>

      <Modal
        open={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title={t('education.enrollStudent')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEnrollModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEnrollSubmit} loading={createInscription.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleEnrollSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.enrollStudentField')}
            </label>
            <select
              value={enrollForm.studentId}
              onChange={(e) => setEnrollForm({ ...enrollForm, studentId: e.target.value })}
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
              {t('education.enrollFormation')}
            </label>
            <select
              value={enrollForm.formationId}
              onChange={(e) => setEnrollForm({ ...enrollForm, formationId: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {formations.map((formation) => (
                <option key={formation.id} value={formation.id}>
                  {formation.name} ({formation.price})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.inscriptionMethod')}
            </label>
            <select
              value={enrollForm.method}
              onChange={(e) => setEnrollForm({ ...enrollForm, method: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {t(m.labelKey)}
                </option>
              ))}
            </select>
          </div>
          {enrollForm.method === 'Autre' && (
            <Input
              label={t('education.inscriptionMethodOther')}
              value={enrollForm.otherMethod}
              onChange={(e) => setEnrollForm({ ...enrollForm, otherMethod: e.target.value })}
              required
            />
          )}
          {enrollError && <p className="text-sm text-red-600">{enrollError}</p>}
        </form>
      </Modal>
    </div>
  );
}
```

Notes on this page:
- `openEditFormationModal`'s parameter type is inline-structural (matching `IFormation`'s shape)
  rather than importing `IFormation` directly — this is fine, TypeScript structural typing means
  the actual `IFormation` objects from `formations` satisfy it.
- The enroll modal reuses `useCreateInscription()` from `lib/inscriptions.ts` (already exists,
  unchanged by this slice) — no new backend call for enrollment, exactly matching the design
  spec's confirmed reference behavior.
- No print-receipt flow here (that's specific to the Inscriptions page's own UX, not part of the
  reference's Formation Pro dashboard) — enrolling from this page just creates the inscription and
  closes the modal.

- [ ] **Step 2: Verify it compiles and builds**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec next build`
Expected: build succeeds, route table includes `/[locale]/formations`.

IMPORTANT: do not run `next build` while a `next dev` server is running in the same directory —
stop any running dev server first, or `rm -rf .next` before building if you see stale-cache errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/education-app/src/app/[locale]/(admin)/formations/page.tsx"
git commit -m "feat(education-app): add Formation Pro page (catalogue + analytics + enroll flow)"
```

---

## Task 9: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend and frontend**

Start `user-service`, `gateway`, `education-service`, `education-app`, plus a local
`redis-server`, per prior Education testing sessions' setup notes. Remember to copy untracked
`.env` files into any fresh worktree checkout for each service that needs one.

- [ ] **Step 2: Log in and create a formation via curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test-education.local","password":"TestEdu123!"}' \
  -o /tmp/login.json && python3 -c "import json; print(json.load(open('/tmp/login.json'))['accessToken'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Coiffure Professionnelle","duration":"6 mois","price":1500,"description":"Formation complète en coiffure"}' \
  http://localhost:3004/formations
```

Expected: JSON response with the created formation, `tenantId` matching the admin's own tenant.

- [ ] **Step 3: Verify analytics before any enrollment**

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/formations/analytics
```

Expected: `totalFormations: 1`, `totalInscriptions: 0`, `totalRevenue: 0`, `monthlyRevenue: 0`,
`recentInscriptions: []`.

- [ ] **Step 4: Enroll a student and re-check analytics**

```bash
FORMATION_ID="<id from step 2's response>"
STUDENT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/students \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT_ID\",\"type\":\"FORMATION\",\"category\":\"Coiffure Professionnelle\",\"amount\":1500,\"method\":\"Espèces\",\"note\":\"Inscription Formation: Coiffure Professionnelle\"}" \
  http://localhost:3004/inscriptions

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/formations/analytics
```

Expected: `totalInscriptions: 1`, `totalRevenue: 1500`, `monthlyRevenue: 1500` (assuming this runs
in the current month), `recentInscriptions` contains the just-created inscription with `student`
included.

- [ ] **Step 5: Verify tenant scoping**

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/formations | python3 -c "import sys,json; d=json.load(sys.stdin); print('tenants:', set(f['tenantId'] for f in d['data']))"
```

Expected: a single tenant ID matching the admin's own tenant.

- [ ] **Step 6: Verify the UI end-to-end in the browser**

Open `http://localhost:3103/fr/login`, log in, confirm "Formation Pro" appears in the sidebar with
an orange accent (last item). Open it, confirm the 4 stat cards show the correct totals matching
Step 4's curl results, and the table shows the "Coiffure Professionnelle" formation. Click
"Ajouter une formation", create a second formation, save, confirm it appears in the table. Click
"Inscrire un étudiant", select a student and a formation, submit, confirm the modal closes and the
stat cards update (total inscriptions/revenue increase). Click the edit (pencil) icon on a
formation, change its price, save, confirm the table updates. Click the delete (trash) icon on the
second formation, confirm it disappears from the table.

- [ ] **Step 7: Report results**

No commit for this task — it's verification only. If any step fails, fix the underlying code in
the relevant earlier task and re-commit there, then re-run this task's steps.
