# Education Packs Catalogue + Smart School Landing Page

## Context

ArwaEduc (`apps/education-apps`) is sold to schools as a paid SaaS with three commercial packs, but the system has no notion of them: `School.packTier` is a free string (default `'basic'`) and nothing reads it. New schools sign up through a public, simplified `POST /api/schools/signup` (owner name/email/password only, 15-day trial stamped in `trialEndsAt`), and the frontend root `/` is a dev-mode redirect to `/login`. The SUPER_ADMIN already has `/admin/schools` (list + activate/suspend).

This spec adds (1) a **pack catalogue** the SUPER_ADMIN manages, (2) **pack assignment** to schools, and (3) a public bilingual (Arabic / French) **landing page** at `/` where a school picks a pack and starts a 15-day free trial. Pack limits and features are stored and exposed, but **not enforced** yet (see Non-Goals).

Reference visual: `docs/superpowers/specs/assets/2026-09-20-smart-school-landing-mockup.html` (dark style "B" was chosen; the illustrated dashboard in the hero is an inline SVG with no text so it works in both languages).

## Goals

- SUPER_ADMIN can create, edit and deactivate packs (name, code, monthly/yearly price in MAD, student and branch limits, feature flags) and choose one default pack.
- SUPER_ADMIN can assign any active pack to a school from the existing schools page.
- The landing page shows the active packs from the catalogue (editing a pack changes the landing without a deploy), with a monthly/yearly toggle, and every card leads to signup with that pack preselected.
- New schools get the pack they picked (or the default pack) together with the existing 15-day free trial.
- The landing page is modern, dark, mobile-friendly, and fully bilingual with correct RTL; Arabic copy is Modern Standard Arabic (fusha), not Moroccan dialect.

## Non-Goals

- Enforcing pack limits or gating features (student/branch caps, hiding Transport/portals) — a later spec; this one only stores and exposes them (`GET /schools/me` returns the pack so enforcement is easy later).
- Billing schools (invoices, payment tracking, auto-suspension), add-ons, coupons, other currencies.
- Rebranding the rest of the app: only the landing page and the signup page use the name "Smart School"; login, sidebar and other screens are untouched.
- Deleting packs (deactivate only), a light theme, more than two languages.
- The canteen module itself: its landing card is a "coming soon" teaser only; no pack feature key is added for it until the module exists.
- The SmartCities Maroc directory itself: the landing card is marketing copy only. Whether registering means a public school listing, a link to the main MoroSmartCity site, or something else is **still to be defined**; until then the card carries no link/behaviour of its own (its CTA is the same signup CTA).

## Data Model (Prisma)

New `Pack` model (platform-level: **no `branchId`**, no tenant scoping):

| Field | Notes |
|---|---|
| `name`, `code` | `code` unique, lowercase slug (`essentiel`, `pro`, `premium`) |
| `monthlyPrice`, `yearlyPrice` | Float, MAD, ≥ 0 |
| `maxStudents`, `maxBranches` | Int?, `null` = unlimited, otherwise ≥ 1 |
| `features` | `String[]` of keys from the fixed list below |
| `isDefault` | at most one pack is default |
| `active` | inactive packs are hidden from the landing/signup and cannot be assigned |
| `sortOrder` | Int, ascending display order |

Fixed feature keys (a constant in code, shared by validation, the admin form and the landing labels): `PARENT_PORTAL`, `STUDENT_PORTAL`, `QR_ATTENDANCE`, `ANNOUNCEMENTS`, `FINANCE_ANALYTICS`, `TRANSPORT`. Branch count is governed by `maxBranches`, not a feature key. Adding a new feature key needs a code change; adding a pack does not.

`School`: replace `packTier String` with `packId String? @db.ObjectId` + `pack Pack?` relation (nullable: a school may have no pack if none was configured). `Pack` gets the reverse `schools School[]`; add `@@index([active, sortOrder])` on `Pack` and `@@index([packId])` on `School`.

### Seed (idempotent script, upserts by `code`)

| code | name | monthly / yearly | maxStudents | maxBranches | features |
|---|---|---|---|---|---|
| `essentiel` | Essentiel | 250 / 2500 | 100 | 1 | — |
| `pro` (default) | Pro | 400 / 4000 | 300 | 2 | PARENT_PORTAL, STUDENT_PORTAL, QR_ATTENDANCE, ANNOUNCEMENTS, FINANCE_ANALYTICS |
| `premium` | Premium | 800 / 8000 | null | null | all six, including TRANSPORT |

The seed also sets `packId` to the default pack on every existing school that has none (they are dev data; `packTier` is dropped). Running it twice changes nothing.

## Backend API

New module `src/modules/packs/` (routes / controller / service / tests), same style as the transport module (`respond` helper, TDD, jest with mocked prisma).

| Route | Access | Purpose |
|---|---|---|
| `GET /api/packs/public` | public, rate-limited | active packs ordered by `sortOrder`; fields: `code`, `name`, `monthlyPrice`, `yearlyPrice`, `maxStudents`, `maxBranches`, `features`, `recommended` (= `isDefault`). Nothing else (no ids of schools, no `active`). |
| `GET /api/packs` | SUPER_ADMIN | all packs incl. inactive, with a school count |
| `POST /api/packs` | SUPER_ADMIN | create |
| `PUT /api/packs/:id` | SUPER_ADMIN | update any field incl. `active` |
| `PATCH /api/packs/:id/default` | SUPER_ADMIN | make default; clears the previous default in the same `$transaction` |
| `PATCH /api/schools/:id/pack` | SUPER_ADMIN | body `{ packId }`, pack must exist and be active |

Changes to existing endpoints:
- `GET /api/schools` (SUPER_ADMIN list) and `GET /api/schools/me` include the school's pack (`id`, `code`, `name`, prices, limits, `features`).
- `POST /api/schools/signup` accepts an optional `packCode`: an unknown or inactive code → `400`; omitted → the default pack (if none exists, `packId` stays `null` and signup still succeeds). The old `packTier` input is removed (controller + service + tests). `trialEndsAt` = 15 days, unchanged.

Validation (service level, messages in English like the rest of the API): `name` and `code` required; `code` matches `^[a-z0-9-]+$` and is unique; prices are numbers ≥ 0; `maxStudents`/`maxBranches` are `null` or positive integers; every `features` entry is in the fixed list (duplicates removed); the default pack cannot be deactivated (set another default first); a missing id never reaches a `findFirst` (reuse the `assertId` idea from the transport module).

## Frontend

### Landing page at `/` (`apps/education-apps/frontend/app/page.tsx`)

Replaces the dev redirect. Dark style "B" from the mockup, brand "Smart School". Sections: nav (pricing anchor, language switch, login link to `/login`), hero (badge "15 jours d'essai gratuit", headline, lead, two CTAs, "no card" line, inline SVG dashboard illustration), ten feature cards (parent portal, student portal, QR attendance, transport, payments, formations, staff management, multi-branch, announcements, and a **Cantine** card labelled "Bientôt" / "قريبًا" (the canteen module is planned, not built), ), plus a highlighted card spanning two columns of a 4-column grid (2 columns on tablets, 1 on phones) inviting schools to register on **SmartCities Maroc** (the platform's directory), a **"for every type of institution"** section (private schools, tutoring centres, vocational training, language centres, nurseries/kindergartens, school networks — each with feature tags), pricing, three-step "how it starts", final CTA, a minimal footer ("© Smart School" only), floating WhatsApp button. There is deliberately no statistics strip and no "made in Morocco" line.

- **Bilingual:** messages live in one typed file (`lib/landing/messages.ts`, `fr` and `ar` objects with identical keys, enforced by TypeScript). Default language: Arabic if `navigator.language` starts with `ar`, otherwise French; the choice is saved in `localStorage` (wrapped in try/catch). `dir="rtl"` and the Cairo font apply to the landing root only when Arabic is active; layout uses logical properties (`start`/`end`, `ms-`/`me-`) so RTL needs no separate styles. Arabic copy is Modern Standard Arabic; the mockup's Arabic strings are the reference.
- **Pricing section:** fetches `GET /api/packs/public` on the client (skeleton while loading). Each card shows name, price (monthly or yearly per the toggle; yearly shows the yearly price and a "2 months free" note only when `yearlyPrice < 12 × monthlyPrice`), limits from `maxStudents`/`maxBranches` (`null` → "unlimited"), the base inclusions (students/enrolment/payments, attendance/receipts) plus one line per feature key, "recommended" badge on `recommended`, and a CTA to `/signup?pack=<code>`. If the request fails or returns nothing, the section shows a short message with a plain CTA to `/signup`; the rest of the page is unaffected.
- **Already logged in:** if an access token/user is present, redirect to the role's home using the same rules as `app/login/page.tsx` (OWNER → `/admin/select-branch`, ADMIN/SUPER_ADMIN → `/admin`, SECRETARY → `/secretary`) instead of showing the landing.
- **WhatsApp button:** links to `https://wa.me/<number>`. The number comes from `NEXT_PUBLIC_WHATSAPP_NUMBER` and **temporarily defaults to `0608183886`** (stored and used in international format `212608183886`); replace it via the env var when the final number is known.
- **Accessibility/performance:** semantic headings and landmarks, labelled language switch and billing toggle (`aria-pressed`), sufficient contrast on the dark theme, no layout shift on language change, images limited to the inline SVG.

### Signup page (`app/signup/page.tsx`)

Reads `?pack=<code>`, fetches the public packs, shows the selected pack as a compact summary with the ability to switch (radio list of active packs) and sends `packCode` with the signup request (`signupSchool` payload gains `packCode?`). No `pack` param → the recommended pack is preselected. If the packs cannot be loaded, signup still works without `packCode`. The brand text on this page becomes "Smart School".

### Super Admin

- New page `/admin/packs` (SUPER_ADMIN only, same guard as `/admin/schools`) and a "Packs" entry in the SUPER_ADMIN sidebar: table (name, monthly/yearly price, limits, feature chips, default badge, active toggle, school count) and a create/edit form with the six feature checkboxes; empty limit field = unlimited; "make default" action; deactivate instead of delete.
- `/admin/schools` gains a **Pack** column with a select of active packs that calls `PATCH /schools/:id/pack`.

## Testing

Backend (TDD, jest, mocked prisma): pack service — unique/invalid `code`, price and limit validation, unknown feature key rejected, duplicate feature keys collapsed, default switch clears the previous default atomically, cannot deactivate the default, public list only returns active packs and only public fields; schools service — assign requires an existing active pack, signup with valid/unknown/inactive/missing `packCode` (default fallback, no-default fallback to `null`), `packTier` no longer accepted; seed run twice is idempotent (test with a mocked prisma or a dry-run function). Frontend has no test runner: `tsc --noEmit` and `next build` must pass, plus manual QA of the landing in fr and ar (RTL), mobile width, the pricing toggle, a failing packs request (API stopped), the `?pack=` preselection through signup, and the SUPER_ADMIN pages.

## Rollout

Additive schema change except dropping `School.packTier` (dev data only; no production data exists). Run `prisma db push`, then the seed script. The landing needs no new env (the optional `NEXT_PUBLIC_WHATSAPP_NUMBER` overrides the temporary default number `0608183886`); it reuses the existing `NEXT_PUBLIC_API_URL`.
