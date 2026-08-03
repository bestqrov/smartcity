# Hotel Administrative Management — Stock/Inventory Module (Sub-project 2/5)

## Context

This is the second of 5 ordered sub-projects under "hotel administrative management" (see
[2026-08-02-hotel-expenses-module-design.md](2026-08-02-hotel-expenses-module-design.md) for
the full roadmap and the `finance-service` architecture decision). Sub-project 1 (Expenses)
is complete, reviewed, and merged into the `worktree-hotel-expenses-module` branch (not yet
merged to `main`).

This spec covers stock/inventory tracking for a hotel's physical goods — minibar items,
room-service supplies, cleaning/maintenance consumables — sized for a small riad/hotel, not
a full warehouse-management system.

## Scope

- Per-hotel item catalog with current quantity and a low-stock threshold.
- Manual stock movements (restock, waste/loss, correction) with a full audit trail.
- Automatic stock deduction when a minibar/room-service order (`ServiceOrder`) references a
  stock item.
- Read access for `ACCOUNTANT`, write access for `ADMIN`/`MANAGER` (same split as Expenses).

## Data Model (added to `packages/database/prisma/schema.prisma`)

```prisma
model StockItem {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String   @db.ObjectId
  hotelId     String   @db.ObjectId
  name        String
  unit        String
  quantity    Int      @default(0)
  minQuantity Int      @default(0)
  costPrice   Float?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])
  hotel  Hotel  @relation(fields: [hotelId], references: [id])

  @@map("stock_items")
}

model StockMovement {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  itemId         String   @db.ObjectId
  type           String
  quantityChange Int
  reason         String?
  createdById    String   @db.ObjectId
  createdAt      DateTime @default(now())

  item StockItem @relation(fields: [itemId], references: [id])

  @@map("stock_movements")
}
```

Notes (following the precedent set and corrected during the Expenses sub-project's final
review — relations are declared on both sides, matching every other model in this shared
schema; `createdById` stays a bare scalar, matching `Expense.createdById`, since no model in
this schema relations an audit "who did this" field):

- `hotelId` is **required** (unlike `Expense.hotelId`, which is optional) — a minibar item
  physically exists in one hotel, it isn't shared across a tenant's multiple properties.
- Add `stockItems StockItem[]` to `Tenant` and to `Hotel`.
- Add `movements StockMovement[]` to `StockItem`.
- `type` on `StockMovement` is a plain string with 4 recognized values (`RESTOCK`, `WASTE`,
  `ADJUSTMENT`, `ORDER_DEDUCTION`), validated at the DTO layer via `@IsIn([...])` — not a
  Prisma enum, to stay consistent with how `ServiceOrder.type` (free string) already works in
  this schema rather than introducing a new enum pattern for this one field.
- `isLow` (whether `quantity < minQuantity`) is computed in the API response, not stored.
- `quantity` may go negative — no floor is enforced (see "Order deduction" below).

## `ServiceOrder` change (cross-service)

Add an optional field to the **existing** `ServiceOrder` model:

```prisma
  itemId String? @db.ObjectId
```

`ServiceOrder` is owned by `tourism-service`, not `finance-service` — but every service in
this monorepo shares the same Prisma schema/client, so `tourism-service`'s
`orders.service.ts` can read/write `StockItem`/`StockMovement` directly, the same
cross-domain pattern already used by `finance-service`'s `assertHotelOwnership` (reading
`Hotel`, which `tourism-service` owns) and `getTenantCurrency` (reading `Tenant`, which
`user-service` owns).

**Behavior:** when `POST /orders` is called with `itemId` set:
1. Decrement `StockItem.quantity` by `dto.quantity`.
2. Create a `StockMovement` row: `{ itemId, type: 'ORDER_DEDUCTION', quantityChange: -dto.quantity, createdById: <the ordering user's id>, reason: null }`.
3. The order is created regardless of resulting stock level — **insufficient stock does not
   block the order** (a guest ordering a 4th soda when 3 are left should not get an error;
   the hotel finds out via the low-stock indicator and restocks). This mirrors real small-riad
   operations where staff resolve stock gaps physically, not via a blocking API 400.

If `itemId` is omitted (the common case for orders that aren't tied to a tracked stock item),
`ServiceOrder` behaves exactly as it does today — no behavior change for existing callers.

## API (`finance-service`, same service/port as Expenses — 3008)

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/stock-items` | ADMIN, MANAGER | Create item (tenant+hotel scoped) |
| GET | `/stock-items` | ADMIN, MANAGER, ACCOUNTANT | List, filterable by `hotelId`; each row includes computed `isLow` |
| GET | `/stock-items/:id` | ADMIN, MANAGER, ACCOUNTANT | Detail |
| PATCH | `/stock-items/:id` | ADMIN, MANAGER | Update `name`/`unit`/`minQuantity`/`costPrice` — **not** `quantity` directly (quantity only changes via movements) |
| DELETE | `/stock-items/:id` | ADMIN | Delete (blocked if movements exist, same pattern as Expense Category deletion) |
| POST | `/stock-items/:id/movements` | ADMIN, MANAGER | Record a movement (`type` + `quantityChange` + optional `reason`); applies the delta to `StockItem.quantity` and inserts the `StockMovement` row in the same operation |
| GET | `/stock-items/:id/movements` | ADMIN, MANAGER, ACCOUNTANT | Movement history for one item, paginated |

All tenant/hotel ownership checks use the same `assertHotelOwnership`-style pattern already
established in `expenses.service.ts`.

## Out of Scope (deferred or explicitly rejected)

- Push/email low-stock notifications — only the `isLow` boolean in API responses, no
  notification delivery.
- Linking to `Purchase` records — the Purchases sub-project (next in the roadmap) will create
  `StockMovement` rows of type `RESTOCK` when a purchase order is received; that wiring
  belongs to that sub-project's spec, not this one.
- Any frontend admin UI page.
- Blocking orders on insufficient stock — explicitly rejected per the "Order deduction"
  section above.

## Testing Considerations

- Tenant/hotel isolation on all `stock-items` and `movements` endpoints (same pattern as
  Expenses — verify with a cross-tenant `hotelId`/`itemId` returns 404).
- Role checks: `STAFF`/`GUEST` rejected on all `finance-service` stock endpoints.
- Creating a `ServiceOrder` with `itemId` set correctly decrements `StockItem.quantity` and
  creates exactly one `ORDER_DEDUCTION` movement.
- Creating a `ServiceOrder` without `itemId` has zero effect on any `StockItem` (regression
  check against existing order behavior).
- `quantity` can go negative via order deduction without error.
- Deleting a `StockItem` with existing movements is blocked (409).
