# Education: Users (Staff Accounts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth full-stack Education slice — staff account management (create/list/edit/deactivate `MANAGER`/`STAFF`/`ACCOUNTANT` users) — while fixing a pre-existing tenant-isolation security bug in `user-service`'s `UsersService` that this slice's new admin UI would otherwise sit directly on top of.

**Architecture:** `user-service`'s existing `users` module gets a tenant-scoping fix (every method takes `tenantId`, sourced only from the caller's JWT, never client input) plus a new `create` method/endpoint. `education-app` gets a new `lib/users.ts` hook file, a new "Users" page (stat cards + table + add-user modal, following the same pattern as every prior Education page), and a new sidebar nav entry. No new Prisma models — this slice reuses the existing shared `User`/`UserRole`.

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB), class-validator, bcryptjs — Next.js 15, React 19, `@smartcity/ui`, `@smartcity/types`, `@tanstack/react-query`, `lucide-react`.

---

## Deviations from app-injahi (and why)

Documented in full in `docs/superpowers/specs/2026-08-23-education-users-design.md` — summary:

- **Fixes a real pre-existing tenant-isolation bug** in `user-service`'s `UsersService` (`findById`,
  `update`, `softDelete` had zero tenant checks; `findAll` took `tenantId` from a client-supplied
  query param). Not present in app-injahi at all — app-injahi is single-tenant, this bug is
  specific to this monorepo's multi-tenant `user-service`.
- **Roles limited to `MANAGER`/`STAFF`/`ACCOUNTANT`** (this monorepo's `UserRole` enum) instead of
  app-injahi's `ADMIN`/`SECRETARY` pair — cannot mint `ADMIN`/`SUPER_ADMIN` from this UI.
- **No secretary-only profile fields** (`gsm`, `whatsapp`, `address`, `schoolLevel`,
  `certification`, `avatar`) — no home for them in the shared `User` model.
- **No invite-link/email flow** — admin sets the password directly, same as app-injahi and every
  prior Education slice's bias toward the simplest thing that works today.
- **No automated tests** — same as every prior slice; verification is `tsc --noEmit`, `nest
  build`, and manual `curl`/Playwright checks.

**Known pre-existing limitation, deliberately not touched:** `UsersController`'s class-level
`@Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')` decorator applies to every handler, including
`GET /users/me` — a `STAFF`/`ACCOUNTANT`/`GUEST` user technically cannot call `/users/me` today.
This is unrelated to the tenant-isolation bug this plan fixes, no frontend code calls `/users/me`
anywhere in this monorepo currently (verified via grep), and changing controller-wide RBAC is a
separate decision from the approved design's scope. Left as-is; worth a future look if/when
something actually starts calling that route.

---

## File Structure

```
services/user-service/
  src/common/tenant.util.ts                  # create: requireTenantId(user) helper
  src/users/dto/create-user.dto.ts            # create: CreateUserDto
  src/users/users.service.ts                  # modify: tenant-scope every method, + create()
  src/users/users.controller.ts               # modify: pass tenantId through, + POST /users

apps/education-app/
  src/components/StatCard.tsx                 # modify: + indigo color
  src/components/InitialsAvatar.tsx           # modify: + indigo color
  src/lib/users.ts                            # create: TanStack Query hooks
  src/app/[locale]/(admin)/layout.tsx         # modify: + Users sidebar nav entry
  src/app/[locale]/(admin)/users/page.tsx     # create: Users page

packages/i18n/locales/{en,fr,ar}.json         # modify: + users education.* keys
```

No changes needed to `packages/database/prisma/schema.prisma` (the `User`/`UserRole` shape already
supports this), `packages/shared-types` (`IUser`/`UserRole` already exported from
`@smartcity/types`), `services/user-service/src/app.module.ts` (`UsersModule` already registered),
or `services/gateway/src/proxy/proxy.middleware.ts` (`/api/users` already routes to
`user-service`).

---

## Task 1: `requireTenantId` helper for `user-service`

**Files:**
- Create: `services/user-service/src/common/tenant.util.ts`

- [ ] **Step 1: Write the helper**

```typescript
import { ForbiddenException } from '@nestjs/common';
import type { CurrentUserDto } from '../auth/jwt.strategy';

/**
 * Returns the authenticated user's tenantId, or throws if the token carries
 * none. Every tenant-scoped user-service method must scope its Prisma
 * queries with the value this returns — never with a tenantId taken from
 * client input (query params, body fields, etc).
 */
export function requireTenantId(user: CurrentUserDto): string {
  if (!user.tenantId) {
    throw new ForbiddenException('Tenant context required');
  }
  return user.tenantId;
}
```

This is a straight port of `services/education-service/src/common/tenant.util.ts`, adapted to
`user-service`'s own `CurrentUserDto` type (same shape: `userId`, `email`, `firstName?`,
`lastName?`, `role`, `tenantId?` — defined in `services/user-service/src/auth/jwt.strategy.ts`).

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/services/user-service && pnpm exec tsc --noEmit`
Expected: no errors (the file isn't imported by anything yet, so this just checks syntax).

- [ ] **Step 3: Commit**

```bash
git add services/user-service/src/common/tenant.util.ts
git commit -m "feat(user-service): add requireTenantId helper"
```

---

## Task 2: Tenant-scope `UsersService` and add `create`

**Files:**
- Modify: `services/user-service/src/users/users.service.ts` (full rewrite — small file, easier to
  replace wholesale than patch piecemeal)
- Create: `services/user-service/src/users/dto/create-user.dto.ts`

**Context:** The current `UsersService` (`services/user-service/src/users/users.service.ts`) has
four methods, none of which scope by tenant correctly — `findAll` takes `tenantId` as an optional
filter from the caller instead of the JWT, and `findById`/`update`/`softDelete` don't check tenant
at all. This task fixes all four and adds a fifth (`create`).

- [ ] **Step 1: Write `create-user.dto.ts`**

```typescript
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsIn(['MANAGER', 'STAFF', 'ACCOUNTANT'])
  role: 'MANAGER' | 'STAFF' | 'ACCOUNTANT';
}
```

- [ ] **Step 2: Rewrite `users.service.ts`**

```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

interface FindAllParams {
  page: number;
  limit: number;
  role?: string;
}

const SELECT_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  tenantId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUserDto) {
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        tenantId,
      },
      select: SELECT_FIELDS,
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, role } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: SELECT_FIELDS,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SELECT_FIELDS,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByIdInTenant(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: SELECT_FIELDS,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(tenantId: string, id: string, data: Record<string, any>) {
    // Prevent updating sensitive fields directly
    const { password, email, role, isActive, tenantId: _ignored, ...safeData } = data;

    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: safeData,
      select: SELECT_FIELDS,
    });
  }

  async softDelete(tenantId: string, id: string, callerId: string) {
    if (id === callerId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'User deactivated successfully' };
  }
}
```

Note: `findById` (no tenant param) stays as-is and is used only by `GET /users/me` (a user looking
up their own record by their own `userId` from the JWT — there's no cross-tenant risk since the ID
comes from the token, not client input). `findByIdInTenant` is the new tenant-checked variant used
by `GET /users/:id`, where the `:id` param IS client-supplied and must be checked. This mirrors
`education-service`'s own `assert*InTenant` naming pattern for the same "trusted-self-lookup vs
client-supplied-id-lookup" distinction.

Note: `findAll`'s `where` clause deliberately drops the original code's `isActive: true` filter.
The pre-existing `UsersService` hard-filtered to active users only, which made sense when there was
no way to *see* deactivated users anywhere. This slice's Users page needs to show both active and
inactive staff (status badges, an "active staff" stat card, and disabling the deactivate button
once a user is already inactive) — hiding inactive users from `findAll` entirely would make all of
that impossible and contradicts Task 9 Step 7's verification, which expects a just-deactivated user
to still appear in the table with an "Inactif" badge, not silently disappear.

- [ ] **Step 3: Verify it compiles (controller not updated yet — expect controller-side errors, not service-side)**

Run: `cd /Users/mac/Documents/smartcity/services/user-service && pnpm exec tsc --noEmit`
Expected: errors only in `users.controller.ts` (still calling the old method signatures) — no
errors inside `users.service.ts` or `dto/create-user.dto.ts` themselves. This confirms the service
rewrite itself is type-correct; Task 3 fixes the controller.

- [ ] **Step 4: Commit**

```bash
git add services/user-service/src/users/users.service.ts services/user-service/src/users/dto/create-user.dto.ts
git commit -m "fix(user-service): tenant-scope UsersService and add create()

findById/update/softDelete previously performed zero tenant checks, and
findAll took tenantId from a client-supplied query param instead of the
caller's JWT -- any authenticated ADMIN/MANAGER could view, edit, or
deactivate another tenant's users. All four methods now require an
explicit tenantId sourced only from the JWT. Also adds create() for the
upcoming Education Users admin page."
```

---

## Task 3: Wire tenant scoping and the create route into `UsersController`

**Files:**
- Modify: `services/user-service/src/users/users.controller.ts`

- [ ] **Step 1: Rewrite the controller**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { requireTenantId } from '../common/tenant.util';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user?.userId;
    return this.usersService.findById(userId);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateUserDto) {
    const tenantId = requireTenantId(req.user);
    return this.usersService.create(tenantId, dto);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
  ) {
    const tenantId = requireTenantId(req.user);
    return this.usersService.findAll(tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      role,
    });
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const tenantId = requireTenantId(req.user);
    return this.usersService.findByIdInTenant(tenantId, id);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: Record<string, any>,
  ) {
    const tenantId = requireTenantId(req.user);
    return this.usersService.update(tenantId, id, data);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const tenantId = requireTenantId(req.user);
    return this.usersService.softDelete(tenantId, id, req.user.userId);
  }
}
```

This keeps the file's existing `@Req() req: any` convention (rather than introducing a new
`@CurrentUser()` decorator, which doesn't exist in `user-service` today and would be an unrelated
refactor for this task).

- [ ] **Step 2: Verify the whole service builds**

Run: `cd /Users/mac/Documents/smartcity/services/user-service && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/services/user-service && rm -f tsconfig.tsbuildinfo && pnpm exec nest build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add services/user-service/src/users/users.controller.ts
git commit -m "fix(user-service): wire tenant scoping into UsersController, add POST /users"
```

---

## Task 4: `StatCard` and `InitialsAvatar` gain an `indigo` color

**Files:**
- Modify: `apps/education-app/src/components/StatCard.tsx`
- Modify: `apps/education-app/src/components/InitialsAvatar.tsx`

**Context:** Every color used so far (`sky`, `primary`, `amber`, `violet`, `rose`, `green`) is
already claimed by another page's accent. This task adds `indigo` for the new Users page, matching
exactly how `green` was added for Finance.

- [ ] **Step 1: Edit `StatCard.tsx`**

In `apps/education-app/src/components/StatCard.tsx`, change:

```typescript
const colorClasses = {
  sky: 'bg-sky-50 text-sky-600',
  primary: 'bg-primary-50 text-primary-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
  green: 'bg-green-50 text-green-600',
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
} as const;
```

- [ ] **Step 2: Edit `InitialsAvatar.tsx`**

In `apps/education-app/src/components/InitialsAvatar.tsx`, change:

```typescript
const gradientClasses = {
  sky: 'from-sky-500 to-sky-600',
  primary: 'from-primary-500 to-primary-600',
  amber: 'from-amber-500 to-amber-600',
  violet: 'from-violet-500 to-violet-600',
  rose: 'from-rose-500 to-rose-600',
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
} as const;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/education-app/src/components/StatCard.tsx apps/education-app/src/components/InitialsAvatar.tsx
git commit -m "feat(education-app): add indigo color to StatCard and InitialsAvatar"
```

---

## Task 5: Frontend API hooks — `lib/users.ts`

**Files:**
- Create: `apps/education-app/src/lib/users.ts`

- [ ] **Step 1: Write the hooks**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IUser } from '@smartcity/types';
import { apiClient } from './api';

interface UserListResponse {
  data: IUser[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type ManagedRole = 'MANAGER' | 'STAFF' | 'ACCOUNTANT';

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: ManagedRole;
}

export function useUsers(page = 1, limit = 20, role?: ManagedRole) {
  return useQuery({
    queryKey: ['users', page, limit, role],
    queryFn: () =>
      apiClient<UserListResponse>(
        `/users?page=${page}&limit=${limit}${role ? `&role=${role}` : ''}`,
      ),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      apiClient<IUser>('/users', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ message: string }>(`/users/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

`IUser` and its `role: UserRole` field already exist in `@smartcity/types`
(`packages/shared-types/src/user.types.ts`) — no new shared type needed. No `useUpdateUser` hook:
the approved design scopes this page to create + list + deactivate only (editing an existing
staff member's profile fields isn't in scope for this slice).

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/education-app/src/lib/users.ts
git commit -m "feat(education-app): add Users API hooks"
```

---

## Task 6: Sidebar nav entry

**Files:**
- Modify: `apps/education-app/src/app/[locale]/(admin)/layout.tsx`

**Context:** The `Users` icon name from `lucide-react` is already imported and used for the
Guardians nav item (`apps/education-app/src/app/[locale]/(admin)/layout.tsx:12`), so this new
entry uses a different icon: `UserCog` (a person-with-gear icon, reads clearly as "manage user
accounts").

- [ ] **Step 1: Add the `UserCog` import**

In `apps/education-app/src/app/[locale]/(admin)/layout.tsx`, change:

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
} from 'lucide-react';
```

- [ ] **Step 2: Add the nav entry**

In the same file, change the end of the `navItems` array from:

```typescript
    {
      href: `/${locale}/finance`,
      label: t('education.finance'),
      icon: Wallet,
      accent: 'text-green-400',
      activeBg: 'bg-green-500/10',
      activeBorder: 'border-green-400',
    },
  ];
```

to:

```typescript
    {
      href: `/${locale}/finance`,
      label: t('education.finance'),
      icon: Wallet,
      accent: 'text-green-400',
      activeBg: 'bg-green-500/10',
      activeBorder: 'border-green-400',
    },
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

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: errors about the missing `education.users` i18n key type are NOT expected (the `t()`
helper isn't strictly typed against the JSON in this codebase — verify by checking that any error
here is unrelated to this change). Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/education-app/src/app/[locale]/(admin)/layout.tsx"
git commit -m "feat(education-app): add Users sidebar navigation entry"
```

---

## Task 7: i18n keys

**Files:**
- Modify: `packages/i18n/locales/en.json`
- Modify: `packages/i18n/locales/fr.json`
- Modify: `packages/i18n/locales/ar.json`

- [ ] **Step 1: Add keys to `en.json`**

In `packages/i18n/locales/en.json`, the `"education"` object currently ends with:

```json
    "noTransactionsYet": "No transactions recorded yet.",
    "typeIncome": "Income",
    "typeExpense": "Expense"
  }
}
```

Change to:

```json
    "noTransactionsYet": "No transactions recorded yet.",
    "typeIncome": "Income",
    "typeExpense": "Expense",
    "users": "Users",
    "addUser": "Add user",
    "userEmail": "Email",
    "userPassword": "Password",
    "userFirstName": "First name",
    "userLastName": "Last name",
    "userPhone": "Phone (optional)",
    "userRole": "Role",
    "roleManager": "Manager",
    "roleStaff": "Staff",
    "roleAccountant": "Accountant",
    "userStatus": "Status",
    "statusActive": "Active",
    "statusInactive": "Inactive",
    "deactivateUser": "Deactivate",
    "confirmDeactivateUser": "Deactivate this user? They will no longer be able to log in.",
    "cannotDeactivateSelf": "You cannot deactivate your own account.",
    "noUsersYet": "No staff accounts yet.",
    "totalStaff": "Total staff",
    "activeStaff": "Active staff",
    "staffByRole": "Manager / Staff / Accountant"
  }
}
```

- [ ] **Step 2: Add keys to `fr.json`**

In `packages/i18n/locales/fr.json`, the `"education"` object currently ends with:

```json
    "noTransactionsYet": "Aucune transaction enregistrée pour l'instant.",
    "typeIncome": "Revenu",
    "typeExpense": "Dépense"
  }
}
```

Change to:

```json
    "noTransactionsYet": "Aucune transaction enregistrée pour l'instant.",
    "typeIncome": "Revenu",
    "typeExpense": "Dépense",
    "users": "Utilisateurs",
    "addUser": "Ajouter un utilisateur",
    "userEmail": "Email",
    "userPassword": "Mot de passe",
    "userFirstName": "Prénom",
    "userLastName": "Nom",
    "userPhone": "Téléphone (optionnel)",
    "userRole": "Rôle",
    "roleManager": "Manager",
    "roleStaff": "Personnel",
    "roleAccountant": "Comptable",
    "userStatus": "Statut",
    "statusActive": "Actif",
    "statusInactive": "Inactif",
    "deactivateUser": "Désactiver",
    "confirmDeactivateUser": "Désactiver cet utilisateur ? Il ne pourra plus se connecter.",
    "cannotDeactivateSelf": "Vous ne pouvez pas désactiver votre propre compte.",
    "noUsersYet": "Aucun compte du personnel pour l'instant.",
    "totalStaff": "Total du personnel",
    "activeStaff": "Personnel actif",
    "staffByRole": "Manager / Personnel / Comptable"
  }
}
```

- [ ] **Step 3: Add keys to `ar.json`**

In `packages/i18n/locales/ar.json`, the `"education"` object currently ends with:

```json
    "noTransactionsYet": "لا توجد معاملات مسجلة بعد.",
    "typeIncome": "إيراد",
    "typeExpense": "مصروف"
  }
}
```

Change to:

```json
    "noTransactionsYet": "لا توجد معاملات مسجلة بعد.",
    "typeIncome": "إيراد",
    "typeExpense": "مصروف",
    "users": "المستخدمون",
    "addUser": "إضافة مستخدم",
    "userEmail": "البريد الإلكتروني",
    "userPassword": "كلمة المرور",
    "userFirstName": "الاسم الشخصي",
    "userLastName": "الاسم العائلي",
    "userPhone": "الهاتف (اختياري)",
    "userRole": "الدور",
    "roleManager": "مدير",
    "roleStaff": "موظف",
    "roleAccountant": "محاسب",
    "userStatus": "الحالة",
    "statusActive": "نشط",
    "statusInactive": "غير نشط",
    "deactivateUser": "تعطيل",
    "confirmDeactivateUser": "تعطيل هذا المستخدم؟ لن يتمكن من تسجيل الدخول بعد الآن.",
    "cannotDeactivateSelf": "لا يمكنك تعطيل حسابك الخاص.",
    "noUsersYet": "لا توجد حسابات موظفين بعد.",
    "totalStaff": "إجمالي الموظفين",
    "activeStaff": "الموظفون النشطون",
    "staffByRole": "مدير / موظف / محاسب"
  }
}
```

- [ ] **Step 4: Verify all three files are valid JSON**

Run: `python3 -c "import json; [json.load(open(f'/Users/mac/Documents/smartcity/packages/i18n/locales/{l}.json')) for l in ['en','fr','ar']]; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/locales/en.json packages/i18n/locales/fr.json packages/i18n/locales/ar.json
git commit -m "feat(i18n): add users education namespace keys (en/fr/ar)"
```

---

## Task 8: Users page

**Files:**
- Create: `apps/education-app/src/app/[locale]/(admin)/users/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { UserCog, UserCheck, Users as UsersIcon, Ban } from 'lucide-react';
import { Button, Input, Badge, Modal, Skeleton } from '@smartcity/ui';
import { useUsers, useCreateUser, useDeactivateUser, type ManagedRole } from '@/lib/users';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';
import { InitialsAvatar } from '@/components/InitialsAvatar';

interface UserFormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: ManagedRole;
}

const EMPTY_FORM: UserFormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'STAFF',
};

const ROLE_LABEL_KEY: Record<ManagedRole, string> = {
  MANAGER: 'education.roleManager',
  STAFF: 'education.roleStaff',
  ACCOUNTANT: 'education.roleAccountant',
};

export default function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { data, isLoading } = useUsers(1, 100);
  const createUser = useCreateUser();
  const deactivateUser = useDeactivateUser();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await createUser.mutateAsync({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        role: form.role,
      });
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!window.confirm(t('education.confirmDeactivateUser'))) {
      return;
    }
    await deactivateUser.mutateAsync(id);
  };

  const users = data?.data ?? [];
  const activeCount = users.filter((u) => u.isActive).length;
  const managerCount = users.filter((u) => u.role === 'MANAGER').length;
  const staffCount = users.filter((u) => u.role === 'STAFF').length;
  const accountantCount = users.filter((u) => u.role === 'ACCOUNTANT').length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.users')}</h1>
        <Button onClick={openCreateModal}>{t('education.addUser')}</Button>
      </div>

      {!isLoading && users.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={UsersIcon}
            color="indigo"
            label={t('education.totalStaff')}
            value={users.length}
          />
          <StatCard
            icon={UserCheck}
            color="indigo"
            label={t('education.activeStaff')}
            value={activeCount}
          />
          <StatCard
            icon={UserCog}
            color="indigo"
            label={t('education.staffByRole')}
            value={`${managerCount} / ${staffCount} / ${accountantCount}`}
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && users.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
            <UserCog size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noUsersYet')}</p>
        </div>
      )}

      {!isLoading && users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.fullName')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.userRole')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.userStatus')}
                </th>
                <th className="p-3 text-end font-medium text-gray-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((staffUser) => {
                const isSelf = staffUser.id === currentUser?.id;
                return (
                  <tr key={staffUser.id} className="border-b border-gray-100 last:border-0 hover:bg-indigo-50/30">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar
                          name={`${staffUser.firstName} ${staffUser.lastName}`}
                          color="indigo"
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            {staffUser.firstName} {staffUser.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{staffUser.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">
                      {t(ROLE_LABEL_KEY[staffUser.role as ManagedRole] ?? staffUser.role)}
                    </td>
                    <td className="p-3">
                      <Badge variant={staffUser.isActive ? 'success' : 'default'}>
                        {staffUser.isActive
                          ? t('education.statusActive')
                          : t('education.statusInactive')}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleDeactivate(staffUser.id)}
                          disabled={isSelf || !staffUser.isActive}
                          title={isSelf ? t('education.cannotDeactivateSelf') : t('education.deactivateUser')}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        >
                          <Ban size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.addUser')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={createUser.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.userFirstName')}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <Input
            label={t('education.userLastName')}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
          <Input
            label={t('education.userEmail')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label={t('education.userPassword')}
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <Input
            label={t('education.userPhone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.userRole')}
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as ManagedRole })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="MANAGER">{t('education.roleManager')}</option>
              <option value="STAFF">{t('education.roleStaff')}</option>
              <option value="ACCOUNTANT">{t('education.roleAccountant')}</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
```

Notes on this page relative to prior pages:
- Uses `useAuth()`'s `currentUser.id` to compare against each row and disable the deactivate button
  on the caller's own row (frontend UX mirror of the backend guard — the backend guard in
  `UsersService.softDelete` is the actual security boundary).
- The deactivate button is also disabled once a user is already inactive (`!staffUser.isActive`) —
  nothing to do twice.
- No edit modal/action — the approved design scopes this page to create + list + deactivate only.
- The status column header uses the dedicated `education.userStatus` key (added in Task 7),
  distinct from `education.statusActive`/`education.statusInactive` used for the badge text itself.

- [ ] **Step 2: Verify it compiles and builds**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec next build`
Expected: build succeeds, route table includes `/[locale]/users`.

- [ ] **Step 3: Commit**

```bash
git add "apps/education-app/src/app/[locale]/(admin)/users/page.tsx"
git commit -m "feat(education-app): add Users page (staff account management)"
```

---

## Task 9: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend and frontend**

Start `user-service`, `gateway`, `education-service` (not touched, but other pages depend on it if
navigating around), `education-app`, plus a local `redis-server`, per prior Education testing
sessions' setup notes (local `REDIS_URL` override needed for `user-service`).

- [ ] **Step 2: Log in as the test tenant admin and create a staff user via curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test-education.local","password":"TestEdu123!"}' \
  -o /tmp/login.json && python3 -c "import json; print(json.load(open('/tmp/login.json'))['accessToken'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"secretary1@test-education.local","password":"Secretary123!","firstName":"Sara","lastName":"Bennani","role":"STAFF"}' \
  http://localhost:3001/users
```

Expected: JSON response with the created user (`role: "STAFF"`, `tenantId` matching the admin's
own tenant, no `password`/`passwordHash` field in the response).

- [ ] **Step 3: Verify the list is tenant-scoped**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/users?limit=10"
```

Expected: the response includes the just-created `secretary1@test-education.local` user, and every
`tenantId` in the list matches the admin's own tenant.

- [ ] **Step 4: Verify the cross-tenant fix — this is the critical security check**

This requires a second tenant + admin to exist. If one doesn't already exist in the Atlas dev
database from prior testing, register one first:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin2@test-education-b.local","password":"TestEdu456!","firstName":"Second","lastName":"Admin"}' \
  http://localhost:3001/auth/register
```

(This creates a user with no `tenantId` and default `GUEST` role via the public `register`
endpoint — sufficient for this check since we only need a *different* user ID to probe, not a
fully-provisioned second tenant. If `register` requires a `tenantId` in practice, use any other
existing user ID from a different tenant found via direct DB inspection instead.)

```bash
OTHER_USER_ID="<id of a user belonging to a different tenant than admin@test-education.local>"
curl -s -o /tmp/cross_tenant_check.json -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/users/$OTHER_USER_ID"
cat /tmp/cross_tenant_check.json
```

Expected: HTTP 404 (`User not found`) — NOT the other tenant's user data. This confirms the
tenant-isolation fix from Task 2/3 actually works, not just that it compiles.

- [ ] **Step 5: Verify self-deactivate is blocked**

```bash
ME_ID=$(python3 -c "import json; print(json.load(open('/tmp/login.json'))['user']['id'])")
curl -s -o /tmp/self_deactivate_check.json -w "%{http_code}" \
  -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/users/$ME_ID"
cat /tmp/self_deactivate_check.json
```

Expected: HTTP 400 with a message about not being able to deactivate your own account.

- [ ] **Step 6: Verify deactivating someone else works**

```bash
SECRETARY_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/users?limit=10" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print([u['id'] for u in d['data'] if u['email']=='secretary1@test-education.local'][0])")

curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "http://localhost:3001/users/$SECRETARY_ID"
```

Expected: `{"message":"User deactivated successfully"}`.

- [ ] **Step 7: Verify the UI end-to-end in the browser**

Open `http://localhost:3103/fr/login`, log in, confirm "Utilisateurs" appears in the sidebar with
an indigo accent (last item). Open it, confirm the three stat cards show correct totals including
the secretary account created in Step 2 (now shown as inactive after Step 6 — status badge should
read "Inactif"). Click "Ajouter un utilisateur", create a new MANAGER account, save, confirm it
appears in the table with a green "Actif" badge. Confirm the deactivate button on the logged-in
admin's own row is visibly disabled.

- [ ] **Step 8: Report results**

No commit for this task — it's verification only. If any step fails, fix the underlying code in
the relevant earlier task and re-commit there, then re-run this task's steps.
