# Education: Formations (Formation Pro) Module Design

## Goal

Add an eighth full-stack Education slice — a Formation Pro catalog + a quick "enroll a new
student into a formation" flow — porting it from the reference project (`ArwaEduc`, aka
`app-injahi`), now available permanently at `apps/education-apps` in this monorepo (see
`reference-app-injahi-local-copy` memory). This slice follows the fidelity mandate established
after the Inscriptions revision: match the reference's actual behavior closely, deviating only
for clear technical reasons (multi-tenancy) or explicit user sign-off, both documented below.

## What's being ported, and what's deliberately changed

The reference's `Formation` model (`prisma/schema.prisma` in `apps/education-apps`) is:

```prisma
model Formation {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  duration    String
  price       Float
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  groups      Group[]
}
```

Its `formations.controller.ts` is a plain CRUD module (no separate service layer — logic lives
directly in the controller in the reference, but this port follows this monorepo's established
service/controller split like every prior slice) plus a real analytics endpoint
(`GET /formations/analytics`) computing `totalFormations`, `totalInscriptions` (count of
`Inscription` where `type=FORMATION`), `totalRevenue` (sum of those inscriptions' `amount`),
`monthlyRevenue` (same sum, scoped to the current calendar month), and `recentInscriptions`
(last 5, with `student` included).

**Deliberate technical deviations (multi-tenancy, same pattern every prior slice has made):**
- `Formation` gains a required `tenantId` — the reference is single-tenant, this SaaS is not.
- The analytics endpoint's every query gets tenant-scoped (`where: { tenantId, ... }`).

**Deliberately built where prior slices deferred it, per explicit user request this time:**
- The `GET /formations/analytics` endpoint IS built (every prior slice deferred a dedicated
  analytics endpoint in favor of client-side stat computation) — the user explicitly asked for
  this one to be built for real, since the reference module's whole point is this dashboard.

**Deliberately left out of scope, confirmed with the user:**
- **No `Formation`↔`Group` link.** The reference's own `Group` model has an optional
  `formationId`/`formation` relation; this monorepo's already-shipped `Group` model (built in an
  earlier slice) has no such field and has already diverged from the reference in several other
  ways (tenantId, branchId, a `GroupStudent` join table instead of an array, no `type` field).
  Reconciling that is a separate, larger concern than this slice — `Formation` ships standalone
  with no relation to `Group` for now.
- **No `teacherId` on `Formation`** — the reference doesn't have one either (unlike the
  `Offering` catalog concept from the reverted Inscriptions design, which added one). This isn't
  a deviation at all — it's the reference's actual shape.
- **No `isActive` flag** — same reasoning; the reference has none.

**One faithful, load-bearing detail confirmed against the reference's actual code (not just its
docs)**: the "enroll a student into a formation" flow does NOT introduce a new endpoint or a
`formationId` field on `Inscription`. Reading `apps/education-apps/frontend/components/forms/
FormationInscriptionForm.tsx` directly: it calls the same student-creation and inscription-creation
calls the rest of the app uses — `createStudent(...)` then `createInscription({ studentId, type:
'FORMATION', category: formation.name, amount: formation.price, note: 'Inscription Formation:
${formation.name}' })`. The reference frontend also sends a `formationId` field in that payload,
but the reference's own backend `createInscription` service destructures only `{ studentId, type,
category, amount, date, note }` from the request body — `formationId` is silently dropped. This
confirms `Inscription` and `Formation` are NOT actually linked in the reference at runtime, only
loosely by `category` happening to equal the formation's `name` — consistent with the Inscriptions
fidelity revision already merged (plain `type`/`category` strings, no catalog FK). This slice's
"enroll" flow calls this monorepo's own already-existing `POST /inscriptions` (no new endpoint),
passing `type: FORMATION`, `category: <formation.name>`, `amount: <formation.price>`, and an
auto-generated `note`.

**One scoped-down detail, deliberately NOT matching the reference exactly (documented, not
silently dropped):** the reference's enrollment form supports selecting MULTIPLE formations via
checkboxes in one submit (creating one student, then one `Inscription` per selected formation via
`Promise.all`). This slice scopes that down to a single formation per enrollment — consistent with
this monorepo's own Inscriptions page (which already only creates one inscription per submit) and
avoiding the added complexity of a bulk multi-create flow for a first pass. A user who wants to
enroll one new student into multiple formations submits the form multiple times. This is a real,
acknowledged deviation from the reference (not required by multi-tenancy, not explicitly asked for
by the user) — flagged here for visibility per the fidelity mandate, on YAGNI grounds: the extra
complexity (bulk creation, partial-failure handling across multiple `Promise.all` calls) isn't
worth it for a first pass, and nothing about it is field-research-validated the way the category
lists or the generic-ledger-entry behavior were.

## Data model

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

`Tenant` gains a `formations Formation[]` back-ref. `duration` stays a free-text string (e.g. `"3
mois"`), matching the reference and this codebase's established "free text over premature
structure" precedent (`Group.level`/`Group.subject`, `Offering.duration` before it was reverted).

## Backend (`education-service`)

New `formations/` module:

- **`FormationsService`**: `create(tenantId, dto)`, `findAll(tenantId, { page, limit })`,
  `update(tenantId, id, dto)`, `delete(tenantId, id)` — standard tenant-scoped CRUD, `findFirst`
  before `update`/`delete` (never `findUnique` on a bare id), matching every prior slice's
  `assert*InTenant` pattern.
- **`getAnalytics(tenantId)`**:
  ```typescript
  const totalFormations = await this.prisma.formation.count({ where: { tenantId } });
  const totalInscriptions = await this.prisma.inscription.count({
    where: { tenantId, type: 'FORMATION' },
  });
  const revenueAgg = await this.prisma.inscription.aggregate({
    where: { tenantId, type: 'FORMATION' },
    _sum: { amount: true },
  });
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenueAgg = await this.prisma.inscription.aggregate({
    where: { tenantId, type: 'FORMATION', createdAt: { gte: startOfMonth } },
    _sum: { amount: true },
  });
  const recentInscriptions = await this.prisma.inscription.findMany({
    where: { tenantId, type: 'FORMATION' },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { student: true },
  });
  ```
  Matches the reference's own aggregation shape (total/monthly revenue split, recent list), just
  tenant-scoped.
- **`FormationsController`** (`@Controller('formations')`):
  ```
  POST   /formations              ADMIN, MANAGER
  GET    /formations              ADMIN, MANAGER, STAFF   — paginated
  PATCH  /formations/:id          ADMIN, MANAGER
  DELETE /formations/:id          ADMIN, MANAGER
  GET    /formations/analytics    ADMIN, MANAGER
  ```
  (The reference restricts everything but plain `GET` to `ADMIN` only, no `SECRETARY` access —
  this monorepo's standing convention has consistently mapped the reference's `ADMIN`-only
  mutations to `ADMIN, MANAGER` here, same as Offerings/Users/every prior catalog-style module.)

No changes needed to the Inscriptions module — `POST /inscriptions` already accepts a plain
`category` string, and the Formation Pro page will just populate that field with the chosen
formation's `name` client-side.

Gateway gets one new route: `'/api/formations': educationServiceUrl`.

## Frontend (`education-app`)

- **`src/lib/formations.ts`** — TanStack Query hooks: `useFormations(page, limit)`,
  `useCreateFormation()`, `useUpdateFormation(id)`, `useDeleteFormation()`, `useFormationAnalytics()`.
- **New page `src/app/[locale]/(admin)/formations/page.tsx`** ("Formation Pro" in the sidebar, the
  `Award` icon from `lucide-react` — `GraduationCap` is already used for Students — and a fresh
  accent color, `orange` (added to `StatCard`'s `colorClasses` alongside the existing
  `sky`/`primary`/`amber`/`violet`/`rose`/`green`/`indigo`/`teal`):
  - 4 stat cards from `useFormationAnalytics()`: total formations, total inscriptions, total
    revenue, monthly revenue (matching the reference dashboard's real analytics, not client-side
    computation).
  - A formations table (name, duration, price, description) with an "Add formation" button
    opening a create/edit modal (name, duration, price, description).
  - An "Enroll a student" button opening a modal: new-student fields (first name, last name,
    email, phone, CIN, address — matching `createStudent`'s existing DTO shape already used by
    the Students module), a formation `<select>` (populated from `useFormations`), submits by
    calling `useCreateStudent()` then `useCreateInscription()` with `type: FORMATION`, `category:
    <formation.name>`, `amount: <formation.price>`, `note: "Inscription Formation:
    ${formation.name}"` — no new backend call, reuses the two already-existing endpoints exactly
    like the reference does.
- Sidebar nav gains a "Formation Pro" entry, positioned after Inscriptions (last in the list).

## i18n

New `education.*` keys in `en.json`/`fr.json`/`ar.json`: `formations`, `addFormation`,
`editFormation`, `formationName`, `formationDuration`, `formationPrice`,
`formationDescription`, `noFormationsYet`, `enrollStudent`, `enrollFormation`,
`enrollFirstName`, `enrollLastName`, `enrollEmail`, `enrollPhone`, `enrollCin`, `enrollAddress`,
`totalFormations`, `totalFormationInscriptions`, `totalFormationRevenue`,
`monthlyFormationRevenue`.

## Out of scope (explicitly deferred, same rationale as prior slices)

- `Formation`↔`Group` link (the reference has one, this monorepo's `Group` model doesn't — a
  separate, larger reconciliation).
- Multi-formation bulk enrollment in one submit (scoped down to single-formation per submit, see
  above).
- No automated tests — same as every prior slice; verification is `tsc --noEmit`, `nest build`,
  `next build`, and manual `curl`/Playwright checks.

## Testing

Same as every prior Education slice: no test harness exists anywhere in this repo. Verification is
`tsc --noEmit`, `nest build`, `next build`, and manual `curl` + Playwright checks before merging —
including creating a formation, enrolling a new student into it (confirming both the `Student` and
`Inscription` rows are created correctly, and the linked `Payment`/`Transaction` from
`PaymentsService.create` shows up as expected), and confirming `GET /formations/analytics` returns
correct tenant-scoped totals after that enrollment.
