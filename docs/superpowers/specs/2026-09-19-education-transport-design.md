# Education School Transport Service (ArwaEduc)

## Context

ArwaEduc (`apps/education-apps`) is multi-tenant (`School` → `Branch`); every module is branch-scoped via `tenantScopeMiddleware` and `req.branchId`, and cross-references are validated per `docs/superpowers/specs/2026-08-30-education-multi-tenancy-module-rollout-design.md`. Schools that run their own buses need to manage vehicles, drivers, routes and stops, subscribe students to a route, and collect a monthly transport fee. Nothing transport-related exists yet.

## Goals

- Manage vehicles, drivers, routes and ordered stops with morning/afternoon times.
- Subscribe a student to a route + stop; charge a monthly fee; track paid/unpaid per month.
- Each branch chooses its pricing mode.
- Parents see (read-only) their child's route, stop, times, driver contact and current-month payment status in the existing parent portal.
- Fully branch-scoped, following the existing module pattern.

## Non-Goals

GPS/live tracking, boarding/alighting QR scans, parent notifications, insurance/inspection/license tracking, PDF invoices, multiple simultaneous subscriptions per student.

## Data Model (Prisma)

All models have required `branchId` with `@relation` to `Branch`.

| Model | Fields |
|---|---|
| `Vehicle` | `plate`, `capacity` (Int), `active` |
| `Driver` | `name`, `phone`, `active` |
| `TransportRoute` | `name`, `vehicleId`, `driverId`, `monthlyPrice?`, `active` |
| `TransportStop` | `routeId`, `name`, `order` (Int), `morningTime`, `afternoonTime` (`"HH:mm"` strings), `monthlyPrice?` |
| `TransportSubscription` | `studentId`, `routeId`, `stopId`, `monthlyPrice` (snapshot), `startDate`, `endDate?`, `status` (`ACTIVE` \| `PAUSED` \| `ENDED`) |

`Payment` gains two optional fields: `transportSubscriptionId` and `forMonth` (`"YYYY-MM"`). Existing tuition payments leave them null.

`Settings` (per branch) gains `transportPricingMode` (`ROUTE` \| `STOP` \| `UNIFORM`, default `ROUTE`) and `transportUniformPrice?`.

### Pricing

At subscription time the price is resolved once from the branch's mode — `ROUTE`: `TransportRoute.monthlyPrice`; `STOP`: `TransportStop.monthlyPrice`; `UNIFORM`: `Settings.transportUniformPrice` — and stored in `TransportSubscription.monthlyPrice`. Later price changes never affect existing subscriptions. If the resolved price is missing, creation fails with a clear error.

## Backend API (`src/modules/transport/`)

Split into small files (vehicles, drivers, routes/stops, subscriptions, payments/dues), each with routes/controller/service and tests, matching sibling modules. All routes use `tenantScopeMiddleware` and roles `OWNER`/`ADMIN`/`SECRETARY`.

| Route | Purpose |
|---|---|
| `/api/transport/vehicles`, `/drivers` | CRUD |
| `/api/transport/routes`, `/routes/:id/stops` | CRUD for routes and their stops |
| `/api/transport/subscriptions` | create / pause / resume / end |
| `/api/transport/subscriptions/:id/payments` | record a payment for a month |
| `/api/transport/dues` | active subscriptions unpaid for the current month |

`branchId` always comes from `req.branchId`, never the payload. Cross-reference validation: `studentId`, `routeId`, `stopId`, `vehicleId`, `driverId` are each looked up with `findFirst({ where: { id, branchId } })`; a miss is rejected in the module's existing error style.

### Business rules

- A student has at most one `ACTIVE` or `PAUSED` subscription at a time.
- `stopId` must belong to `routeId`.
- Creating/resuming a subscription is rejected if the route's vehicle already has `capacity` ACTIVE subscriptions.
- Deactivating or deleting a vehicle/driver/route/stop referenced by an ACTIVE or PAUSED subscription is rejected.
- Only one payment per `(transportSubscriptionId, forMonth)`; a second is rejected. Amount defaults to the subscription's `monthlyPrice` and may be overridden.
- Recording a transport payment creates the `Payment` and an `INCOME` `Transaction` (category `Transport`) inside one `prisma.$transaction`, so neither exists without the other.
- Ending a subscription sets `endDate` and status `ENDED`; dues only consider `ACTIVE` subscriptions whose `startDate` is on or before the month.

## Frontend

**Admin:** a "Transport" sidebar entry with four tabs — Routes & stops, Vehicles & drivers, Subscriptions, Dues. The student page gets a small transport card (current subscription, subscribe action). Settings gets the pricing-mode selector (and the uniform price field when `UNIFORM`).

**Parent portal (read-only):** a "Transport" card per child showing route, stop, morning/afternoon times, driver name and phone, and current-month paid/unpaid status. Backed by a parent-scoped endpoint that returns only subscriptions of the parent's own students (same derivation `Parent.students[]` used elsewhere).

## Testing

TDD per module, following existing tests: a `describe('branch scoping')` block per service (reads filtered by `branchId`, writes stamped from `req.branchId`, cross-branch FK rejected), plus tests for each business rule above (second subscription, capacity, stop/route mismatch, duplicate month payment, in-use deactivation, price snapshot per mode, atomic payment + transaction). Final manual QA mirrors the two-owner isolation scenario: owner B gets `403` on owner A's transport resources.

## Rollout

No production data exists, so no migrations beyond the Prisma schema change. `Payment.transportSubscriptionId`/`forMonth` and the two `Settings` fields are optional/defaulted, so existing code keeps working.
