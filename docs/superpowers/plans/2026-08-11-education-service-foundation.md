# Education Service Foundation — Institution/Branch & Student Management (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `education-service` (NestJS) and `education-app` (Next.js) end-to-end for two modules — Branches and Students — establishing the reusable pattern (auth, tenant isolation, gateway wiring, `@smartcity/ui` frontend) that the rest of the Education vertical (Parent, Academic Structure, Timetable, Attendance, Finance) will replicate in a follow-up plan.

**Architecture:** `education-service` is built by copying `tourism-service`'s existing structure verbatim (JWT auth via the shared `user-service`-issued token, Prisma access to the one shared MongoDB, NestJS module-per-domain layout). Every Education model lives in the same shared Prisma schema as Tourism's models, scoped by a mandatory `tenantId` taken only from the verified JWT — never from client input. `education-app` mirrors `tourism-app`'s Next.js App Router / locale-prefixed routing setup, but adopts `@smartcity/ui` from day one (tourism-app declares it as a dependency but never uses it) and TanStack Query for server state (tourism-app uses raw `useState`/`useEffect`).

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB), passport-jwt, class-validator — Next.js 15, React 19, TypeScript 5.5, Tailwind CSS 3, `@smartcity/ui`, `@smartcity/i18n`, `@smartcity/types`, `@tanstack/react-query`.

---

## Deviations from the architecture docs (and why)

The 10-document architecture series (`docs/education/architecture/01`–`10`) calls for a few things this plan intentionally does not build yet, to keep this first slice small and shippable:

- **No `SubscriptionGuard`.** `tourism-service` gates `create`/`update` on hotels behind a `SubscriptionGuard` tied to `billing-service`. Nothing in the architecture docs requires Education's Branches/Students endpoints to be subscription-gated for this first slice, and adding it now would pull in `billing-service` integration work unrelated to the goal here. Skipped; revisit when a paid-tier gate is actually needed.
- **No HttpOnly-cookie auth.** `08-frontend-architecture.md` (§17) recommends server-side cookie-based token storage as an improvement over `tourism-app`'s `localStorage` pattern. This plan uses the same `localStorage` + `Authorization` header pattern as `tourism-app` and `super-admin-dashboard` (see `docs/superpowers/plans/2026-08-09-super-admin-dashboard.md` Task 5) because that is the actual, working, established pattern in this repo today. Hardening auth storage is tracked as future work, not a blocker for this slice.
- **No TDD / test files.** Neither `tourism-service` nor `tourism-app` nor `super-admin-dashboard` has any `.spec.ts` files or a working `jest.config` in this repo (verified: zero test files exist anywhere in `services/` or `apps/`). Inventing a test harness that doesn't exist anywhere else in the codebase, for one new service, would be inconsistent with "follow established patterns." Verification steps use `tsc --noEmit`, `nest build`, and manual `curl`/browser checks instead — exactly as `docs/superpowers/plans/2026-08-09-super-admin-dashboard.md` does throughout.
- **`UserRole` and `TenantType` enums are extended, not replaced.** `packages/database/prisma/schema.prisma`'s `TenantType` enum has no education value; this plan adds `EDUCATION_INSTITUTE` additively. `UserRole` already has `ADMIN`/`MANAGER`/`STAFF`, which this plan reuses for Institution Admin / Branch Manager / Receptionist respectively — no new roles needed for Branches/Students. `TEACHER`/`STUDENT`/`PARENT` roles are deferred to the follow-up plan that adds Attendance and the self-service portal.
- **Parent, Academic Structure, Timetable, Attendance, and Finance are out of scope for this plan.** They are Phase 2 per `docs/education/architecture/00-reconciliation-baseline.md` §5. This plan only proves out Branches and Students, end-to-end, because that's what establishes every reusable piece (auth copy, tenant-scoping helper, gateway wiring, Docker wiring, frontend scaffold) the rest will need.

---

## File Structure

```
packages/database/prisma/schema.prisma        # modify: + EDUCATION_INSTITUTE, StudentStatus, Branch, Student models
packages/shared-types/src/education.types.ts  # create: IBranch, IStudent, StudentStatus
packages/shared-types/src/index.ts            # modify: export education.types
packages/i18n/locales/{en,fr,ar}.json         # modify: + "education" namespace

services/education-service/
  package.json                                # modify: + auth/prisma deps
  src/main.ts                                  # modify: validation pipe, global guards, CORS
  src/app.module.ts                            # modify: + AuthModule, BranchesModule, StudentsModule
  src/common/prisma.service.ts                 # create (copied from tourism-service)
  src/common/tenant.util.ts                    # create: requireTenantId() helper
  src/auth/jwt.strategy.ts                     # create (copied from tourism-service)
  src/auth/jwt-auth.guard.ts                   # create (copied from tourism-service)
  src/auth/roles.guard.ts                      # create (copied from tourism-service)
  src/auth/auth.module.ts                      # create (adapted from tourism-service, no SubscriptionGuard)
  src/auth/decorators/roles.decorator.ts       # create (copied)
  src/auth/decorators/public.decorator.ts      # create (copied)
  src/auth/decorators/current-user.decorator.ts # create (copied)
  src/branches/dto/create-branch.dto.ts        # create
  src/branches/dto/update-branch.dto.ts        # create
  src/branches/branches.service.ts             # create
  src/branches/branches.controller.ts          # create
  src/branches/branches.module.ts              # create
  src/students/dto/create-student.dto.ts       # create
  src/students/dto/update-student.dto.ts       # create
  src/students/students.service.ts             # create
  src/students/students.controller.ts          # create
  src/students/students.module.ts              # create

services/gateway/src/proxy/proxy.middleware.ts # modify: + EDUCATION_SERVICE_URL routes

.env.example                                   # modify: + EDUCATION_SERVICE_URL, PORT_EDUCATION_APP
docker-compose.yml                             # modify: + education-service
docker-compose.prod.yml                        # modify: + education-service, education-app
infra/docker/education-app.Dockerfile          # create (copied from tourism-app.Dockerfile)
package.json                                   # modify: + dev:education script

apps/education-app/
  package.json, tsconfig.json, next.config.js, postcss.config.js, tailwind.config.ts  # create
  src/middleware.ts                            # create (copied from tourism-app)
  src/lib/i18n.ts                              # create (copied from tourism-app)
  src/lib/api.ts                               # create (adapted from super-admin-dashboard)
  src/lib/auth.tsx                             # create (adapted from super-admin-dashboard)
  src/lib/branches.ts                          # create
  src/lib/students.ts                          # create
  src/components/Providers.tsx                 # create
  src/app/[locale]/layout.tsx                  # create
  src/app/[locale]/globals.css                 # create
  src/app/[locale]/page.tsx                    # create (redirects to /branches)
  src/app/[locale]/login/page.tsx               # create
  src/app/[locale]/(admin)/layout.tsx           # create (route guard)
  src/app/[locale]/(admin)/branches/page.tsx    # create
  src/app/[locale]/(admin)/students/page.tsx    # create
```

---

## Task 1: Prisma schema — add Education models

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add `EDUCATION_INSTITUTE` to the `TenantType` enum**

In `packages/database/prisma/schema.prisma`, find:

```prisma
enum TenantType {
  HOTEL
  RIAD
  RESORT
  GUESTHOUSE
  HOSTEL
  TOUR_OPERATOR
  SHOP
}
```

Replace with:

```prisma
enum TenantType {
  HOTEL
  RIAD
  RESORT
  GUESTHOUSE
  HOSTEL
  TOUR_OPERATOR
  SHOP
  EDUCATION_INSTITUTE
}
```

- [ ] **Step 2: Add `branches` and `students` back-reference fields to `Tenant`**

Find:

```prisma
  users             User[]
  hotels            Hotel[]
  subscription      Subscription?
  activities        Activity[]
  restaurants       Restaurant[]
  expenseCategories ExpenseCategory[]
  expenses          Expense[]
  stockItems        StockItem[]
  purchases         Purchase[]

  @@map("tenants")
```

Replace with:

```prisma
  users             User[]
  hotels            Hotel[]
  subscription      Subscription?
  activities        Activity[]
  restaurants       Restaurant[]
  expenseCategories ExpenseCategory[]
  expenses          Expense[]
  stockItems        StockItem[]
  purchases         Purchase[]
  branches          Branch[]
  students          Student[]

  @@map("tenants")
```

- [ ] **Step 3: Append the `Branch` and `Student` models and `StudentStatus` enum**

At the end of `packages/database/prisma/schema.prisma`, after the final `PurchaseItem` model, append:

```prisma

enum StudentStatus {
  ACTIVE
  WITHDRAWN
  GRADUATED
}

model Branch {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String   @db.ObjectId
  name      String
  address   String
  city      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  students Student[]

  @@map("branches")
}

model Student {
  id                 String        @id @default(auto()) @map("_id") @db.ObjectId
  tenantId           String        @db.ObjectId
  branchId           String        @db.ObjectId
  registrationNumber String
  firstName          String
  lastName            String
  dateOfBirth        DateTime?
  status             StudentStatus @default(ACTIVE)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])
  branch Branch @relation(fields: [branchId], references: [id])

  @@unique([tenantId, registrationNumber])
  @@map("students")
}
```

- [ ] **Step 4: Regenerate the Prisma client**

Run: `cd /Users/mac/Documents/smartcity && pnpm --filter @smartcity/database run db:generate`
Expected: `✔ Generated Prisma Client` with no errors. If MongoDB isn't reachable that's fine — `db:generate` only reads the schema file, it doesn't need a live connection.

- [ ] **Step 5: Push the new models to the database**

Run: `cd /Users/mac/Documents/smartcity && pnpm --filter @smartcity/database run db:push`
Expected: output confirming the `branches` and `students` collections/indexes are in sync (requires `DATABASE_URL` in the root `.env` to point at a reachable MongoDB — use the same one `tourism-service` already uses in local dev).

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add Branch and Student models for the Education vertical"
```

---

## Task 2: Shared types for Education

**Files:**
- Create: `packages/shared-types/src/education.types.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Write `packages/shared-types/src/education.types.ts`**

```ts
export enum StudentStatus {
  ACTIVE = "ACTIVE",
  WITHDRAWN = "WITHDRAWN",
  GRADUATED = "GRADUATED",
}

export interface IBranch {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  city: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudent {
  id: string;
  tenantId: string;
  branchId: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Export it from the package barrel**

In `packages/shared-types/src/index.ts`, find:

```ts
export * from "./user.types";
export * from "./tenant.types";
export * from "./tourism.types";
export * from "./api.types";
export * from "./i18n.types";
```

Replace with:

```ts
export * from "./user.types";
export * from "./tenant.types";
export * from "./tourism.types";
export * from "./education.types";
export * from "./api.types";
export * from "./i18n.types";
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/shared-types/src/education.types.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add IBranch/IStudent types for Education"
```

---

## Task 3: i18n — `education` namespace

**Files:**
- Modify: `packages/i18n/locales/en.json`
- Modify: `packages/i18n/locales/fr.json`
- Modify: `packages/i18n/locales/ar.json`

- [ ] **Step 1: Add the `education` key to `packages/i18n/locales/en.json`**

Find the closing of the top-level JSON object (the last key before the final `}`, currently `"housekeeping"`'s block) and add a new top-level sibling key. Concretely, find:

```json
  "housekeeping": {
```

and locate that block's closing `},` (the one that ends the `housekeeping` object, immediately before the file's final `}`). Insert this new top-level key right after it, before the file's closing `}`:

```json
  "education": {
    "branches": "Branches",
    "students": "Students",
    "addBranch": "Add branch",
    "addStudent": "Add student",
    "branchName": "Branch name",
    "branchAddress": "Address",
    "branchCity": "City",
    "studentFirstName": "First name",
    "studentLastName": "Last name",
    "studentRegistrationNumber": "Registration number",
    "studentBranch": "Branch",
    "studentStatus": "Status",
    "statusActive": "Active",
    "statusWithdrawn": "Withdrawn",
    "statusGraduated": "Graduated",
    "noBranchesYet": "No branches yet. Add your first branch to get started.",
    "noStudentsYet": "No students yet. Add your first student to get started."
  }
```

- [ ] **Step 2: Add the equivalent French block to `packages/i18n/locales/fr.json`**, in the same position (after the `housekeeping` block, before the file's closing `}`):

```json
  "education": {
    "branches": "Filiales",
    "students": "Étudiants",
    "addBranch": "Ajouter une filiale",
    "addStudent": "Ajouter un étudiant",
    "branchName": "Nom de la filiale",
    "branchAddress": "Adresse",
    "branchCity": "Ville",
    "studentFirstName": "Prénom",
    "studentLastName": "Nom",
    "studentRegistrationNumber": "Numéro d'inscription",
    "studentBranch": "Filiale",
    "studentStatus": "Statut",
    "statusActive": "Actif",
    "statusWithdrawn": "Retiré",
    "statusGraduated": "Diplômé",
    "noBranchesYet": "Aucune filiale pour l'instant. Ajoutez votre première filiale.",
    "noStudentsYet": "Aucun étudiant pour l'instant. Ajoutez votre premier étudiant."
  }
```

- [ ] **Step 3: Add the equivalent Arabic block to `packages/i18n/locales/ar.json`**, same position:

```json
  "education": {
    "branches": "الفروع",
    "students": "الطلبة",
    "addBranch": "إضافة فرع",
    "addStudent": "إضافة طالب",
    "branchName": "اسم الفرع",
    "branchAddress": "العنوان",
    "branchCity": "المدينة",
    "studentFirstName": "الاسم الشخصي",
    "studentLastName": "الاسم العائلي",
    "studentRegistrationNumber": "رقم التسجيل",
    "studentBranch": "الفرع",
    "studentStatus": "الحالة",
    "statusActive": "نشط",
    "statusWithdrawn": "منسحب",
    "statusGraduated": "متخرج",
    "noBranchesYet": "لا توجد فروع بعد. أضف أول فرع للبدء.",
    "noStudentsYet": "لا يوجد طلبة بعد. أضف أول طالب للبدء."
  }
```

- [ ] **Step 4: Validate all three files are still valid JSON**

Run: `node -e "['en','fr','ar'].forEach(l => { require('/Users/mac/Documents/smartcity/packages/i18n/locales/'+l+'.json'); console.log(l, 'OK'); })"`
Expected: `en OK`, `fr OK`, `ar OK` — no `SyntaxError`.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/i18n/locales/en.json packages/i18n/locales/fr.json packages/i18n/locales/ar.json
git commit -m "feat(i18n): add education namespace (en/fr/ar)"
```

---

## Task 4: `education-service` dependencies

**Files:**
- Modify: `services/education-service/package.json`

- [ ] **Step 1: Replace `services/education-service/package.json`** with the auth/Prisma deps added (mirroring `services/tourism-service/package.json`, minus `qrcode`/`sharp` which are tourism-specific):

```json
{
  "name": "education-service",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/mapped-types": "^2.1.1",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^10.3.0",
    "@prisma/client": "^6.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "@types/passport-jwt": "^4.0.1",
    "prisma": "^6.0.0",
    "ts-loader": "^9.6.2",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Install**

Run: `cd /Users/mac/Documents/smartcity && pnpm install`
Expected: completes without errors, `services/education-service/node_modules` now has `@nestjs/jwt`, `passport-jwt`, etc.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/package.json pnpm-lock.yaml
git commit -m "chore(education-service): add auth and Prisma dependencies"
```

---

## Task 5: Copy the Prisma service and add the tenant-scoping helper

**Files:**
- Create: `services/education-service/src/common/prisma.service.ts`
- Create: `services/education-service/src/common/tenant.util.ts`

- [ ] **Step 1: Write `services/education-service/src/common/prisma.service.ts`** (identical to `services/tourism-service/src/common/prisma.service.ts`)

```ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }
}
```

- [ ] **Step 2: Write `services/education-service/src/common/tenant.util.ts`**

This is the single line of defense every Education service method calls through: it is the concrete implementation of the "no query without an explicit tenant" rule from `docs/education/architecture/10-security-architecture.md` §3. `tenantId` must never be read from a request body or query string — only from the JWT-derived `CurrentUserDto`.

```ts
import { ForbiddenException } from '@nestjs/common';
import type { CurrentUserDto } from '../auth/jwt.strategy';

/**
 * Returns the authenticated user's tenantId, or throws if the token carries
 * none. Every Education service method must scope its Prisma queries with
 * the value this returns — never with a tenantId taken from client input.
 */
export function requireTenantId(user: CurrentUserDto): string {
  if (!user.tenantId) {
    throw new ForbiddenException('Tenant context required');
  }
  return user.tenantId;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: errors about missing `../auth/jwt.strategy` (that file doesn't exist yet — created in Task 6). This is expected at this point; do not fix it here.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/src/common/prisma.service.ts services/education-service/src/common/tenant.util.ts
git commit -m "feat(education-service): add Prisma service and tenant-scoping helper"
```

---

## Task 6: Auth module (copied from `tourism-service`)

**Files:**
- Create: `services/education-service/src/auth/jwt.strategy.ts`
- Create: `services/education-service/src/auth/jwt-auth.guard.ts`
- Create: `services/education-service/src/auth/roles.guard.ts`
- Create: `services/education-service/src/auth/decorators/roles.decorator.ts`
- Create: `services/education-service/src/auth/decorators/public.decorator.ts`
- Create: `services/education-service/src/auth/decorators/current-user.decorator.ts`
- Create: `services/education-service/src/auth/auth.module.ts`

- [ ] **Step 1: Write `services/education-service/src/auth/jwt.strategy.ts`** (identical to `services/tourism-service/src/auth/jwt.strategy.ts` — validates the JWT `user-service` issues; no education-specific logic)

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId?: string;
}

export interface CurrentUserDto {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserDto> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      tenantId: payload.tenantId,
    };
  }
}
```

- [ ] **Step 2: Write `services/education-service/src/auth/jwt-auth.guard.ts`** (identical to `services/tourism-service/src/auth/jwt-auth.guard.ts`)

```ts
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
```

- [ ] **Step 3: Write `services/education-service/src/auth/roles.guard.ts`** (identical to `services/tourism-service/src/auth/roles.guard.ts`)

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorators/roles.decorator';
import { CurrentUserDto } from './jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: CurrentUserDto }>();

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!requiredRoles.includes(user.role) && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
```

- [ ] **Step 4: Write the three decorator files** (identical to `services/tourism-service/src/auth/decorators/*`)

`services/education-service/src/auth/decorators/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

`services/education-service/src/auth/decorators/public.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`services/education-service/src/auth/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserDto } from '../jwt.strategy';

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserDto | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUserDto }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
```

- [ ] **Step 5: Write `services/education-service/src/auth/auth.module.ts`** (adapted from `services/tourism-service/src/auth/auth.module.ts` — no `SubscriptionGuard`, see "Deviations" above)

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard, PrismaService],
  exports: [JwtModule, PassportModule, JwtStrategy, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 6: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: no errors (the Task 5 error about the missing `jwt.strategy` import is now resolved).

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/src/auth
git commit -m "feat(education-service): add JWT auth module (copied from tourism-service)"
```

---

## Task 7: Wire `main.ts` and `app.module.ts`

**Files:**
- Modify: `services/education-service/src/main.ts`
- Modify: `services/education-service/src/app.module.ts`

- [ ] **Step 1: Replace `services/education-service/src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  const port = process.env.PORT_EDUCATION_SERVICE || 3004;
  await app.listen(port);
  console.log(`[EducationService] Running on http://localhost:${port}`);
}

bootstrap();
```

- [ ] **Step 2: Replace `services/education-service/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { StudentsModule } from './students/students.module';
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
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: errors about missing `./branches/branches.module` and `./students/students.module` (created in Tasks 8–9). Expected at this point.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/src/main.ts services/education-service/src/app.module.ts
git commit -m "feat(education-service): wire global validation, auth guards, and CORS"
```

---

## Task 8: Branches module

**Files:**
- Create: `services/education-service/src/branches/dto/create-branch.dto.ts`
- Create: `services/education-service/src/branches/dto/update-branch.dto.ts`
- Create: `services/education-service/src/branches/branches.service.ts`
- Create: `services/education-service/src/branches/branches.controller.ts`
- Create: `services/education-service/src/branches/branches.module.ts`

- [ ] **Step 1: Write `services/education-service/src/branches/dto/create-branch.dto.ts`**

```ts
import { IsString, MinLength } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  address: string;

  @IsString()
  city: string;
}
```

- [ ] **Step 2: Write `services/education-service/src/branches/dto/update-branch.dto.ts`**

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateBranchDto } from './create-branch.dto';

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
```

- [ ] **Step 3: Write `services/education-service/src/branches/branches.service.ts`**

Every method takes `tenantId` as its first parameter — it is always the value `requireTenantId()` returned from the authenticated user, never something a caller can override. `findOne`/`update`/`deactivate` use `findFirst({ where: { id, tenantId } })`, not `findUnique({ where: { id } })`, specifically so a branch ID from another tenant can never be read, updated, or deactivated even if guessed or leaked.

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

interface FindAllParams {
  page: number;
  limit: number;
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = { tenantId, isActive: true };

    const [branches, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return {
      data: branches,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto) {
    await this.findById(tenantId, id);

    return this.prisma.branch.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Branch deactivated successfully' };
  }
}
```

- [ ] **Step 4: Write `services/education-service/src/branches/branches.controller.ts`**

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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.branchesService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.branchesService.findById(requireTenantId(user), id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.branchesService.deactivate(requireTenantId(user), id);
  }
}
```

- [ ] **Step 5: Write `services/education-service/src/branches/branches.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BranchesController],
  providers: [BranchesService, PrismaService],
  exports: [BranchesService],
})
export class BranchesModule {}
```

- [ ] **Step 6: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: errors only about the still-missing `./students/students.module` import in `app.module.ts`. No errors inside `src/branches/`.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/src/branches
git commit -m "feat(education-service): add tenant-scoped Branches CRUD"
```

---

## Task 9: Students module

**Files:**
- Create: `services/education-service/src/students/dto/create-student.dto.ts`
- Create: `services/education-service/src/students/dto/update-student.dto.ts`
- Create: `services/education-service/src/students/students.service.ts`
- Create: `services/education-service/src/students/students.controller.ts`
- Create: `services/education-service/src/students/students.module.ts`

- [ ] **Step 1: Write `services/education-service/src/students/dto/create-student.dto.ts`**

```ts
import { IsString, IsOptional, IsDateString, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  branchId: string;

  @IsString()
  @MinLength(1)
  registrationNumber: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;
}
```

- [ ] **Step 2: Write `services/education-service/src/students/dto/update-student.dto.ts`**

Imports `StudentStatus` from `@prisma/client` (the generated enum), not from `@smartcity/types`. Both declare the same three values, but they are separate nominal TypeScript enums — `@prisma/client`'s is the one `PrismaService.student.update()` actually expects in its `data` argument, so it's the one the DTO must use to typecheck cleanly against `StudentsService.update()`'s Prisma call in Task 9 Step 3. `@smartcity/types`'s `StudentStatus` (Task 2) stays purely a frontend-facing contract type.

```ts
import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { StudentStatus } from '@prisma/client';
import { CreateStudentDto } from './create-student.dto';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @IsEnum(StudentStatus)
  @IsOptional()
  status?: StudentStatus;
}
```

- [ ] **Step 3: Write `services/education-service/src/students/students.service.ts`**

Same tenant-scoping discipline as `BranchesService`: every read/write is filtered by `tenantId`, and `create`/`update` additionally re-validate that the given `branchId` belongs to the same tenant (via `findFirst({ where: { id: branchId, tenantId } })`) before writing — this is what stops a student from being silently attached to another tenant's branch.

```ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

interface FindAllParams {
  page: number;
  limit: number;
  branchId?: string;
  status?: string;
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertBranchInTenant(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new BadRequestException('branchId does not belong to this tenant');
    }
  }

  async create(tenantId: string, dto: CreateStudentDto) {
    await this.assertBranchInTenant(tenantId, dto.branchId);

    const existing = await this.prisma.student.findFirst({
      where: { tenantId, registrationNumber: dto.registrationNumber },
    });

    if (existing) {
      throw new ConflictException(
        `Registration number "${dto.registrationNumber}" is already in use`,
      );
    }

    return this.prisma.student.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        registrationNumber: dto.registrationNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, branchId, status } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: students,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async update(tenantId: string, id: string, dto: UpdateStudentDto) {
    await this.findById(tenantId, id);

    if (dto.branchId) {
      await this.assertBranchInTenant(tenantId, dto.branchId);
    }

    return this.prisma.student.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async withdraw(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    return this.prisma.student.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });
  }
}
```

- [ ] **Step 4: Write `services/education-service/src/students/students.controller.ts`**

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
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateStudentDto) {
    return this.studentsService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.studentsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
      branchId,
      status,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.studentsService.findById(requireTenantId(user), id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.studentsService.withdraw(requireTenantId(user), id);
  }
}
```

- [ ] **Step 5: Write `services/education-service/src/students/students.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService, PrismaService],
  exports: [StudentsService],
})
export class StudentsModule {}
```

- [ ] **Step 6: Verify the whole service builds**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec nest build`
Expected: `webpack compiled successfully` (or similar), no TypeScript errors, `dist/main.js` produced.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/src/students
git commit -m "feat(education-service): add tenant-scoped Students CRUD"
```

---

## Task 10: Gateway routing

**Files:**
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`

- [ ] **Step 1: Add the education service URL and its routes**

In `services/gateway/src/proxy/proxy.middleware.ts`, find:

```ts
    const financeServiceUrl =
      this.configService.get<string>('FINANCE_SERVICE_URL') ||
      'http://localhost:3008';

    this.routeMap = {
      '/api/auth': userServiceUrl,
      '/api/users': userServiceUrl,
      '/api/tenants': userServiceUrl,
      '/api/hotels': tourismServiceUrl,
      '/api/rooms': tourismServiceUrl,
      '/api/bookings': tourismServiceUrl,
      '/api/activities': tourismServiceUrl,
      '/api/restaurants': tourismServiceUrl,
      '/api/reviews': tourismServiceUrl,
      '/api/orders': tourismServiceUrl,
      '/api/messages': tourismServiceUrl,
      '/api/qr': tourismServiceUrl,
      '/api/plans': billingServiceUrl,
      '/api/subscriptions': billingServiceUrl,
      '/api/expenses': financeServiceUrl,
      '/api/expense-categories': financeServiceUrl,
      '/api/stock-items': financeServiceUrl,
      '/api/purchases': financeServiceUrl,
    };
```

Replace with:

```ts
    const financeServiceUrl =
      this.configService.get<string>('FINANCE_SERVICE_URL') ||
      'http://localhost:3008';
    const educationServiceUrl =
      this.configService.get<string>('EDUCATION_SERVICE_URL') ||
      'http://localhost:3004';

    this.routeMap = {
      '/api/auth': userServiceUrl,
      '/api/users': userServiceUrl,
      '/api/tenants': userServiceUrl,
      '/api/hotels': tourismServiceUrl,
      '/api/rooms': tourismServiceUrl,
      '/api/bookings': tourismServiceUrl,
      '/api/activities': tourismServiceUrl,
      '/api/restaurants': tourismServiceUrl,
      '/api/reviews': tourismServiceUrl,
      '/api/orders': tourismServiceUrl,
      '/api/messages': tourismServiceUrl,
      '/api/qr': tourismServiceUrl,
      '/api/plans': billingServiceUrl,
      '/api/subscriptions': billingServiceUrl,
      '/api/expenses': financeServiceUrl,
      '/api/expense-categories': financeServiceUrl,
      '/api/stock-items': financeServiceUrl,
      '/api/purchases': financeServiceUrl,
      '/api/branches': educationServiceUrl,
      '/api/students': educationServiceUrl,
    };
```

- [ ] **Step 2: Verify the gateway still compiles**

Run: `cd /Users/mac/Documents/smartcity/services/gateway && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/gateway/src/proxy/proxy.middleware.ts
git commit -m "feat(gateway): route /api/branches and /api/students to education-service"
```

---

## Task 11: Env vars, Docker Compose, and Dockerfile

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Create: `infra/docker/education-app.Dockerfile`

- [ ] **Step 1: Add education vars to `.env.example`**

Find:

```
# ── Service URLs (used by gateway) ───────
USER_SERVICE_URL="http://user-service:3001"
TOURISM_SERVICE_URL="http://tourism-service:3002"
FINANCE_SERVICE_URL="http://finance-service:3008"

# ── Frontend ─────────────────────────────
NEXT_PUBLIC_API_URL="https://your-domain.com/api"
PORT_TOURISM_APP=3102
```

Replace with:

```
# ── Service URLs (used by gateway) ───────
USER_SERVICE_URL="http://user-service:3001"
TOURISM_SERVICE_URL="http://tourism-service:3002"
FINANCE_SERVICE_URL="http://finance-service:3008"
EDUCATION_SERVICE_URL="http://education-service:3004"

# ── Frontend ─────────────────────────────
NEXT_PUBLIC_API_URL="https://your-domain.com/api"
PORT_TOURISM_APP=3102
PORT_EDUCATION_APP=3103
```

- [ ] **Step 2: Add `education-service` to `docker-compose.yml`** (local dev compose — mirrors the existing `tourism-service` block; note this file has no frontend `-app` entries at all, so `education-app` is intentionally not added here)

Find:

```yaml
  # ── Tourism Service ──────────────────────────────────────
  tourism-service:
    build:
      context: .
      dockerfile: infra/docker/service.Dockerfile
      args:
        SERVICE_NAME: tourism-service
    container_name: smartcity-tourism-service
    ports:
      - "${PORT_TOURISM_SERVICE:-3002}:3002"
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - .env
    environment:
      - DATABASE_URL=${DATABASE_URL:-mongodb://mongodb:27017/smartcity}
      - REDIS_URL=${REDIS_URL:-redis://redis:6379}
    networks:
      - smartcity-network
    restart: unless-stopped

volumes:
```

Replace with:

```yaml
  # ── Tourism Service ──────────────────────────────────────
  tourism-service:
    build:
      context: .
      dockerfile: infra/docker/service.Dockerfile
      args:
        SERVICE_NAME: tourism-service
    container_name: smartcity-tourism-service
    ports:
      - "${PORT_TOURISM_SERVICE:-3002}:3002"
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - .env
    environment:
      - DATABASE_URL=${DATABASE_URL:-mongodb://mongodb:27017/smartcity}
      - REDIS_URL=${REDIS_URL:-redis://redis:6379}
    networks:
      - smartcity-network
    restart: unless-stopped

  # ── Education Service ─────────────────────────────────────
  education-service:
    build:
      context: .
      dockerfile: infra/docker/service.Dockerfile
      args:
        SERVICE_NAME: education-service
    container_name: smartcity-education-service
    ports:
      - "${PORT_EDUCATION_SERVICE:-3004}:3004"
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - .env
    environment:
      - DATABASE_URL=${DATABASE_URL:-mongodb://mongodb:27017/smartcity}
      - REDIS_URL=${REDIS_URL:-redis://redis:6379}
    networks:
      - smartcity-network
    restart: unless-stopped

volumes:
```

- [ ] **Step 3: Add `education-service` and `education-app` to `docker-compose.prod.yml`**

Find:

```yaml
  # ── Tourism Frontend ─────────────────────────────────────
  tourism-app:
    build:
      context: .
      dockerfile: infra/docker/tourism-app.Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-/api}
    container_name: smartcity-tourism-app
    ports:
      - "${PORT_TOURISM_APP:-3102}:3102"
    depends_on:
      - gateway
    env_file:
      - .env
    environment:
      - PORT=3102
    networks:
      - smartcity-network
    restart: unless-stopped

volumes:
  smartcity-redis-data:
```

Replace with:

```yaml
  # ── Tourism Frontend ─────────────────────────────────────
  tourism-app:
    build:
      context: .
      dockerfile: infra/docker/tourism-app.Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-/api}
    container_name: smartcity-tourism-app
    ports:
      - "${PORT_TOURISM_APP:-3102}:3102"
    depends_on:
      - gateway
    env_file:
      - .env
    environment:
      - PORT=3102
    networks:
      - smartcity-network
    restart: unless-stopped

  # ── Education Service ─────────────────────────────────────
  education-service:
    build:
      context: .
      dockerfile: infra/docker/service.Dockerfile
      args:
        SERVICE_NAME: education-service
    container_name: smartcity-education-service
    depends_on:
      redis:
        condition: service_healthy
    env_file:
      - .env
    environment:
      - PORT=${PORT_EDUCATION_SERVICE:-3004}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL:-redis://redis:6379}
    networks:
      - smartcity-network
    restart: unless-stopped

  # ── Education Frontend ────────────────────────────────────
  education-app:
    build:
      context: .
      dockerfile: infra/docker/education-app.Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-/api}
    container_name: smartcity-education-app
    ports:
      - "${PORT_EDUCATION_APP:-3103}:3103"
    depends_on:
      - gateway
    env_file:
      - .env
    environment:
      - PORT=3103
    networks:
      - smartcity-network
    restart: unless-stopped

volumes:
  smartcity-redis-data:
```

Also update the gateway block's `environment` list a few lines above to include the new URL. Find:

```yaml
    environment:
      - PORT=${PORT_GATEWAY:-3000}
      - REDIS_URL=${REDIS_URL:-redis://redis:6379}
      - USER_SERVICE_URL=${USER_SERVICE_URL:-http://user-service:3001}
      - TOURISM_SERVICE_URL=${TOURISM_SERVICE_URL:-http://tourism-service:3002}
      - FINANCE_SERVICE_URL=${FINANCE_SERVICE_URL:-http://finance-service:3008}
```

Replace with:

```yaml
    environment:
      - PORT=${PORT_GATEWAY:-3000}
      - REDIS_URL=${REDIS_URL:-redis://redis:6379}
      - USER_SERVICE_URL=${USER_SERVICE_URL:-http://user-service:3001}
      - TOURISM_SERVICE_URL=${TOURISM_SERVICE_URL:-http://tourism-service:3002}
      - FINANCE_SERVICE_URL=${FINANCE_SERVICE_URL:-http://finance-service:3008}
      - EDUCATION_SERVICE_URL=${EDUCATION_SERVICE_URL:-http://education-service:3004}
```

- [ ] **Step 4: Write `infra/docker/education-app.Dockerfile`** (copied from `infra/docker/tourism-app.Dockerfile`, `tourism-app` → `education-app`, port `3102` → `3103`)

```dockerfile
# ═══════════════════════════════════════════════════════════
# Smart City Education Frontend Dockerfile (Next.js)
# ═══════════════════════════════════════════════════════════

ARG NODE_VERSION=20

# ── Stage 1: Dependencies ────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/education-app/package.json ./apps/education-app/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: Builder ─────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

ARG NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api

ENV NODE_ENV=${NODE_ENV}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build workspace packages
RUN pnpm --filter "@smartcity/*" run build 2>/dev/null || true

# Build Next.js app
RUN pnpm --filter education-app run build

# ── Stage 3: Production ──────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml* ./
COPY --from=builder /app/apps/education-app/.next ./apps/education-app/.next
COPY --from=builder /app/apps/education-app/public ./apps/education-app/public
COPY --from=builder /app/apps/education-app/package.json ./apps/education-app/
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules

RUN pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm store prune

USER appuser

WORKDIR /app/apps/education-app

ENV NODE_ENV=production
ENV PORT=3103
ENV HOSTNAME=0.0.0.0

EXPOSE 3103

CMD ["pnpm", "start"]
```

- [ ] **Step 5: Add a `dev:education` convenience script to the root `package.json`**

Find:

```json
    "dev:tourism": "turbo run dev --filter=tourism-app --filter=tourism-service",
```

Replace with:

```json
    "dev:tourism": "turbo run dev --filter=tourism-app --filter=tourism-service",
    "dev:education": "turbo run dev --filter=education-app --filter=education-service",
```

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add .env.example docker-compose.yml docker-compose.prod.yml infra/docker/education-app.Dockerfile package.json
git commit -m "chore(infra): wire education-service and education-app into env, compose, and Docker"
```

---

## Task 12: End-to-end backend verification

**Files:** none (verification only)

- [ ] **Step 1: Create a local `.env` for `education-service`**

Run: `cp /Users/mac/Documents/smartcity/services/tourism-service/.env /Users/mac/Documents/smartcity/services/education-service/.env`
Then edit `services/education-service/.env` and change the `CORS_ORIGINS` line to include `http://localhost:3103` (the education-app dev port), e.g.:

```
CORS_ORIGINS="http://localhost:3100,http://localhost:3101,http://localhost:3102,http://localhost:3103"
```

Expected: `services/education-service/.env` now exists with the same `DATABASE_URL`/`JWT_SECRET` as `tourism-service` (this file is gitignored — confirmed via `.gitignore:6` — so it is never committed).

- [ ] **Step 2: Start `education-service`**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm start:dev`
Expected: `[EducationService] Running on http://localhost:3004` with no startup errors.

- [ ] **Step 3: Confirm the endpoint rejects unauthenticated requests**

Run (in a second terminal, leave `education-service` running): `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3004/branches`
Expected: `401`

- [ ] **Step 4: Get a real token from `user-service` and confirm branch creation works end-to-end**

Start `user-service` and `gateway` too (in separate terminals): `cd /Users/mac/Documents/smartcity/services/user-service && pnpm start:dev` and `cd /Users/mac/Documents/smartcity/services/gateway && pnpm start:dev`.

Log in as an existing `ADMIN`-or-higher user (use whatever seeded/created user already exists in this environment's database from prior `tourism-service` work) via the gateway:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<existing-admin-email>","password":"<existing-admin-password>"}'
```

Expected: a JSON body with `accessToken` and `user.role` of `ADMIN` or `MANAGER`. Copy the `accessToken` value into `$TOKEN` for the next command:

```bash
export TOKEN="<paste accessToken here>"
curl -s -X POST http://localhost:3000/api/branches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Main Campus","address":"12 Rue Ibn Sina","city":"Rabat"}'
```

Expected: `201`-equivalent JSON body echoing back the created branch with an `id`, `tenantId` matching the logged-in user's tenant, and `isActive: true`.

- [ ] **Step 5: Confirm tenant isolation on `findAll`**

Run: `curl -s http://localhost:3000/api/branches -H "Authorization: Bearer $TOKEN"`
Expected: a `{ data: [...], meta: {...} }` body containing the branch just created, and only branches whose `tenantId` matches the logged-in user's own tenant (there is no way to pass a different `tenantId` via this request — confirming the isolation guarantee from Task 8 holds).

- [ ] **Step 6: Create a student against that branch**

Run: `curl -s http://localhost:3000/api/branches -H "Authorization: Bearer $TOKEN"` and copy the branch `id` from the response into `$BRANCH_ID`, then:

```bash
export BRANCH_ID="<paste branch id here>"
curl -s -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"branchId\":\"$BRANCH_ID\",\"registrationNumber\":\"STU-0001\",\"firstName\":\"Yassine\",\"lastName\":\"El Amrani\"}"
```

Expected: `201`-equivalent JSON body with the created student, `status: "ACTIVE"`.

- [ ] **Step 7: Confirm the duplicate-registration-number guard**

Run the same command from Step 6 again (same `registrationNumber`).
Expected: an error response with a message like `Registration number "STU-0001" is already in use` (HTTP 409).

- [ ] **Step 8: Stop the three running services** (`Ctrl+C` in each terminal) — nothing to commit, this task is verification-only.

---

## Task 13: `education-app` scaffold (config files)

**Files:**
- Create: `apps/education-app/package.json`
- Create: `apps/education-app/tsconfig.json`
- Create: `apps/education-app/next.config.js`
- Create: `apps/education-app/postcss.config.js`
- Create: `apps/education-app/tailwind.config.ts`

- [ ] **Step 1: Write `apps/education-app/package.json`**

```json
{
  "name": "education-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "NEXT_PUBLIC_API_URL=http://localhost:3000/api next dev -p 3103",
    "build": "next build",
    "start": "next start -p 3103",
    "lint": "next lint"
  },
  "dependencies": {
    "@smartcity/i18n": "workspace:*",
    "@smartcity/types": "workspace:*",
    "@smartcity/ui": "workspace:*",
    "@tanstack/react-query": "^5.59.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Write `apps/education-app/tsconfig.json`**

```json
{
  "extends": "../../packages/config/tsconfig/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@smartcity/ui-components": ["../../packages/ui-components/src"],
      "@smartcity/i18n": ["../../packages/i18n"],
      "@smartcity/types": ["../../packages/shared-types/src"]
    }
  },
  "include": ["next-env.d.ts", "src/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next"]
}
```

- [ ] **Step 3: Write `apps/education-app/next.config.js`**

```js
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
};

module.exports = nextConfig;
```

- [ ] **Step 4: Write `apps/education-app/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Write `apps/education-app/tailwind.config.ts`**

Uses a green/teal primary palette, deliberately distinct from `tourism-app`'s cyan "ocean" palette (per `docs/education/architecture/06-ux-ui-architecture.md` §"فلسفة اللون") so the two verticals are visually distinguishable, while keeping the accent scale identical to `tourism-app`'s.

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui-components/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add apps/education-app/package.json apps/education-app/tsconfig.json apps/education-app/next.config.js apps/education-app/postcss.config.js apps/education-app/tailwind.config.ts
git commit -m "chore(education-app): scaffold Next.js app config"
```

---

## Task 14: Root layout, locale middleware, and `Providers`

**Files:**
- Create: `apps/education-app/src/middleware.ts`
- Create: `apps/education-app/src/lib/i18n.ts`
- Create: `apps/education-app/src/app/[locale]/globals.css`
- Create: `apps/education-app/src/app/[locale]/layout.tsx`
- Create: `apps/education-app/src/app/[locale]/page.tsx`
- Create: `apps/education-app/src/components/Providers.tsx`

- [ ] **Step 1: Write `apps/education-app/src/middleware.ts`** (identical to `apps/tourism-app/src/middleware.ts`)

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supportedLocales, defaultLocale } from '@smartcity/i18n';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = supportedLocales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) return NextResponse.next();

  const locale = defaultLocale;
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
};
```

- [ ] **Step 2: Write `apps/education-app/src/lib/i18n.ts`** (identical to `apps/tourism-app/src/lib/i18n.ts`, reads the `education` namespace added in Task 3 the same way it reads any other namespace)

```ts
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { en, fr, ar } from '@smartcity/i18n';

const translations: Record<string, Record<string, any>> = { en, fr, ar };

export function useTranslation() {
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const [translateFn, setTranslateFn] = useState(() => (key: string, params?: Record<string, string | number>) =>
    getTranslationValue(locale, key, params),
  );

  useEffect(() => {
    setTranslateFn(() => (key: string, params?: Record<string, string | number>) => getTranslationValue(locale, key, params));
  }, [locale]);

  const t = (key: string, params?: Record<string, string | number>): string => translateFn(key, params);

  return { t, locale };
}

function getTranslationValue(locale: string, key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = translations[locale] || translations.fr;

  for (const k of keys) {
    if (value == null) return key;
    value = value[k];
  }

  if (typeof value !== 'string') return key;

  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? `{{${k}}}`));
  }

  return value;
}
```

- [ ] **Step 3: Write `apps/education-app/src/app/[locale]/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900;
  }
}
```

- [ ] **Step 4: Write `apps/education-app/src/components/Providers.tsx`**

```tsx
'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Write `apps/education-app/src/app/[locale]/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import * as React from 'react';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { getDirection, supportedLocales } from '@smartcity/i18n';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SmartCity Education',
  description: 'Manage students, branches, and academic operations',
};

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const direction = getDirection(locale);

  return (
    <html lang={locale} dir={direction}>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Write `apps/education-app/src/app/[locale]/page.tsx`** (root of each locale redirects straight to Branches — there is no public marketing page for this app in Phase 1)

```tsx
import { redirect } from 'next/navigation';

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/branches`);
}
```

- [ ] **Step 7: Verify it compiles** (this will still fail because `@/lib/auth` doesn't exist yet — created in Task 15 — confirm the *only* error is that missing module)

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm install && pnpm exec tsc --noEmit`
Expected: a single error class, `Cannot find module '@/lib/auth'`. No other errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add apps/education-app/src/middleware.ts apps/education-app/src/lib/i18n.ts apps/education-app/src/app/\[locale\]/globals.css apps/education-app/src/app/\[locale\]/layout.tsx apps/education-app/src/app/\[locale\]/page.tsx apps/education-app/src/components/Providers.tsx
git commit -m "feat(education-app): add locale middleware, root layout, and providers"
```

---

## Task 15: API client and auth

**Files:**
- Create: `apps/education-app/src/lib/api.ts`
- Create: `apps/education-app/src/lib/auth.tsx`
- Create: `apps/education-app/src/app/[locale]/login/page.tsx`

- [ ] **Step 1: Write `apps/education-app/src/lib/api.ts`** (adapted from `apps/super-admin-dashboard/src/lib/api.ts` — same `ApiError`/`setUnauthorizedHandler` pattern, education-app-specific token key)

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'education_access_token';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Request failed' }));
    const message = body.message || `Request failed with status ${response.status}`;

    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
```

- [ ] **Step 2: Write `apps/education-app/src/lib/auth.tsx`** (adapted from `apps/super-admin-dashboard/src/lib/auth.tsx` — no `SUPER_ADMIN`-only restriction, since Education is used by `ADMIN`/`MANAGER`/`STAFF` tenant staff, not platform admins)

```tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import type { ILoginResponse, IUser } from '@smartcity/types';
import { apiClient, setUnauthorizedHandler, ApiError } from './api';

interface AuthContextValue {
  user: IUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'education_access_token';
const REFRESH_TOKEN_KEY = 'education_refresh_token';
const USER_KEY = 'education_user';

function persistSession(response: ILoginResponse) {
  localStorage.setItem(TOKEN_KEY, response.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(response.user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser) as IUser);
      } catch {
        clearSession();
      }
    }

    setIsLoading(false);

    setUnauthorizedHandler(() => {
      clearSession();
      setUser(null);
      window.location.href = '/login';
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiClient<ILoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    persistSession(response);
    setUser(response.user);
  };

  const logout = () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    clearSession();
    setUser(null);

    if (refreshToken) {
      apiClient('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {
        // Logout is best-effort client-side; session is already cleared locally.
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { ApiError };
```

- [ ] **Step 3: Write `apps/education-app/src/app/[locale]/login/page.tsx`**, using `@smartcity/ui`'s `Button`/`Input`/`Card` (per the "adopt `@smartcity/ui` from day one" decision — no hand-rolled form primitives)

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@smartcity/ui';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push(`/${locale}/branches`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('common.error');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>SmartCity Education</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              label={t('auth.password') === 'auth.password' ? 'Password' : t('auth.password')}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={isSubmitting} className="w-full">
              {t('common.login') === 'common.login' ? 'Login' : t('common.login')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors. (The `/branches` redirect target from Task 14 Step 6 is only a URL string, not an import, so the not-yet-created `(admin)/branches` route doesn't cause a compile error — only a 404 if visited before Task 16.)

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add apps/education-app/src/lib/api.ts apps/education-app/src/lib/auth.tsx "apps/education-app/src/app/[locale]/login"
git commit -m "feat(education-app): add API client, auth context, and login page"
```

---

## Task 16: Admin route guard, Branches page

**Files:**
- Create: `apps/education-app/src/lib/branches.ts`
- Create: `apps/education-app/src/app/[locale]/(admin)/layout.tsx`
- Create: `apps/education-app/src/app/[locale]/(admin)/branches/page.tsx`

- [ ] **Step 1: Write `apps/education-app/src/lib/branches.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IBranch } from '@smartcity/types';
import { apiClient } from './api';

interface BranchListResponse {
  data: IBranch[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateBranchInput {
  name: string;
  address: string;
  city: string;
}

export function useBranches(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['branches', page, limit],
    queryFn: () =>
      apiClient<BranchListResponse>(`/api/branches?page=${page}&limit=${limit}`),
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBranchInput) =>
      apiClient<IBranch>('/api/branches', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}
```

- [ ] **Step 2: Write `apps/education-app/src/app/[locale]/(admin)/layout.tsx`** (route guard, adapted from `apps/super-admin-dashboard/src/app/(dashboard)/layout.tsx`, with a locale-aware sidebar)

```tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { PageLoader } from '@smartcity/ui';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const { t } = useTranslation();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [isLoading, user, router, locale]);

  if (isLoading || !user) {
    return <PageLoader />;
  }

  const navItems = [
    { href: `/${locale}/branches`, label: t('education.branches') },
    { href: `/${locale}/students`, label: t('education.students') },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-e border-gray-200 bg-white">
        <div className="p-4 text-sm font-semibold text-gray-900">SmartCity Education</div>
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm ${
                pathname === item.href
                  ? 'bg-primary-50 font-medium text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div />
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{user.email}</span>
            <button onClick={logout} className="text-gray-700 hover:underline">
              {t('common.logout') === 'common.logout' ? 'Logout' : t('common.logout')}
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `apps/education-app/src/app/[locale]/(admin)/branches/page.tsx`**

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
import { useBranches, useCreateBranch } from '@/lib/branches';
import { useTranslation } from '@/lib/i18n';

export default function BranchesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await createBranch.mutateAsync({ name, address, city });
    setName('');
    setAddress('');
    setCity('');
    setIsModalOpen(false);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.branches')}</h1>
        <Button onClick={() => setIsModalOpen(true)}>{t('education.addBranch')}</Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noBranchesYet')}</p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((branch) => (
            <Card key={branch.id}>
              <CardContent>
                <p className="font-medium text-gray-900">{branch.name}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {branch.address}, {branch.city}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.addBranch')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={createBranch.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.branchName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label={t('education.branchAddress')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <Input
            label={t('education.branchCity')}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add apps/education-app/src/lib/branches.ts "apps/education-app/src/app/[locale]/(admin)/layout.tsx" "apps/education-app/src/app/[locale]/(admin)/branches"
git commit -m "feat(education-app): add admin route guard and Branches page"
```

---

## Task 17: Students page

**Files:**
- Create: `apps/education-app/src/lib/students.ts`
- Create: `apps/education-app/src/app/[locale]/(admin)/students/page.tsx`

- [ ] **Step 1: Write `apps/education-app/src/lib/students.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IStudent } from '@smartcity/types';
import { apiClient } from './api';

interface StudentListResponse {
  data: IStudent[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateStudentInput {
  branchId: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}

export function useStudents(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['students', page, limit],
    queryFn: () =>
      apiClient<StudentListResponse>(`/api/students?page=${page}&limit=${limit}`),
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStudentInput) =>
      apiClient<IStudent>('/api/students', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
```

- [ ] **Step 2: Write `apps/education-app/src/app/[locale]/(admin)/students/page.tsx`**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import {
  Button,
  Input,
  Badge,
  Modal,
  Skeleton,
} from '@smartcity/ui';
import { useBranches } from '@/lib/branches';
import { useStudents, useCreateStudent } from '@/lib/students';
import { useTranslation } from '@/lib/i18n';

const STATUS_VARIANT: Record<string, 'success' | 'default' | 'info'> = {
  ACTIVE: 'success',
  WITHDRAWN: 'default',
  GRADUATED: 'info',
};

export default function StudentsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useStudents();
  const { data: branchesData } = useBranches();
  const createStudent = useCreateStudent();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createStudent.mutateAsync({
        branchId,
        registrationNumber,
        firstName,
        lastName,
      });
      setBranchId('');
      setRegistrationNumber('');
      setFirstName('');
      setLastName('');
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const branchNameById = (id: string) =>
    branchesData?.data.find((b) => b.id === id)?.name ?? id;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.students')}</h1>
        <Button onClick={() => setIsModalOpen(true)}>{t('education.addStudent')}</Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="3rem" />
          <Skeleton height="3rem" />
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noStudentsYet')}</p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.studentRegistrationNumber')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">Name</th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.studentBranch')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.studentStatus')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((student) => (
                <tr key={student.id} className="border-b border-gray-100 last:border-0">
                  <td className="p-3">{student.registrationNumber}</td>
                  <td className="p-3">
                    {student.firstName} {student.lastName}
                  </td>
                  <td className="p-3">{branchNameById(student.branchId)}</td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANT[student.status] ?? 'default'}>
                      {student.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.addStudent')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={createStudent.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.studentBranch')}
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {branchesData?.data.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t('education.studentRegistrationNumber')}
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            required
          />
          <Input
            label={t('education.studentFirstName')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label={t('education.studentLastName')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add apps/education-app/src/lib/students.ts "apps/education-app/src/app/[locale]/(admin)/students"
git commit -m "feat(education-app): add Students page"
```

---

## Task 18: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend chain**

In three separate terminals: `cd services/user-service && pnpm start:dev`, `cd services/gateway && pnpm start:dev`, `cd services/education-service && pnpm start:dev`. Confirm all three print their "Running on http://localhost:PORT" line with no errors.

- [ ] **Step 2: Start `education-app`**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm dev`
Expected: `Local: http://localhost:3103`

- [ ] **Step 3: Visit the app while logged out**

Open `http://localhost:3103` in a browser.
Expected: redirected to `http://localhost:3103/fr/branches`, then immediately redirected again to `http://localhost:3103/fr/login` (the `(admin)` route guard from Task 16 kicks in because there's no session yet).

- [ ] **Step 4: Log in**

On the login page, enter the same admin credentials used in Task 12 Step 4.
Expected: redirected to `/fr/branches`, page shows the "Main Campus" branch created during backend verification (Task 12), rendered as a `@smartcity/ui` `Card`.

- [ ] **Step 5: Create a second branch through the UI**

Click "Add branch" (or its French label), fill the modal, submit.
Expected: modal closes, the new branch appears in the grid without a full page reload (confirms the React Query cache invalidation from `useCreateBranch` works).

- [ ] **Step 6: Visit Students and create one through the UI**

Navigate to Students in the sidebar, click "Add student", select a branch from the dropdown, fill in the remaining fields, submit.
Expected: modal closes, the new row appears in the table with an `ACTIVE` badge and the correct branch name resolved (confirms `useBranches`' data is correctly cross-referenced in `branchNameById`).

- [ ] **Step 7: Confirm RTL rendering**

Change the URL from `/fr/` to `/ar/` (e.g. `http://localhost:3103/ar/branches`).
Expected: layout direction flips to right-to-left (the `<html dir="rtl">` from `getDirection('ar')` in the root layout), and the sidebar/table read correctly right-to-left with the `education` namespace's Arabic strings from Task 3.

- [ ] **Step 8: Stop all four dev servers** (`Ctrl+C` in each terminal). Nothing to commit — this task is verification-only.

---

## Follow-up (not in this plan)

Once this lands: Parent management (+ Student↔Parent link), Academic Structure (Program/Subject/Level/Group), Timetable, Attendance, and Finance core (Invoice/Payment/Installment) are Phase 2, per `docs/education/architecture/00-reconciliation-baseline.md` §5. They reuse every pattern established here (tenant-scoped Prisma models, copied auth module, gateway routing, `@smartcity/ui` + React Query frontend) — no new architectural decisions should be needed to write that plan.
