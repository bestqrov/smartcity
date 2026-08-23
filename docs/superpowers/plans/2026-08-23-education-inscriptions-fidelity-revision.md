# Education: Inscriptions Fidelity Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise the already-merged Inscriptions slice to drop the `Offering` catalog entirely and match app-injahi's actual `Inscription`/`Payment` shape — a plain `category` string field, no FK between `Inscription` and `Payment`, a generic (not category-specific) ledger entry — while deliberately keeping two intentional non-fidelity choices the user re-confirmed: payment failures fail loud (app-injahi silently swallows them), and the payment method stays a `<select>` with fixed options (app-injahi hardcodes `'CASH'`).

**Architecture:** Delete the `Offering` Prisma model and the `Inscription.paymentId`/`offeringId` FKs, replacing them with `type`/`category` fields directly on `Inscription`. Delete the entire `OfferingsService`/`OfferingsController` backend sub-feature and `lib/offerings.ts` frontend hook file. Rewrite `InscriptionsService.create` to call `PaymentsService.create` without category/description overrides (letting the ledger stay generic) and to let any error from that call propagate instead of being caught. Rewrite the Inscriptions page to drop the Catalogue section entirely, replacing the offering picker with type+category selects populated from hardcoded lists ported from app-injahi's frontend.

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB), class-validator — Next.js 15, React 19, `@smartcity/ui`, `@tanstack/react-query`, `lucide-react`.

---

## Deviations from app-injahi (and why) — this revision's own deviations, on top of the base slice

Documented in full in `docs/superpowers/specs/2026-08-23-education-inscriptions-fidelity-revision-design.md` — summary:

- **Payment-creation failures fail loud** — app-injahi silently swallows this error (`console.error`,
  no rethrow), leaving an `Inscription` with no corresponding financial record and no visible
  error. The user reviewed this specific app-injahi behavior explicitly and chose NOT to replicate
  it — a silently-swallowed financial write failure is a bug pattern, not a field-validated
  requirement.
- **Payment method stays a `<select>`** with fixed options instead of app-injahi's hardcoded
  `'CASH'` — already explicitly requested by the user earlier in this project, re-confirmed during
  this revision's clarifying questions.
- Everything else in this revision — dropping `Offering`, dropping the `Inscription`↔`Payment` FK,
  the generic (non-category-specific) ledger entry, the unvalidated free-text `category` field, the
  hardcoded `SOUTIEN_CATEGORIES`/`FORMATION_CATEGORIES` dropdown lists — restores app-injahi's
  actual behavior exactly, reversing the improvements the original Inscriptions slice made.
- **No automated tests** — same as every prior slice; verification is `tsc --noEmit`, `nest
  build`, `next build`, and manual `curl`/Playwright checks.

---

## File Structure

```
packages/database/prisma/schema.prisma          # modify: remove Offering model, rewrite Inscription, fix back-refs
packages/shared-types/src/education.types.ts    # modify: remove IOffering, rewrite IInscription

packages/i18n/locales/{en,fr,ar}.json           # modify: remove offering-specific keys, add category keys

services/education-service/
  src/inscriptions/offerings.service.ts               # DELETE
  src/inscriptions/offerings.controller.ts             # DELETE
  src/inscriptions/dto/create-offering.dto.ts          # DELETE
  src/inscriptions/dto/update-offering.dto.ts          # DELETE
  src/inscriptions/dto/create-inscription.dto.ts       # modify: drop offeringId, add type/category
  src/inscriptions/inscriptions.service.ts             # modify: no Offering lookup, no category override, fail loud
  src/inscriptions/inscriptions.controller.ts          # modify: fix `type` filter (own field, not via offering)
  src/inscriptions/inscriptions.module.ts              # modify: drop Offerings controller/service

services/gateway/src/proxy/proxy.middleware.ts   # modify: remove /api/offerings route

apps/education-app/
  src/lib/offerings.ts                             # DELETE
  src/lib/inscriptions.ts                          # modify: drop offering relation, add type/category
  src/components/ThermalReceipt.tsx                # modify: rename offeringName/offeringLabel to itemLabel
  src/app/[locale]/(admin)/inscriptions/page.tsx  # full rewrite: drop Catalogue section, add category picker
```

---

## Task 1: Prisma schema — drop `Offering`, rewrite `Inscription`

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Delete the `Offering` model and rewrite `Inscription`**

Find and delete the entire `Offering` model block (currently around line 723-741):

```prisma
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
```

Delete that whole block entirely.

Then find the `Inscription` model right after it (currently around line 743-761):

```prisma
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

Replace it with:

```prisma
model Inscription {
  id        String          @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String          @db.ObjectId
  studentId String          @db.ObjectId
  type      InscriptionType
  category  String
  amount    Float
  date      DateTime
  note      String?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  student Student @relation(fields: [studentId], references: [id])

  @@map("inscriptions")
}
```

(The `InscriptionType` enum stays untouched — it's still correct.)

- [ ] **Step 2: Fix back-refs on `Tenant`, `Teacher`, `Payment`**

In `Tenant`'s relations block, remove the `offerings Offering[]` line (keep `inscriptions
Inscription[]` — `Inscription` still exists, just simpler). Find:

```prisma
  offerings         Offering[]
  inscriptions      Inscription[]
```

Change to:

```prisma
  inscriptions      Inscription[]
```

In `Teacher`'s relations block, remove the `offerings Offering[]` line entirely. Find:

```prisma
  tenant    Tenant     @relation(fields: [tenantId], references: [id])
  groups    Group[]
  offerings Offering[]

  @@map("teachers")
```

Change to:

```prisma
  tenant Tenant  @relation(fields: [tenantId], references: [id])
  groups Group[]

  @@map("teachers")
```

In `Payment`'s relations block, remove the `inscription Inscription?` back-ref (no relation to
`Inscription` anymore). Find:

```prisma
  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  student     Student     @relation(fields: [studentId], references: [id])
  transaction Transaction @relation(fields: [transactionId], references: [id])
  inscription Inscription?

  @@map("payments")
```

Change to:

```prisma
  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  student     Student     @relation(fields: [studentId], references: [id])
  transaction Transaction @relation(fields: [transactionId], references: [id])

  @@map("payments")
```

`Student`'s `inscriptions Inscription[]` back-ref is unaffected — leave it as-is.

- [ ] **Step 3: Regenerate the Prisma client and verify**

Run: `cd /Users/mac/Documents/smartcity/packages/database && pnpm run db:generate`
Expected: `✔ Generated Prisma Client` with no errors.

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: multiple errors, all inside `services/education-service/src/inscriptions/` (files that
still reference `Offering`/`offeringId`/`paymentId` — those get fixed in Task 3). No errors
anywhere else in the service.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "fix(database): drop Offering model, restore Inscription's plain type/category fields

Matches app-injahi's actual Inscription shape (no catalog entity, no
FK to Payment) instead of the unified Offering catalog the original
Inscriptions slice introduced -- per user request, app-injahi's
design here reflects real field research with schools, not an
arbitrary implementation worth 'improving'."
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared-types/src/education.types.ts`

- [ ] **Step 1: Remove `IOffering`, rewrite `IInscription`**

Find and delete the entire `IOffering` interface:

```typescript
export interface IOffering {
  id: string;
  tenantId: string;
  type: InscriptionType;
  name: string;
  description?: string;
  duration?: string;
  price: number;
  teacherId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Delete that block entirely.

Then find `IInscription`:

```typescript
export interface IInscription {
  id: string;
  tenantId: string;
  studentId: string;
  offeringId: string;
  paymentId: string;
  amount: number;
  date: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Replace with:

```typescript
export interface IInscription {
  id: string;
  tenantId: string;
  studentId: string;
  type: InscriptionType;
  category: string;
  amount: number;
  date: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

(`InscriptionType` enum, defined just above these two interfaces, stays untouched.)

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/packages/shared-types && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/education.types.ts
git commit -m "fix(shared-types): remove IOffering, restore IInscription's type/category fields"
```

---

## Task 3: Backend — delete Offerings, rewrite Inscriptions

**Files:**
- Delete: `services/education-service/src/inscriptions/offerings.service.ts`
- Delete: `services/education-service/src/inscriptions/offerings.controller.ts`
- Delete: `services/education-service/src/inscriptions/dto/create-offering.dto.ts`
- Delete: `services/education-service/src/inscriptions/dto/update-offering.dto.ts`
- Modify: `services/education-service/src/inscriptions/dto/create-inscription.dto.ts`
- Modify: `services/education-service/src/inscriptions/inscriptions.service.ts`
- Modify: `services/education-service/src/inscriptions/inscriptions.controller.ts`
- Modify: `services/education-service/src/inscriptions/inscriptions.module.ts`
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`

- [ ] **Step 1: Delete the four Offerings files**

```bash
cd /Users/mac/Documents/smartcity
rm services/education-service/src/inscriptions/offerings.service.ts
rm services/education-service/src/inscriptions/offerings.controller.ts
rm services/education-service/src/inscriptions/dto/create-offering.dto.ts
rm services/education-service/src/inscriptions/dto/update-offering.dto.ts
```

- [ ] **Step 2: Rewrite `create-inscription.dto.ts`**

Full file contents:

```typescript
import { IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { InscriptionType } from '@prisma/client';

export class CreateInscriptionDto {
  @IsMongoId()
  studentId: string;

  @IsEnum(InscriptionType)
  type: InscriptionType;

  @IsString()
  @MinLength(1)
  category: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(2)
  method: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
```

`category` uses `@MinLength(1)` only (no whitelist) — deliberately matching app-injahi's own
disabled category validation, not tightening it.

- [ ] **Step 3: Rewrite `inscriptions.service.ts`**

Full file contents:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaymentsService } from '../finance/payments.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';

interface FindAllParams {
  page: number;
  limit: number;
  studentId?: string;
  type?: string;
}

const INCLUDE_RELATIONS = {
  student: true,
} as const;

@Injectable()
export class InscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async create(tenantId: string, dto: CreateInscriptionDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });
    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }

    const date = dto.date ? new Date(dto.date) : new Date();
    const typeLabel = dto.type === 'SOUTIEN' ? 'soutien' : 'formation';

    await this.paymentsService.create(tenantId, {
      studentId: dto.studentId,
      amount: dto.amount,
      method: dto.method,
      notes: dto.note ?? `Inscription ${typeLabel}: ${dto.category}`,
      date: date.toISOString(),
    });

    const inscription = await this.prisma.inscription.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        type: dto.type,
        category: dto.category,
        amount: dto.amount,
        date,
        note: dto.note,
      },
      include: INCLUDE_RELATIONS,
    });

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true },
    });

    return { ...inscription, tenantName: tenant?.name ?? '', method: dto.method };
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, studentId, type } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (studentId) where.studentId = studentId;
    if (type) where.type = type;

    const [inscriptions, total] = await Promise.all([
      this.prisma.inscription.findMany({
        where,
        skip,
        take: limit,
        include: INCLUDE_RELATIONS,
        orderBy: { date: 'desc' },
      }),
      this.prisma.inscription.count({ where }),
    ]);

    return {
      data: inscriptions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

Two important behavioral notes, both deliberate — do not treat either as something to "fix":

1. `paymentsService.create(...)` is called WITHOUT `category`/`description` overrides — the linked
   `Transaction` gets the generic default (`'Tuition Payment'`), matching app-injahi's own
   `createPayment()` which always hardcodes `'Paiement Scolarité'` regardless of what triggered it.
   The inscription-specific context goes into `notes` instead (mirroring app-injahi's
   `Payment.note: "Paiement pour inscription: ${type} - ${category}"`), using the caller's own
   `note` if provided, otherwise an auto-generated one.
2. The `paymentsService.create(...)` call is NOT wrapped in a try/catch. If it throws (e.g. a
   downstream Prisma error), `create` throws too and `POST /inscriptions` returns an error — no
   `Inscription` row gets created, and no silent partial state exists. This is the one place this
   revision deliberately does NOT match app-injahi (which swallows this exact failure) — confirmed
   with the user directly.

- [ ] **Step 4: Fix `inscriptions.controller.ts`'s `type` filter (already correct otherwise)**

The controller itself doesn't need changes — `findAll`'s `type` query param was already being
passed straight through to the service (`inscriptions.controller.ts` never referenced `Offering`
directly). Read the current file to confirm; if it's unchanged from before, no edit is needed here.
The fix that matters is inside `inscriptions.service.ts`'s `findAll` (Step 3 above): `where.type =
type` now filters `Inscription.type` directly (its own field), rather than the old
`where.offering = { type }` relation filter that no longer applies since the `offering` relation is
gone.

- [ ] **Step 5: Rewrite `inscriptions.module.ts`**

Full file contents:

```typescript
import { Module } from '@nestjs/common';
import { InscriptionsController } from './inscriptions.controller';
import { InscriptionsService } from './inscriptions.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [InscriptionsController],
  providers: [InscriptionsService, PrismaService],
})
export class InscriptionsModule {}
```

(Drops `OfferingsController`/`OfferingsService` from the imports and both arrays.)

- [ ] **Step 6: Remove the `/api/offerings` gateway route**

In `services/gateway/src/proxy/proxy.middleware.ts`, find:

```typescript
      '/api/offerings': educationServiceUrl,
      '/api/inscriptions': educationServiceUrl,
```

Change to:

```typescript
      '/api/inscriptions': educationServiceUrl,
```

- [ ] **Step 7: Verify the whole service builds**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/services/education-service && rm -f tsconfig.tsbuildinfo && pnpm exec nest build`
Expected: build succeeds with no errors.

Run: `cd /Users/mac/Documents/smartcity/services/gateway && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add services/education-service/src/inscriptions services/gateway/src/proxy/proxy.middleware.ts
git commit -m "fix(education-service): drop Offerings sub-feature, restore Inscription's direct type/category

InscriptionsService.create no longer looks up an Offering -- type and
category come directly from the request. The auto-created Payment's
linked Transaction stays generic ('Tuition Payment') instead of being
overridden with offering-specific category/description, matching
app-injahi's own createPayment() which always uses a fixed
'Paiement Scolarité' label. Unlike app-injahi, a payment-creation
failure now propagates as an error instead of being silently
swallowed -- confirmed with the user as a deliberate non-fidelity
choice."
```

---

## Task 4: Frontend hooks — delete Offerings, rewrite Inscriptions

**Files:**
- Delete: `apps/education-app/src/lib/offerings.ts`
- Modify: `apps/education-app/src/lib/inscriptions.ts`

- [ ] **Step 1: Delete `lib/offerings.ts`**

```bash
rm /Users/mac/Documents/smartcity/apps/education-app/src/lib/offerings.ts
```

- [ ] **Step 2: Rewrite `lib/inscriptions.ts`**

Full file contents:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IInscription, IStudent, InscriptionType } from '@smartcity/types';
import { apiClient } from './api';

export interface InscriptionWithRelations extends IInscription {
  student: IStudent;
}

export interface CreatedInscription extends InscriptionWithRelations {
  tenantName: string;
  method: string;
}

interface InscriptionListResponse {
  data: InscriptionWithRelations[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateInscriptionInput {
  studentId: string;
  type: InscriptionType;
  category: string;
  amount: number;
  method: string;
  note?: string;
}

export function useInscriptions(page = 1, limit = 20, studentId?: string) {
  return useQuery({
    queryKey: ['inscriptions', page, limit, studentId],
    queryFn: () =>
      apiClient<InscriptionListResponse>(
        `/inscriptions?page=${page}&limit=${limit}${studentId ? `&studentId=${studentId}` : ''}`,
      ),
  });
}

export function useCreateInscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInscriptionInput) =>
      apiClient<CreatedInscription>('/inscriptions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}
```

(Drops the `payment: { method: string }` field from `InscriptionWithRelations` too — that was
added in a post-review fix for the old offering-based table's method column; the rewritten page in
Task 7 doesn't need per-row payment method display since there's no `Payment` relation include
happening server-side for the list endpoint in this revision.)

- [ ] **Step 3: Verify it compiles (page.tsx not rewritten yet — expect errors there, not here)**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: errors only inside `src/app/[locale]/(admin)/inscriptions/page.tsx` and possibly
`src/components/ThermalReceipt.tsx` (both still reference the old offering-based shape — fixed in
Tasks 5 and 7). No errors inside `lib/inscriptions.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add apps/education-app/src/lib/inscriptions.ts
git rm apps/education-app/src/lib/offerings.ts
git commit -m "fix(education-app): drop Offerings hooks, restore Inscription's direct type/category"
```

---

## Task 5: `ThermalReceipt` — rename offering props to a generic item label

**Files:**
- Modify: `apps/education-app/src/components/ThermalReceipt.tsx`

- [ ] **Step 1: Rewrite the component**

Full file contents:

```tsx
'use client';

interface ThermalReceiptProps {
  tenantName: string;
  receiptId: string;
  date: string;
  studentName: string;
  itemLabel: string;
  method: string;
  amount: number;
  thankYouLabel: string;
  receiptLabel: string;
  dateLabel: string;
  studentLabel: string;
  itemFieldLabel: string;
  methodLabel: string;
}

export function ThermalReceipt({
  tenantName,
  receiptId,
  date,
  studentName,
  itemLabel,
  method,
  amount,
  thankYouLabel,
  receiptLabel,
  dateLabel,
  studentLabel,
  itemFieldLabel,
  methodLabel,
}: ThermalReceiptProps) {
  return (
    <div
      id="thermal-receipt"
      style={{ width: 384, padding: 8, fontFamily: 'monospace', color: '#000', background: '#fff' }}
    >
      <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{tenantName}</div>
      <div style={{ marginTop: 8 }}>{receiptLabel}: {receiptId}</div>
      <div>{dateLabel}: {date}</div>
      <div>{studentLabel}: {studentName}</div>
      <div>{itemFieldLabel}: {itemLabel}</div>
      <div>{methodLabel}: {method}</div>
      <div style={{ marginTop: 8, fontWeight: 'bold' }}>Montant: {amount} MAD</div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>--- {thankYouLabel} ---</div>
    </div>
  );
}
```

Two distinct props were needed here, not one: `itemLabel` is the DATA value (e.g. `"Soutien —
Mathématiques"`), while `itemFieldLabel` is the on-screen LABEL for that line (e.g. `"Article"` or
whatever the page passes) — same distinction the component already had between `studentName`
(data) and `studentLabel` (label), just renamed from `offeringName`/`offeringLabel` since
"offering" isn't a concept anymore.

- [ ] **Step 2: Verify it compiles (page.tsx not rewritten yet — expect errors there, not here)**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: errors only inside `src/app/[locale]/(admin)/inscriptions/page.tsx` (still passes the old
prop names — fixed in Task 7). No errors inside `ThermalReceipt.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add apps/education-app/src/components/ThermalReceipt.tsx
git commit -m "fix(education-app): rename ThermalReceipt's offering props to a generic item label"
```

---

## Task 6: i18n keys

**Files:**
- Modify: `packages/i18n/locales/en.json`
- Modify: `packages/i18n/locales/fr.json`
- Modify: `packages/i18n/locales/ar.json`

- [ ] **Step 1: Update `en.json`**

Find this block (the offering/inscription keys added by the original Inscriptions slice):

```json
    "inscriptions": "Inscriptions",
    "offerings": "Catalogue",
    "addOffering": "Add offering",
    "editOffering": "Edit offering",
    "offeringName": "Name",
    "offeringDescription": "Description (optional)",
    "offeringDuration": "Duration (optional)",
    "offeringPrice": "Price",
    "offeringTeacher": "Teacher (optional)",
    "offeringType": "Type",
    "noOfferingsYet": "No offerings in the catalogue yet.",
    "addInscription": "Add inscription",
    "inscriptionStudent": "Student",
    "inscriptionOffering": "Offering",
    "inscriptionAmount": "Amount",
    "inscriptionMethod": "Payment method",
    "inscriptionMethodOther": "Specify method",
    "inscriptionNote": "Note (optional)",
    "noInscriptionsYet": "No inscriptions recorded yet.",
    "totalInscriptions": "Total inscriptions",
    "soutienInscriptions": "Soutien",
    "formationInscriptions": "Formation",
    "typeSoutien": "Soutien",
    "typeFormation": "Formation",
    "methodCash": "Cash",
    "methodCard": "Card",
    "methodTransfer": "Bank transfer",
    "methodCheck": "Check",
    "methodOther": "Other",
    "printReceipt": "Print receipt",
    "receiptLabel": "Receipt",
    "receiptDate": "Date",
    "receiptStudent": "Student",
    "receiptOffering": "Offering",
    "receiptMethod": "Method",
    "receiptThankYou": "Thank you"
```

Replace it with:

```json
    "inscriptions": "Inscriptions",
    "addInscription": "Add inscription",
    "inscriptionStudent": "Student",
    "inscriptionType": "Type",
    "inscriptionCategory": "Category",
    "inscriptionAmount": "Amount",
    "inscriptionMethod": "Payment method",
    "inscriptionMethodOther": "Specify method",
    "inscriptionNote": "Note (optional)",
    "noInscriptionsYet": "No inscriptions recorded yet.",
    "totalInscriptions": "Total inscriptions",
    "soutienInscriptions": "Soutien",
    "formationInscriptions": "Formation",
    "typeSoutien": "Soutien",
    "typeFormation": "Formation",
    "categoryMath": "Math",
    "categoryPhysique": "Physics",
    "categorySvt": "Life & Earth Sciences",
    "categoryFrancais": "French",
    "categoryAnglais": "English",
    "categoryCalculMental": "Mental arithmetic",
    "categoryCouran": "Quran",
    "categoryCoiffure": "Hairdressing",
    "categoryBureautique": "Office skills",
    "categoryEcommerce": "E-commerce",
    "categoryAutre": "Other",
    "methodCash": "Cash",
    "methodCard": "Card",
    "methodTransfer": "Bank transfer",
    "methodCheck": "Check",
    "methodOther": "Other",
    "printReceipt": "Print receipt",
    "receiptLabel": "Receipt",
    "receiptDate": "Date",
    "receiptStudent": "Student",
    "receiptItem": "Item",
    "receiptMethod": "Method",
    "receiptThankYou": "Thank you"
```

- [ ] **Step 2: Update `fr.json`**

Find the equivalent block:

```json
    "inscriptions": "Inscriptions",
    "offerings": "Catalogue",
    "addOffering": "Ajouter une offre",
    "editOffering": "Modifier l'offre",
    "offeringName": "Nom",
    "offeringDescription": "Description (optionnel)",
    "offeringDuration": "Durée (optionnel)",
    "offeringPrice": "Prix",
    "offeringTeacher": "Enseignant (optionnel)",
    "offeringType": "Type",
    "noOfferingsYet": "Aucune offre dans le catalogue pour l'instant.",
    "addInscription": "Ajouter une inscription",
    "inscriptionStudent": "Étudiant",
    "inscriptionOffering": "Offre",
    "inscriptionAmount": "Montant",
    "inscriptionMethod": "Mode de paiement",
    "inscriptionMethodOther": "Préciser le mode",
    "inscriptionNote": "Note (optionnel)",
    "noInscriptionsYet": "Aucune inscription enregistrée pour l'instant.",
    "totalInscriptions": "Total des inscriptions",
    "soutienInscriptions": "Soutien",
    "formationInscriptions": "Formation",
    "typeSoutien": "Soutien",
    "typeFormation": "Formation",
    "methodCash": "Espèces",
    "methodCard": "Carte bancaire",
    "methodTransfer": "Virement bancaire",
    "methodCheck": "Chèque",
    "methodOther": "Autre",
    "printReceipt": "Imprimer le reçu",
    "receiptLabel": "Reçu",
    "receiptDate": "Date",
    "receiptStudent": "Étudiant",
    "receiptOffering": "Offre",
    "receiptMethod": "Méthode",
    "receiptThankYou": "Merci"
```

Replace it with:

```json
    "inscriptions": "Inscriptions",
    "addInscription": "Ajouter une inscription",
    "inscriptionStudent": "Étudiant",
    "inscriptionType": "Type",
    "inscriptionCategory": "Catégorie",
    "inscriptionAmount": "Montant",
    "inscriptionMethod": "Mode de paiement",
    "inscriptionMethodOther": "Préciser le mode",
    "inscriptionNote": "Note (optionnel)",
    "noInscriptionsYet": "Aucune inscription enregistrée pour l'instant.",
    "totalInscriptions": "Total des inscriptions",
    "soutienInscriptions": "Soutien",
    "formationInscriptions": "Formation",
    "typeSoutien": "Soutien",
    "typeFormation": "Formation",
    "categoryMath": "Math",
    "categoryPhysique": "Physique",
    "categorySvt": "SVT",
    "categoryFrancais": "Français",
    "categoryAnglais": "Anglais",
    "categoryCalculMental": "Calcul mental",
    "categoryCouran": "Coran",
    "categoryCoiffure": "Coiffure",
    "categoryBureautique": "Bureautique",
    "categoryEcommerce": "E-commerce",
    "categoryAutre": "Autre",
    "methodCash": "Espèces",
    "methodCard": "Carte bancaire",
    "methodTransfer": "Virement bancaire",
    "methodCheck": "Chèque",
    "methodOther": "Autre",
    "printReceipt": "Imprimer le reçu",
    "receiptLabel": "Reçu",
    "receiptDate": "Date",
    "receiptStudent": "Étudiant",
    "receiptItem": "Article",
    "receiptMethod": "Méthode",
    "receiptThankYou": "Merci"
```

- [ ] **Step 3: Update `ar.json`**

Find the equivalent block:

```json
    "inscriptions": "التسجيلات",
    "offerings": "الكتالوج",
    "addOffering": "إضافة عرض",
    "editOffering": "تعديل العرض",
    "offeringName": "الاسم",
    "offeringDescription": "الوصف (اختياري)",
    "offeringDuration": "المدة (اختياري)",
    "offeringPrice": "الثمن",
    "offeringTeacher": "الأستاذ (اختياري)",
    "offeringType": "النوع",
    "noOfferingsYet": "لا توجد عروض في الكتالوج بعد.",
    "addInscription": "إضافة تسجيل",
    "inscriptionStudent": "الطالب",
    "inscriptionOffering": "العرض",
    "inscriptionAmount": "المبلغ",
    "inscriptionMethod": "طريقة الأداء",
    "inscriptionMethodOther": "حدد الطريقة",
    "inscriptionNote": "ملاحظة (اختياري)",
    "noInscriptionsYet": "لا توجد تسجيلات مسجلة بعد.",
    "totalInscriptions": "إجمالي التسجيلات",
    "soutienInscriptions": "دعم",
    "formationInscriptions": "تكوين",
    "typeSoutien": "دعم",
    "typeFormation": "تكوين",
    "methodCash": "نقدا",
    "methodCard": "بطاقة بنكية",
    "methodTransfer": "تحويل بنكي",
    "methodCheck": "شيك",
    "methodOther": "أخرى",
    "printReceipt": "طباعة الوصل",
    "receiptLabel": "الوصل",
    "receiptDate": "التاريخ",
    "receiptStudent": "الطالب",
    "receiptOffering": "العرض",
    "receiptMethod": "الطريقة",
    "receiptThankYou": "شكرا"
```

Replace it with:

```json
    "inscriptions": "التسجيلات",
    "addInscription": "إضافة تسجيل",
    "inscriptionStudent": "الطالب",
    "inscriptionType": "النوع",
    "inscriptionCategory": "الفئة",
    "inscriptionAmount": "المبلغ",
    "inscriptionMethod": "طريقة الأداء",
    "inscriptionMethodOther": "حدد الطريقة",
    "inscriptionNote": "ملاحظة (اختياري)",
    "noInscriptionsYet": "لا توجد تسجيلات مسجلة بعد.",
    "totalInscriptions": "إجمالي التسجيلات",
    "soutienInscriptions": "دعم",
    "formationInscriptions": "تكوين",
    "typeSoutien": "دعم",
    "typeFormation": "تكوين",
    "categoryMath": "الرياضيات",
    "categoryPhysique": "الفيزياء",
    "categorySvt": "علوم الحياة والأرض",
    "categoryFrancais": "الفرنسية",
    "categoryAnglais": "الإنجليزية",
    "categoryCalculMental": "الحساب الذهني",
    "categoryCouran": "القرآن",
    "categoryCoiffure": "الحلاقة",
    "categoryBureautique": "المكتبية",
    "categoryEcommerce": "التجارة الإلكترونية",
    "categoryAutre": "أخرى",
    "methodCash": "نقدا",
    "methodCard": "بطاقة بنكية",
    "methodTransfer": "تحويل بنكي",
    "methodCheck": "شيك",
    "methodOther": "أخرى",
    "printReceipt": "طباعة الوصل",
    "receiptLabel": "الوصل",
    "receiptDate": "التاريخ",
    "receiptStudent": "الطالب",
    "receiptItem": "العنصر",
    "receiptMethod": "الطريقة",
    "receiptThankYou": "شكرا"
```

- [ ] **Step 4: Verify all three files are valid JSON**

Run: `python3 -c "import json; [json.load(open(f'/Users/mac/Documents/smartcity/packages/i18n/locales/{l}.json')) for l in ['en','fr','ar']]; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/locales/en.json packages/i18n/locales/fr.json packages/i18n/locales/ar.json
git commit -m "fix(i18n): replace offering keys with category keys for the fidelity revision"
```

---

## Task 7: Inscriptions page — full rewrite

**Files:**
- Modify: `apps/education-app/src/app/[locale]/(admin)/inscriptions/page.tsx`

- [ ] **Step 1: Rewrite the page**

Full file contents:

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { ClipboardList, GraduationCap, BookOpen, Printer } from 'lucide-react';
import { Button, Input, Badge, Modal, Skeleton } from '@smartcity/ui';
import { InscriptionType } from '@smartcity/types';
import { useStudents } from '@/lib/students';
import {
  useInscriptions,
  useCreateInscription,
  type CreatedInscription,
} from '@/lib/inscriptions';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';
import { InitialsAvatar } from '@/components/InitialsAvatar';
import { ThermalReceipt } from '@/components/ThermalReceipt';

const PAYMENT_METHODS = [
  { value: 'Espèces', labelKey: 'education.methodCash' },
  { value: 'Carte bancaire', labelKey: 'education.methodCard' },
  { value: 'Virement bancaire', labelKey: 'education.methodTransfer' },
  { value: 'Chèque', labelKey: 'education.methodCheck' },
  { value: 'Autre', labelKey: 'education.methodOther' },
] as const;

const TYPE_LABEL_KEY: Record<InscriptionType, string> = {
  [InscriptionType.SOUTIEN]: 'education.typeSoutien',
  [InscriptionType.FORMATION]: 'education.typeFormation',
};

const SOUTIEN_CATEGORIES = [
  { value: 'math', labelKey: 'education.categoryMath' },
  { value: 'physique', labelKey: 'education.categoryPhysique' },
  { value: 'svt', labelKey: 'education.categorySvt' },
  { value: 'francais', labelKey: 'education.categoryFrancais' },
  { value: 'anglais', labelKey: 'education.categoryAnglais' },
  { value: 'calcul_mental', labelKey: 'education.categoryCalculMental' },
  { value: 'couran', labelKey: 'education.categoryCouran' },
  { value: 'autre', labelKey: 'education.categoryAutre' },
] as const;

const FORMATION_CATEGORIES = [
  { value: 'coiffure', labelKey: 'education.categoryCoiffure' },
  { value: 'bureautique', labelKey: 'education.categoryBureautique' },
  { value: 'ecommerce', labelKey: 'education.categoryEcommerce' },
  { value: 'autre', labelKey: 'education.categoryAutre' },
] as const;

interface InscriptionFormState {
  studentId: string;
  type: InscriptionType;
  category: string;
  otherCategory: string;
  amount: string;
  method: string;
  otherMethod: string;
  note: string;
}

const EMPTY_INSCRIPTION_FORM: InscriptionFormState = {
  studentId: '',
  type: InscriptionType.SOUTIEN,
  category: 'math',
  otherCategory: '',
  amount: '',
  method: 'Espèces',
  otherMethod: '',
  note: '',
};

export default function InscriptionsPage() {
  const { t } = useTranslation();

  const { data: studentsData } = useStudents(1, 100);
  const { data: inscriptionsData, isLoading: isLoadingInscriptions } = useInscriptions(1, 100);

  const createInscription = useCreateInscription();

  const [isInscriptionModalOpen, setIsInscriptionModalOpen] = useState(false);
  const [inscriptionForm, setInscriptionForm] = useState<InscriptionFormState>(EMPTY_INSCRIPTION_FORM);
  const [inscriptionError, setInscriptionError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<CreatedInscription | null>(null);

  const openCreateInscriptionModal = () => {
    setInscriptionForm(EMPTY_INSCRIPTION_FORM);
    setInscriptionError(null);
    setLastCreated(null);
    setIsInscriptionModalOpen(true);
  };

  const handleTypeChange = (type: InscriptionType) => {
    const defaultCategory = type === InscriptionType.SOUTIEN ? 'math' : 'coiffure';
    setInscriptionForm({ ...inscriptionForm, type, category: defaultCategory, otherCategory: '' });
  };

  const handleInscriptionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setInscriptionError(null);

    const category =
      inscriptionForm.category === 'autre' ? inscriptionForm.otherCategory : inscriptionForm.category;
    const method =
      inscriptionForm.method === 'Autre' ? inscriptionForm.otherMethod : inscriptionForm.method;

    try {
      const created = await createInscription.mutateAsync({
        studentId: inscriptionForm.studentId,
        type: inscriptionForm.type,
        category,
        amount: Number(inscriptionForm.amount),
        method,
        note: inscriptionForm.note || undefined,
      });
      setLastCreated(created);
    } catch (err) {
      setInscriptionError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const inscriptions = inscriptionsData?.data ?? [];
  const soutienCount = inscriptions.filter((i) => i.type === InscriptionType.SOUTIEN).length;
  const formationCount = inscriptions.filter((i) => i.type === InscriptionType.FORMATION).length;

  const categoryOptions =
    inscriptionForm.type === InscriptionType.SOUTIEN ? SOUTIEN_CATEGORIES : FORMATION_CATEGORIES;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.inscriptions')}</h1>
        <Button onClick={openCreateInscriptionModal}>{t('education.addInscription')}</Button>
      </div>

      {!isLoadingInscriptions && inscriptions.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={ClipboardList}
            color="teal"
            label={t('education.totalInscriptions')}
            value={inscriptions.length}
          />
          <StatCard
            icon={GraduationCap}
            color="teal"
            label={t('education.soutienInscriptions')}
            value={soutienCount}
          />
          <StatCard
            icon={BookOpen}
            color="teal"
            label={t('education.formationInscriptions')}
            value={formationCount}
          />
        </div>
      )}

      {isLoadingInscriptions && <Skeleton height="4rem" />}

      {!isLoadingInscriptions && inscriptions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-500">
            <ClipboardList size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noInscriptionsYet')}</p>
        </div>
      )}

      {!isLoadingInscriptions && inscriptions.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.inscriptionStudent')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.inscriptionType')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.inscriptionCategory')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.inscriptionAmount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {inscriptions.map((inscription) => (
                <tr key={inscription.id} className="border-b border-gray-100 last:border-0 hover:bg-teal-50/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={`${inscription.student.firstName} ${inscription.student.lastName}`}
                        color="indigo"
                      />
                      <span className="font-medium text-gray-900">
                        {inscription.student.firstName} {inscription.student.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant={inscription.type === InscriptionType.SOUTIEN ? 'info' : 'success'}>
                      {t(TYPE_LABEL_KEY[inscription.type])}
                    </Badge>
                  </td>
                  <td className="p-3 text-gray-600">{inscription.category}</td>
                  <td className="p-3 text-gray-600">{inscription.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isInscriptionModalOpen}
        onClose={() => setIsInscriptionModalOpen(false)}
        title={t('education.addInscription')}
        footer={
          lastCreated ? (
            <>
              <Button variant="outline" onClick={() => setIsInscriptionModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handlePrint}>
                <Printer size={16} className="me-2" />
                {t('education.printReceipt')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsInscriptionModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleInscriptionSubmit} loading={createInscription.isPending}>
                {t('common.save')}
              </Button>
            </>
          )
        }
      >
        {!lastCreated && (
          <form onSubmit={handleInscriptionSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionStudent')}
              </label>
              <select
                value={inscriptionForm.studentId}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, studentId: e.target.value })}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="" disabled>
                  —
                </option>
                {(studentsData?.data ?? []).map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.firstName} {student.lastName} ({student.registrationNumber})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">{t('education.inscriptionType')}</label>
              <select
                value={inscriptionForm.type}
                onChange={(e) => handleTypeChange(e.target.value as InscriptionType)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={InscriptionType.SOUTIEN}>{t('education.typeSoutien')}</option>
                <option value={InscriptionType.FORMATION}>{t('education.typeFormation')}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionCategory')}
              </label>
              <select
                value={inscriptionForm.category}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, category: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            {inscriptionForm.category === 'autre' && (
              <Input
                label={t('education.inscriptionCategory')}
                value={inscriptionForm.otherCategory}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, otherCategory: e.target.value })}
                required
              />
            )}
            <Input
              label={t('education.inscriptionAmount')}
              type="number"
              min="0.01"
              step="0.01"
              value={inscriptionForm.amount}
              onChange={(e) => setInscriptionForm({ ...inscriptionForm, amount: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionMethod')}
              </label>
              <select
                value={inscriptionForm.method}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, method: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            {inscriptionForm.method === 'Autre' && (
              <Input
                label={t('education.inscriptionMethodOther')}
                value={inscriptionForm.otherMethod}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, otherMethod: e.target.value })}
                required
              />
            )}
            <Input
              label={t('education.inscriptionNote')}
              value={inscriptionForm.note}
              onChange={(e) => setInscriptionForm({ ...inscriptionForm, note: e.target.value })}
            />
            {inscriptionError && <p className="text-sm text-red-600">{inscriptionError}</p>}
          </form>
        )}

        {lastCreated && (
          <>
            <div className="print:hidden">
              <p className="text-sm text-gray-600">
                {lastCreated.student.firstName} {lastCreated.student.lastName} — {t(TYPE_LABEL_KEY[lastCreated.type])}: {lastCreated.category}
              </p>
            </div>
            <div className="hidden print:block">
              <ThermalReceipt
                tenantName={lastCreated.tenantName}
                receiptId={lastCreated.id}
                date={new Date(lastCreated.date).toLocaleDateString()}
                studentName={`${lastCreated.student.firstName} ${lastCreated.student.lastName}`}
                itemLabel={`${t(TYPE_LABEL_KEY[lastCreated.type])} — ${lastCreated.category}`}
                method={lastCreated.method}
                amount={lastCreated.amount}
                thankYouLabel={t('education.receiptThankYou')}
                receiptLabel={t('education.receiptLabel')}
                dateLabel={t('education.receiptDate')}
                studentLabel={t('education.receiptStudent')}
                itemFieldLabel={t('education.receiptItem')}
                methodLabel={t('education.receiptMethod')}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
```

Notes on this rewrite:
- The whole Catalogue section, `OfferingFormState`, `editingOffering`, `useTeachers` import, and
  the `Pencil` icon import are all gone — there's no catalog to manage anymore.
- `handleTypeChange` resets `category` to a sensible default for the newly-selected type (`'math'`
  for SOUTIEN, `'coiffure'` for FORMATION) so the category select never shows a stale value from
  the other type's list.
- The category `<select>`'s options come from `SOUTIEN_CATEGORIES`/`FORMATION_CATEGORIES` — ported
  directly from app-injahi's `frontend/types/index.ts` constants, matching that reference exactly.
- Amount is no longer prefilled from anything (there's no catalog price to read) — plain manual
  entry, matching app-injahi's own form (which also has no price-lookup prefill for inscriptions).

- [ ] **Step 2: Verify it compiles and builds**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec next build`
Expected: build succeeds, route table includes `/[locale]/inscriptions`.

IMPORTANT: do not run `next build` while a `next dev` server is running in the same directory —
stop any running dev server first, or `rm -rf .next` before building if you see stale-cache errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/education-app/src/app/[locale]/(admin)/inscriptions/page.tsx"
git commit -m "fix(education-app): rewrite Inscriptions page without the Offering catalogue

Drops the Catalogue section and offering picker entirely, replacing
it with type+category selects populated from app-injahi's own
hardcoded SOUTIEN/FORMATION category lists -- matches app-injahi's
actual field-tested form shape instead of the admin-manageable
catalog concept the original slice introduced."
```

---

## Task 8: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend and frontend**

Start `user-service`, `gateway`, `education-service`, `education-app`, plus a local
`redis-server`, per prior Education testing sessions' setup notes.

- [ ] **Step 2: Log in and create an inscription via curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test-education.local","password":"TestEdu123!"}' \
  -o /tmp/login.json && python3 -c "import json; print(json.load(open('/tmp/login.json'))['accessToken'])")

STUDENT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/students \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT_ID\",\"type\":\"SOUTIEN\",\"category\":\"math\",\"amount\":300,\"method\":\"Espèces\"}" \
  http://localhost:3004/inscriptions
```

Expected: JSON response with the created inscription — `type: "SOUTIEN"`, `category: "math"`, a
nested `student` object, plus `tenantName` and `method` fields at the top level. NO `offeringId`
or `paymentId` field anywhere in the response.

- [ ] **Step 3: Verify the linked Transaction stays generic (not category-specific)**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3004/finance/transactions?limit=3"
```

Expected: the most recent transaction has `category: "Tuition Payment"` (the generic default, NOT
`"math"` or any category-specific label) — confirming the ledger stays generic, matching
app-injahi's `'Paiement Scolarité'` behavior.

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3004/finance/payments?limit=3"
```

Expected: the most recent payment's `notes` field reads something like `"Inscription soutien:
math"` (the inscription context, carried on `Payment.notes` instead of the `Transaction`).

- [ ] **Step 4: Verify `/api/offerings` no longer exists**

```bash
curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/offerings
```

Expected: NOT a 200 — either a 404 (gateway has no route for it) or a connection/proxy error,
confirming the route was actually removed, not just unused.

- [ ] **Step 5: Verify the UI end-to-end in the browser**

Open `http://localhost:3103/fr/login`, log in, go to "Inscriptions". Confirm there's no
"Catalogue" section anymore — just the inscriptions table and stat cards. Click "Ajouter une
inscription", select a student, switch the type between Soutien and Formation and confirm the
category dropdown's options change accordingly, select "Autre" for category and confirm a text
input appears, fill in an amount and a payment method (try "Autre" for method too), submit, confirm
the modal switches to "Imprimer le reçu", click it, confirm the browser's print preview shows the
receipt with the category-derived item line (not an offering name) and all other fields populated
correctly.

- [ ] **Step 6: Report results**

No commit for this task — it's verification only. If any step fails, fix the underlying code in
the relevant earlier task and re-commit there, then re-run this task's steps.
