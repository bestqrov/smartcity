# School Signup Simplification + Demo Activation (ArwaEduc)

## Context

ArwaEduc (`apps/education-apps`) is the official Education product (per project decision
2026-08-25 — the earlier `education-app`/`education-service` NestJS module was deleted). Its
own backend owns a `School` / `Branch` / `User` Prisma schema; it is unrelated to the
platform-wide `Tenant` model in `services/user-service` or the separate, still-unbuilt
`apps/super-admin-dashboard` project (spec: `2026-08-09-super-admin-dashboard-design.md`,
paused). Nothing in this spec touches that other project or its app.

Today, `/signup` (`frontend/app/signup/page.tsx`) collects 8 fields (school name, owner name,
owner email, owner phone, password, branch name, branch city, pack tier) and immediately logs
the new owner in. The user finds this too heavy for a first touchpoint and wants:

1. A minimal signup (name, email, password) that pushes the rest of school setup into
   `/admin/settings` after login.
2. New schools to start in a 15-day demo period, after which unactivated schools are
   restricted (not locked out) until a platform-level `SUPER_ADMIN` manually activates them.

`/admin/settings`'s "Profil École" tab currently exists but is disconnected from the backend
(`handleSaveSchoolProfile` just writes to `localStorage`) — this must be wired to a real
endpoint for the new flow to make sense, since it becomes the only place school details get
entered.

## Scope

In scope: signup form + backend changes, wiring the School Profile settings tab to a real
endpoint, adding a 15-day demo/trial concept to `School`, enforcing restricted access after
expiry, and a minimal `SUPER_ADMIN`-only activation page.

Out of scope: billing/payment integration (`billing-service` `Plan`/`Subscription` — this demo
timer is independent of and does not touch billing), email notifications about trial status,
any change to the platform-wide `apps/super-admin-dashboard` project, automated tests (no app
in this monorepo has a test suite; verification is manual per existing convention).

## 1. Signup Form (`frontend/app/signup/page.tsx`)

Reduce the form to three fields only:

- `ownerName` — "Votre nom" (required)
- `ownerEmail` — "Adresse e-mail" (required)
- `password` — "Mot de passe" (required, min 8 chars — unchanged validation)

Remove from the form UI: `schoolName`, `ownerPhone`, `branchName`, `branchCity`, `packTier`.
`signupSchool()` (`lib/services/schools.ts`) is called with only these three fields.

On success, redirect to `/admin/settings` instead of `/admin/select-branch` (a school with
exactly one auto-created branch has nothing to select).

## 2. Backend Signup Defaults (`schools.controller.ts` / `schools.service.ts`)

`POST /schools/signup` keeps accepting the old fields too (so nothing else calling this
endpoint breaks), but `schoolName`, `branchName`, `branchCity`, `packTier` become optional and
the service fills defaults when absent:

- `schoolName` defaults to `` `École de ${ownerName}` ``
- `branchName` defaults to `"Établissement principal"`
- `branchCity` defaults to `""` (filled in later via Settings)
- `packTier` defaults to `"basic"`

`status` is created as `PENDING` (unchanged), and a new `trialEndsAt` is set to
`createdAt + 15 days` (see §4). The transaction still creates one `School` + one `Branch`,
matching current behavior — only the source of the values changes.

## 3. Wire `/admin/settings` School Profile to the Real Backend

New endpoints on the existing schools module:

- `GET /schools/me` — returns the caller's school record (`name`, `director`, `city`,
  `address`, `phone`, `email`, `logo`), resolved from the JWT the same way other authenticated
  routes already do.
- `PUT /schools/me` — updates those same fields on the caller's `School` row. Restricted to
  authenticated users belonging to that school (owner/admin role — reuse whatever role check
  the "Utilisateurs" tab's existing `PUT /users/:id` already applies for admin-only actions).

Note: `director`, `address`, `phone`, `email`, `logo` don't exist on `School` yet — add them as
new optional `String?` fields on the Prisma model (logo stored as a URL/path string, consistent
with how avatars are handled elsewhere in this app — check `User.avatar` handling and mirror
it, don't invent a new upload mechanism).

`frontend/app/admin/settings/page.tsx`: `handleSaveSchoolProfile` calls `PUT /schools/me`
instead of `localStorage.setItem`; the tab's initial state loads from `GET /schools/me` instead
of starting blank/from localStorage.

## 4. 15-Day Demo Period

Add `trialEndsAt: DateTime` to the `School` model (set at signup, per §2). No new
`SchoolStatus` enum value is introduced — `PENDING` continues to mean "not yet activated by a
super admin," and `trialEndsAt` just says when that pending period stops being a full-access
demo.

Access rule, checked wherever a request is scoped to a school (existing tenant-scoping
middleware/guard — extend it rather than adding a parallel check):

- `status === ACTIVE` → full access, always, regardless of `trialEndsAt`.
- `status === PENDING` and `now <= trialEndsAt` → full access (demo period).
- `status === PENDING` and `now > trialEndsAt` → **restricted**: read (`GET`) requests pass
  through normally; write requests (`POST`/`PUT`/`PATCH`/`DELETE`) on tenant-scoped resources
  are rejected with a 403 and a clear error body (e.g.
  `{ error: 'TRIAL_EXPIRED', message: '...' }`) that the frontend can key off of.
- `status === SUSPENDED` → existing behavior, unchanged (out of scope to touch here).

Frontend: a banner (visible to admin roles) shows remaining days while in-demo, and a
different "trial expired — contact us to activate" banner once past `trialEndsAt`, driven by
data already available from `GET /schools/me` (add `status` and `trialEndsAt` to that
response). Write-action UI (buttons/forms) can stay as-is and rely on the 403 + toast — no need
to pre-emptively disable every button across the app for this first version.

## 5. Minimal Super-Admin Activation Page

Scoped entirely inside ArwaEduc (not the separate platform dashboard project). `SUPER_ADMIN` is
already a `UserRole` enum value with some role-gate scaffolding
(`components/auth/RequireRole.tsx`, `Sidebar.tsx`) but no schools list exists yet.

Backend (new, `schools` module):
- `GET /schools` — list all schools platform-wide (`id`, `name`, `ownerEmail`, `status`,
  `trialEndsAt`, `createdAt`). Guarded by role `SUPER_ADMIN` — this is the one endpoint in this
  app allowed to bypass normal tenant scoping, since its whole purpose is cross-tenant
  visibility.
- `PATCH /schools/:id/status` — body `{ status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' }`, guarded
  by `SUPER_ADMIN`. Sets `School.status`. No side effects on `trialEndsAt` (activating doesn't
  need to touch it, since `ACTIVE` bypasses the trial check entirely per §4).

Frontend: new route `/admin/schools`, visible in `Sidebar.tsx` only for `SUPER_ADMIN` (reuse
the existing role-gate pattern). Plain table: name, owner email, status badge, trial end date
(or "—" if activated), one "Activer" button per `PENDING` row calling
`PATCH /schools/:id/status` with `ACTIVE`. No create/edit/delete of schools here — activation
only, matching what was actually asked for.

## Error Handling

- Signup: unchanged validation errors (missing fields, weak password, duplicate email) — same
  paths as today, just fewer required fields.
- Settings save (`PUT /schools/me`): validation errors surfaced inline per-field like the
  existing "Utilisateurs" tab does for `PUT /users/:id`.
- Trial-expired writes: 403 with `TRIAL_EXPIRED` code, surfaced as a toast telling the user to
  contact support/wait for activation.
- `/admin/schools` and its endpoints: a non-`SUPER_ADMIN` hitting the backend routes gets 403;
  the frontend route itself redirects away via the existing `RequireRole` pattern.

## Testing

Manual, consistent with the rest of this app (no automated suite exists). Verify by hand:
signup with only 3 fields → lands on `/admin/settings` with a real, empty-ish school
profile → fill and save → reload confirms persistence. Force `trialEndsAt` into the past
directly in the DB → confirm reads still work and a write returns `TRIAL_EXPIRED`. Log in as a
`SUPER_ADMIN`, activate that school, confirm writes succeed again immediately.

## Explicitly Out of Scope

Billing/subscription integration, trial-expiry email/notification, per-write-button UI
disabling beyond the banner + 403/toast, any changes to `apps/super-admin-dashboard`, school
creation/deletion from the new `/admin/schools` page, automated tests.
