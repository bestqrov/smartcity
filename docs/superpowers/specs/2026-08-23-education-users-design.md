# Education: Users (Staff Accounts) Module Design

## Goal

Add a sixth full-stack Education slice — staff account management — continuing the pattern of
porting a module from the user's reference project (`bestqrov/app-injahi`) into a proper
multi-tenant SaaS slice. Unlike every prior slice, this one lives partly in `user-service` (not
`education-service`), because staff accounts are `User` rows in the shared, cross-vertical
`User`/`Tenant` schema that auth already uses.

## What's being ported, and what's deliberately left out

app-injahi's `users` module lets an `ADMIN` create/list/update/delete staff accounts with role
`ADMIN` or `SECRETARY`, plus secretary-specific list/update endpoints and secretary-only profile
fields (`gsm`, `whatsapp`, `address`, `schoolLevel`, `certification`, `avatar`).

This slice ports the core shape — an admin managing staff accounts for their own institution — but
adapted to this monorepo's existing shared `UserRole` enum (`SUPER_ADMIN`, `ADMIN`, `MANAGER`,
`STAFF`, `ACCOUNTANT`, `GUEST`) instead of app-injahi's two-role scheme. It deliberately leaves
out:
- **Secretary-only profile fields** (`gsm`, `whatsapp`, `address`, `schoolLevel`, `certification`,
  `avatar`) — the shared `User` model doesn't have them and adding them would mean either forking
  the model per-vertical or polluting every other vertical's `User` rows with Education-only
  fields. If a future need arises, that's a separate, deliberate schema decision, not a side effect
  of porting this module.
- **Invite-link/email flow** — no email service exists anywhere in this monorepo yet. Matches
  app-injahi's own approach (admin sets the password directly) and every prior Education slice's
  bias toward the simplest thing that works today.
- **Creating `ADMIN` or `SUPER_ADMIN` accounts from this UI** — scoped down to `MANAGER`, `STAFF`,
  `ACCOUNTANT` only, so a compromised or malicious `MANAGER`-level account can't use this endpoint
  to mint itself admin-equivalent access. Provisioning additional `ADMIN`s stays a DB-level/support
  operation, same trust boundary as `SUPER_ADMIN` already has.

## A pre-existing security bug this slice must fix first

While investigating the existing `user-service` `users` module (`services/user-service/src/users/`)
to see what it already offered, three real tenant-isolation bugs were found in
`users.service.ts`:

1. `findById(id)` — no tenant check at all. Any authenticated `ADMIN`/`MANAGER`, from any tenant,
   can fetch any other tenant's user by ID (email, phone, role — full PII).
2. `update(id, data)` — same: no tenant check. Any `ADMIN`/`MANAGER` can edit another tenant's
   user's `firstName`/`lastName`/`phone`/`avatar`.
3. `softDelete(id)` — same: no tenant check. Any `ADMIN`/`MANAGER` can deactivate another tenant's
   user by guessing/enumerating IDs.
4. `findAll(params)` — `tenantId` is accepted as a **client-supplied query parameter** rather than
   derived from the caller's JWT, so a caller can list any tenant's users by passing a different
   `tenantId`.

Usage check before deciding to fix this now: `apps/tourism-app/src/app/[locale]/admin/page.tsx` is
the only caller of `GET /users` today, and only for a count (`?page=1&limit=1`, no `tenantId`
param) — `apps/super-admin-dashboard` doesn't call `/users` at all yet (still an unbuilt plan per
project memory). So the fix is safe to make now with no other caller to coordinate with, and it
must happen now regardless, because this slice adds a real admin UI on top of these same endpoints
— shipping that UI without the fix would just be a nicer front end on a broken back end.

**Fix:** every `UsersService` method takes `tenantId` as an explicit first parameter, sourced only
from `requireTenantId(user)` in the controller (the same helper-pattern already used throughout
`education-service`, ported here as `services/user-service/src/common/tenant.util.ts` since
`user-service` doesn't have it yet). Every Prisma call changes from `findUnique({ where: { id } })`
to `findFirst({ where: { id, tenantId } })`. `findAll` drops the client-supplied `tenantId` query
param entirely and always scopes to the caller's own tenant.

One exception: `GET /users/me` and `SUPER_ADMIN` callers. `SUPER_ADMIN` already bypasses
`@Roles()` checks in `RolesGuard` (see `roles.guard.ts`), but `SUPER_ADMIN` users typically carry
no `tenantId` — `requireTenantId` would reject them, which is correct: this module manages a
single institution's staff, and a `SUPER_ADMIN` acting cross-tenant is `super-admin-dashboard`'s
job (unbuilt), not this one's. `GET /users/me` is unaffected by this fix — it already looks up by
the caller's own `userId`, not a client-supplied `id`.

## Backend (`user-service`)

- **`services/user-service/src/common/tenant.util.ts`** (new) — same `requireTenantId(user)`
  helper as `education-service`, adapted to `user-service`'s `CurrentUserDto` shape (`userId`,
  `email`, `role`, `tenantId?`).
- **`UsersService`** (modified) — `findAll`, `findById`, `update`, `softDelete` all take
  `tenantId` first; add `create(tenantId, dto)`.
- **`UsersController`** (modified) — add `@CurrentUser()`-style extraction (this service currently
  uses `@Req() req: any` + `req.user`, which stays as-is to match the file's existing convention —
  no unrelated refactor); pass `requireTenantId(req.user)` into every service call; add:

```
POST   /users            ADMIN, MANAGER   — create a MANAGER/STAFF/ACCOUNTANT account
GET    /users            ADMIN, MANAGER   — list own tenant's staff (paginated, ?role=)
GET    /users/me         any authenticated — unchanged
GET    /users/:id        ADMIN, MANAGER   — now tenant-scoped
PATCH  /users/:id        ADMIN, MANAGER   — now tenant-scoped
DELETE /users/:id        ADMIN, MANAGER   — now tenant-scoped + self-deactivate guard
```

- **`create(tenantId, dto)`**: validates `dto.role` is one of `MANAGER`/`STAFF`/`ACCOUNTANT`
  (`class-validator` `@IsIn`), hashes the password with the existing `bcryptjs` helper (`bcrypt.hash(dto.password, 12)`, same cost factor `auth.service.ts` already uses), creates the `User` with
  `tenantId` forced from the caller — never returns tokens (the creating admin stays logged in as
  themselves; this is not a login flow).
- **`softDelete(tenantId, id, callerId)`**: throws `BadRequestException` if `id === callerId`
  before doing anything else (self-deactivate guard).
- New `dto/create-user.dto.ts`: `email` (`@IsEmail`), `password` (`@IsString @MinLength(8)`,
  matches `RegisterDto`'s own minimum), `firstName`/`lastName` (`@IsString @IsNotEmpty`), `phone?`
  (`@IsString @IsOptional`), `role` (`@IsIn(['MANAGER', 'STAFF', 'ACCOUNTANT'])`).

No new gateway route needed — `/api/users` already maps to `userServiceUrl` in
`services/gateway/src/proxy/proxy.middleware.ts`.

## Frontend (`education-app`)

- **`src/lib/users.ts`** (new) — TanStack Query hooks following the same shape as
  `src/lib/finance.ts`: `useUsers(page, limit, role?)`, `useCreateUser()`, `useUpdateUser()`,
  `useDeactivateUser()`. Calls hit `/users` directly (no `/api` prefix duplication — this codebase
  already fixed that bug once).
- **New page `src/app/[locale]/(admin)/users/page.tsx`** ("Utilisateurs"/"Users" in the sidebar,
  `Users` icon from `lucide-react`, a fresh accent color not yet used — `indigo`, added to
  `StatCard`'s `colorClasses` alongside `sky`/`primary`/`amber`/`violet`/`rose`/`cyan`/`green`):
  - Stat cards, computed client-side from the fetched list (this module has no dedicated
    `/users/stats` endpoint like Finance does — same pragmatic choice Attendance made for its Group
    detail page, computing its rate from already-fetched records instead of adding a bespoke
    aggregate endpoint for a first pass): **total staff**, **active staff** (`isActive: true`
    count), **by-role breakdown** shown as a single card listing the three counts (Manager / Staff
    / Accountant) rather than three separate cards, keeping the row at a consistent 3-card width
    matching every prior page's stat-card row. Since `findAll` is paginated (default `limit=20`),
    the page fetches with `useUsers(1, 100)` for both the table and the stat computation — same
    "fetch a generous single page" pattern `finance/page.tsx` already uses for its student picker
    (`useStudents(1, 100)`) — accurate for any realistically-sized institution staff list, with a
    correct total documented as a known limit rather than silently wrong past 100 staff.
  - A table (name, email, role badge, status badge active/inactive, actions) with an "Add user"
    button opening a modal (email, password, first name, last name, phone optional, role select
    limited to Manager/Staff/Accountant).
  - Deactivate action per row, disabled (with a tooltip/title) on the current logged-in admin's own
    row — the frontend mirrors the backend guard for UX, but the backend guard is the actual
    security boundary.
- Sidebar nav gains a "Users" entry, positioned after Finance (last in the list, since this is the
  most recently-added module).

## i18n

New `education.*` keys in `en.json`/`fr.json`/`ar.json`: `users`, `addUser`, `userEmail`,
`userPassword`, `userFirstName`, `userLastName`, `userPhone`, `userRole`, `roleManager`,
`roleStaff`, `roleAccountant`, `statusActive`, `statusInactive`, `deactivateUser`,
`confirmDeactivateUser`, `cannotDeactivateSelf`, `noUsersYet`, `totalStaff`.

## Out of scope (explicitly deferred, same rationale as prior slices)

- Secretary-only profile fields (`gsm`, `whatsapp`, `address`, `schoolLevel`, `certification`,
  `avatar`) — no home for them in the shared `User` model without a larger schema decision.
- Invite-link/email-based account creation — no email service in this stack yet.
- Creating additional `ADMIN`/`SUPER_ADMIN` accounts from this UI.
- A dedicated `/users/stats` aggregate endpoint — first pass computes stats client-side from the
  paginated list, same pragmatic choice Attendance made for its Group detail stats.
- `super-admin-dashboard`'s eventual cross-tenant user view — out of scope, unbuilt, and this
  slice's tenant-scoping fix doesn't block it (that dashboard will need its own explicitly
  `SUPER_ADMIN`-gated, intentionally-cross-tenant code path, not a bypass of this fix).

## Testing

Same as every prior Education slice: no test harness exists anywhere in this repo. Verification is
`tsc --noEmit`, `nest build`, and manual `curl` + Playwright checks before merging — with explicit
extra curl checks for the security fix itself (confirm a tenant-A admin token gets a 404, not
another tenant's data, when hitting `GET /users/:id` with a tenant-B user's ID).
