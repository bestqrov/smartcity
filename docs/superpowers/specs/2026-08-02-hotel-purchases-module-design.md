# Hotel Administrative Management — Purchases Module (Sub-project 3/5)

## Context

Third of 5 sub-projects under "hotel administrative management" (see
[2026-08-02-hotel-expenses-module-design.md](2026-08-02-hotel-expenses-module-design.md) for
the roadmap and `finance-service` architecture decision). Sub-project 1 (Expenses) and
sub-project 2 (Stock/Inventory) are complete, reviewed, and merged into the
`worktree-hotel-expenses-module` branch (not yet merged to `main`).

Per the roadmap, "Purchases feeds stock, posts as an expense" — this sub-project is the
integration point between the two already-built systems, living in the same `finance-service`
(port 3008).

## Scope

Multi-line purchase orders (a single purchase from one vendor can cover several different
stock items) with a simple lifecycle: record the purchase, then mark it received — receiving
atomically restocks every line item and posts one consolidated expense. No vendor management
system, no partial receipts, no price-comparison tooling — sized for a small riad/hotel.

## Data Model (added to `packages/database/prisma/schema.prisma`)

```prisma
enum PurchaseStatus {
  PENDING
  RECEIVED
  CANCELLED
}

model Purchase {
  id          String         @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String         @db.ObjectId
  hotelId     String         @db.ObjectId
  vendorName  String
  categoryId  String         @db.ObjectId
  status      PurchaseStatus @default(PENDING)
  totalCost   Float
  currency    String
  createdById String         @db.ObjectId
  receivedAt  DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  tenant   Tenant          @relation(fields: [tenantId], references: [id])
  hotel    Hotel           @relation(fields: [hotelId], references: [id])
  category ExpenseCategory @relation(fields: [categoryId], references: [id])
  items    PurchaseItem[]
}

model PurchaseItem {
  id          String @id @default(auto()) @map("_id") @db.ObjectId
  purchaseId  String @db.ObjectId
  stockItemId String @db.ObjectId
  quantity    Int
  unitCost    Float

  purchase  Purchase  @relation(fields: [purchaseId], references: [id])
  stockItem StockItem @relation(fields: [stockItemId], references: [id])
}
```

Notes:
- `vendorName` is free text (no `Vendor` model) — consistent with keeping this scoped for a
  small operation; a structured vendor directory can be added later if needed.
- `categoryId` (an existing `ExpenseCategory`) is chosen by the user at `Purchase` creation
  time, not defaulted — it's the category the auto-generated `Expense` will use when the
  purchase is received.
- `totalCost` is computed server-side from the line items (`Σ quantity × unitCost`) at
  creation time — never accepted directly from the client, to prevent it drifting from the
  actual line items.
- `currency` is resolved via the same `getTenantCurrency` lookup already used by the Expenses
  module (reads `Tenant.currency` directly via the shared Prisma client).
- Every `PurchaseItem.stockItemId` must reference a `StockItem` belonging to the same
  `hotelId` as the `Purchase` — validated at creation (same `assertHotelOwnership`-style
  pattern used throughout `finance-service`).
- Add `purchases Purchase[]` to `Tenant`, `Hotel`, and `ExpenseCategory`; add
  `purchaseItems PurchaseItem[]` to `StockItem`.

## Lifecycle

- **Create (`POST /purchases`)**: status `PENDING`. No effect on stock or expenses yet.
- **Receive (`PATCH /purchases/:id/status` with `{ status: 'RECEIVED' }`)**: a single
  `$transaction` that, for every `PurchaseItem`, creates a `StockMovement` of type `RESTOCK`
  (`quantityChange: +item.quantity`, `reason: 'Purchase received'`) and increments the
  corresponding `StockItem.quantity` — plus creates exactly **one** `Expense` for the whole
  purchase, `amount: purchase.totalCost`, `categoryId: purchase.categoryId`,
  `description` referencing the vendor name, `date: now`. Sets `Purchase.status = RECEIVED`
  and `receivedAt: now` in the same transaction.
- **Cancel (`PATCH /purchases/:id/status` with `{ status: 'CANCELLED' }`)**: just flips the
  status field. No stock or expense side effects.
- **Terminal states**: `RECEIVED` and `CANCELLED` are final — no further status transitions
  are accepted from either (reject with 400).

## API (`finance-service`, port 3008)

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/purchases` | ADMIN, MANAGER, ACCOUNTANT | Create a purchase (PENDING), with line items |
| GET | `/purchases` | ADMIN, MANAGER, ACCOUNTANT | List, filterable by `hotelId`/`status` |
| GET | `/purchases/:id` | ADMIN, MANAGER, ACCOUNTANT | Detail, including line items |
| PATCH | `/purchases/:id/status` | ADMIN, MANAGER | Transition to `RECEIVED` or `CANCELLED` |

`SUPER_ADMIN` bypasses role checks everywhere, per the existing `RolesGuard` pattern.

## Tenant/Hotel Scoping

Same pattern as Expenses and Stock: every read/write scoped to `req.user.tenantId`; `hotelId`
and every `PurchaseItem.stockItemId` validated to belong to that tenant (and, for stock items,
that specific hotel) before being accepted.

## Out of Scope

- Vendor directory / vendor performance tracking.
- Partial/split receipts (receiving only some line items).
- Purchase order approval workflow (mirrors the Expenses module's decision to skip approval
  workflows for this stage).
- Receipt/invoice photo attachments.
- Price comparison across purchases/vendors.

## Testing Considerations

- Tenant/hotel isolation on all `purchases` endpoints.
- Role checks: `STAFF`/`GUEST` rejected everywhere; `ACCOUNTANT` can create/read but not
  transition status.
- Creating a purchase with a `stockItemId` belonging to a different hotel is rejected (404).
- Receiving a purchase creates exactly one `RESTOCK` movement per line item and exactly one
  `Expense`, and correctly increments each referenced `StockItem.quantity`.
- Receiving a purchase twice, or cancelling an already-received purchase, is rejected (400 —
  terminal state).
- `totalCost` sent by the client on creation is ignored/recomputed server-side (verify by
  sending a bogus value and confirming the stored value matches the computed sum).
