# Hotel Administrative Management — Expenses Module (Sub-project 1/5)

## Context

SmartCity Tourism currently has no way for a hotel/riad/maison d'hôte to track its own
internal operating costs. The user asked for a broader "hotel administrative management"
capability covering salary/payroll, stock/inventory, expenses, purchases, and accounting,
scoped for small hospitality businesses (not an enterprise ERP), usable by the hotel's
`ADMIN`/`MANAGER` and a new `ACCOUNTANT` role.

This is decomposed into 5 ordered sub-projects, each with its own spec → plan → implementation
cycle:

1. **Expenses** (this spec) — base building block; every purchase/payroll entry will
   eventually also post as an expense.
2. **Stock/Inventory** — connects to the existing `ServiceOrder` (minibar/room-service) model.
3. **Purchases** — feeds stock, posts as an expense.
4. **Salary/Payroll** — tied to `User` (staff).
5. **Accounting** — a reporting layer over all of the above (P&L, summaries); built last
   because it depends on the others.

## Scope of this spec: Expenses

Free-form, category-based expense tracking for a hotel tenant, with direct (unapproved)
entry — no approval workflow, no recurring-expense automation. Optimized for how a small
riad/hotel actually operates: fast entry, simple category totals, receipt photo attached
for audit/accountant reference.

## Architecture Decision

New microservice `finance-service` (port 3008), following the same pattern as
`billing-service`: NestJS + Prisma (`@smartcity/database`) + JWT guard + `RolesGuard` +
tenant-scoping guard pattern already used in `tourism-service`.

Rationale: 5 sub-projects are coming, all under the same "hotel finance/administration"
domain, logically distinct from guest-facing operations. Grouping them avoids further
bloating `tourism-service` (already the largest service: hotels, rooms, bookings, orders,
restaurants, activities, reviews, messages, qr). Housing them together also lets Stock,
Purchases, Salary, and Accounting share Prisma models and tenant-scoping utilities within
one service without cross-service calls.

## Data Model (Prisma, added to `packages/database/prisma/schema.prisma`)

```prisma
model ExpenseCategory {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String   @db.ObjectId
  name      String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Expense {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId     String   @db.ObjectId
  hotelId      String?  @db.ObjectId
  categoryId   String   @db.ObjectId
  amount       Float
  currency     String
  description  String?
  receiptUrl   String?
  date         DateTime
  createdById  String   @db.ObjectId
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Notes:
- `hotelId` is optional: a `null` value means the expense is tenant-wide (relevant for
  tenants that own more than one `Hotel`); when set, it must belong to the same tenant as
  the requesting user.
- `currency` defaults to `tenant.currency` (already on the `Tenant` model, default `"MAD"`)
  at creation time but is stored per-expense so historical entries aren't affected if a
  tenant's default currency ever changes.
- On tenant creation, seed default `ExpenseCategory` rows (`isDefault: true`): Utilities,
  Maintenance, Cleaning, Marketing, Salaries (placeholder until the Payroll sub-project
  exists), Supplies, Other. `ADMIN` can add/rename/remove categories freely — no hardcoded
  enum, so no code deploy is needed to change categories.

## Role Model Change

Add `ACCOUNTANT` to the shared `UserRole` enum in both:
- `packages/shared-types/src/user.types.ts`
- `packages/database/prisma/schema.prisma` (`UserRole` enum)

`ACCOUNTANT` is tenant-scoped like `ADMIN`/`MANAGER`/`STAFF` (not a cross-tenant role like
`SUPER_ADMIN`).

## API (`finance-service`, port 3008)

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/expenses` | ADMIN, MANAGER, ACCOUNTANT | Create expense (direct, no approval step) |
| GET | `/expenses` | ADMIN, MANAGER, ACCOUNTANT | List, filterable by `categoryId`, `hotelId`, date range |
| GET | `/expenses/:id` | ADMIN, MANAGER, ACCOUNTANT | Detail |
| PATCH | `/expenses/:id` | ADMIN, ACCOUNTANT | Update |
| DELETE | `/expenses/:id` | ADMIN | Delete |
| GET | `/expenses/summary` | ADMIN, MANAGER, ACCOUNTANT | Totals grouped by category and by month (e.g. `?month=2026-08`) |
| GET | `/expense-categories` | ADMIN, MANAGER, ACCOUNTANT | List categories |
| POST | `/expense-categories` | ADMIN | Create category |
| PATCH | `/expense-categories/:id` | ADMIN | Rename category |
| DELETE | `/expense-categories/:id` | ADMIN | Remove category — blocked (409) if any `Expense` references it |

`SUPER_ADMIN` bypasses role checks everywhere per the existing `RolesGuard` pattern.

## Tenant Scoping

Every read/write is scoped to `req.user.tenantId`, matching the ownership-check pattern
already used for `bookings`/`orders` in `tourism-service` (the pattern that fixed the
cross-tenant leak found in the bookings module). If `hotelId` is supplied, the service
must verify that hotel belongs to the same tenant before accepting it.

## Gateway

Add routing in `services/gateway`:
- `/api/expenses/*` → `finance-service` (3008)
- `/api/expense-categories/*` → `finance-service` (3008)

## Out of Scope (deferred to later sub-projects or explicitly rejected)

- Approval workflow (PENDING → APPROVED/REJECTED) — rejected for this stage; direct entry only.
- Recurring/auto-generated expenses — rejected for this stage; manual entry only.
- Linking expenses to `Purchase` records — will happen when the Purchases sub-project is
  built (an accepted purchase will post an `Expense` row).
- Full accounting reports (P&L, cash flow) — deferred to the Accounting sub-project; this
  spec only provides category/month summary totals.

## Testing Considerations

- Tenant isolation: staff of tenant A must not read/write/see totals for tenant B's expenses.
- Role checks: STAFF must be rejected on all expense endpoints.
- `hotelId` cross-tenant guard: rejecting a `hotelId` belonging to another tenant.
- Category deletion is blocked (409) when any `Expense` still references it.
