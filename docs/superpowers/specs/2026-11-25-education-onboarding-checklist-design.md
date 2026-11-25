# ArwaEduc — Onboarding checklist for a new establishment (design)

Date: 2026-11-25. Status: approved in conversation.

## Goal

A school that has just signed up is guided, in a logical order, through the setup it needs before registering students: profile, prices, classes, teachers, staff, transport, then the first student. Student registration then works smoothly, because the prices, groups and teachers it depends on already exist.

## Approach

This is a guided checklist, not a full-screen wizard. Each step links to the page that already exists for it, so no form is duplicated. A step is marked done automatically, from the data in the database. Nothing stores "done", so if the last group is deleted, the step goes back to not done.

## Steps

The steps depend on the institution type and on the pack. They are shown in this order:

| key | Step | Link | Done when | Optional | Shown when |
|---|---|---|---|---|---|
| `profile` | Profil de l'établissement | `/admin/settings` | the branch `Settings` has a `schoolName`, and the school has a `phone` or the settings have a `contactInfo`. For a PRIVATE_SCHOOL, `schoolCycles` must also be non-empty | no | always |
| `prices` | Prix / Frais de scolarité | `/admin/finance/prix` | school mode: at least one `TuitionFee` in the branch. Otherwise: at least one active `Pricing` | no | always |
| `formations` | Formations | `/admin/formation-pro/new` | at least one `Formation` in the branch | no | VOCATIONAL_TRAINING only |
| `groups` | Classes / Groupes | `/admin/groups` | at least one `Group` in the branch | no | always |
| `teachers` | Enseignants | `/admin/teachers` | at least one `Teacher` in the branch | no | always |
| `staff` | Staff (secrétaire) | `/admin/secretaire` | at least one `User` with the role SECRETARY in the branch | yes | always |
| `transport` | Transport | `/admin/transport` | at least one `Vehicle` and one `TransportRoute` in the branch | yes | the pack has `TRANSPORT`, or the school has no pack |
| `firstStudent` | Premier élève | `/admin/inscriptions` (Import Excel offered next to it) | at least one `Student` in the branch | no | always |

School mode is decided by the same rule as `schoolMode.routes`: the institution type is PRIVATE_SCHOOL, or the branch has `schoolCycles`.

Rooms («Salles») are not a step. The current Salles page shows demo data only and saves nothing, so persistent rooms would be a separate project.

## Data

Two new fields go on `Settings` (per branch):
- `onboardingSkipped String[]`: the keys of the optional steps the admin skipped.
- `onboardingDismissed Boolean @default(false)`: the admin hid the checklist.

## API

Both routes are for ADMIN and OWNER, and are tenant-scoped through the existing `tenantScopeMiddleware`.

- `GET /api/onboarding` returns `{ steps: [{ key, done, skipped, optional, href }], completed, dismissed }`.
  - It runs light `count` queries, in parallel, for the visible steps.
  - `completed` is true when every required visible step is done. Optional steps (staff, transport) never keep it open, so schools already running are not shown the checklist.
- `PATCH /api/onboarding` with `{ skip: key }`, `{ unskip: key }` or `{ dismissed: boolean }`.
  - Only optional keys can be skipped. Any other key answers 400.

The new module is `src/modules/onboarding/`, with a service, a controller and routes.

## Frontend

- **Dashboard card** (ADMIN/OWNER, on `/admin`): «Configurer votre établissement · 3/7».
  - It shows the ordered list with ✅/⬜, and the skipped steps greyed out with «Reprendre».
  - A «Continuer» button opens the first step that is not done.
  - A «Masquer» link sets `dismissed`.
  - The card is hidden when `completed` or `dismissed` is true.
- **Step banner**: a thin bar at the top of the admin layout, shown when the current path matches the href of a step that is not done, and the checklist is neither completed nor dismissed.
  - It reads «Étape 4/7 · Classes et groupes». When the step is done it shows «Suivant ›», and on an optional step it also shows «Passer».
  - It refetches when the route changes, so the step ticks as soon as the admin comes back from saving.
- **Signup**: after signup the school lands on `/admin` (the dashboard with the card) instead of `/admin/settings`.
- **Languages**: the texts go through `tr()` with entries in the `lib/i18n/ar` dictionary.
- A small `lib/services/onboarding.ts` holds the API calls, and a `useOnboarding()` hook is shared by the card and the banner.

## Errors

- If the checklist fails to load, the card and the banner simply do not render. The dashboard must never break because of them.
- A failed skip or dismiss shows the API message inline.

## Tests (Jest, dummy data)

- The visible steps per institution type: formations only for VOCATIONAL_TRAINING; transport hidden when the pack lacks `TRANSPORT`, and shown when there is no pack.
- `done` for each step, including the school-mode branch for prices and profile.
- `completed` with skipped optional steps.
- PATCH: skipping an optional step, unskipping, refusing a required key, and dismissing.
- Routes: SECRETARY, TEACHER and SUPER_ADMIN are refused.
