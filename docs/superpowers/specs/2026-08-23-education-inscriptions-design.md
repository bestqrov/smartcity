# Education: Inscriptions Module Design

## Goal

Add a seventh full-stack Education slice — inscriptions (soutien/formation enrollment) — continuing
the pattern of porting a module from the user's reference project (`bestqrov/app-injahi`) into a
proper multi-tenant SaaS slice. This slice deliberately absorbs part of what was originally scoped
as a separate future "Formation Pro" slice (a course/offering catalog), because inscriptions are
meaningless without something to enroll a student *in* — see "Scope decision" below.

## What's being ported, and what's deliberately changed

app-injahi's `Inscription` model is a flat `{studentId, type(SOUTIEN|FORMATION), category, amount,
date, note}` — `category` for `SOUTIEN` is one of a hardcoded string list (`math`, `physique`,
`svt`, `francais`, `anglais`, `calcul_mental`, `couran`, `autre`), and for `FORMATION` it's a
different hardcoded list (`coiffure`, `bureautique`, `ecommerce`, `autre`). Separately, app-injahi
also has a standalone `Formation` model (`name`, `duration`, `price`, `description` — no teacher
link) used only by its own "Formation Pro" module, disconnected from the `SOUTIEN` side entirely.
Creating an `Inscription` auto-creates a `Payment` via a direct service call, with no FK linking
the two — the same unlinked-pair gap the Finance slice already fixed once for `Payment`/
`Transaction`.

**Scope decision (made with the user mid-brainstorm):** rather than port app-injahi's two
disconnected pieces (hardcoded category strings + a separate teacher-less `Formation` model) as-is,
this slice unifies them into one real catalog entity, `Offering`, covering both `SOUTIEN` and
`FORMATION` types, each with a name, description, duration, price, and an *optional* linked
`Teacher` — something app-injahi's own `Formation` model never had. Admins manage this catalog
directly (add/edit offerings) instead of being stuck with a fixed, hardcoded list. This is a
deliberate improvement over app-injahi's shape, not a faithful port, made because the user
explicitly asked for it after reviewing the initial (more literal) design.

Also deliberately added, beyond app-injahi's own `Inscription`/`Payment` shape:
- **`Inscription.paymentId` is a required FK** to `Payment` — same improvement pattern Finance
  already established for `Payment.transactionId` (app-injahi's `Inscription` and `Payment` have
  no relation between them at all).
- **A thermal-receipt print button** after creating an inscription, ported from app-injahi's
  `frontend/components/ThermalReceipt.tsx` (a bare 384px-wide monospace layout meant for an 80mm
  thermal printer, using the browser's native print dialog — no backend, no PDF library, no new
  dependency). The user flagged this explicitly as something to include now rather than defer.

**Deliberately deferred** (unchanged from prior slices' pattern of scoping down):
- **No dedicated `/inscriptions/analytics` endpoint.** Stats (totals, breakdown by type) are
  computed client-side from the already-fetched list, same pragmatic first-pass choice Attendance
  and Users made for their own stat cards.
- **No `SECRETARY` role.** This monorepo's shared `UserRole` enum has no equivalent — `STAFF` is
  the closest fit and is used everywhere app-injahi's routes allowed `SECRETARY`.
- **No full "Documents" module** (printable student dossiers, letterhead-based certificates) — only
  the specific thermal-receipt-after-inscription flow is in scope here; a fuller documents/reports
  module stays a future slice.
- **No `Settings` module yet** — the receipt uses `Tenant.name` (already exists) for the
  institution name; no address/logo on the receipt for this first pass, since `Tenant` has no
  address field and a dedicated `Settings` model doesn't exist yet.

## Data model

Two new Prisma models, tenant-scoped like every other Education model:

```prisma
enum InscriptionType {
  SOUTIEN
  FORMATION
}

model Offering {
  id          String           @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String           @db.ObjectId
  type        InscriptionType
  name        String
  description String?
  duration    String?
  price       Float
  teacherId   String?          @db.ObjectId
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  teacher      Teacher?      @relation(fields: [teacherId], references: [id])
  inscriptions Inscription[]

  @@map("offerings")
}

model Inscription {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId   String   @db.ObjectId
  studentId  String   @db.ObjectId
  offeringId String   @db.ObjectId
  paymentId  String   @unique @db.ObjectId
  amount     Float
  date       DateTime
  note       String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tenant   Tenant   @relation(fields: [tenantId], references: [id])
  student  Student  @relation(fields: [studentId], references: [id])
  offering Offering @relation(fields: [offeringId], references: [id])
  payment  Payment  @relation(fields: [paymentId], references: [id])

  @@map("inscriptions")
}
```

`duration` stays a free-text string (e.g. `"3 mois"`, `"6 semaines"`) rather than a fixed unit —
matches app-injahi's own `Formation.duration` shape and the same "free text over premature
structure" call made for `Group.level`/`Group.subject` in the Teachers/Groups slice.

`amount` on `Inscription` is stored explicitly rather than always equal to `offering.price` — the
create form prefills it from the chosen offering's price but lets the staff member override it
(discounts, promotions), so the actually-charged amount is always what's on record, independent of
the catalog price at the time.

`Tenant` gains `offerings Offering[]` and `inscriptions Inscription[]` back-refs; `Student` gains
`inscriptions Inscription[]`; `Teacher` gains `offerings Offering[]`; `Payment` gains a bare
`inscription Inscription?` back-ref (same 1:1-on-MongoDB pattern already used for
`Transaction`↔`Payment`).

## Backend (`education-service`)

### Extending `PaymentsService` (small, backward-compatible change)

`PaymentsService.create` currently always hardcodes the linked `Transaction`'s `category` to
`'Tuition Payment'` and composes a fixed description. Inscriptions need the ledger entry to reflect
what was actually purchased (e.g. `"Soutien - Mathématiques"`, not a generic tuition label), so
`CreatePaymentDto` gains two optional fields:

```typescript
@IsString()
@IsOptional()
category?: string; // defaults to 'Tuition Payment' if omitted

@IsString()
@IsOptional()
description?: string; // defaults to the existing computed description if omitted
```

`PaymentsService.create` uses `dto.category ?? 'Tuition Payment'` and
`dto.description ?? \`Payment from ${student.firstName} ${student.lastName} (${dto.method})\`` when
building the `Transaction`. Existing callers (the Finance page) never pass these fields, so their
behavior is unchanged — this is purely additive.

### New `offerings/` sub-module (inside the existing `finance` NestJS module is wrong — this lives
in a new `inscriptions/` module, since it's conceptually part of enrollment, not the ledger)

- **`OfferingsService`**: `create(tenantId, dto)`, `findAll(tenantId, { page, limit, type? })`,
  `update(tenantId, id, dto)` (name/description/duration/price/teacherId/isActive — no delete,
  soft-deactivate via `isActive: false` like every other Education entity). Validates
  `teacherId` belongs to the tenant when provided (same `assertInTenant`-style check
  `TeachersService`/`GroupsService` already do for their own FK validations).
- **`OfferingsController`** (`@Controller('offerings')`):
  ```
  POST   /offerings        ADMIN, MANAGER
  GET    /offerings        ADMIN, MANAGER, STAFF   — ?type=SOUTIEN|FORMATION, paginated
  PATCH  /offerings/:id     ADMIN, MANAGER
  ```

### New `InscriptionsService` (same module)

- **`create(tenantId, dto)`**:
  1. Validates `dto.studentId` belongs to the tenant (same pattern `PaymentsService.create`
     already uses).
  2. Validates `dto.offeringId` belongs to the tenant and `isActive`.
  3. Calls `paymentsService.create(tenantId, { studentId: dto.studentId, amount: dto.amount,
     method: dto.method, category: offering.name, description: `Inscription
     ${offering.type === 'SOUTIEN' ? 'soutien' : 'formation'}: ${offering.name} —
     ${student.firstName} ${student.lastName}` })` — this atomically creates the `Transaction` and
     `Payment` (already-approved `prisma.$transaction` pattern from Finance).
  4. Creates the `Inscription` row referencing `offering.id` and the just-created `payment.id`,
     then returns it with `student`, `offering` (including `offering.teacher`), and a `tenantName`
     field (a `Tenant.findFirst({ where: { id: tenantId }, select: { name: true } })` lookup) —
     the one extra field the frontend's print-receipt flow needs that isn't otherwise on the
     response, so it never needs a second call just to print the record it just created.

  **Documented consistency trade-off:** steps 3 and 4 are NOT wrapped in one atomic transaction —
  step 3 reuses `PaymentsService.create()` as its own self-contained unit (per the user's explicit
  choice to reuse it rather than duplicate transaction logic), and step 4 is a separate write
  afterward. If step 4 fails, the `Payment`/`Transaction` pair still exists correctly (the money is
  accounted for) but with no `Inscription` record pointing at it — a narrow, low-probability window
  (a second DB write immediately after a successful first one), not a money-safety issue, and
  consistent with the user's chosen approach of reusing `PaymentsService.create` as a black box
  rather than rewriting a three-way atomic transaction.
- **`findAll(tenantId, { page, limit, studentId?, type? })`** — paginated, includes `student` and
  `offering` (and `offering.teacher` for display).

- **`InscriptionsController`** (`@Controller('inscriptions')`):
  ```
  POST   /inscriptions        ADMIN, MANAGER, STAFF
  GET    /inscriptions        ADMIN, MANAGER, STAFF   — ?studentId=, ?type=, paginated
  ```

Both controllers registered via one `InscriptionsModule` in `app.module.ts`, importing
`FinanceModule` (to inject `PaymentsService`) and `AuthModule`. Gateway gets two new routes:
`'/api/offerings': educationServiceUrl` and `'/api/inscriptions': educationServiceUrl`.

### Payment method field

Stays a free-text `string` at the schema/DTO level — no enum, matching app-injahi's own
`Payment.method: String` and this codebase's existing `Payment.method` shape (unchanged, no
migration). The *frontend* form for creating an inscription's payment renders it as a `<select>`
with fixed common options (`Espèces`, `Carte bancaire`, `Virement bancaire`, `Chèque`, `Autre`) —
choosing `Autre` reveals a text input to specify something else, mirroring the same "fixed list +
'autre' escape hatch" pattern already used for `Offering` categories. This is a frontend-only UX
improvement; the API contract for `method` doesn't change.

## Frontend (`education-app`)

- **`src/lib/offerings.ts`** — TanStack Query hooks: `useOfferings(page, limit, type?)`,
  `useCreateOffering()`, `useUpdateOffering()`.
- **`src/lib/inscriptions.ts`** — TanStack Query hooks: `useInscriptions(page, limit, studentId?,
  type?)`, `useCreateInscription()`.
- **New page `src/app/[locale]/(admin)/inscriptions/page.tsx`** ("Inscriptions" in the sidebar,
  `ClipboardList` icon from `lucide-react`, a fresh accent color — `teal`, added to `StatCard`'s
  `colorClasses` alongside `sky`/`primary`/`amber`/`violet`/`rose`/`green`/`indigo`), following the
  established two-section-on-one-page pattern the Finance page already uses:
  - **Catalogue section**: a table of `Offering`s (name, type badge, price, duration, teacher name
    or `—`, active/inactive badge) with an "Add offering" button opening a modal (type select,
    name, description, duration, price, teacher select — populated via `useTeachers(1, 100)`,
    optional).
  - **Inscriptions section**: 3 stat cards (total inscriptions, count by `SOUTIEN`, count by
    `FORMATION` — computed client-side from the fetched list, same `useInscriptions(1, 100)`
    generous-single-page pattern Finance/Users already use) + a table (student name, offering name,
    type badge, amount, payment method, date) with an "Add inscription" button opening a modal:
    student select (`useStudents(1, 100)`), offering select (`useOfferings(1, 100)` — filtered
    client-side by a type toggle so the category picker feels like app-injahi's two-tab
    SOUTIEN/FORMATION form), amount (prefilled from the selected offering's price, editable),
    payment method select (`Espèces`/`Carte bancaire`/`Virement bancaire`/`Chèque`/`Autre` +
    conditional text input), optional note.
  - **After a successful inscription creation**, the modal's success state shows an "Imprimer le
    reçu" button instead of immediately closing — clicking it renders a `ThermalReceipt` client
    component (ported from app-injahi's, ~384px/80mm monospace layout) in a hidden-until-print
    container and calls `window.print()`. No new dependency — plain CSS `@media print` +
    `window.print()`, same technique app-injahi used. The receipt shows: institution name, receipt
    id (the created `Inscription`'s `id`), date, student name, offering name, payment method,
    amount, and a thank-you line. Institution name is NOT available on the `IUser` the frontend
    already has (`useAuth()`'s `user` has no tenant name, only `tenantId`) — the simplest source
    without adding a new endpoint is to have `useCreateInscription()`'s mutation response include
    the tenant name by having the backend's `POST /inscriptions` response include a
    `tenantName: string` field (one extra `select`/lookup on `Tenant.name` in
    `InscriptionsService.create`, alongside the existing `student`/`offering` includes) — the
    frontend never needs a separate call just to print a receipt for the record it just created.
- Sidebar nav gains an "Inscriptions" entry (`ClipboardList` icon, `teal` accent), positioned after
  Users (last in the list, most recently added).

## i18n

New `education.*` keys in `en.json`/`fr.json`/`ar.json`: `inscriptions`, `offerings`,
`addOffering`, `offeringName`, `offeringDescription`, `offeringDuration`, `offeringPrice`,
`offeringTeacher`, `offeringType`, `noOfferingsYet`, `addInscription`, `inscriptionStudent`,
`inscriptionOffering`, `inscriptionAmount`, `inscriptionMethod`, `inscriptionNote`,
`noInscriptionsYet`, `totalInscriptions`, `typeSoutien`, `typeFormation`, `methodCash`,
`methodCard`, `methodTransfer`, `methodCheck`, `methodOther`, `printReceipt`, `receiptThankYou`.

## Out of scope (explicitly deferred, same rationale as prior slices)

- `/inscriptions/analytics` endpoint (daily/monthly revenue breakdown) — client-side stat cards
  cover the first-pass need; a real analytics endpoint can be added later without a breaking
  change.
- `SECRETARY`-specific role — `STAFF` is the standing equivalent across this whole vertical.
- A full `Documents` module (student dossiers, letterhead certificates) — only the narrow
  receipt-after-inscription print flow is in scope here.
- A `Settings` module (school name/logo/address management) — the receipt uses `Tenant.name` only;
  no logo, no address, until `Settings` exists as its own slice.
- No automated tests — same as every prior slice; verification is `tsc --noEmit`, `nest build`,
  and manual `curl`/Playwright checks (including an actual browser print-preview check for the
  thermal receipt).

## Testing

Same as every prior Education slice: no test harness exists anywhere in this repo. Verification is
`tsc --noEmit`, `nest build`, and manual `curl` + Playwright checks before merging — including
creating an offering, creating an inscription against it (confirming the linked Payment+Transaction
both appear correctly with the inscription's category/description, not the generic "Tuition
Payment" default), and triggering the print-receipt flow in a real browser to confirm the layout
renders (Playwright can't validate print output directly, but can confirm the receipt DOM node
renders with correct data before print is triggered).
