# Super Admin Dashboard (Sub-project 1/N: Auth + Shell + Tenants)

## Context

SmartCity has no platform-level admin UI. The user asked for a super admin dashboard that
eventually manages the whole SmartCity ecosystem: all tenants, all users across roles,
billing/subscriptions, and per-vertical services (tourism, health, education, services), plus
whatever gets added later.

That full scope spans multiple independent subsystems, so it is decomposed into ordered
sub-projects, each with its own spec → plan → implementation cycle:

1. **Auth + Shell + Tenants** (this spec) — foundation: login restricted to `SUPER_ADMIN`, the
   app shell/navigation, and full Tenant management (the backend for this already exists).
2. **Users management** — cross-tenant user administration, all roles.
3. **Billing / Subscriptions overview** — `Plan`/`Subscription` models via `billing-service`.
4. **Per-vertical service dashboards** — tourism/health/education/services drill-downs.
5. **Platform monitoring/analytics** — cross-service reporting layer, built last since it
   depends on the others existing.

## Scope of this spec: Auth + Shell + Tenants

A working Next.js app that a super admin can log into, see a navigation shell reflecting the
full future ecosystem (with not-yet-built sections visibly disabled), and fully manage
`Tenant` records (list, create, view, edit, deactivate).

Out of scope for this spec: users management, billing, per-vertical dashboards, analytics,
automated tests (no existing app in the monorepo has a test suite to follow), and any backend
changes (the `Tenant` CRUD API already exists and is sufficient).

## Architecture Decision

New Next.js 15 (App Router) app at `apps/super-admin-dashboard` — the directory already exists
as an empty scaffold (`public/`, `src/{pages,components,lib}`, no `package.json`) and this spec
fills it in.

- Talks to the existing gateway (`http://localhost:3000/api`), which already proxies
  `/api/auth` and `/api/tenants` to `user-service` (`services/gateway/src/proxy/proxy.middleware.ts`).
  No gateway or backend changes needed.
- Dev port `3104` (landing-page uses 3100, tourism-app uses 3102 — 3104 avoids collision and
  leaves room for one more app in between).
- UI stack: **shadcn/ui + Tailwind**, explicitly *not* reusing `@smartcity/ui-components`
  (tourism-app's plain-Tailwind kit) or tourism-app's visual conventions — the user chose a
  distinct admin-panel design system. TanStack Table for the tenants list, TanStack Query for
  data fetching/caching, `zod` for form validation.
- Reuses non-visual patterns only: the JWT-decode-with-`jose` approach and the
  React-context `AuthProvider` shape from `apps/tourism-app/src/lib/auth.tsx`, adapted with
  dashboard-specific `localStorage` keys (`sa_access_token`, `sa_refresh_token`, `sa_user`) so
  the two apps' sessions never collide if run on the same browser/host.
- Workspace deps: `@smartcity/types` (shared `IUser`, `ILoginResponse`, `Tenant` types) and
  `@smartcity/i18n` (language switcher, matching other apps). Not `@smartcity/ui-components`.

## Auth Flow

- `/login`: email + password form → `POST /api/auth/login`.
- On success: decode the returned JWT, check `user.role === 'SUPER_ADMIN'`.
  - Not `SUPER_ADMIN` → clear any stored token immediately, show "Access denied — super admin
    only" on the login page, do not proceed further. No session is ever persisted for a
    non-super-admin login.
  - Is `SUPER_ADMIN` → persist `accessToken`, `refreshToken`, and `user` to `localStorage`,
    redirect to `/`.
- Route protection: a client-side check in the root layout (mirroring tourism-app's
  `AuthProvider` + guard pattern) redirects unauthenticated visitors on any non-`/login` route
  back to `/login`.
- Logout: clears `localStorage`, calls `POST /api/auth/logout` with the refresh token
  (endpoint already exists in `services/user-service/src/auth/auth.controller.ts`), redirects
  to `/login`.
- 401 on any API call → treat as expired session: clear storage, redirect to `/login`.

## Shell (App Layout)

- Sidebar nav: **Dashboard** (placeholder landing content), **Tenants** (built this phase),
  and disabled/"coming soon" entries for **Users**, **Billing**, **Services** — so the shell
  already communicates the full intended ecosystem without those sections being functional.
- Topbar: logged-in super admin's name/email, language switcher (`@smartcity/i18n`), logout
  button.

## Tenants Module

Backend is already complete in `services/user-service/src/tenants/` (`TenantsController`:
`GET /`, `GET /:id`, `GET /slug/:slug`, `POST /`, `PATCH /:id`, `DELETE /:id` — delete is a
soft-delete via `softDelete()`). This spec is UI-only against that API.

- `/tenants`: paginated table (`GET /api/tenants?page&limit`) showing name, slug, type,
  isActive, currency, createdAt. Filtering/search is client-side over the current page only —
  the backend doesn't expose a search param, and adding one is out of scope here.
- Row actions:
  - **View** → `/tenants/[id]` detail page (`GET /api/tenants/:id`).
  - **Edit** → dialog form (`PATCH /api/tenants/:id`).
  - **Deactivate** → confirmation dialog → `DELETE /api/tenants/:id` (soft delete; tenant stays
    in the list with `isActive: false`, no hard-delete path is exposed anywhere in this UI).
- **Create Tenant** button → dialog form → `POST /api/tenants`. Fields map to the `Tenant`
  Prisma model (`packages/database/prisma/schema.prisma`): `name`, `slug`, `type`
  (`TenantType` enum: HOTEL/RIAD/RESORT/GUESTHOUSE/HOSTEL/TOUR_OPERATOR/SHOP), `domain`
  (optional), `currency` (default `MAD`), `defaultLocale` (default `fr`), `timezone` (default
  `Africa/Casablanca`).
- Validation: `zod` schema mirroring the Prisma field constraints (required `name`/`slug`/
  `type`, `slug` uniqueness is enforced server-side and surfaced as a form error on 409/400).

## Error Handling

- API/network errors: shadcn `Sonner` toast with the server's error message when available,
  generic fallback otherwise.
- Form-level validation: inline per-field errors from `zod`, plus server-side validation
  errors (e.g. duplicate slug) mapped back onto the relevant field when the API response
  identifies it, otherwise shown as a form-level toast.
- 401: global handling as described in Auth Flow (session-expired → logout → redirect).

## Testing

No automated test suite — consistent with every other app in this monorepo (tourism-app,
landing-page, etc. have none). Verification is manual: run `user-service` + `gateway`
locally, run the dashboard dev server, exercise login (super admin, non-super-admin,
wrong credentials) and full tenant CRUD by hand. If automated tests are wanted, that should be
a deliberate separate decision, not folded in silently here.

## Explicitly Out of Scope

Users management, Billing/Subscriptions, per-vertical service dashboards (tourism, health,
education, services), platform-wide analytics, backend/API changes, search/filter params on
the tenants endpoint, hard-delete of tenants. Each future sub-project listed under Context
gets its own spec.
