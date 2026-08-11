---
title: Education Foundation — CTO Hardening Audit
document: Post-implementation security & architecture review of worktree-education-service-foundation
status: complete
date: 2026-08-11
scope: Review and harden the existing Branches/Students foundation only — no new business features
---

# Education Foundation — CTO Hardening Audit

> This is a review of code that already exists and was already implemented, tested, and merged into the `worktree-education-service-foundation` branch (19 commits, all previously spec- and quality-reviewed). This audit re-inspected the real source directly — not prior review summaries — traced the full request path, ran a live tenant-isolation/IDOR penetration test against a running instance, applied three small safe fixes, and re-verified live after the fixes.

---

## A. Foundation Status

**READY WITH MINOR FIXES** (fixes have now been applied and re-verified — see Section D).

The core model (`Tenant → Branch → Student`), the tenant-isolation mechanism, and the auth boundary are structurally sound. Nothing found in this audit required a design change. What was found and fixed were input-validation gaps and a frontend UX gap — not architectural flaws.

---

## B. Architecture Findings

### B1. Core model — `Tenant → Branch → Student`

Traced the full request path for both modules:

```
Frontend (apiClient, Bearer token only)
  → gateway (proxy.middleware.ts, prefix-routed to EDUCATION_SERVICE_URL)
    → education-service main.ts (global ValidationPipe + JwtAuthGuard + RolesGuard)
      → JwtStrategy.validate() (verifies JWT signature against JWT_SECRET, extracts tenantId from payload)
        → Controller (@CurrentUser() decorator reads request.user, never request.body/query for identity)
          → requireTenantId(user) (throws if token carries no tenantId)
            → Service method (tenantId is the first parameter of every method, always)
              → Prisma (every query's `where` includes tenantId, or the record was already tenant-verified via findFirst)
```

No point in this chain lets a client supply its own `tenantId`. It is derived exactly once, from the verified JWT, in `requireTenantId()`, and threaded explicitly through every layer below it.

- **Tenant**: identity is authoritative — comes only from the JWT payload set by `user-service` at login, never re-derived or re-validated client-side. `User.tenantId` is optional in the schema (platform-level roles have none), and `requireTenantId()` correctly rejects any request from a tokenless-tenant user before it reaches business logic — **Severity: none, this is correct.**
- **Branch**: every read/write is tenant-scoped. `findById`/`update`/`deactivate` use `findFirst({where:{id,tenantId}})`, never `findUnique({where:{id}})`. Confirmed live: fetching Tenant A's branch ID while authenticated as Tenant B returns 404, not the record (Section C).
- **Student**: same discipline, plus an explicit `assertBranchInTenant()` check on `create`/`update` whenever a `branchId` is supplied, preventing a student from being attached to another tenant's branch even if the ID is known/guessed. Confirmed live (Section C).

**No structural issue found in the core model.**

### B2. Findings by severity

| Severity | Location | Problem | Why it matters | Action |
|---|---|---|---|---|
| Important | `students.controller.ts` `findAll` | `@Query('branchId')`/`@Query('status')` were plain strings with zero validation, reaching `prisma.student.findMany({where})` directly | A malformed `branchId` or an arbitrary `status` string caused an unhandled 500 (raw Prisma error leaked to the client) instead of a clean 400 | **Fixed** — see D1 |
| Minor | `BranchesPage.tsx` (frontend) | `handleSubmit` had no try/catch; a failed create left the modal stuck in a loading state with no feedback | Poor UX on any backend validation/network failure, not a security issue | **Fixed** — see D2 |
| Minor | `login/page.tsx`, `(admin)/layout.tsx` | Dead `t(key) === key ? fallback : t(key)` idiom; the keys always existed so the fallback branch never executed | Code noise, no functional impact | **Fixed** — see D3 |
| Minor | `students/page.tsx` | Table header "Name" was a hardcoded English string in an otherwise fully-i18n'd page | Breaks FR/AR localization for one column header | **Fixed** — see D3 |
| Minor (pre-existing, out of scope) | `branches.controller.ts`/`students.controller.ts` `findAll` | `page`/`limit` aren't clamped (`page=-1` → negative Prisma `skip`) | Same convention already present in `tourism-service/hotels.controller.ts` — a repo-wide pattern, not an Education-specific regression | **Deferred**, see E |
| Minor (pre-existing, out of scope) | `services/gateway/src/common/jwt.guard.ts` | Gateway's own `JwtAuthGuard` class exists but is never registered (not global, not per-route) | Gateway currently does zero authentication of its own — it relies entirely on downstream services (education-service, tourism-service, etc.) to authenticate. This is a platform-wide design already documented as a known gap in `docs/education/architecture/10-security-architecture.md` §3, not something introduced by or specific to Education | **Deferred**, see E — out of scope per explicit instruction not to redesign the gateway |

### B3. No Critical findings.

---

## C. Security Findings (tenant isolation & authorization)

Live penetration test performed against a rebuilt, running instance of `education-service` (port 4004) through the real `gateway` (port 4000) and `user-service` (port 4001), using two real, independent tenants already seeded from prior verification work.

| Attack attempted | Result | Evidence |
|---|---|---|
| Unauthenticated request to `/api/branches` | **Blocked** — 401 | `{"message":"Authentication required",...}` |
| Tenant B lists `/api/branches` | **Correctly scoped** — only sees its own branch, never Tenant A's | `{"data":[{"name":"Other Campus",...}]}` — "Main Campus" (Tenant A's) never appears |
| Tenant B fetches Tenant A's branch by its real, known ID (IDOR) | **Blocked** — 404, not the record | `{"message":"Branch not found",...}` |
| Tenant B sends `?status=NOT_A_REAL_STATUS` to `/api/students` | **Blocked** — clean 400 (previously: raw 500) | `{"message":["status must be one of the following values: ACTIVE, WITHDRAWN, GRADUATED"],...}` |
| Tenant B sends `?branchId=not-a-valid-objectid` to `/api/students` | **Blocked** — clean 400 (previously: raw 500) | `{"message":["branchId must be a mongodb id"],...}` |
| Tenant B attempts to create a student using Tenant A's real `branchId` (cross-tenant FK attachment) | **Blocked** — 400 | `{"message":"branchId does not belong to this tenant",...}` |

**Authentication vs. Authorization vs. Tenant Isolation — verified as three distinct, correctly-separated concerns:**
- **Authentication** ("who are you?"): `JwtStrategy` + `JwtAuthGuard`, applied globally in `main.ts`. Verifies the signature against the shared `JWT_SECRET` issued by `user-service` — no separate auth system.
- **Authorization** ("what are you allowed to do?"): `RolesGuard` + `@Roles(...)` decorators. `POST`/`PATCH`/`DELETE` on Branches require `ADMIN`/`MANAGER`; on Students, `ADMIN`/`MANAGER`/`STAFF`. `GET` endpoints require only authentication. This is sufficient for the current two-module scope; it is intentionally minimal and will need real expansion (Teacher/Parent/Student self-service roles) once those modules are built — not before.
- **Tenant isolation** ("which organization's data can you access?"): `requireTenantId()` + tenant-scoped Prisma queries throughout, independent of role. Confirmed live above.

No cross-tenant read, write, update, or delete succeeded in any attempted scenario.

---

## D. Fixes Applied

All three fixes below were applied, then the whole branch was re-verified: `tsc --noEmit` clean on `education-service`, `gateway`, and `education-app`; `education-service` rebuilt and restarted; the six live attack scenarios in Section C re-run successfully against the rebuilt instance. Committed as `66a7d68`.

**D1 — Backend validation gap (Important).** Added `services/education-service/src/students/dto/find-students-query.dto.ts` (`@IsMongoId()` on `branchId`, `@IsEnum(StudentStatus)` on `status`, both `@IsOptional()`), and switched `StudentsController.findAll` to consume it via `@Query() query: FindStudentsQueryDto` instead of four loose `@Query(...)` params. This closes the same class of bug the earlier `CreateStudentDto.branchId` fix addressed, now on the read path too.

**D2 — Frontend error handling (Minor).** `BranchesPage.tsx`'s `handleSubmit` now wraps `createBranch.mutateAsync(...)` in try/catch and displays the error message in the modal, matching the pattern `StudentsPage.tsx` already had.

**D3 — i18n cleanup (Minor).** Removed the two dead `t(key) === key ? fallback : t(key)` ternaries (`login/page.tsx`, `(admin)/layout.tsx`); added the missing `education.studentName` key (en/fr/ar) and used it for the previously-hardcoded "Name" table header in `students/page.tsx`.

Also tracked `apps/education-app/next-env.d.ts` (Next.js-generated, was untracked; `tourism-app`'s equivalent is committed, so this was an inconsistency, not a fix per se).

---

## E. Deferred Items (intentionally left for future phases)

- **Pagination clamping** (`page`/`limit` not validated against negative/zero values) — real but low-severity, and it's an existing repo-wide convention shared with `tourism-service`. Fixing it only for Education would be inconsistent; fixing it repo-wide is out of scope for this audit.
- **Gateway-level authentication** — the gateway's own `JwtAuthGuard` is dead code, never registered. This is a pre-existing, platform-wide architectural gap already documented in the Education security architecture doc, explicitly not something to fix by redesigning the gateway per this task's instructions.
- **Real browser/visual verification** — no Playwright/browser-automation tool is available in this environment (checked, none configured). All frontend verification in this audit and in the prior implementation was done via `tsc`, code inspection, and API-contract-level checks. **This remains genuinely unverified** — nobody has visually confirmed the modal interactions, the React Query cache-invalidation re-render, or actual RTL text flow in a real browser. Flagging this plainly rather than working around it with unnecessary tooling, per instruction.
- **RBAC expansion, Parent/Academic/Timetable/Attendance/Finance modules, AI, CRM, etc.** — correctly out of scope for this task, as instructed.

---

## F. Future Compatibility

The foundation is safe to build on. Specifically:

- The `tenant.util.ts` + tenant-scoped-Prisma-call pattern is copy-paste-ready for every future module (Parents, Programs, Courses, Enrollment, Attendance, Finance, ...) — it required zero rework during this audit and generalizes cleanly.
- The `Branch` model's `students Student[]` back-reference and the `assertBranchInTenant`-style cross-reference-validation pattern is the template for every future foreign-key relationship (Enrollment→Program, Attendance→Group, Invoice→Student, etc.).
- The auth module (copied verbatim from `tourism-service`, zero Tourism-specific logic in it) needs no changes to support new roles — `@Roles('TEACHER', ...)` etc. can be added to new controllers immediately; only the `UserRole` enum in the shared Prisma schema needs new values when those roles are introduced (additive, non-breaking, already anticipated in the architecture docs).
- The frontend pattern (`lib/<module>.ts` React Query hooks + `(admin)/<module>/page.tsx` using `@smartcity/ui`) is now proven twice (Branches, Students) and is mechanically repeatable for the next modules.
- Nothing in the shared packages (`@smartcity/ui`, `@smartcity/types`, `@smartcity/i18n`) was polluted with Education-specific or Tourism-specific leakage — confirmed by direct inspection, not just trusting prior reviews.

**No redesign is needed before Phase 2 begins.**

---

## G. Recommended Next Phase

Build **Parent management** (entity + Student↔Parent link) next, not Academic Structure/Timetable/Attendance.

Reasoning: Parent is the smallest possible next module (one new model, one new tenant-scoped CRUD module, one new frontend page) that exercises a *many-to-many* relationship for the first time (a parent can have multiple children, a student can have multiple guardians) — which the current `Branch→Student` one-to-many pattern doesn't cover. Proving that pattern out on a small, low-risk module before Academic Structure (which needs it repeatedly — Program↔Course, Group↔Student, Timetable↔Group↔Teacher) reduces risk for the harder modules that come after it. Academic Structure should follow immediately after, since Attendance and Finance both depend on it existing first.
