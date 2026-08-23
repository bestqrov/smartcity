# Education: Finance Module Design

## Goal

Add a fifth full-stack slice to the Education vertical — a Finance module (student payments +
general transaction ledger) — continuing the established pattern of porting a module from the
user's reference project (`bestqrov/app-injahi`) into `education-service`/`education-app` as a
proper multi-tenant SaaS slice, scoped down deliberately where app-injahi's version is broader
than what's needed here.

## What's being ported, and what's deliberately left out

app-injahi's Finance domain has three models: `Payment` (a student's tuition payment, which
auto-creates a linked `Transaction`), `Transaction` (a general INCOME/EXPENSE ledger), and
`Pricing` (a price catalog keyed by category/level/subject). Its `payments.service.ts` shows the
pattern worth keeping: creating a `Payment` automatically inserts a corresponding `INCOME`
`Transaction` row in the same call, so the general ledger and the per-student payment history stay
consistent without the caller having to do two separate writes.

This slice ports `Payment` and `Transaction` with that auto-linking behavior. It deliberately
**does not** port:
- **`Pricing`** — a price catalog tied to category/level/subject presumes the fuller academic
  structure (Program/Subject/Level as real entities) that every prior Education slice in this
  repo has explicitly deferred (see the Teachers/Groups plan's "Deviations" section). Without
  that structure, a pricing catalog has nothing real to key off of yet.
- **Teacher payroll / salary payments** — app-injahi has a separate `salary-payments` module that
  projects monthly teacher expenses from `Teacher.hourlyRate`. That's a distinct HR-adjacent
  feature or entities than tuition income/expense tracking, and was already explicitly deferred
  when the Teachers module was built ("No HR features (contracts, payroll, performance
  reviews)").

## Data model

Two new Prisma models, tenant-scoped like every other Education model:

```prisma
enum TransactionType {
  INCOME
  EXPENSE
}

model Transaction {
  id          String          @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String          @db.ObjectId
  type        TransactionType
  amount      Float
  category    String
  description String?
  date        DateTime
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("transactions")
}

model Payment {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId      String   @db.ObjectId
  studentId     String   @db.ObjectId
  transactionId String   @db.ObjectId
  amount        Float
  method        String
  notes         String?
  date          DateTime
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  student     Student     @relation(fields: [studentId], references: [id])
  transaction Transaction @relation(fields: [transactionId], references: [id])

  @@map("payments")
}
```

`Payment.transactionId` is the one deliberate improvement over app-injahi's shape: app-injahi's
`Payment` and `Transaction` have no foreign-key link between them at all (the transaction is just
created alongside, with no relation field pointing back), so there is no way to trace a ledger
entry back to the payment that produced it, or to prevent the two from drifting apart. This slice
makes that link explicit and required — a `Payment` cannot exist without its `Transaction`, and
they are created together in a single service call (see below), never independently.

`Tenant` gains `transactions Transaction[]` and `payments Payment[]` back-refs; `Student` gains a
`payments Payment[]` back-ref.

`method` stays a free-text string (not an enum) — app-injahi does the same, and a fixed set of
payment methods (cash/card/transfer/check) varies enough by institution that a string is the
pragmatic choice here, consistent with `Group.level`/`Group.subject` also staying free-text
strings in the Teachers/Groups slice for the same kind of reason.

## Backend (`education-service`)

New `finance/` module with two services sharing one Prisma transaction for the auto-link:

- **`TransactionsService`**:
  - `create(tenantId, dto)` — plain create, used both directly (manual expense/income entries)
    and internally by `PaymentsService`.
  - `findAll(tenantId, params)` — paginated, optional `type` filter.
  - `getStats(tenantId)` — `{ totalIncome, totalExpense, balance }` across all tenant
    transactions (not scoped to the current month — app-injahi's `getPaymentAnalytics` scopes to
    "this month" for a dashboard view, but a simple all-time balance is the more useful default
    for a first slice; month-scoping can be added later as a filter param without a breaking
    change).

- **`PaymentsService`**:
  - `create(tenantId, dto)` — validates `studentId` belongs to the tenant, then uses
    `prisma.$transaction([...])` to create the `Transaction` (`type: INCOME`, `category:
    "Tuition Payment"`, `description` built from the student's name and payment method) and the
    `Payment` (referencing the new transaction's id) atomically — either both are written or
    neither is, closing the exact consistency gap app-injahi's two-separate-calls approach leaves
    open.
  - `findAll(tenantId, params)` — paginated, includes `student: true`.
  - `findByStudent(tenantId, studentId)` — a student's payment history, newest first.

- **`FinanceController`** (`@Controller('finance')`, both resources under one controller since
  they're small and tightly coupled — matches how `GroupsController`/`GroupStudentsController`
  stayed as two controllers in one module when the coupling was through a join table, but here
  `Payment` directly owns the `Transaction` relationship, so one controller with clearly-prefixed
  routes is the better fit):

```
POST /finance/payments           ADMIN, MANAGER, STAFF
GET  /finance/payments           (any authenticated tenant user) — ?studentId=X or unfiltered+paginated
POST /finance/transactions       ADMIN, MANAGER
GET  /finance/transactions       (any authenticated tenant user) — paginated, ?type=X
GET  /finance/stats              (any authenticated tenant user)
```

Registered in `app.module.ts`. Gateway gets one new route: `'/api/finance': educationServiceUrl`.

## Frontend (`education-app`)

- **`src/lib/finance.ts`** — TanStack Query hooks: `usePayments(page, limit, studentId?)`,
  `useCreatePayment()`, `useTransactions(page, limit, type?)`, `useCreateTransaction()`,
  `useFinanceStats()`.
- **New page `src/app/[locale]/(admin)/finance/page.tsx`** ("Finance" in the sidebar, reusing the
  `amber` accent is already taken by Guardians — pick a fresh one: `emerald`... already `primary`.
  Use `green` explicitly as a distinct Tailwind shade from `primary` (emerald) to avoid visual
  collision, since Finance is conceptually adjacent to but distinct from the Students section):
  - Three `StatCard`s at the top: total income, total expenses, balance (from `useFinanceStats`).
  - A "Payments" table (student name, amount, method, date) with an "Add payment" button opening
    a modal (select student, amount, method, optional notes).
  - A "Transactions" table below it (type badge INCOME/EXPENSE, category, amount, date) with an
    "Add transaction" button opening a modal (type select, amount, category, optional
    description) — for manual entries like rent or utilities that aren't tied to a student
    payment.
- Sidebar nav gains a "Finance" entry (`Wallet` icon from `lucide-react`, `green` accent),
  positioned after Présence.

## i18n

New `education.*` keys in `en.json`/`fr.json`/`ar.json`: `finance`, `totalIncome`,
`totalExpenses`, `balance`, `payments`, `addPayment`, `paymentAmount`, `paymentMethod`,
`paymentNotes`, `paymentStudent`, `noPaymentsYet`, `transactions`, `addTransaction`,
`transactionType`, `transactionAmount`, `transactionCategory`, `transactionDescription`,
`noTransactionsYet`, `typeIncome`, `typeExpense`.

## Out of scope (explicitly deferred, same rationale as prior slices)

- Pricing catalog (needs real Program/Subject/Level entities first).
- Teacher payroll / salary payments (separate HR feature, already deferred with Teachers).
- Month-scoped dashboard stats, receipts/PDF generation, "Salles" (room billing) — none of these
  exist as working features in app-injahi's own reference either (or are out of this slice's
  reasonable size).

## Testing

Same as every prior Education slice: no test harness exists anywhere in this repo. Verification
is `tsc --noEmit`, `nest build`, and manual `curl` + Playwright checks before merging.
