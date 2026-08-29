# Multi-School / Multi-Branch Tenancy for ArwaEduc (Education)

## Context

ArwaEduc (`apps/education-apps`) is currently single-tenant: every `Student`, `Group`, `Teacher`, `Payment`, etc. lives in one shared MongoDB database with no notion of which school it belongs to. The business now needs ArwaEduc to operate as a self-serve SaaS product: any school can sign up on its own, choose a subscription pack, and manage its data completely isolated from every other school. A school itself may have multiple branches in different cities (a "chain" school), each with its own fully independent data (students, staff, groups, finances), while the school's owner needs a consolidated view across all of their own branches.

No production data exists yet for any school — this is a clean-slate implementation, not a migration of existing tenants.

This spec is deliberately scoped to the **foundation**: the data model, authentication/authorization, tenant scoping mechanism, self-serve signup, and the owner's cross-branch dashboard. Retrofitting every existing module (students, groups, teachers, payments, attendance, inscriptions, parents, formations, transactions, pricing, settings) to use this foundation is mechanical, repetitive work that belongs in the implementation plan as a module-by-module rollout, not further design decisions here.

## Goals

- A school can sign up itself (name, owner contact, first branch, chosen pack) and start using the product immediately, with billing/payment confirmed manually/later (no payment gateway integration in this spec).
- A school with multiple branches keeps each branch's data (students, staff, finances, attendance...) completely isolated from its other branches.
- Three access levels: branch staff (`ADMIN`/`SECRETARY`, scoped to exactly one branch), school owner (`OWNER`, scoped to all branches of their school, full read/write everywhere in their school plus branch-creation/admin-assignment), and `SUPER_ADMIN` (platform-wide — out of scope for this spec's UI, handled by the separate super-admin-dashboard project referenced in `docs/superpowers/specs/2026-08-09-super-admin-dashboard-design.md`).
- One shared database and one shared app deployment for all schools (not one deployment per school) — chosen for operational simplicity at the current and near-future scale (a few thousand students/staff total is trivial load for this architecture; see "Scale" below).
- A single, centrally-enforced mechanism for branch-scoping so that no individual module's code can accidentally leak data across branches by forgetting a filter.

## Non-Goals

- Real payment gateway integration (Stripe/CMI/etc.) — Pack selection at signup is recorded but not charged; a school starts in `PENDING` status and is confirmed manually. Real billing is an explicit future sub-project.
- Retrofitting the existing modules' actual query code — covered task-by-task in the implementation plan, not designed field-by-field here (the pattern is identical for each module: add `branchId`, filter/set it via the shared middleware).
- `SUPER_ADMIN` UI/dashboard within ArwaEduc itself — that role's cross-school administration is expected to live in the separate super-admin-dashboard project. This spec only ensures the data model and JWT are shaped so that a future `SUPER_ADMIN` integration is possible without another migration.
- Data migration of existing rows — there is no existing production data.

## Scale Assumption (informs the architecture choice)

Current expectation: a handful of schools, a few branches each, on the order of ~1,000 students/staff combined, growing gradually. At this scale a single MongoDB database and single Node.js process comfortably serve the load for years; this is explicitly not a scale that justifies per-tenant database isolation. The tradeoff being made — shared infrastructure (cheap, simple, fast to extend) in exchange for shared *availability* (a crash or heavy load from one school's usage can affect others, even though their *data* stays fully isolated) — is accepted for now, mitigated with baseline resilience practices (see "Resilience" below), with the explicit understanding that a specific large future customer could be moved to isolated infrastructure later without a data-model rewrite, since every row is already scoped by `branchId`.

## Data Model

### New models

```prisma
enum SchoolStatus {
  PENDING
  ACTIVE
  SUSPENDED
}

model School {
  id          String       @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  status      SchoolStatus @default(PENDING)
  packTier    String       // free-text pack name chosen at signup; no enforcement yet
  ownerName   String
  ownerEmail  String
  ownerPhone  String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  branches    Branch[]
  users       User[]

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

  @@map("branches")
}
```

### `User` changes

```prisma
enum UserRole {
  ADMIN
  SECRETARY
  OWNER        // new: school owner, all branches of their school
  SUPER_ADMIN
}
```

Add to `User`:
```prisma
  schoolId String? @db.ObjectId   // set for OWNER only
  school   School? @relation(fields: [schoolId], references: [id])
  branchId String? @db.ObjectId   // set for ADMIN/SECRETARY only
  branch   Branch? @relation(fields: [branchId], references: [id])
```
Both nullable and both unused (null) for `SUPER_ADMIN`. Exactly one of `schoolId`/`branchId` is set for `OWNER`/`ADMIN`/`SECRETARY` respectively — enforced at the application layer (Prisma/MongoDB can't express an XOR constraint), validated in the signup/user-creation service functions, not the schema.

### Every existing tenant-scoped model gains `branchId`

`Student`, `Parent`, `Group`, `Teacher`, `Inscription`, `Payment`, `Attendance`, `Settings`, `Formation`, `Transaction`, `Pricing`, `AttendanceNotification` each gain:
```prisma
  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])
```
Required (not nullable) — every one of these rows must belong to exactly one branch, no exceptions, no "global" rows. `AccessLog` is intentionally left without `branchId` (it's an audit trail keyed by `parentId`/`studentId`, which already transitively identify the branch if needed).

## Authentication & Tenant Scoping

### Login

`POST /api/auth/login` is unchanged in shape (email + password). The JWT payload gains `schoolId` and `branchId` (whichever applies to the user's role, `null` otherwise) alongside the existing `id`/`email`/`role`.

### Frontend routing after login

- `ADMIN`/`SECRETARY`: JWT already carries a fixed `branchId` — go straight to their branch dashboard. No picker.
- `OWNER`: JWT carries `schoolId`, no `branchId`. Frontend shows a branch switcher (a dropdown, populated from `GET /api/branches` scoped to their school) before/around entering the dashboard; the chosen branch is kept in frontend state (not re-authenticated) and sent explicitly with subsequent requests needing branch context. Switching branches doesn't require logging in again.
- `SUPER_ADMIN`: out of scope (see Non-Goals).

### Server-side enforcement: `tenantScope` middleware

A new middleware, applied after `authMiddleware` on every branch-scoped route, computes the request's authoritative `branchId` and puts it on `req.branchId` — every downstream service function uses `req.branchId`, never a client-supplied value directly:

- `ADMIN`/`SECRETARY`: `req.branchId = req.user.branchId` (from the JWT — the client cannot override this by sending a different value in the request).
- `OWNER`: the client must send an explicit `branchId` (header or query param, e.g. `X-Branch-Id`). The middleware looks up that `Branch`, confirms `branch.schoolId === req.user.schoolId`; if not, `403 Forbidden`. If confirmed, `req.branchId = <that branch>`.
- Requests with no resolvable branch (e.g. an `OWNER` who hasn't picked one yet) get `400 Bad Request` with a clear "select a branch" error — the frontend is expected to never let this happen post-picker, but the backend doesn't trust that.

This centralizes the one dangerous mistake class (a module forgetting to filter by branch) into a single, well-tested piece of code, rather than depending on every module remembering to do it correctly.

### Owner cross-branch dashboard endpoint

`GET /api/branches/summary` (`OWNER` only, no explicit branch header needed — this one endpoint intentionally spans all of the owner's branches): aggregates, per branch under `req.user.schoolId`, student count, today's attendance summary, and a revenue/balance figure (same "inscriptions vs. payments" convention established in the existing student/parent profile pages), plus a combined total. Other endpoints remain single-branch-scoped as described above; the owner reaches per-branch detail by switching branches, not by a special multi-branch query on every endpoint.

## Self-Serve Signup

New public (unauthenticated) endpoint `POST /api/schools/signup`:
- Input: school name, owner name/email/phone, a chosen password, first branch name + city, chosen pack (free-text from a fixed list shown in the UI — no payment fields).
- Creates, in one transaction: `School` (`status: PENDING`), the first `Branch`, and a `User` (`role: OWNER`, `schoolId` set, password hashed the same way `auth.service.ts` already hashes passwords).
- Returns a JWT immediately (same shape as login) — the owner can use the product right away; a human (via the separate super-admin system, manually) later flips `School.status` to `ACTIVE` once payment is arranged. `PENDING` status does not block usage in this spec (no enforcement logic is being built here — status is informational, ready for a future billing sub-project to act on).

New public frontend page `app/signup/page.tsx` (outside `app/admin`, same reasoning as the `/p/[token]` public parent page — no auth layout).

## Resilience (mitigating the shared-infrastructure tradeoff)

Baseline practices to adopt as part of this work, not deep infrastructure projects:
- Run the backend under a process manager (PM2) in production so a crash recovers in seconds, not until someone notices.
- Apply a general rate limiter across the whole API (the existing `express-rate-limit` dependency, already used for the parent magic-link endpoint), not just the one endpoint that has it today.
- Keep the error-isolation discipline already established in the attendance-scan/notification code (one failure doesn't cascade) as the standard for new code in this project too.

## Testing

- Unit tests for the `tenantScope` middleware: `ADMIN`/`SECRETARY` gets their fixed branch regardless of what the client sends; `OWNER` with a valid branch header for their own school succeeds; `OWNER` with a branch header belonging to a different school gets `403`; missing branch context for `OWNER` gets `400`.
- Unit tests for the signup service: creates `School`+`Branch`+`User` atomically, hashes the password, rejects a duplicate owner email.
- One full module (Students) retrofitted end-to-end with tests as the reference pattern for the rest of the rollout (covered in the implementation plan, not this spec).

## Implementation Phasing (for the plan, not decided further here)

1. **Foundation**: schema changes, `tenantScope` middleware, signup endpoint + page, login/JWT changes, branch switcher UI, owner summary endpoint — plus Students as the one fully-retrofitted reference module.
2. **Module rollout**: repeat the same `branchId`-filtering pattern across the remaining existing modules (Groups, Teachers, Payments, Attendance, Inscriptions, Parents, Formations, Transactions, Pricing, Settings) — mechanical, one task per module, likely its own plan document given the size.
