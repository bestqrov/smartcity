# Education: Inscriptions Fidelity Revision

## Goal

Revise the just-merged Inscriptions slice (`docs/superpowers/specs/2026-08-23-education-inscriptions-design.md`) to match app-injahi's actual `Inscription`/`Payment` behavior closely, instead of the unified `Offering` catalog this repo built. This is a correction, not a new feature: the original design deliberately diverged from app-injahi (merging its separate hardcoded-category-list + teacher-less `Formation` model into one admin-manageable catalog), and the user has since clarified that app-injahi's shape here specifically reflects real field research conducted with schools — not an arbitrary implementation worth "improving" from first principles. See `[[feedback-app-injahi-fidelity]]` memory for the full context.

## What changes and why

**Drop `Offering` entirely.** app-injahi's real `Inscription` model (`prisma/schema.prisma:132-145` in the reference repo) has no catalog entity at all:

```prisma
model Inscription {
  id        String          @id @default(auto()) @map("_id") @db.ObjectId
  studentId String          @db.ObjectId
  type      InscriptionType
  category  String
  amount    Float
  date      DateTime        @default(now())
  note      String?
}
```

`category` is a plain string — not an FK, not even validated against a fixed list server-side. Reading app-injahi's actual `inscriptions.service.ts`, the category-validation function's body is entirely commented out ("`// Optional: you might want to relax this too...`", "`// FORMATION validation removed to allow dynamic formation names`") — the hardcoded `SOUTIEN_CATEGORIES`/`FORMATION_CATEGORIES` lists (`math`, `physique`, `svt`, `francais`, `anglais`, `calcul_mental`, `couran`, `autre` for `SOUTIEN`; `coiffure`, `bureautique`, `ecommerce`, `autre` for `FORMATION`) exist only as a **frontend UI convenience** (a dropdown), never enforced by the backend. This slice restores that exact shape: no `Offering` model, no `teacherId` link, no admin-manageable catalog page — `category` becomes a plain, unvalidated string on `Inscription`, with the frontend still offering the same two hardcoded dropdowns + "Autre" escape hatch app-injahi has.

**Drop `Inscription.paymentId` — no FK between `Inscription` and `Payment` at all.** Confirmed directly from app-injahi's schema: `Inscription` and `Payment` are two fully independent models with zero relation fields pointing at each other. This was the one deliberate improvement the original design made (an FK for traceability) — the user explicitly chose to drop it for this revision, in favor of matching app-injahi's actual (unlinked) shape exactly.

**The auto-created `Payment`'s ledger entry stays generic, matching app-injahi exactly.** Reading app-injahi's `payments.service.ts`, `createPayment()` always hardcodes the linked `Transaction`'s `category: 'Paiement Scolarité'` and a fixed description — it never reflects the inscription's type/category on the ledger. The inscription-specific context (`"Paiement pour inscription: ${type} - ${category}"`) goes on `Payment.note` instead, not the `Transaction`. This slice reverts the earlier `category`/`description` override call site added for Inscriptions specifically: `InscriptionsService.create` now calls `paymentsService.create` **without** passing `category`/`description` overrides (the generic `'Tuition Payment'` default applies, matching app-injahi's `'Paiement Scolarité'`), and instead passes `notes: `Inscription ${type}: ${category}`` (or the caller's own note, if provided) — mirroring app-injahi's `Payment.note` usage. The optional `category`/`description` fields added to `CreatePaymentDto`/`PaymentsService.create` in the prior slice stay in the codebase (harmless, backward compatible, no other caller uses them) — they're just no longer called *from Inscriptions*.

**Payment failure fails loud, deliberately NOT matching app-injahi.** app-injahi's `createInscription` wraps the auto-payment-creation call in a try/catch that swallows any error (`console.error`, no rethrow) — the `Inscription` row is already committed before this call, so a failed payment leaves an inscription with no corresponding financial record and no visible error to the person who created it. The user explicitly reviewed this specific behavior and chose NOT to replicate it: this revision keeps payment creation as a failure that propagates (the whole `POST /inscriptions` call fails with a clear error) rather than silently succeeding with an unaccounted-for payment. This is the one point in this revision where fidelity is deliberately NOT the goal — a silently-swallowed financial-write failure is a bug pattern, not a field-validated business requirement, and the user agreed once this was surfaced explicitly.

**Payment method stays a `<select>` with fixed options — this is intentional non-fidelity, already explicitly requested earlier by the user.** app-injahi's backend hardcodes `method: 'CASH'` for every auto-created payment with no way to choose otherwise. Before this fidelity conversation started, the user had already explicitly asked for a payment-method dropdown (Espèces/Carte bancaire/Virement bancaire/Chèque/Autre) as an addition on top of app-injahi's shape — confirmed again during this revision's clarifying questions (the user re-confirmed keeping the dropdown, not reverting to a hardcoded `'CASH'`). `method` stays a plain `string` field on `CreateInscriptionDto` (matches app-injahi's field type — a string, just user-selectable via the UI instead of hardcoded).

**Analytics stays deferred, unchanged from the original design.** app-injahi's daily/monthly analytics endpoint was already explicitly out of scope in the original Inscriptions design and this revision doesn't reopen that question — client-side stat cards (total / soutien / formation counts) stay as they are.

## Data model changes

```prisma
// REMOVE entirely: the Offering model, and InscriptionType stays (already correct, matches
// app-injahi's own enum).

model Inscription {
  id        String           @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String           @db.ObjectId
  studentId String           @db.ObjectId
  type      InscriptionType
  category  String
  amount    Float
  date      DateTime
  note      String?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  student Student @relation(fields: [studentId], references: [id])

  @@map("inscriptions")
}
```

Remove `Payment.inscription?` back-ref (no relation anymore). Remove `Teacher.offerings`/`Tenant.offerings` back-refs (the `Offering` model is gone). Keep `Tenant.inscriptions`/`Student.inscriptions` back-refs (Inscription itself still exists, just simpler).

## Backend (`education-service`)

- **Delete** `offerings.service.ts`, `offerings.controller.ts`, `dto/create-offering.dto.ts`, `dto/update-offering.dto.ts` — the whole Offerings sub-feature goes away.
- **`InscriptionsService.create(tenantId, dto)`** rewritten:
  1. Validate `dto.studentId` belongs to the tenant (unchanged).
  2. No offering lookup/validation (there's no `Offering` anymore).
  3. Call `paymentsService.create(tenantId, { studentId: dto.studentId, amount: dto.amount, method: dto.method, notes: dto.note ?? `Inscription ${dto.type}: ${dto.category}` })` — no `category`/`description` overrides, so the ledger entry stays the generic default. This call is NOT wrapped in a try/catch — if it throws, `create` throws too (fail loud).
  4. Create the `Inscription` row directly with `tenantId`, `studentId`, `type`, `category`, `amount`, `date`, `note`.
  5. Return the created inscription with `student` included, plus `tenantName` and `method` (still needed by the receipt-printing flow — `method` now comes straight from `dto.method` since there's no `Payment` relation to read it back from).
- **`InscriptionsService.findAll`**: unchanged shape (tenant-scoped, paginated), just without the `offering` include (there's nothing to include).
- **`CreateInscriptionDto`**: `studentId`, `type` (`@IsEnum(InscriptionType)`), `category` (`@IsString @MinLength(1)` — no whitelist enforcement, matching app-injahi's disabled validation), `amount`, `method`, `note?`, `date?`.
- **`InscriptionsModule`**: drop `OfferingsController`/`OfferingsService` from its `controllers`/`providers` arrays.
- **Gateway**: remove the `/api/offerings` route (no more Offerings endpoint to route to).

## Shared types

- **Remove** `IOffering` from `packages/shared-types/src/education.types.ts`.
- **`IInscription`** updated: drop `offeringId`, `paymentId`; add `type: InscriptionType`, `category: string`.

## Frontend (`education-app`)

- **Delete** `apps/education-app/src/lib/offerings.ts`.
- **`apps/education-app/src/lib/inscriptions.ts`** rewritten: `InscriptionWithRelations` drops `offering`; `CreateInscriptionInput` gains `type`/`category`, drops `offeringId`. `CreatedInscription` keeps `tenantName`/`method` (same reasoning as before — the receipt-printing flow needs them in the create response without a second call).
- **Inscriptions page rewritten**, removing the entire "Catalogue" section and its modal (no more offering CRUD, no teacher select). The remaining "Inscriptions" section:
  - Same 3 stat cards (total / soutien / formation), same table structure, now showing `category` instead of an offering name, no teacher column anywhere (there never was one on this table specifically — only the removed Catalogue table had it).
  - "Add inscription" modal: student select, **type select (SOUTIEN/FORMATION)**, **category select** — populated from `SOUTIEN_CATEGORIES`/`FORMATION_CATEGORIES` constants (ported from app-injahi's `frontend/types/index.ts`) filtered by the chosen type, with an "Autre" option revealing a free-text input (mirrors the existing payment-method "Autre" pattern already built) — amount (no longer prefilled from an offering price, since there's no catalog; plain empty/manual entry), payment method select (unchanged — Espèces/Carte bancaire/Virement bancaire/Chèque/Autre), note (optional).
  - Same "Imprimer le reçu" print flow after a successful create. `ThermalReceipt`'s `offeringName`
    prop is renamed to `itemLabel` (since "offering" no longer exists as a concept) and the page
    passes it `"${type label} — ${category}"` (e.g. `"Soutien — Mathématiques"`) instead of an
    offering's name. `ThermalReceipt`'s own on-screen label prop (`offeringLabel`, added in the
    prior slice's post-review fix) is renamed to `itemLabel` too for consistency, still sourced
    from a `t()` call in the page (reusing `education.inscriptionCategory` or a new
    `education.receiptItem` key — pick one when writing the plan's exact i18n key list).
- **Sidebar nav, `teal` color, i18n namespace keys**: unchanged (still called "Inscriptions", still teal) — only offering-specific i18n keys (`offerings`, `addOffering`, `editOffering`, `offeringName`, `offeringDescription`, `offeringDuration`, `offeringPrice`, `offeringTeacher`, `noOfferingsYet`) get removed, and new ones for the category select get added (`inscriptionType`, `inscriptionCategory`, `categoryOther` — reusing `typeSoutien`/`typeFormation`/`methodOther`-style keys already present) plus the actual category label keys for each of the 8+4 hardcoded values (e.g. `categoryMath`, `categoryPhysique`, ... `categoryCoiffure`, `categoryBureautique`, `categoryEcommerce`).

## Migration note

Since Inscriptions was just merged to `main` with zero real production data behind it (this whole vertical has never been pushed to origin, and this is local development against a shared Atlas dev database with only test-tenant seed data), this revision drops the `Offering` collection and any already-created test `Inscription`/`Offering` rows outright rather than writing a data migration — there's nothing worth preserving. Verification in this revision's plan will re-create fresh test data.

## Out of scope (unchanged from the original design)

- No `/inscriptions/analytics` endpoint.
- No `SECRETARY` role — `STAFF` remains the standing equivalent.
- No `Documents`/`Settings` modules.
- No automated tests — verification is `tsc --noEmit`, `nest build`, `next build`, and manual `curl`/Playwright checks.

## Testing

Same verification approach as the original slice: curl checks (create an inscription, confirm the linked `Transaction` category is the generic default not a category-specific one, confirm `Payment.notes` carries the inscription context, confirm a payment-creation failure — simulate via an invalid `studentId` at the `PaymentsService.create` layer, or trust the existing tenant-check already covers the realistic failure path — propagates as an error rather than silently succeeding) plus a full Playwright browser pass (create an inscription via the category dropdown including "Autre", confirm the print-receipt flow still works with the new field shape).
