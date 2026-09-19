# Education School Transport Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let schools using ArwaEduc manage vehicles, drivers, routes and stops, subscribe students to a route, and collect a monthly transport fee, with parents seeing their child's transport read-only in the portal.

**Architecture:** A new branch-scoped backend module `src/modules/transport/` (small service + controller files per resource, one router) following the existing `holidays`/`groups` pattern. Transport fees are stored as `Payment` rows carrying `transportSubscriptionId` + `forMonth`, written together with an `INCOME` `Transaction` inside one `prisma.$transaction`. Because `Payment` rows are summed as tuition in several existing views, those views are changed to read tuition-only payments. Frontend: one admin page `/admin/transport` (4 tabs), a student-page card, and a card on the parent portal.

**Tech Stack:** Node/Express, Prisma 5 on MongoDB (Atlas replica set — `$transaction` already used in `students.service.ts`), Jest + ts-jest (mocked prisma), Next.js 14 + Tailwind + axios (frontend has no test runner — verified with `tsc` and manual QA).

**Spec:** `docs/superpowers/specs/2026-09-19-education-transport-design.md`

**Conventions used throughout**
- Backend commands run from `apps/education-apps`; frontend commands from `apps/education-apps/frontend`.
- Tests mock `../../config/database` exactly like `src/modules/groups/groups.service.test.ts`.
- Baseline before starting: `npx jest` → 19 suites / 103 tests pass; `npx tsc --noEmit -p .` prints nothing.

## Decisions that refine the spec (Task 1 also edits the spec to match)

1. `TransportStop` gets `active` (soft delete) — stops can be referenced by ENDED subscriptions, so hard delete is unsafe.
2. `Settings.transportPricingMode` is **optional** in the schema (null ⇒ `ROUTE`). A required field with a default would make Prisma fail reading existing MongoDB `settings` documents that lack the field.
3. Capacity rule is **per route**: ACTIVE subscriptions on a route ≤ that route's vehicle `capacity`. (A vehicle may serve several routes in sequence.)
4. No unique index on `(transportSubscriptionId, forMonth)`: MongoDB unique indexes treat missing/null as equal, so every tuition payment would collide. The duplicate-month check runs inside the `$transaction` instead.
5. Pricing-mode selector lives on the Transport page (not the 950-line Settings page); it still persists in `Settings` through the existing `/settings` API.
6. Transport payments are excluded from tuition views: student balance (admin + student portal), parent portal balance, and the documents module. Finance "Paiements" list and monthly received total keep including them (money actually received).
7. All `/api/transport/*` routes allow `ADMIN`, `SECRETARY`, `OWNER` (per spec). Admin-side UI only; no secretary UI in this plan.

## File Structure

**Backend — create** (`apps/education-apps/src/modules/transport/`)
- `month.ts` — `"YYYY-MM"` helpers.
- `pricing.ts` — `resolveMonthlyPrice` (pure).
- `openSubscriptions.ts` — "is this vehicle/driver/route/stop still in use" counters.
- `http.ts` — `respond()` helper (try/catch + status mapping) shared by controllers.
- `vehicles.service.ts` / `vehicles.controller.ts`
- `drivers.service.ts` / `drivers.controller.ts`
- `routes.service.ts` / `routes.controller.ts` (routes **and** stops)
- `subscriptions.service.ts` / `subscriptions.controller.ts`
- `payments.service.ts` / `payments.controller.ts` (transport payments + dues)
- `transport.routes.ts` — the router.
- one `*.test.ts` next to each service, plus `month.test.ts`, `pricing.test.ts`.

**Backend — modify**
- `prisma/schema.prisma`, `src/app.ts`
- `src/modules/settings/settings.service.ts`, `settings.controller.ts`, `settings.service.test.ts`
- `src/modules/payments/tuitionFilter.ts` (create)
- `src/modules/students/students.service.ts` (+test), `src/modules/parents/parents.service.ts` (+test), `src/modules/documents/documents.service.ts` (+ new test)

**Frontend — create** (`apps/education-apps/frontend/`)
- `lib/services/transport.ts`
- `components/transport/styles.ts`, `FleetTab.tsx`, `RoutesTab.tsx`, `SubscriptionsTab.tsx`, `DuesTab.tsx`, `PricingModePanel.tsx`, `StudentTransportCard.tsx`
- `app/admin/transport/page.tsx`

**Frontend — modify**
- `types/index.ts`, `components/Sidebar.tsx`, `app/admin/students/[id]/page.tsx`, `app/p/[token]/page.tsx`

---

### Task 1: Prisma schema + spec alignment

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `docs/superpowers/specs/2026-09-19-education-transport-design.md`

- [ ] **Step 1: Add enums and models**

Append to the end of `prisma/schema.prisma`:

```prisma
enum TransportSubscriptionStatus {
  ACTIVE
  PAUSED
  ENDED
}

enum TransportPricingMode {
  ROUTE
  STOP
  UNIFORM
}

model Vehicle {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  plate     String
  capacity  Int
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])

  routes TransportRoute[]

  @@map("vehicles")
}

model Driver {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  phone     String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])

  routes TransportRoute[]

  @@map("drivers")
}

model TransportRoute {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  name         String
  monthlyPrice Float?
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  vehicleId String  @db.ObjectId
  vehicle   Vehicle @relation(fields: [vehicleId], references: [id])
  driverId  String  @db.ObjectId
  driver    Driver  @relation(fields: [driverId], references: [id])

  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])

  stops         TransportStop[]
  subscriptions TransportSubscription[]

  @@map("transport_routes")
}

model TransportStop {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  name          String
  order         Int
  morningTime   String
  afternoonTime String
  monthlyPrice  Float?
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  routeId String         @db.ObjectId
  route   TransportRoute @relation(fields: [routeId], references: [id], onDelete: Cascade)

  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])

  subscriptions TransportSubscription[]

  @@map("transport_stops")
}

model TransportSubscription {
  id           String                      @id @default(auto()) @map("_id") @db.ObjectId
  monthlyPrice Float
  startDate    DateTime                    @default(now())
  endDate      DateTime?
  status       TransportSubscriptionStatus @default(ACTIVE)
  createdAt    DateTime                    @default(now())
  updatedAt    DateTime                    @updatedAt

  studentId String  @db.ObjectId
  student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  routeId   String         @db.ObjectId
  route     TransportRoute @relation(fields: [routeId], references: [id])
  stopId    String         @db.ObjectId
  stop      TransportStop  @relation(fields: [stopId], references: [id])

  branchId String @db.ObjectId
  branch   Branch @relation(fields: [branchId], references: [id])

  payments Payment[]

  @@map("transport_subscriptions")
}
```

- [ ] **Step 2: Add reverse relations and new optional fields to existing models**

In `model Branch`, after `holidays  Holiday[]` add:

```prisma
  vehicles               Vehicle[]
  drivers                Driver[]
  transportRoutes        TransportRoute[]
  transportStops         TransportStop[]
  transportSubscriptions TransportSubscription[]
```

In `model Student`, after `attendances  Attendance[]` add:

```prisma
  transportSubscriptions TransportSubscription[]
```

In `model Payment`, before the `branchId` line add:

```prisma
  transportSubscriptionId String?                @db.ObjectId
  transportSubscription   TransportSubscription? @relation(fields: [transportSubscriptionId], references: [id])
  forMonth                String? // "YYYY-MM", only set on transport payments
```

In `model Settings`, before the `branchId` line add:

```prisma
  transportPricingMode  TransportPricingMode? // null is treated as ROUTE
  transportUniformPrice Float?
```

- [ ] **Step 3: Format, generate, typecheck**

Run: `npx prisma format && npx prisma generate && npx tsc --noEmit -p .`
Expected: `Generated Prisma Client`, tsc prints nothing.

- [ ] **Step 4: Push the schema to the dev database (additive only)**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.` (Only adds collections/fields; if Prisma warns about data loss, STOP and ask the user.)

- [ ] **Step 5: Verify Prisma's `null` filter matches documents missing the field**

Later tasks rely on `where: { transportSubscriptionId: null }` matching existing payments that were created before this field existed. Verify against the dev DB:

```bash
cat > /tmp/nullcheck.ts <<'EOF'
import prisma from './src/config/database';
(async () => {
  const all = await prisma.payment.count();
  const nullOnly = await prisma.payment.count({ where: { transportSubscriptionId: null } });
  console.log({ all, nullOnly });
  await prisma.$disconnect();
})();
EOF
cp /tmp/nullcheck.ts ./nullcheck.ts && npx ts-node nullcheck.ts; rm nullcheck.ts
```
Expected: `all === nullOnly`. If they differ, replace `{ transportSubscriptionId: null }` with `{ transportSubscriptionId: { isSet: false } }` in Task 8 (`tuitionFilter.ts`) — note `isSet: false` only matches missing fields, so use `OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }]` if both shapes exist.

- [ ] **Step 6: Align the spec with the decisions above**

In `docs/superpowers/specs/2026-09-19-education-transport-design.md`:
- In the `TransportStop` row add `active` to the fields.
- In the Settings sentence change to `transportPricingMode` (optional; null ⇒ `ROUTE`).
- Replace the capacity bullet with: `Creating/resuming a subscription is rejected if the route already has as many ACTIVE subscriptions as its vehicle's `capacity`.`
- Replace "Only one payment per (transportSubscriptionId, forMonth)…" bullet's mechanism with: `enforced by a check inside the same $transaction (no unique index — MongoDB treats null/missing as equal).`
- Under Frontend/Admin replace "Settings gets the pricing-mode selector…" with "The Transport page has a pricing-mode panel (persisted in `Settings`)."
- Add a section `## Effect on existing payment views` stating: student balance (admin + student portal), parent portal balance and the documents module read tuition-only payments (`transportSubscriptionId` null); the Finance payments list and monthly received total still include transport payments.

- [ ] **Step 7: Commit**

```bash
git add apps/education-apps/prisma/schema.prisma docs/superpowers/specs/2026-09-19-education-transport-design.md
git commit -m "feat(education): add transport schema (vehicles, drivers, routes, stops, subscriptions)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Month helpers and price resolver (pure functions)

**Files:**
- Create: `apps/education-apps/src/modules/transport/month.ts`, `month.test.ts`, `pricing.ts`, `pricing.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/modules/transport/month.test.ts`:

```ts
import { currentMonth, isValidMonth, startOfNextMonth } from './month';

describe('month helpers', () => {
    it('currentMonth formats a date as YYYY-MM with zero padding', () => {
        expect(currentMonth(new Date(2026, 8, 19))).toBe('2026-09');
        expect(currentMonth(new Date(2026, 11, 1))).toBe('2026-12');
    });

    it('isValidMonth accepts YYYY-MM only', () => {
        expect(isValidMonth('2026-09')).toBe(true);
        expect(isValidMonth('2026-13')).toBe(false);
        expect(isValidMonth('2026-9')).toBe(false);
        expect(isValidMonth('september')).toBe(false);
        expect(isValidMonth(undefined)).toBe(false);
    });

    it('startOfNextMonth returns the first instant of the following month', () => {
        expect(startOfNextMonth('2026-09')).toEqual(new Date(2026, 9, 1));
        expect(startOfNextMonth('2026-12')).toEqual(new Date(2027, 0, 1));
    });
});
```

`src/modules/transport/pricing.test.ts`:

```ts
import { resolveMonthlyPrice } from './pricing';

const route = { monthlyPrice: 300 };
const stop = { monthlyPrice: 250 };

describe('resolveMonthlyPrice', () => {
    it('ROUTE uses the route price', () => {
        expect(resolveMonthlyPrice('ROUTE', route, stop, 200)).toBe(300);
    });

    it('STOP uses the stop price', () => {
        expect(resolveMonthlyPrice('STOP', route, stop, 200)).toBe(250);
    });

    it('UNIFORM uses the branch uniform price', () => {
        expect(resolveMonthlyPrice('UNIFORM', route, stop, 200)).toBe(200);
    });

    it('treats a missing mode as ROUTE', () => {
        expect(resolveMonthlyPrice(null, route, stop, 200)).toBe(300);
        expect(resolveMonthlyPrice(undefined, route, stop, 200)).toBe(300);
    });

    it('throws when the price for the mode is not configured', () => {
        expect(() => resolveMonthlyPrice('ROUTE', { monthlyPrice: null }, stop, 200)).toThrow(
            'Transport price is not configured for pricing mode ROUTE'
        );
        expect(() => resolveMonthlyPrice('STOP', route, { monthlyPrice: 0 }, 200)).toThrow(
            'Transport price is not configured for pricing mode STOP'
        );
        expect(() => resolveMonthlyPrice('UNIFORM', route, stop, null)).toThrow(
            'Transport price is not configured for pricing mode UNIFORM'
        );
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/modules/transport/month.test.ts src/modules/transport/pricing.test.ts`
Expected: FAIL — `Cannot find module './month'` / `'./pricing'`.

- [ ] **Step 3: Implement**

`src/modules/transport/month.ts`:

```ts
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isValidMonth = (value: unknown): value is string =>
    typeof value === 'string' && MONTH_RE.test(value);

export const currentMonth = (now: Date = new Date()): string =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// "2026-09" -> 2026-10-01 00:00 (local). Used as an exclusive upper bound.
export const startOfNextMonth = (month: string): Date => {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber, 1);
};
```

`src/modules/transport/pricing.ts`:

```ts
export type TransportPricingMode = 'ROUTE' | 'STOP' | 'UNIFORM';

interface Priced {
    monthlyPrice?: number | null;
}

export const resolveMonthlyPrice = (
    mode: TransportPricingMode | null | undefined,
    route: Priced,
    stop: Priced,
    uniformPrice?: number | null
): number => {
    const effectiveMode = mode ?? 'ROUTE';
    const price =
        effectiveMode === 'STOP' ? stop.monthlyPrice : effectiveMode === 'UNIFORM' ? uniformPrice : route.monthlyPrice;

    if (price == null || !(price > 0)) {
        throw new Error(`Transport price is not configured for pricing mode ${effectiveMode}`);
    }

    return price;
};
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest src/modules/transport/month.test.ts src/modules/transport/pricing.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src/modules/transport
git commit -m "feat(education): transport month helpers and price resolver

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Settings — persist the pricing mode

**Files:**
- Modify: `apps/education-apps/src/modules/settings/settings.service.ts`, `settings.controller.ts`, `settings.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/modules/settings/settings.service.test.ts`:

```ts
describe('transport pricing settings', () => {
    afterEach(() => jest.clearAllMocks());

    it('updateSettings passes the transport fields through to update and create', async () => {
        (prisma.settings.upsert as jest.Mock).mockResolvedValue({ id: 'set1' });

        await updateSettings('b1', { transportPricingMode: 'UNIFORM', transportUniformPrice: 200 });

        expect(prisma.settings.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: { transportPricingMode: 'UNIFORM', transportUniformPrice: 200 },
                create: expect.objectContaining({
                    branchId: 'b1',
                    transportPricingMode: 'UNIFORM',
                    transportUniformPrice: 200,
                }),
            })
        );
    });

    it('updateSettings leaves transport fields out of create when not provided', async () => {
        (prisma.settings.upsert as jest.Mock).mockResolvedValue({ id: 'set1' });

        await updateSettings('b1', { schoolName: 'X' });

        const call = (prisma.settings.upsert as jest.Mock).mock.calls[0][0];
        expect(call.create).not.toHaveProperty('transportPricingMode');
        expect(call.create).not.toHaveProperty('transportUniformPrice');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/settings`
Expected: FAIL — TypeScript error: `transportPricingMode` does not exist in type `UpdateSettingsData`.

- [ ] **Step 3: Implement service change**

In `settings.service.ts` replace the interface and the `updateSettings` create block:

```ts
import { TransportPricingMode } from '../transport/pricing';

interface UpdateSettingsData {
    schoolName?: string;
    logo?: string;
    academicYear?: string;
    contactInfo?: string;
    transportPricingMode?: TransportPricingMode;
    transportUniformPrice?: number | null;
}
```

```ts
export const updateSettings = async (branchId: string, data: UpdateSettingsData) => {
    return prisma.settings.upsert({
        where: { branchId },
        update: data,
        create: {
            branchId,
            schoolName: data.schoolName || 'School Name',
            academicYear: data.academicYear || '2024-2025',
            logo: data.logo || null,
            contactInfo: data.contactInfo || null,
            ...(data.transportPricingMode !== undefined && { transportPricingMode: data.transportPricingMode }),
            ...(data.transportUniformPrice !== undefined && { transportUniformPrice: data.transportUniformPrice }),
        },
    });
};
```

- [ ] **Step 4: Implement controller change**

In `settings.controller.ts` `update`, extend destructuring and the whitelist:

```ts
        const { schoolName, logo, academicYear, contactInfo, transportPricingMode, transportUniformPrice } = req.body;

        if (transportPricingMode !== undefined && !['ROUTE', 'STOP', 'UNIFORM'].includes(transportPricingMode)) {
            sendError(res, 'transportPricingMode must be ROUTE, STOP or UNIFORM', 'Validation error', 400);
            return;
        }
        if (
            transportUniformPrice !== undefined &&
            transportUniformPrice !== null &&
            !(typeof transportUniformPrice === 'number' && transportUniformPrice >= 0)
        ) {
            sendError(res, 'transportUniformPrice must be a non-negative number', 'Validation error', 400);
            return;
        }

        const updateData: any = {};
        if (schoolName) updateData.schoolName = schoolName;
        if (logo !== undefined) updateData.logo = logo;
        if (academicYear) updateData.academicYear = academicYear;
        if (contactInfo !== undefined) updateData.contactInfo = contactInfo;
        if (transportPricingMode !== undefined) updateData.transportPricingMode = transportPricingMode;
        if (transportUniformPrice !== undefined) updateData.transportUniformPrice = transportUniformPrice;
```

(Keep the existing `try {`/`catch` and the trailing `updateSettings(...)` + `sendSuccess` lines; only the destructuring and whitelist change.)

- [ ] **Step 5: Run to verify pass + typecheck**

Run: `npx jest src/modules/settings && npx tsc --noEmit -p .`
Expected: all settings tests PASS, tsc silent.

- [ ] **Step 6: Commit**

```bash
git add apps/education-apps/src/modules/settings
git commit -m "feat(education): persist transport pricing mode in branch settings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Shared helpers — open-subscription counters and HTTP wrapper

**Files:**
- Create: `apps/education-apps/src/modules/transport/openSubscriptions.ts`, `openSubscriptions.test.ts`, `http.ts`

- [ ] **Step 1: Write the failing test**

`src/modules/transport/openSubscriptions.test.ts`:

```ts
import prisma from '../../config/database';
import { countOpenSubscriptions, countOpenSubscriptionsForRoutesOf } from './openSubscriptions';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        transportSubscription: { count: jest.fn() },
        transportRoute: { findMany: jest.fn() },
    },
}));

describe('open subscription counters', () => {
    afterEach(() => jest.clearAllMocks());

    it('countOpenSubscriptions counts ACTIVE and PAUSED in the branch, filtered by stop', async () => {
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(2);

        const result = await countOpenSubscriptions('b1', { stopId: 'st1' });

        expect(result).toBe(2);
        expect(prisma.transportSubscription.count).toHaveBeenCalledWith({
            where: { branchId: 'b1', status: { in: ['ACTIVE', 'PAUSED'] }, stopId: 'st1' },
        });
    });

    it('countOpenSubscriptionsForRoutesOf looks up the routes of a vehicle in the branch first', async () => {
        (prisma.transportRoute.findMany as jest.Mock).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(1);

        const result = await countOpenSubscriptionsForRoutesOf('b1', 'vehicleId', 'v1');

        expect(prisma.transportRoute.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1', vehicleId: 'v1' },
            select: { id: true },
        });
        expect(prisma.transportSubscription.count).toHaveBeenCalledWith({
            where: { branchId: 'b1', status: { in: ['ACTIVE', 'PAUSED'] }, routeId: { in: ['r1', 'r2'] } },
        });
        expect(result).toBe(1);
    });

    it('countOpenSubscriptionsForRoutesOf returns 0 without counting when there are no routes', async () => {
        (prisma.transportRoute.findMany as jest.Mock).mockResolvedValue([]);

        const result = await countOpenSubscriptionsForRoutesOf('b1', 'driverId', 'd1');

        expect(result).toBe(0);
        expect(prisma.transportSubscription.count).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/transport/openSubscriptions.test.ts`
Expected: FAIL — `Cannot find module './openSubscriptions'`.

- [ ] **Step 3: Implement**

`src/modules/transport/openSubscriptions.ts`:

```ts
import prisma from '../../config/database';

export const OPEN_STATUSES = ['ACTIVE', 'PAUSED'] as const;

interface OpenFilter {
    routeId?: string;
    routeIds?: string[];
    stopId?: string;
}

export const countOpenSubscriptions = (branchId: string, filter: OpenFilter) =>
    prisma.transportSubscription.count({
        where: {
            branchId,
            status: { in: [...OPEN_STATUSES] },
            ...(filter.routeId && { routeId: filter.routeId }),
            ...(filter.routeIds && { routeId: { in: filter.routeIds } }),
            ...(filter.stopId && { stopId: filter.stopId }),
        },
    });

// Vehicles and drivers are only referenced through routes, so "in use" means
// "one of their routes has an ACTIVE/PAUSED subscription".
export const countOpenSubscriptionsForRoutesOf = async (
    branchId: string,
    field: 'vehicleId' | 'driverId',
    id: string
): Promise<number> => {
    const routes = await prisma.transportRoute.findMany({
        where: { branchId, [field]: id },
        select: { id: true },
    });

    if (routes.length === 0) return 0;

    return countOpenSubscriptions(branchId, { routeIds: routes.map((route) => route.id) });
};
```

`src/modules/transport/http.ts`:

```ts
import { Response } from 'express';
import { sendSuccess, sendError } from '../../utils/response';

interface RespondOptions {
    message: string;
    failure: string;
    status?: number;
}

// Runs a service call and maps the outcome to the API's { success, data | error } shape.
// Errors ending in "not found" become 404, every other thrown error is a 400.
export const respond = async (res: Response, action: () => Promise<unknown>, options: RespondOptions): Promise<void> => {
    try {
        const data = await action();
        sendSuccess(res, data, options.message, options.status ?? 200);
    } catch (error: any) {
        const status = /not found$/i.test(error.message) ? 404 : 400;
        sendError(res, error.message, options.failure, status);
    }
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/modules/transport/openSubscriptions.test.ts && npx tsc --noEmit -p .`
Expected: 3 tests PASS, tsc silent.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src/modules/transport
git commit -m "feat(education): transport shared helpers (open-subscription counters, respond)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Vehicles and drivers

**Files:**
- Create: `src/modules/transport/vehicles.service.ts`, `vehicles.service.test.ts`, `vehicles.controller.ts`, `drivers.service.ts`, `drivers.service.test.ts`, `drivers.controller.ts` (all under `apps/education-apps/`)

- [ ] **Step 1: Write the failing vehicle tests**

`src/modules/transport/vehicles.service.test.ts`:

```ts
import prisma from '../../config/database';
import { getAllVehicles, createVehicle, updateVehicle, deleteVehicle } from './vehicles.service';
import * as open from './openSubscriptions';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        vehicle: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    },
}));
jest.mock('./openSubscriptions');

describe('vehicles service — branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('getAllVehicles only returns active vehicles of the given branch', async () => {
        (prisma.vehicle.findMany as jest.Mock).mockResolvedValue([]);

        await getAllVehicles('b1');

        expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1', active: true } })
        );
    });

    it('createVehicle stamps the given branchId and trims the plate', async () => {
        (prisma.vehicle.create as jest.Mock).mockResolvedValue({ id: 'v1' });

        await createVehicle({ plate: ' 12345-A-6 ', capacity: 30, branchId: 'b1' });

        expect(prisma.vehicle.create).toHaveBeenCalledWith({
            data: { plate: '12345-A-6', capacity: 30, branchId: 'b1' },
        });
    });

    it('createVehicle rejects a non-positive or non-integer capacity', async () => {
        await expect(createVehicle({ plate: 'A', capacity: 0, branchId: 'b1' })).rejects.toThrow(
            'Capacity must be a positive integer'
        );
        await expect(createVehicle({ plate: 'A', capacity: 2.5, branchId: 'b1' })).rejects.toThrow(
            'Capacity must be a positive integer'
        );
    });

    it('createVehicle rejects a blank plate', async () => {
        await expect(createVehicle({ plate: '  ', capacity: 10, branchId: 'b1' })).rejects.toThrow('Plate is required');
    });

    it('updateVehicle throws for a vehicle outside the branch', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateVehicle('v1', 'b1', { plate: 'X' })).rejects.toThrow('Vehicle not found');
        expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({ where: { id: 'v1', branchId: 'b1' } });
    });

    it('updateVehicle refuses to deactivate a vehicle whose routes have open subscriptions', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
        (open.countOpenSubscriptionsForRoutesOf as jest.Mock).mockResolvedValue(3);

        await expect(updateVehicle('v1', 'b1', { active: false })).rejects.toThrow(
            'Vehicle is used by routes with active subscriptions'
        );
        expect(prisma.vehicle.update).not.toHaveBeenCalled();
    });

    it('deleteVehicle soft-deletes an unused vehicle', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
        (open.countOpenSubscriptionsForRoutesOf as jest.Mock).mockResolvedValue(0);
        (prisma.vehicle.update as jest.Mock).mockResolvedValue({ id: 'v1', active: false });

        await deleteVehicle('v1', 'b1');

        expect(prisma.vehicle.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { active: false } });
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/transport/vehicles.service.test.ts`
Expected: FAIL — `Cannot find module './vehicles.service'`.

- [ ] **Step 3: Implement vehicles service**

`src/modules/transport/vehicles.service.ts`:

```ts
import prisma from '../../config/database';
import { countOpenSubscriptionsForRoutesOf } from './openSubscriptions';

export interface VehicleData {
    plate: string;
    capacity: number;
    branchId: string;
}

export interface UpdateVehicleData {
    plate?: string;
    capacity?: number;
    active?: boolean;
}

const assertPlate = (plate: unknown) => {
    if (typeof plate !== 'string' || !plate.trim()) throw new Error('Plate is required');
};

const assertCapacity = (capacity: unknown) => {
    if (!Number.isInteger(capacity) || (capacity as number) < 1) {
        throw new Error('Capacity must be a positive integer');
    }
};

const assertNotInUse = async (id: string, branchId: string) => {
    if ((await countOpenSubscriptionsForRoutesOf(branchId, 'vehicleId', id)) > 0) {
        throw new Error('Vehicle is used by routes with active subscriptions');
    }
};

export const getAllVehicles = async (branchId: string) => {
    return prisma.vehicle.findMany({ where: { branchId, active: true }, orderBy: { plate: 'asc' } });
};

export const createVehicle = async (data: VehicleData) => {
    assertPlate(data.plate);
    assertCapacity(data.capacity);

    return prisma.vehicle.create({
        data: { plate: data.plate.trim(), capacity: data.capacity, branchId: data.branchId },
    });
};

export const updateVehicle = async (id: string, branchId: string, data: UpdateVehicleData) => {
    const existing = await prisma.vehicle.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Vehicle not found');

    if (data.plate !== undefined) assertPlate(data.plate);
    if (data.capacity !== undefined) assertCapacity(data.capacity);
    if (data.active === false) await assertNotInUse(id, branchId);

    return prisma.vehicle.update({
        where: { id },
        data: { plate: data.plate?.trim(), capacity: data.capacity, active: data.active },
    });
};

export const deleteVehicle = async (id: string, branchId: string) => {
    const existing = await prisma.vehicle.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Vehicle not found');

    await assertNotInUse(id, branchId);

    return prisma.vehicle.update({ where: { id }, data: { active: false } });
};
```

- [ ] **Step 4: Run to verify vehicle tests pass**

Run: `npx jest src/modules/transport/vehicles.service.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing driver tests**

`src/modules/transport/drivers.service.test.ts`:

```ts
import prisma from '../../config/database';
import { getAllDrivers, createDriver, updateDriver, deleteDriver } from './drivers.service';
import * as open from './openSubscriptions';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        driver: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    },
}));
jest.mock('./openSubscriptions');

describe('drivers service — branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('getAllDrivers only returns active drivers of the given branch', async () => {
        (prisma.driver.findMany as jest.Mock).mockResolvedValue([]);

        await getAllDrivers('b1');

        expect(prisma.driver.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1', active: true } })
        );
    });

    it('createDriver stamps the given branchId', async () => {
        (prisma.driver.create as jest.Mock).mockResolvedValue({ id: 'd1' });

        await createDriver({ name: 'Ahmed', phone: '0600000000', branchId: 'b1' });

        expect(prisma.driver.create).toHaveBeenCalledWith({
            data: { name: 'Ahmed', phone: '0600000000', branchId: 'b1' },
        });
    });

    it('createDriver requires a name and a phone', async () => {
        await expect(createDriver({ name: '', phone: '06', branchId: 'b1' })).rejects.toThrow('Name is required');
        await expect(createDriver({ name: 'A', phone: ' ', branchId: 'b1' })).rejects.toThrow('Phone is required');
    });

    it('updateDriver throws for a driver outside the branch', async () => {
        (prisma.driver.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateDriver('d1', 'b1', { name: 'X' })).rejects.toThrow('Driver not found');
    });

    it('deleteDriver refuses when the driver\'s routes have open subscriptions', async () => {
        (prisma.driver.findFirst as jest.Mock).mockResolvedValue({ id: 'd1' });
        (open.countOpenSubscriptionsForRoutesOf as jest.Mock).mockResolvedValue(1);

        await expect(deleteDriver('d1', 'b1')).rejects.toThrow('Driver is used by routes with active subscriptions');
        expect(prisma.driver.update).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 6: Run to verify failure, then implement drivers service**

Run: `npx jest src/modules/transport/drivers.service.test.ts` → FAIL (module missing).

`src/modules/transport/drivers.service.ts`:

```ts
import prisma from '../../config/database';
import { countOpenSubscriptionsForRoutesOf } from './openSubscriptions';

export interface DriverData {
    name: string;
    phone: string;
    branchId: string;
}

export interface UpdateDriverData {
    name?: string;
    phone?: string;
    active?: boolean;
}

const assertName = (name: unknown) => {
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name is required');
};

const assertPhone = (phone: unknown) => {
    if (typeof phone !== 'string' || !phone.trim()) throw new Error('Phone is required');
};

const assertNotInUse = async (id: string, branchId: string) => {
    if ((await countOpenSubscriptionsForRoutesOf(branchId, 'driverId', id)) > 0) {
        throw new Error('Driver is used by routes with active subscriptions');
    }
};

export const getAllDrivers = async (branchId: string) => {
    return prisma.driver.findMany({ where: { branchId, active: true }, orderBy: { name: 'asc' } });
};

export const createDriver = async (data: DriverData) => {
    assertName(data.name);
    assertPhone(data.phone);

    return prisma.driver.create({
        data: { name: data.name.trim(), phone: data.phone.trim(), branchId: data.branchId },
    });
};

export const updateDriver = async (id: string, branchId: string, data: UpdateDriverData) => {
    const existing = await prisma.driver.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Driver not found');

    if (data.name !== undefined) assertName(data.name);
    if (data.phone !== undefined) assertPhone(data.phone);
    if (data.active === false) await assertNotInUse(id, branchId);

    return prisma.driver.update({
        where: { id },
        data: { name: data.name?.trim(), phone: data.phone?.trim(), active: data.active },
    });
};

export const deleteDriver = async (id: string, branchId: string) => {
    const existing = await prisma.driver.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Driver not found');

    await assertNotInUse(id, branchId);

    return prisma.driver.update({ where: { id }, data: { active: false } });
};
```

- [ ] **Step 7: Controllers**

`src/modules/transport/vehicles.controller.ts`:

```ts
import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import { getAllVehicles, createVehicle, updateVehicle, deleteVehicle } from './vehicles.service';

export const getAll = (req: TenantRequest, res: Response) =>
    respond(res, () => getAllVehicles(req.branchId!), {
        message: 'Vehicles retrieved successfully',
        failure: 'Failed to retrieve vehicles',
    });

export const create = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () => createVehicle({ plate: req.body.plate, capacity: Number(req.body.capacity), branchId: req.branchId! }),
        { message: 'Vehicle created successfully', status: 201, failure: 'Failed to create vehicle' }
    );

export const update = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            updateVehicle(req.params.id, req.branchId!, {
                plate: req.body.plate,
                capacity: req.body.capacity !== undefined ? Number(req.body.capacity) : undefined,
                active: req.body.active,
            }),
        { message: 'Vehicle updated successfully', failure: 'Failed to update vehicle' }
    );

export const remove = (req: TenantRequest, res: Response) =>
    respond(res, async () => {
        await deleteVehicle(req.params.id, req.branchId!);
        return null;
    }, { message: 'Vehicle deleted successfully', failure: 'Failed to delete vehicle' });
```

`src/modules/transport/drivers.controller.ts`:

```ts
import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import { getAllDrivers, createDriver, updateDriver, deleteDriver } from './drivers.service';

export const getAll = (req: TenantRequest, res: Response) =>
    respond(res, () => getAllDrivers(req.branchId!), {
        message: 'Drivers retrieved successfully',
        failure: 'Failed to retrieve drivers',
    });

export const create = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () => createDriver({ name: req.body.name, phone: req.body.phone, branchId: req.branchId! }),
        { message: 'Driver created successfully', status: 201, failure: 'Failed to create driver' }
    );

export const update = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            updateDriver(req.params.id, req.branchId!, {
                name: req.body.name,
                phone: req.body.phone,
                active: req.body.active,
            }),
        { message: 'Driver updated successfully', failure: 'Failed to update driver' }
    );

export const remove = (req: TenantRequest, res: Response) =>
    respond(res, async () => {
        await deleteDriver(req.params.id, req.branchId!);
        return null;
    }, { message: 'Driver deleted successfully', failure: 'Failed to delete driver' });
```

- [ ] **Step 8: Run tests + typecheck**

Run: `npx jest src/modules/transport && npx tsc --noEmit -p .`
Expected: all transport tests PASS (vehicles 7, drivers 5, plus earlier), tsc silent.

- [ ] **Step 9: Commit**

```bash
git add apps/education-apps/src/modules/transport
git commit -m "feat(education): transport vehicles and drivers services and controllers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Routes and stops

**Files:**
- Create: `src/modules/transport/routes.service.ts`, `routes.service.test.ts`, `routes.controller.ts`

- [ ] **Step 1: Write the failing tests**

`src/modules/transport/routes.service.test.ts`:

```ts
import prisma from '../../config/database';
import {
    getAllRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
    createStop,
    updateStop,
    deleteStop,
} from './routes.service';
import * as open from './openSubscriptions';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        vehicle: { findFirst: jest.fn() },
        driver: { findFirst: jest.fn() },
        transportRoute: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
        transportStop: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
        transportSubscription: { count: jest.fn() },
    },
}));
jest.mock('./openSubscriptions');

describe('routes service — branch scoping', () => {
    afterEach(() => jest.resetAllMocks());

    it('getAllRoutes only returns active routes of the branch, with ordered active stops', async () => {
        (prisma.transportRoute.findMany as jest.Mock).mockResolvedValue([]);

        await getAllRoutes('b1');

        expect(prisma.transportRoute.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { branchId: 'b1', active: true },
                include: {
                    vehicle: true,
                    driver: true,
                    stops: { where: { active: true }, orderBy: { order: 'asc' } },
                },
            })
        );
    });

    it('createRoute stamps branchId after validating vehicle and driver belong to the branch', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
        (prisma.driver.findFirst as jest.Mock).mockResolvedValue({ id: 'd1' });
        (prisma.transportRoute.create as jest.Mock).mockResolvedValue({ id: 'r1' });

        await createRoute({ name: 'Agdal', vehicleId: 'v1', driverId: 'd1', monthlyPrice: 300, branchId: 'b1' });

        expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({ where: { id: 'v1', branchId: 'b1', active: true } });
        expect(prisma.driver.findFirst).toHaveBeenCalledWith({ where: { id: 'd1', branchId: 'b1', active: true } });
        expect(prisma.transportRoute.create).toHaveBeenCalledWith({
            data: { name: 'Agdal', vehicleId: 'v1', driverId: 'd1', monthlyPrice: 300, branchId: 'b1' },
        });
    });

    it('createRoute rejects a vehicle from another branch', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
            createRoute({ name: 'Agdal', vehicleId: 'v9', driverId: 'd1', branchId: 'b1' })
        ).rejects.toThrow('Vehicle does not belong to this branch');
    });

    it('createRoute rejects a driver from another branch', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
        (prisma.driver.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
            createRoute({ name: 'Agdal', vehicleId: 'v1', driverId: 'd9', branchId: 'b1' })
        ).rejects.toThrow('Driver does not belong to this branch');
    });

    it('createRoute rejects a negative price', async () => {
        await expect(
            createRoute({ name: 'A', vehicleId: 'v1', driverId: 'd1', monthlyPrice: -5, branchId: 'b1' })
        ).rejects.toThrow('Price must be a non-negative number');
    });

    it('updateRoute throws for a route outside the branch', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateRoute('r1', 'b1', { name: 'X' })).rejects.toThrow('Route not found');
    });

    it('updateRoute refuses to deactivate a route with open subscriptions', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1', vehicleId: 'v1' });
        (open.countOpenSubscriptions as jest.Mock).mockResolvedValue(2);

        await expect(updateRoute('r1', 'b1', { active: false })).rejects.toThrow(
            'Route has active subscriptions'
        );
        expect(prisma.transportRoute.update).not.toHaveBeenCalled();
    });

    it('updateRoute refuses a replacement vehicle smaller than the route\'s ACTIVE subscriptions', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1', vehicleId: 'v1' });
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v2', capacity: 10 });
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(12);

        await expect(updateRoute('r1', 'b1', { vehicleId: 'v2' })).rejects.toThrow(
            'New vehicle capacity is lower than the route\'s active subscriptions'
        );
    });

    it('deleteRoute soft-deletes an unused route', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1' });
        (open.countOpenSubscriptions as jest.Mock).mockResolvedValue(0);
        (prisma.transportRoute.update as jest.Mock).mockResolvedValue({ id: 'r1' });

        await deleteRoute('r1', 'b1');

        expect(prisma.transportRoute.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { active: false } });
    });
});

describe('stops', () => {
    afterEach(() => jest.resetAllMocks());

    const stopInput = { name: 'Place Verte', order: 1, morningTime: '07:15', afternoonTime: '17:30' };

    it('createStop validates the route belongs to the branch and stamps branchId', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1' });
        (prisma.transportStop.create as jest.Mock).mockResolvedValue({ id: 'st1' });

        await createStop('r1', 'b1', { ...stopInput, monthlyPrice: 250 });

        expect(prisma.transportRoute.findFirst).toHaveBeenCalledWith({ where: { id: 'r1', branchId: 'b1', active: true } });
        expect(prisma.transportStop.create).toHaveBeenCalledWith({
            data: { ...stopInput, monthlyPrice: 250, routeId: 'r1', branchId: 'b1' },
        });
    });

    it('createStop throws when the route is not in the branch', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(createStop('r1', 'b1', stopInput)).rejects.toThrow('Route not found');
    });

    it('createStop rejects times that are not HH:mm', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1' });

        await expect(createStop('r1', 'b1', { ...stopInput, morningTime: '7h15' })).rejects.toThrow(
            'Morning time must be in HH:mm format'
        );
        await expect(createStop('r1', 'b1', { ...stopInput, afternoonTime: '25:00' })).rejects.toThrow(
            'Afternoon time must be in HH:mm format'
        );
    });

    it('updateStop throws for a stop outside the branch', async () => {
        (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateStop('st1', 'b1', { name: 'X' })).rejects.toThrow('Stop not found');
        expect(prisma.transportStop.findFirst).toHaveBeenCalledWith({ where: { id: 'st1', branchId: 'b1' } });
    });

    it('deleteStop refuses when open subscriptions use the stop', async () => {
        (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue({ id: 'st1' });
        (open.countOpenSubscriptions as jest.Mock).mockResolvedValue(1);

        await expect(deleteStop('st1', 'b1')).rejects.toThrow('Stop has active subscriptions');
        expect(open.countOpenSubscriptions).toHaveBeenCalledWith('b1', { stopId: 'st1' });
    });

    it('deleteStop soft-deletes an unused stop', async () => {
        (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue({ id: 'st1' });
        (open.countOpenSubscriptions as jest.Mock).mockResolvedValue(0);
        (prisma.transportStop.update as jest.Mock).mockResolvedValue({ id: 'st1' });

        await deleteStop('st1', 'b1');

        expect(prisma.transportStop.update).toHaveBeenCalledWith({ where: { id: 'st1' }, data: { active: false } });
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/transport/routes.service.test.ts`
Expected: FAIL — `Cannot find module './routes.service'`.

- [ ] **Step 3: Implement**

`src/modules/transport/routes.service.ts`:

```ts
import prisma from '../../config/database';
import { countOpenSubscriptions } from './openSubscriptions';

export interface RouteData {
    name: string;
    vehicleId: string;
    driverId: string;
    monthlyPrice?: number | null;
    branchId: string;
}

export interface UpdateRouteData {
    name?: string;
    vehicleId?: string;
    driverId?: string;
    monthlyPrice?: number | null;
    active?: boolean;
}

export interface StopData {
    name: string;
    order: number;
    morningTime: string;
    afternoonTime: string;
    monthlyPrice?: number | null;
}

export interface UpdateStopData extends Partial<StopData> {}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const assertName = (name: unknown) => {
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name is required');
};

const assertPrice = (price: unknown) => {
    if (price !== undefined && price !== null && !(typeof price === 'number' && price >= 0)) {
        throw new Error('Price must be a non-negative number');
    }
};

const assertTime = (label: string, value: unknown) => {
    if (typeof value !== 'string' || !TIME_RE.test(value)) throw new Error(`${label} must be in HH:mm format`);
};

const assertOrder = (order: unknown) => {
    if (!Number.isInteger(order) || (order as number) < 1) throw new Error('Order must be a positive integer');
};

const findVehicle = async (vehicleId: string, branchId: string) => {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, branchId, active: true } });
    if (!vehicle) throw new Error('Vehicle does not belong to this branch');
    return vehicle;
};

const assertDriver = async (driverId: string, branchId: string) => {
    const driver = await prisma.driver.findFirst({ where: { id: driverId, branchId, active: true } });
    if (!driver) throw new Error('Driver does not belong to this branch');
};

// ---------- routes ----------

export const getAllRoutes = async (branchId: string) => {
    return prisma.transportRoute.findMany({
        where: { branchId, active: true },
        include: {
            vehicle: true,
            driver: true,
            stops: { where: { active: true }, orderBy: { order: 'asc' } },
        },
        orderBy: { name: 'asc' },
    });
};

export const createRoute = async (data: RouteData) => {
    assertName(data.name);
    assertPrice(data.monthlyPrice);
    await findVehicle(data.vehicleId, data.branchId);
    await assertDriver(data.driverId, data.branchId);

    return prisma.transportRoute.create({
        data: {
            name: data.name.trim(),
            vehicleId: data.vehicleId,
            driverId: data.driverId,
            monthlyPrice: data.monthlyPrice,
            branchId: data.branchId,
        },
    });
};

export const updateRoute = async (id: string, branchId: string, data: UpdateRouteData) => {
    const existing = await prisma.transportRoute.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Route not found');

    if (data.name !== undefined) assertName(data.name);
    if (data.monthlyPrice !== undefined) assertPrice(data.monthlyPrice);

    if (data.vehicleId !== undefined && data.vehicleId !== existing.vehicleId) {
        const vehicle = await findVehicle(data.vehicleId, branchId);
        const activeCount = await prisma.transportSubscription.count({
            where: { routeId: id, branchId, status: 'ACTIVE' },
        });
        if (activeCount > vehicle.capacity) {
            throw new Error("New vehicle capacity is lower than the route's active subscriptions");
        }
    }
    if (data.driverId !== undefined && data.driverId !== existing.driverId) {
        await assertDriver(data.driverId, branchId);
    }
    if (data.active === false && (await countOpenSubscriptions(branchId, { routeId: id })) > 0) {
        throw new Error('Route has active subscriptions');
    }

    return prisma.transportRoute.update({
        where: { id },
        data: {
            name: data.name?.trim(),
            vehicleId: data.vehicleId,
            driverId: data.driverId,
            monthlyPrice: data.monthlyPrice,
            active: data.active,
        },
    });
};

export const deleteRoute = async (id: string, branchId: string) => {
    const existing = await prisma.transportRoute.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Route not found');

    if ((await countOpenSubscriptions(branchId, { routeId: id })) > 0) {
        throw new Error('Route has active subscriptions');
    }

    return prisma.transportRoute.update({ where: { id }, data: { active: false } });
};

// ---------- stops ----------

export const createStop = async (routeId: string, branchId: string, data: StopData) => {
    const route = await prisma.transportRoute.findFirst({ where: { id: routeId, branchId, active: true } });
    if (!route) throw new Error('Route not found');

    assertName(data.name);
    assertOrder(data.order);
    assertTime('Morning time', data.morningTime);
    assertTime('Afternoon time', data.afternoonTime);
    assertPrice(data.monthlyPrice);

    return prisma.transportStop.create({
        data: {
            name: data.name.trim(),
            order: data.order,
            morningTime: data.morningTime,
            afternoonTime: data.afternoonTime,
            monthlyPrice: data.monthlyPrice,
            routeId,
            branchId,
        },
    });
};

export const updateStop = async (id: string, branchId: string, data: UpdateStopData) => {
    const existing = await prisma.transportStop.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Stop not found');

    if (data.name !== undefined) assertName(data.name);
    if (data.order !== undefined) assertOrder(data.order);
    if (data.morningTime !== undefined) assertTime('Morning time', data.morningTime);
    if (data.afternoonTime !== undefined) assertTime('Afternoon time', data.afternoonTime);
    if (data.monthlyPrice !== undefined) assertPrice(data.monthlyPrice);

    return prisma.transportStop.update({
        where: { id },
        data: {
            name: data.name?.trim(),
            order: data.order,
            morningTime: data.morningTime,
            afternoonTime: data.afternoonTime,
            monthlyPrice: data.monthlyPrice,
        },
    });
};

export const deleteStop = async (id: string, branchId: string) => {
    const existing = await prisma.transportStop.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Stop not found');

    if ((await countOpenSubscriptions(branchId, { stopId: id })) > 0) {
        throw new Error('Stop has active subscriptions');
    }

    return prisma.transportStop.update({ where: { id }, data: { active: false } });
};
```

- [ ] **Step 4: Controller**

`src/modules/transport/routes.controller.ts`:

```ts
import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import {
    getAllRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
    createStop,
    updateStop,
    deleteStop,
} from './routes.service';

const optionalNumber = (value: unknown) =>
    value === undefined ? undefined : value === null || value === '' ? null : Number(value);

export const getAll = (req: TenantRequest, res: Response) =>
    respond(res, () => getAllRoutes(req.branchId!), {
        message: 'Routes retrieved successfully',
        failure: 'Failed to retrieve routes',
    });

export const create = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            createRoute({
                name: req.body.name,
                vehicleId: req.body.vehicleId,
                driverId: req.body.driverId,
                monthlyPrice: optionalNumber(req.body.monthlyPrice),
                branchId: req.branchId!,
            }),
        { message: 'Route created successfully', status: 201, failure: 'Failed to create route' }
    );

export const update = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            updateRoute(req.params.id, req.branchId!, {
                name: req.body.name,
                vehicleId: req.body.vehicleId,
                driverId: req.body.driverId,
                monthlyPrice: optionalNumber(req.body.monthlyPrice),
                active: req.body.active,
            }),
        { message: 'Route updated successfully', failure: 'Failed to update route' }
    );

export const remove = (req: TenantRequest, res: Response) =>
    respond(res, async () => {
        await deleteRoute(req.params.id, req.branchId!);
        return null;
    }, { message: 'Route deleted successfully', failure: 'Failed to delete route' });

export const addStop = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            createStop(req.params.id, req.branchId!, {
                name: req.body.name,
                order: Number(req.body.order),
                morningTime: req.body.morningTime,
                afternoonTime: req.body.afternoonTime,
                monthlyPrice: optionalNumber(req.body.monthlyPrice),
            }),
        { message: 'Stop created successfully', status: 201, failure: 'Failed to create stop' }
    );

export const editStop = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            updateStop(req.params.stopId, req.branchId!, {
                name: req.body.name,
                order: req.body.order !== undefined ? Number(req.body.order) : undefined,
                morningTime: req.body.morningTime,
                afternoonTime: req.body.afternoonTime,
                monthlyPrice: optionalNumber(req.body.monthlyPrice),
            }),
        { message: 'Stop updated successfully', failure: 'Failed to update stop' }
    );

export const removeStop = (req: TenantRequest, res: Response) =>
    respond(res, async () => {
        await deleteStop(req.params.stopId, req.branchId!);
        return null;
    }, { message: 'Stop deleted successfully', failure: 'Failed to delete stop' });
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest src/modules/transport && npx tsc --noEmit -p .`
Expected: PASS, tsc silent.

- [ ] **Step 6: Commit**

```bash
git add apps/education-apps/src/modules/transport
git commit -m "feat(education): transport routes and stops service and controller

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Subscriptions

**Files:**
- Create: `src/modules/transport/subscriptions.service.ts`, `subscriptions.service.test.ts`, `subscriptions.controller.ts`

- [ ] **Step 1: Write the failing tests**

`src/modules/transport/subscriptions.service.test.ts`:

```ts
import prisma from '../../config/database';
import {
    createSubscription,
    pauseSubscription,
    resumeSubscription,
    endSubscription,
    listSubscriptions,
    getOpenSubscriptionForStudent,
} from './subscriptions.service';
import { currentMonth } from './month';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findFirst: jest.fn() },
        transportRoute: { findFirst: jest.fn() },
        transportStop: { findFirst: jest.fn() },
        transportSubscription: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        settings: { findUnique: jest.fn() },
        payment: { findFirst: jest.fn() },
    },
}));

const route = { id: 'r1', monthlyPrice: 300, vehicle: { capacity: 2 } };
const stop = { id: 'st1', monthlyPrice: 250 };

const arrangeHappyPath = () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1' });
    (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(route);
    (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue(stop);
    (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(0);
    (prisma.settings.findUnique as jest.Mock).mockResolvedValue({ transportPricingMode: 'ROUTE' });
    (prisma.transportSubscription.create as jest.Mock).mockResolvedValue({ id: 'sub1' });
};

describe('createSubscription', () => {
    afterEach(() => jest.resetAllMocks());

    const input = { studentId: 's1', routeId: 'r1', stopId: 'st1', branchId: 'b1' };

    it('validates every reference inside the branch and stamps branchId', async () => {
        arrangeHappyPath();

        await createSubscription(input);

        expect(prisma.student.findFirst).toHaveBeenCalledWith({ where: { id: 's1', branchId: 'b1' } });
        expect(prisma.transportRoute.findFirst).toHaveBeenCalledWith({
            where: { id: 'r1', branchId: 'b1', active: true },
            include: { vehicle: true },
        });
        expect(prisma.transportStop.findFirst).toHaveBeenCalledWith({
            where: { id: 'st1', routeId: 'r1', branchId: 'b1', active: true },
        });
        expect(prisma.transportSubscription.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ studentId: 's1', routeId: 'r1', stopId: 'st1', branchId: 'b1' }),
            })
        );
    });

    it('snapshots the price for the branch pricing mode', async () => {
        arrangeHappyPath();
        (prisma.settings.findUnique as jest.Mock).mockResolvedValue({
            transportPricingMode: 'STOP',
            transportUniformPrice: 200,
        });

        await createSubscription(input);

        expect(prisma.transportSubscription.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ monthlyPrice: 250 }) })
        );
    });

    it('falls back to ROUTE pricing when the branch has no settings row yet', async () => {
        arrangeHappyPath();
        (prisma.settings.findUnique as jest.Mock).mockResolvedValue(null);

        await createSubscription(input);

        expect(prisma.transportSubscription.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ monthlyPrice: 300 }) })
        );
    });

    it('rejects a student from another branch', async () => {
        arrangeHappyPath();
        (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(createSubscription(input)).rejects.toThrow('Student not found');
    });

    it('rejects a route from another branch', async () => {
        arrangeHappyPath();
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(createSubscription(input)).rejects.toThrow('Route not found');
    });

    it('rejects a stop that does not belong to the route', async () => {
        arrangeHappyPath();
        (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(createSubscription(input)).rejects.toThrow('Stop does not belong to this route');
    });

    it('rejects a second open subscription for the same student', async () => {
        arrangeHappyPath();
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

        await expect(createSubscription(input)).rejects.toThrow('Student already has an open transport subscription');
        expect(prisma.transportSubscription.findFirst).toHaveBeenCalledWith({
            where: { studentId: 's1', branchId: 'b1', status: { in: ['ACTIVE', 'PAUSED'] } },
        });
    });

    it('rejects when the route is at its vehicle capacity', async () => {
        arrangeHappyPath();
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(2);

        await expect(createSubscription(input)).rejects.toThrow('Vehicle is at full capacity');
        expect(prisma.transportSubscription.count).toHaveBeenCalledWith({
            where: { routeId: 'r1', branchId: 'b1', status: 'ACTIVE' },
        });
    });

    it('rejects when no price is configured for the mode', async () => {
        arrangeHappyPath();
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ ...route, monthlyPrice: null });

        await expect(createSubscription(input)).rejects.toThrow(
            'Transport price is not configured for pricing mode ROUTE'
        );
        expect(prisma.transportSubscription.create).not.toHaveBeenCalled();
    });
});

describe('status transitions', () => {
    afterEach(() => jest.resetAllMocks());

    it('pauseSubscription moves ACTIVE to PAUSED', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'ACTIVE' });
        (prisma.transportSubscription.update as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'PAUSED' });

        await pauseSubscription('sub1', 'b1');

        expect(prisma.transportSubscription.findFirst).toHaveBeenCalledWith({ where: { id: 'sub1', branchId: 'b1' } });
        expect(prisma.transportSubscription.update).toHaveBeenCalledWith({
            where: { id: 'sub1' },
            data: { status: 'PAUSED' },
        });
    });

    it('pauseSubscription rejects a subscription that is not ACTIVE', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'PAUSED' });

        await expect(pauseSubscription('sub1', 'b1')).rejects.toThrow('Only an active subscription can be paused');
    });

    it('resumeSubscription re-checks capacity before reactivating', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({
            id: 'sub1',
            status: 'PAUSED',
            routeId: 'r1',
        });
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(route);
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(2);

        await expect(resumeSubscription('sub1', 'b1')).rejects.toThrow('Vehicle is at full capacity');
        expect(prisma.transportSubscription.update).not.toHaveBeenCalled();
    });

    it('resumeSubscription moves PAUSED to ACTIVE when there is room', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({
            id: 'sub1',
            status: 'PAUSED',
            routeId: 'r1',
        });
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(route);
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(1);
        (prisma.transportSubscription.update as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'ACTIVE' });

        await resumeSubscription('sub1', 'b1');

        expect(prisma.transportSubscription.update).toHaveBeenCalledWith({
            where: { id: 'sub1' },
            data: { status: 'ACTIVE' },
        });
    });

    it('endSubscription sets ENDED and an endDate, for ACTIVE or PAUSED', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'PAUSED' });
        (prisma.transportSubscription.update as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'ENDED' });

        await endSubscription('sub1', 'b1');

        expect(prisma.transportSubscription.update).toHaveBeenCalledWith({
            where: { id: 'sub1' },
            data: { status: 'ENDED', endDate: expect.any(Date) },
        });
    });

    it('endSubscription rejects an already ended subscription', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'ENDED' });

        await expect(endSubscription('sub1', 'b1')).rejects.toThrow('Subscription has already ended');
    });

    it('throws for a subscription outside the branch', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(pauseSubscription('sub1', 'b1')).rejects.toThrow('Subscription not found');
    });
});

describe('reads', () => {
    afterEach(() => jest.resetAllMocks());

    it('listSubscriptions is scoped to the branch and optionally filtered by status', async () => {
        (prisma.transportSubscription.findMany as jest.Mock).mockResolvedValue([]);

        await listSubscriptions('b1', 'ACTIVE');

        expect(prisma.transportSubscription.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1', status: 'ACTIVE' } })
        );
    });

    it('getOpenSubscriptionForStudent returns null when the student has none', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(null);

        expect(await getOpenSubscriptionForStudent('s1', 'b1')).toBeNull();
    });

    it('getOpenSubscriptionForStudent reports whether the current month is paid', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1' });
        (prisma.payment.findFirst as jest.Mock).mockResolvedValue({ id: 'p1' });

        const result = await getOpenSubscriptionForStudent('s1', 'b1');

        expect(prisma.payment.findFirst).toHaveBeenCalledWith({
            where: { transportSubscriptionId: 'sub1', forMonth: currentMonth(), branchId: 'b1' },
        });
        expect(result).toEqual(
            expect.objectContaining({ id: 'sub1', currentMonth: currentMonth(), paidCurrentMonth: true })
        );
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/transport/subscriptions.service.test.ts`
Expected: FAIL — `Cannot find module './subscriptions.service'`.

- [ ] **Step 3: Implement**

`src/modules/transport/subscriptions.service.ts`:

```ts
import prisma from '../../config/database';
import { currentMonth } from './month';
import { OPEN_STATUSES } from './openSubscriptions';
import { resolveMonthlyPrice } from './pricing';

export interface CreateSubscriptionData {
    studentId: string;
    routeId: string;
    stopId: string;
    startDate?: Date;
    branchId: string;
}

type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';

const assertRoomOnRoute = async (route: { id: string; vehicle: { capacity: number } }, branchId: string) => {
    const activeCount = await prisma.transportSubscription.count({
        where: { routeId: route.id, branchId, status: 'ACTIVE' },
    });
    if (activeCount >= route.vehicle.capacity) throw new Error('Vehicle is at full capacity');
};

const findOwned = async (id: string, branchId: string) => {
    const subscription = await prisma.transportSubscription.findFirst({ where: { id, branchId } });
    if (!subscription) throw new Error('Subscription not found');
    return subscription;
};

export const createSubscription = async (data: CreateSubscriptionData) => {
    const { studentId, routeId, stopId, branchId } = data;

    const student = await prisma.student.findFirst({ where: { id: studentId, branchId } });
    if (!student) throw new Error('Student not found');

    const route = await prisma.transportRoute.findFirst({
        where: { id: routeId, branchId, active: true },
        include: { vehicle: true },
    });
    if (!route) throw new Error('Route not found');

    const stop = await prisma.transportStop.findFirst({ where: { id: stopId, routeId, branchId, active: true } });
    if (!stop) throw new Error('Stop does not belong to this route');

    const open = await prisma.transportSubscription.findFirst({
        where: { studentId, branchId, status: { in: [...OPEN_STATUSES] } },
    });
    if (open) throw new Error('Student already has an open transport subscription');

    await assertRoomOnRoute(route, branchId);

    const settings = await prisma.settings.findUnique({ where: { branchId } });
    const monthlyPrice = resolveMonthlyPrice(
        settings?.transportPricingMode,
        route,
        stop,
        settings?.transportUniformPrice
    );

    return prisma.transportSubscription.create({
        data: { studentId, routeId, stopId, monthlyPrice, startDate: data.startDate ?? new Date(), branchId },
        include: { student: true, route: true, stop: true },
    });
};

export const pauseSubscription = async (id: string, branchId: string) => {
    const subscription = await findOwned(id, branchId);
    if (subscription.status !== 'ACTIVE') throw new Error('Only an active subscription can be paused');

    return prisma.transportSubscription.update({ where: { id }, data: { status: 'PAUSED' } });
};

export const resumeSubscription = async (id: string, branchId: string) => {
    const subscription = await findOwned(id, branchId);
    if (subscription.status !== 'PAUSED') throw new Error('Only a paused subscription can be resumed');

    const route = await prisma.transportRoute.findFirst({
        where: { id: subscription.routeId, branchId },
        include: { vehicle: true },
    });
    if (!route) throw new Error('Route not found');

    await assertRoomOnRoute(route, branchId);

    return prisma.transportSubscription.update({ where: { id }, data: { status: 'ACTIVE' } });
};

export const endSubscription = async (id: string, branchId: string) => {
    const subscription = await findOwned(id, branchId);
    if (subscription.status === 'ENDED') throw new Error('Subscription has already ended');

    return prisma.transportSubscription.update({ where: { id }, data: { status: 'ENDED', endDate: new Date() } });
};

export const listSubscriptions = async (branchId: string, status?: SubscriptionStatus) => {
    return prisma.transportSubscription.findMany({
        where: { branchId, ...(status && { status }) },
        include: { student: true, route: true, stop: true },
        orderBy: { createdAt: 'desc' },
    });
};

// The student's current (ACTIVE/PAUSED) subscription with route/driver/vehicle/stop, plus whether
// the current month is paid. Powers the card on the student page.
export const getOpenSubscriptionForStudent = async (studentId: string, branchId: string) => {
    const subscription = await prisma.transportSubscription.findFirst({
        where: { studentId, branchId, status: { in: [...OPEN_STATUSES] } },
        include: { route: { include: { driver: true, vehicle: true } }, stop: true },
    });
    if (!subscription) return null;

    const month = currentMonth();
    const payment = await prisma.payment.findFirst({
        where: { transportSubscriptionId: subscription.id, forMonth: month, branchId },
    });

    return { ...subscription, currentMonth: month, paidCurrentMonth: !!payment };
};
```

- [ ] **Step 4: Controller**

`src/modules/transport/subscriptions.controller.ts`:

```ts
import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import {
    createSubscription,
    pauseSubscription,
    resumeSubscription,
    endSubscription,
    listSubscriptions,
    getOpenSubscriptionForStudent,
} from './subscriptions.service';

const STATUSES = ['ACTIVE', 'PAUSED', 'ENDED'];

export const getAll = (req: TenantRequest, res: Response) =>
    respond(
        res,
        async () => {
            const status = req.query.status as string | undefined;
            if (status !== undefined && !STATUSES.includes(status)) throw new Error('Invalid status');
            return listSubscriptions(req.branchId!, status as 'ACTIVE' | 'PAUSED' | 'ENDED' | undefined);
        },
        { message: 'Subscriptions retrieved successfully', failure: 'Failed to retrieve subscriptions' }
    );

export const getForStudent = (req: TenantRequest, res: Response) =>
    respond(res, () => getOpenSubscriptionForStudent(req.params.studentId, req.branchId!), {
        message: 'Subscription retrieved successfully',
        failure: 'Failed to retrieve subscription',
    });

export const create = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            createSubscription({
                studentId: req.body.studentId,
                routeId: req.body.routeId,
                stopId: req.body.stopId,
                startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
                branchId: req.branchId!,
            }),
        { message: 'Subscription created successfully', status: 201, failure: 'Failed to create subscription' }
    );

export const pause = (req: TenantRequest, res: Response) =>
    respond(res, () => pauseSubscription(req.params.id, req.branchId!), {
        message: 'Subscription paused successfully',
        failure: 'Failed to pause subscription',
    });

export const resume = (req: TenantRequest, res: Response) =>
    respond(res, () => resumeSubscription(req.params.id, req.branchId!), {
        message: 'Subscription resumed successfully',
        failure: 'Failed to resume subscription',
    });

export const end = (req: TenantRequest, res: Response) =>
    respond(res, () => endSubscription(req.params.id, req.branchId!), {
        message: 'Subscription ended successfully',
        failure: 'Failed to end subscription',
    });
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest src/modules/transport && npx tsc --noEmit -p .`
Expected: PASS, tsc silent.

- [ ] **Step 6: Commit**

```bash
git add apps/education-apps/src/modules/transport
git commit -m "feat(education): transport subscriptions with capacity, uniqueness and price snapshot

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Transport payments and dues

**Files:**
- Create: `src/modules/transport/payments.service.ts`, `payments.service.test.ts`, `payments.controller.ts`

- [ ] **Step 1: Write the failing tests**

`src/modules/transport/payments.service.test.ts`:

```ts
import prisma from '../../config/database';
import { recordTransportPayment, getDues } from './payments.service';

jest.mock('../../config/database', () => {
    const tx = {
        payment: { findFirst: jest.fn(), create: jest.fn() },
        transaction: { create: jest.fn() },
    };
    return {
        __esModule: true,
        default: {
            transportSubscription: { findFirst: jest.fn(), findMany: jest.fn() },
            payment: { findMany: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

const subscription = {
    id: 'sub1',
    studentId: 's1',
    status: 'ACTIVE',
    monthlyPrice: 300,
    student: { name: 'Sara', surname: 'Alaoui' },
};

describe('recordTransportPayment', () => {
    afterEach(() => jest.clearAllMocks());

    const input = { subscriptionId: 'sub1', branchId: 'b1', forMonth: '2026-09', method: 'Espèces' };

    it('creates the payment and an INCOME transaction atomically, stamping branchId', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);
        tx.payment.findFirst.mockResolvedValue(null);
        tx.payment.create.mockResolvedValue({ id: 'p1' });

        await recordTransportPayment(input);

        expect(prisma.transportSubscription.findFirst).toHaveBeenCalledWith({
            where: { id: 'sub1', branchId: 'b1' },
            include: { student: true },
        });
        expect(tx.payment.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    studentId: 's1',
                    transportSubscriptionId: 'sub1',
                    forMonth: '2026-09',
                    amount: 300,
                    method: 'Espèces',
                    branchId: 'b1',
                }),
            })
        );
        expect(tx.transaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ type: 'INCOME', amount: 300, category: 'Transport', branchId: 'b1' }),
        });
    });

    it('uses an explicit amount over the subscription price', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);
        tx.payment.findFirst.mockResolvedValue(null);
        tx.payment.create.mockResolvedValue({ id: 'p1' });

        await recordTransportPayment({ ...input, amount: 150 });

        expect(tx.payment.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ amount: 150 }) })
        );
        expect(tx.transaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ amount: 150 }),
        });
    });

    it('rejects a duplicate payment for the same subscription and month, without writing a transaction', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);
        tx.payment.findFirst.mockResolvedValue({ id: 'existing' });

        await expect(recordTransportPayment(input)).rejects.toThrow('Payment already recorded for this month');
        expect(tx.payment.findFirst).toHaveBeenCalledWith({
            where: { transportSubscriptionId: 'sub1', forMonth: '2026-09', branchId: 'b1' },
        });
        expect(tx.payment.create).not.toHaveBeenCalled();
        expect(tx.transaction.create).not.toHaveBeenCalled();
    });

    it('throws for a subscription outside the branch', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(recordTransportPayment(input)).rejects.toThrow('Subscription not found');
    });

    it('rejects an ended subscription', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ ...subscription, status: 'ENDED' });

        await expect(recordTransportPayment(input)).rejects.toThrow('Subscription has ended');
    });

    it('rejects a malformed month', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);

        await expect(recordTransportPayment({ ...input, forMonth: '09/2026' })).rejects.toThrow(
            'forMonth must be in YYYY-MM format'
        );
    });

    it('rejects a non-positive amount', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);

        await expect(recordTransportPayment({ ...input, amount: 0 })).rejects.toThrow('Amount must be greater than 0');
    });

    it('requires a payment method', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);

        await expect(recordTransportPayment({ ...input, method: ' ' })).rejects.toThrow('Method is required');
    });
});

describe('getDues', () => {
    afterEach(() => jest.clearAllMocks());

    it('returns ACTIVE subscriptions started by the month that have no payment for it', async () => {
        (prisma.transportSubscription.findMany as jest.Mock).mockResolvedValue([{ id: 'sub1' }, { id: 'sub2' }]);
        (prisma.payment.findMany as jest.Mock).mockResolvedValue([{ transportSubscriptionId: 'sub1' }]);

        const dues = await getDues('b1', '2026-09');

        expect(prisma.transportSubscription.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { branchId: 'b1', status: 'ACTIVE', startDate: { lt: new Date(2026, 9, 1) } },
            })
        );
        expect(prisma.payment.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1', forMonth: '2026-09', transportSubscriptionId: { in: ['sub1', 'sub2'] } },
            select: { transportSubscriptionId: true },
        });
        expect(dues).toEqual([{ id: 'sub2' }]);
    });

    it('rejects a malformed month', async () => {
        await expect(getDues('b1', 'nope')).rejects.toThrow('month must be in YYYY-MM format');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/transport/payments.service.test.ts`
Expected: FAIL — `Cannot find module './payments.service'`.

- [ ] **Step 3: Implement**

`src/modules/transport/payments.service.ts`:

```ts
import prisma from '../../config/database';
import { currentMonth, isValidMonth, startOfNextMonth } from './month';

export interface TransportPaymentData {
    subscriptionId: string;
    branchId: string;
    forMonth: string;
    amount?: number;
    method: string;
    note?: string;
    date?: Date;
}

export const recordTransportPayment = async (data: TransportPaymentData) => {
    const { subscriptionId, branchId } = data;

    const subscription = await prisma.transportSubscription.findFirst({
        where: { id: subscriptionId, branchId },
        include: { student: true },
    });
    if (!subscription) throw new Error('Subscription not found');
    if (subscription.status === 'ENDED') throw new Error('Subscription has ended');

    if (!isValidMonth(data.forMonth)) throw new Error('forMonth must be in YYYY-MM format');
    if (typeof data.method !== 'string' || !data.method.trim()) throw new Error('Method is required');

    const amount = data.amount ?? subscription.monthlyPrice;
    if (!(amount > 0)) throw new Error('Amount must be greater than 0');

    const date = data.date ?? new Date();

    // Payment and Transaction are written together; the duplicate-month check lives inside the same
    // transaction (there is no unique index — MongoDB treats missing/null as equal).
    return prisma.$transaction(async (tx) => {
        const duplicate = await tx.payment.findFirst({
            where: { transportSubscriptionId: subscriptionId, forMonth: data.forMonth, branchId },
        });
        if (duplicate) throw new Error('Payment already recorded for this month');

        const payment = await tx.payment.create({
            data: {
                studentId: subscription.studentId,
                transportSubscriptionId: subscriptionId,
                forMonth: data.forMonth,
                amount,
                method: data.method.trim(),
                note: data.note,
                date,
                branchId,
            },
        });

        await tx.transaction.create({
            data: {
                type: 'INCOME',
                amount,
                category: 'Transport',
                branchId,
                description: `Transport ${data.forMonth} — ${subscription.student.name} ${subscription.student.surname} (${data.method.trim()})`,
                date,
            },
        });

        return payment;
    });
};

// ACTIVE subscriptions that had started by the end of `month` and have no payment recorded for it.
export const getDues = async (branchId: string, month: string = currentMonth()) => {
    if (!isValidMonth(month)) throw new Error('month must be in YYYY-MM format');

    const subscriptions = await prisma.transportSubscription.findMany({
        where: { branchId, status: 'ACTIVE', startDate: { lt: startOfNextMonth(month) } },
        include: { student: true, route: true, stop: true },
        orderBy: { createdAt: 'asc' },
    });
    if (subscriptions.length === 0) return [];

    const paid = await prisma.payment.findMany({
        where: {
            branchId,
            forMonth: month,
            transportSubscriptionId: { in: subscriptions.map((subscription) => subscription.id) },
        },
        select: { transportSubscriptionId: true },
    });
    const paidIds = new Set(paid.map((payment) => payment.transportSubscriptionId));

    return subscriptions.filter((subscription) => !paidIds.has(subscription.id));
};
```

- [ ] **Step 4: Controller**

`src/modules/transport/payments.controller.ts`:

```ts
import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import { recordTransportPayment, getDues } from './payments.service';

export const record = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            recordTransportPayment({
                subscriptionId: req.params.id,
                branchId: req.branchId!,
                forMonth: req.body.forMonth,
                amount: req.body.amount !== undefined && req.body.amount !== '' ? Number(req.body.amount) : undefined,
                method: req.body.method,
                note: req.body.note,
                date: req.body.date ? new Date(req.body.date) : undefined,
            }),
        { message: 'Transport payment recorded successfully', status: 201, failure: 'Failed to record payment' }
    );

export const dues = (req: TenantRequest, res: Response) =>
    respond(res, () => getDues(req.branchId!, (req.query.month as string | undefined) || undefined), {
        message: 'Dues retrieved successfully',
        failure: 'Failed to retrieve dues',
    });
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest src/modules/transport && npx tsc --noEmit -p .`
Expected: PASS, tsc silent.

- [ ] **Step 6: Commit**

```bash
git add apps/education-apps/src/modules/transport
git commit -m "feat(education): transport payments (atomic payment + income transaction) and dues

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Router and app wiring

**Files:**
- Create: `src/modules/transport/transport.routes.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create the router**

`src/modules/transport/transport.routes.ts`:

```ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import * as vehicles from './vehicles.controller';
import * as drivers from './drivers.controller';
import * as routes from './routes.controller';
import * as subscriptions from './subscriptions.controller';
import * as payments from './payments.controller';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/vehicles', vehicles.getAll);
router.post('/vehicles', vehicles.create);
router.put('/vehicles/:id', vehicles.update);
router.delete('/vehicles/:id', vehicles.remove);

router.get('/drivers', drivers.getAll);
router.post('/drivers', drivers.create);
router.put('/drivers/:id', drivers.update);
router.delete('/drivers/:id', drivers.remove);

router.get('/routes', routes.getAll);
router.post('/routes', routes.create);
router.put('/routes/:id', routes.update);
router.delete('/routes/:id', routes.remove);
router.post('/routes/:id/stops', routes.addStop);
router.put('/routes/:id/stops/:stopId', routes.editStop);
router.delete('/routes/:id/stops/:stopId', routes.removeStop);

router.get('/subscriptions', subscriptions.getAll);
router.get('/subscriptions/student/:studentId', subscriptions.getForStudent);
router.post('/subscriptions', subscriptions.create);
router.post('/subscriptions/:id/pause', subscriptions.pause);
router.post('/subscriptions/:id/resume', subscriptions.resume);
router.post('/subscriptions/:id/end', subscriptions.end);
router.post('/subscriptions/:id/payments', payments.record);

router.get('/dues', payments.dues);

export default router;
```

- [ ] **Step 2: Register in `src/app.ts`**

Add after the `holidaysRoutes` import: `import transportRoutes from './modules/transport/transport.routes';`
Add after `apiRouter.use('/holidays', holidaysRoutes);`: `apiRouter.use('/transport', transportRoutes);`

- [ ] **Step 3: Typecheck and run all backend tests**

Run: `npx tsc --noEmit -p . && npx jest`
Expected: tsc silent; all suites PASS.

- [ ] **Step 4: Smoke-test the running API**

Run the backend (`npm run dev`, port from `.env`), log in as `admin@injahi.com` / `admin123`, then:

```bash
TOKEN=<accessToken from POST /api/auth/login>
curl -s localhost:3010/api/transport/vehicles -H "Authorization: Bearer $TOKEN"
```
Expected: `{"success":true,"data":[],...}` (an ADMIN with a branch) — and `401` without the header.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src/modules/transport/transport.routes.ts apps/education-apps/src/app.ts
git commit -m "feat(education): mount /api/transport routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Keep transport payments out of tuition views

Transport payments live in the `payments` collection, but student balances, the student portal, the parent portal and the documents module sum `student.payments` as tuition. Filter them out.

**Files:**
- Create: `src/modules/payments/tuitionFilter.ts`
- Modify: `src/modules/students/students.service.ts` (2 places), `src/modules/parents/parents.service.ts`, `src/modules/documents/documents.service.ts` (2 places)
- Test: `src/modules/students/students.service.test.ts`, `src/modules/parents/parents.service.test.ts`, create `src/modules/documents/documents.service.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/modules/parents/parents.service.test.ts`, replace the `toHaveBeenCalledWith` expectation in `getParentByRawToken returns null for a token that matches no stored hash` with:

```ts
        expect(prisma.parent.findUnique).toHaveBeenCalledWith({
            where: { accessTokenHash: 'some-hash' },
            include: {
                students: {
                    include: {
                        inscriptions: true,
                        payments: { where: { transportSubscriptionId: null } },
                        attendances: true,
                        transportSubscriptions: {
                            where: { status: { in: ['ACTIVE', 'PAUSED'] } },
                            include: {
                                route: {
                                    include: {
                                        driver: { select: { name: true, phone: true } },
                                        vehicle: { select: { plate: true } },
                                    },
                                },
                                stop: true,
                                payments: { where: { forMonth: currentMonth() } },
                            },
                        },
                    },
                },
            },
        });
```
and add `import { currentMonth } from '../transport/month';` at the top of that file.

In `src/modules/students/students.service.test.ts`, add `getStudentByPortalToken` to the import and append:

```ts
describe('tuition-only payments', () => {
    afterEach(() => jest.clearAllMocks());

    it('getStudentById excludes transport payments from the embedded payments', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1' });

        await getStudentById('s1', 'b1');

        expect(prisma.student.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                include: expect.objectContaining({ payments: { where: { transportSubscriptionId: null } } }),
            })
        );
    });

    it('getStudentByPortalToken excludes transport payments from the embedded payments', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

        await getStudentByPortalToken('raw');

        expect(prisma.student.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                include: expect.objectContaining({ payments: { where: { transportSubscriptionId: null } } }),
            })
        );
    });
});
```

Create `src/modules/documents/documents.service.test.ts`:

```ts
import prisma from '../../config/database';
import { getStudentsForDocuments, getStudentDocument } from './documents.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { student: { findMany: jest.fn(), findUnique: jest.fn() } },
}));

const tuitionPayments = { where: { transportSubscriptionId: null }, orderBy: { date: 'desc' } };

describe('documents service — tuition-only payments', () => {
    afterEach(() => jest.clearAllMocks());

    it('getStudentsForDocuments excludes transport payments', async () => {
        (prisma.student.findMany as jest.Mock).mockResolvedValue([]);

        await getStudentsForDocuments();

        expect(prisma.student.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ include: expect.objectContaining({ payments: tuitionPayments }) })
        );
    });

    it('getStudentDocument excludes transport payments', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });

        await getStudentDocument('s1');

        expect(prisma.student.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ include: expect.objectContaining({ payments: tuitionPayments }) })
        );
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/parents src/modules/students src/modules/documents`
Expected: FAIL — the new/updated expectations don't match (`payments: true` etc.).

- [ ] **Step 3: Implement**

`src/modules/payments/tuitionFilter.ts`:

```ts
// Transport fees are stored as Payment rows too (transportSubscriptionId set). Anything that
// treats a student's payments as tuition — balances, receipts, portals — must use this filter.
export const tuitionPayments = { where: { transportSubscriptionId: null } };
```

`src/modules/students/students.service.ts`: add `import { tuitionPayments } from '../payments/tuitionFilter';` and in both `getStudentById` (include at ~line 142) and `getStudentByPortalToken` (~line 229) replace `payments: true,` with `payments: tuitionPayments,`.

`src/modules/documents/documents.service.ts`: add the same import and in both queries replace

```ts
            payments: {
                orderBy: {
                    date: 'desc'
                }
            }
```
with
```ts
            payments: {
                ...tuitionPayments,
                orderBy: {
                    date: 'desc'
                }
            }
```

`src/modules/parents/parents.service.ts`: add `import { tuitionPayments } from '../payments/tuitionFilter';` and `import { currentMonth } from '../transport/month';`, and replace the `getParentByRawToken` include with:

```ts
        include: {
            students: {
                include: {
                    inscriptions: true,
                    payments: tuitionPayments,
                    attendances: true,
                    // Read-only transport summary for the portal: no branch/internal fields, driver limited to name+phone.
                    transportSubscriptions: {
                        where: { status: { in: ['ACTIVE', 'PAUSED'] } },
                        include: {
                            route: {
                                include: {
                                    driver: { select: { name: true, phone: true } },
                                    vehicle: { select: { plate: true } },
                                },
                            },
                            stop: true,
                            payments: { where: { forMonth: currentMonth() } },
                        },
                    },
                },
            },
        },
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx jest && npx tsc --noEmit -p .`
Expected: all suites PASS (including the modified parents/students tests), tsc silent.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src
git commit -m "feat(education): exclude transport payments from tuition balances, add transport to parent portal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Frontend types and API service

**Files:**
- Modify: `apps/education-apps/frontend/types/index.ts`
- Create: `apps/education-apps/frontend/lib/services/transport.ts`

- [ ] **Step 1: Add types**

In `types/index.ts`: add to `interface Settings` (after `contactInfo?: string;`):

```ts
    transportPricingMode?: TransportPricingMode | null;
    transportUniformPrice?: number | null;
```

Add to `interface Student` (next to `announcements?: Announcement[];`):

```ts
    // only present on the parent portal profile response
    transportSubscriptions?: TransportSubscription[];
```

Append at the end of the file:

```ts
// Transport types
export type TransportPricingMode = 'ROUTE' | 'STOP' | 'UNIFORM';
export type TransportSubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';

export interface Vehicle {
    id: string;
    plate: string;
    capacity: number;
    active: boolean;
}

export interface Driver {
    id: string;
    name: string;
    phone: string;
    active: boolean;
}

export interface TransportStop {
    id: string;
    routeId: string;
    name: string;
    order: number;
    morningTime: string;
    afternoonTime: string;
    monthlyPrice?: number | null;
}

export interface TransportRoute {
    id: string;
    name: string;
    monthlyPrice?: number | null;
    vehicleId: string;
    driverId: string;
    vehicle?: Pick<Vehicle, 'plate'> & Partial<Vehicle>;
    driver?: Pick<Driver, 'name' | 'phone'> & Partial<Driver>;
    stops?: TransportStop[];
}

export interface TransportSubscription {
    id: string;
    studentId: string;
    routeId: string;
    stopId: string;
    monthlyPrice: number;
    startDate: string;
    endDate?: string | null;
    status: TransportSubscriptionStatus;
    student?: Student;
    route?: TransportRoute;
    stop?: TransportStop;
    // parent portal: payments of the current month only
    payments?: { id: string }[];
    // student card endpoint
    currentMonth?: string;
    paidCurrentMonth?: boolean;
}
```

- [ ] **Step 2: Create the service**

`lib/services/transport.ts`:

```ts
import type { AxiosResponse } from 'axios';
import api from '../api';
import type {
    ApiResponse,
    Driver,
    TransportRoute,
    TransportStop,
    TransportSubscription,
    TransportSubscriptionStatus,
    Vehicle,
} from '@/types';

const unwrap = async <T>(request: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> => (await request).data.data;

// The API puts the specific reason in `error`; `message` is only a generic label.
export const transportErrorMessage = (e: any): string =>
    e?.response?.data?.error || e?.message || 'Une erreur est survenue';

export interface RouteInput {
    name: string;
    vehicleId: string;
    driverId: string;
    monthlyPrice?: number | null;
}

export interface StopInput {
    name: string;
    order: number;
    morningTime: string;
    afternoonTime: string;
    monthlyPrice?: number | null;
}

export interface TransportPaymentInput {
    forMonth: string;
    amount?: number;
    method: string;
    note?: string;
}

export const transportService = {
    vehicles: {
        list: () => unwrap(api.get<ApiResponse<Vehicle[]>>('/transport/vehicles')),
        create: (data: { plate: string; capacity: number }) =>
            unwrap(api.post<ApiResponse<Vehicle>>('/transport/vehicles', data)),
        remove: async (id: string) => {
            await api.delete(`/transport/vehicles/${id}`);
        },
    },
    drivers: {
        list: () => unwrap(api.get<ApiResponse<Driver[]>>('/transport/drivers')),
        create: (data: { name: string; phone: string }) =>
            unwrap(api.post<ApiResponse<Driver>>('/transport/drivers', data)),
        remove: async (id: string) => {
            await api.delete(`/transport/drivers/${id}`);
        },
    },
    routes: {
        list: () => unwrap(api.get<ApiResponse<TransportRoute[]>>('/transport/routes')),
        create: (data: RouteInput) => unwrap(api.post<ApiResponse<TransportRoute>>('/transport/routes', data)),
        remove: async (id: string) => {
            await api.delete(`/transport/routes/${id}`);
        },
        addStop: (routeId: string, data: StopInput) =>
            unwrap(api.post<ApiResponse<TransportStop>>(`/transport/routes/${routeId}/stops`, data)),
        removeStop: async (routeId: string, stopId: string) => {
            await api.delete(`/transport/routes/${routeId}/stops/${stopId}`);
        },
    },
    subscriptions: {
        list: (status?: TransportSubscriptionStatus) =>
            unwrap(
                api.get<ApiResponse<TransportSubscription[]>>('/transport/subscriptions', {
                    params: status ? { status } : undefined,
                })
            ),
        forStudent: (studentId: string) =>
            unwrap(api.get<ApiResponse<TransportSubscription | null>>(`/transport/subscriptions/student/${studentId}`)),
        create: (data: { studentId: string; routeId: string; stopId: string }) =>
            unwrap(api.post<ApiResponse<TransportSubscription>>('/transport/subscriptions', data)),
        pause: (id: string) => unwrap(api.post<ApiResponse<TransportSubscription>>(`/transport/subscriptions/${id}/pause`)),
        resume: (id: string) => unwrap(api.post<ApiResponse<TransportSubscription>>(`/transport/subscriptions/${id}/resume`)),
        end: (id: string) => unwrap(api.post<ApiResponse<TransportSubscription>>(`/transport/subscriptions/${id}/end`)),
        pay: (id: string, data: TransportPaymentInput) =>
            unwrap(api.post<ApiResponse<{ id: string }>>(`/transport/subscriptions/${id}/payments`, data)),
    },
    dues: (month?: string) =>
        unwrap(api.get<ApiResponse<TransportSubscription[]>>('/transport/dues', { params: month ? { month } : undefined })),
};
```

- [ ] **Step 3: Typecheck**

Run (from `apps/education-apps/frontend`): `npx tsc --noEmit`
Expected: no errors (if pre-existing errors appear, compare against `git stash`-free baseline: run once before Step 1 and only fix new ones).

- [ ] **Step 4: Commit**

```bash
git add apps/education-apps/frontend/types/index.ts apps/education-apps/frontend/lib/services/transport.ts
git commit -m "feat(education): frontend transport types and API service

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Admin Transport page (tabs, pricing panel, sidebar)

**Files (frontend):**
- Create: `components/transport/styles.ts`, `PricingModePanel.tsx`, `FleetTab.tsx`, `RoutesTab.tsx`, `SubscriptionsTab.tsx`, `DuesTab.tsx`, `app/admin/transport/page.tsx`
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Shared styles**

`components/transport/styles.ts`:

```ts
export const cardCls = 'bg-white rounded-2xl shadow-lg p-6 border border-gray-200';
export const inputCls =
    'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
export const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
export const primaryBtnCls =
    'flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold';
export const smallBtnCls = 'px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50';
export const errorCls = 'text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2';
```

- [ ] **Step 2: Pricing-mode panel**

`components/transport/PricingModePanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '@/lib/services/settings';
import { transportErrorMessage } from '@/lib/services/transport';
import type { TransportPricingMode } from '@/types';
import { cardCls, errorCls, inputCls, labelCls, primaryBtnCls } from './styles';

const MODES: { value: TransportPricingMode; label: string; hint: string }[] = [
    { value: 'ROUTE', label: 'Prix par ligne', hint: 'Chaque ligne a son tarif mensuel.' },
    { value: 'STOP', label: 'Prix par arrêt', hint: 'Chaque arrêt a son tarif (selon la distance).' },
    { value: 'UNIFORM', label: 'Prix unique', hint: 'Un seul tarif pour tous les élèves.' },
];

export default function PricingModePanel() {
    const [mode, setMode] = useState<TransportPricingMode>('ROUTE');
    const [uniformPrice, setUniformPrice] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getSettings()
            .then((settings) => {
                setMode(settings.transportPricingMode ?? 'ROUTE');
                setUniformPrice(settings.transportUniformPrice != null ? String(settings.transportUniformPrice) : '');
            })
            .catch((e) => setError(transportErrorMessage(e)));
    }, []);

    const save = async () => {
        setSaving(true);
        setSaved(false);
        setError('');
        try {
            await updateSettings({
                transportPricingMode: mode,
                transportUniformPrice: uniformPrice === '' ? null : Number(uniformPrice),
            } as any);
            setSaved(true);
        } catch (e) {
            setError(transportErrorMessage(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={cardCls}>
            <h2 className="font-bold text-gray-800 mb-1">Tarification du transport</h2>
            <p className="text-xs text-gray-500 mb-4">
                Le tarif est figé à l&apos;inscription de l&apos;élève : modifier le mode n&apos;affecte pas les abonnements existants.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {MODES.map((m) => (
                    <label
                        key={m.value}
                        className={`cursor-pointer rounded-xl border p-3 text-sm ${
                            mode === m.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                    >
                        <input
                            type="radio"
                            name="transportPricingMode"
                            className="mr-2"
                            checked={mode === m.value}
                            onChange={() => setMode(m.value)}
                        />
                        <span className="font-semibold">{m.label}</span>
                        <span className="block text-xs text-gray-500 mt-1">{m.hint}</span>
                    </label>
                ))}
            </div>
            {mode === 'UNIFORM' && (
                <div className="max-w-xs mb-4">
                    <label className={labelCls}>Prix mensuel unique (MAD)</label>
                    <input
                        type="number"
                        min="0"
                        className={inputCls}
                        value={uniformPrice}
                        onChange={(e) => setUniformPrice(e.target.value)}
                    />
                </div>
            )}
            {error && <p className={`${errorCls} mb-3`}>{error}</p>}
            <button onClick={save} disabled={saving} className={primaryBtnCls}>
                {saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
            </button>
        </div>
    );
}
```

- [ ] **Step 3: Fleet tab (vehicles + drivers)**

`components/transport/FleetTab.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import type { Driver, Vehicle } from '@/types';
import { cardCls, errorCls, inputCls, labelCls, primaryBtnCls } from './styles';

export default function FleetTab() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [plate, setPlate] = useState('');
    const [capacity, setCapacity] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [error, setError] = useState('');

    const load = async () => {
        try {
            const [v, d] = await Promise.all([transportService.vehicles.list(), transportService.drivers.list()]);
            setVehicles(v);
            setDrivers(d);
        } catch (e) {
            setError(transportErrorMessage(e));
        }
    };

    useEffect(() => {
        load();
    }, []);

    const run = async (action: () => Promise<unknown>) => {
        setError('');
        try {
            await action();
            await load();
        } catch (e) {
            setError(transportErrorMessage(e));
        }
    };

    return (
        <div className="space-y-6">
            {error && <p className={errorCls}>{error}</p>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cardCls}>
                    <h2 className="font-bold text-gray-800 mb-4">Véhicules</h2>
                    <form
                        className="grid grid-cols-3 gap-2 items-end mb-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                                await transportService.vehicles.create({ plate, capacity: Number(capacity) });
                                setPlate('');
                                setCapacity('');
                            });
                        }}
                    >
                        <div className="col-span-2">
                            <label className={labelCls}>Immatriculation</label>
                            <input className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>Places</label>
                            <input
                                type="number"
                                min="1"
                                className={inputCls}
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className={`${primaryBtnCls} col-span-3`}>
                            <Plus size={16} /> Ajouter un véhicule
                        </button>
                    </form>
                    <div className="space-y-2">
                        {vehicles.length === 0 && <p className="text-sm text-gray-400">Aucun véhicule.</p>}
                        {vehicles.map((v) => (
                            <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p className="font-semibold text-gray-800">{v.plate}</p>
                                    <p className="text-xs text-gray-500">{v.capacity} places</p>
                                </div>
                                <button
                                    onClick={() => run(() => transportService.vehicles.remove(v.id))}
                                    className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={cardCls}>
                    <h2 className="font-bold text-gray-800 mb-4">Chauffeurs</h2>
                    <form
                        className="grid grid-cols-2 gap-2 items-end mb-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                                await transportService.drivers.create({ name: driverName, phone: driverPhone });
                                setDriverName('');
                                setDriverPhone('');
                            });
                        }}
                    >
                        <div>
                            <label className={labelCls}>Nom</label>
                            <input className={inputCls} value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>Téléphone</label>
                            <input className={inputCls} value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} required />
                        </div>
                        <button type="submit" className={`${primaryBtnCls} col-span-2`}>
                            <Plus size={16} /> Ajouter un chauffeur
                        </button>
                    </form>
                    <div className="space-y-2">
                        {drivers.length === 0 && <p className="text-sm text-gray-400">Aucun chauffeur.</p>}
                        {drivers.map((d) => (
                            <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p className="font-semibold text-gray-800">{d.name}</p>
                                    <p className="text-xs text-gray-500">{d.phone}</p>
                                </div>
                                <button
                                    onClick={() => run(() => transportService.drivers.remove(d.id))}
                                    className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Routes & stops tab**

`components/transport/RoutesTab.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import type { Driver, TransportRoute, Vehicle } from '@/types';
import { cardCls, errorCls, inputCls, labelCls, primaryBtnCls } from './styles';

const emptyStop = { name: '', order: '', morningTime: '', afternoonTime: '', monthlyPrice: '' };

export default function RoutesTab() {
    const [routes, setRoutes] = useState<TransportRoute[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [price, setPrice] = useState('');
    const [stopForms, setStopForms] = useState<Record<string, typeof emptyStop>>({});

    const load = async () => {
        try {
            const [r, v, d] = await Promise.all([
                transportService.routes.list(),
                transportService.vehicles.list(),
                transportService.drivers.list(),
            ]);
            setRoutes(r);
            setVehicles(v);
            setDrivers(d);
        } catch (e) {
            setError(transportErrorMessage(e));
        }
    };

    useEffect(() => {
        load();
    }, []);

    const run = async (action: () => Promise<unknown>) => {
        setError('');
        try {
            await action();
            await load();
        } catch (e) {
            setError(transportErrorMessage(e));
        }
    };

    const stopForm = (routeId: string) => stopForms[routeId] ?? emptyStop;
    const setStopField = (routeId: string, field: keyof typeof emptyStop, value: string) =>
        setStopForms((prev) => ({ ...prev, [routeId]: { ...stopForm(routeId), [field]: value } }));

    return (
        <div className="space-y-6">
            {error && <p className={errorCls}>{error}</p>}

            <div className={cardCls}>
                <h2 className="font-bold text-gray-800 mb-4">Nouvelle ligne</h2>
                <form
                    className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
                    onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                            await transportService.routes.create({
                                name,
                                vehicleId,
                                driverId,
                                monthlyPrice: price === '' ? null : Number(price),
                            });
                            setName('');
                            setPrice('');
                        });
                    }}
                >
                    <div>
                        <label className={labelCls}>Nom</label>
                        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                        <label className={labelCls}>Véhicule</label>
                        <select className={inputCls} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
                            <option value="">—</option>
                            {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.plate} ({v.capacity})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Chauffeur</label>
                        <select className={inputCls} value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
                            <option value="">—</option>
                            {drivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Prix mensuel (MAD)</label>
                        <input type="number" min="0" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                    <button type="submit" className={primaryBtnCls}>
                        <Plus size={16} /> Créer
                    </button>
                </form>
            </div>

            {routes.length === 0 && <p className="text-sm text-gray-400">Aucune ligne.</p>}

            {routes.map((route) => {
                const form = stopForm(route.id);
                return (
                    <div key={route.id} className={cardCls}>
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="font-bold text-gray-800">{route.name}</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {route.vehicle?.plate} · {route.driver?.name} ({route.driver?.phone})
                                    {route.monthlyPrice != null && ` · ${route.monthlyPrice} MAD/mois`}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    if (window.confirm(`Supprimer la ligne « ${route.name} » ?`)) {
                                        run(() => transportService.routes.remove(route.id));
                                    }
                                }}
                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 shrink-0"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="space-y-2 mb-4">
                            {(route.stops ?? []).length === 0 && <p className="text-sm text-gray-400">Aucun arrêt.</p>}
                            {(route.stops ?? []).map((stop) => (
                                <div
                                    key={stop.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm"
                                >
                                    <span>
                                        <span className="font-semibold">
                                            {stop.order}. {stop.name}
                                        </span>{' '}
                                        <span className="text-gray-500">
                                            · matin {stop.morningTime} · soir {stop.afternoonTime}
                                            {stop.monthlyPrice != null && ` · ${stop.monthlyPrice} MAD`}
                                        </span>
                                    </span>
                                    <button
                                        onClick={() => run(() => transportService.routes.removeStop(route.id, stop.id))}
                                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <form
                            className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end"
                            onSubmit={(e) => {
                                e.preventDefault();
                                run(async () => {
                                    await transportService.routes.addStop(route.id, {
                                        name: form.name,
                                        order: Number(form.order),
                                        morningTime: form.morningTime,
                                        afternoonTime: form.afternoonTime,
                                        monthlyPrice: form.monthlyPrice === '' ? null : Number(form.monthlyPrice),
                                    });
                                    setStopForms((prev) => ({ ...prev, [route.id]: emptyStop }));
                                });
                            }}
                        >
                            <div className="col-span-2">
                                <label className={labelCls}>Arrêt</label>
                                <input className={inputCls} value={form.name} onChange={(e) => setStopField(route.id, 'name', e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelCls}>Ordre</label>
                                <input type="number" min="1" className={inputCls} value={form.order} onChange={(e) => setStopField(route.id, 'order', e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelCls}>Matin</label>
                                <input type="time" className={inputCls} value={form.morningTime} onChange={(e) => setStopField(route.id, 'morningTime', e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelCls}>Soir</label>
                                <input type="time" className={inputCls} value={form.afternoonTime} onChange={(e) => setStopField(route.id, 'afternoonTime', e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelCls}>Prix (MAD)</label>
                                <input type="number" min="0" className={inputCls} value={form.monthlyPrice} onChange={(e) => setStopField(route.id, 'monthlyPrice', e.target.value)} />
                            </div>
                            <button type="submit" className={`${primaryBtnCls} col-span-2 sm:col-span-6`}>
                                <Plus size={16} /> Ajouter l&apos;arrêt
                            </button>
                        </form>
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 5: Subscriptions tab**

`components/transport/SubscriptionsTab.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import { getStudents } from '@/lib/services/students';
import type { Student, TransportRoute, TransportSubscription, TransportSubscriptionStatus } from '@/types';
import { cardCls, errorCls, inputCls, labelCls, primaryBtnCls, smallBtnCls } from './styles';

const STATUS_LABELS: Record<TransportSubscriptionStatus, string> = {
    ACTIVE: 'Actif',
    PAUSED: 'En pause',
    ENDED: 'Terminé',
};

const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function SubscriptionsTab() {
    const [subs, setSubs] = useState<TransportSubscription[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [routes, setRoutes] = useState<TransportRoute[]>([]);
    const [filter, setFilter] = useState<TransportSubscriptionStatus | ''>('ACTIVE');
    const [error, setError] = useState('');
    const [studentId, setStudentId] = useState('');
    const [routeId, setRouteId] = useState('');
    const [stopId, setStopId] = useState('');
    const [payingId, setPayingId] = useState<string | null>(null);
    const [payMonth, setPayMonth] = useState(currentMonth());
    const [payMethod, setPayMethod] = useState('Espèces');

    const load = async () => {
        try {
            const [s, st, r] = await Promise.all([
                transportService.subscriptions.list(filter || undefined),
                getStudents(),
                transportService.routes.list(),
            ]);
            setSubs(s);
            setStudents(st);
            setRoutes(r);
        } catch (e) {
            setError(transportErrorMessage(e));
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const run = async (action: () => Promise<unknown>) => {
        setError('');
        try {
            await action();
            await load();
        } catch (e) {
            setError(transportErrorMessage(e));
        }
    };

    const selectedRoute = routes.find((r) => r.id === routeId);

    return (
        <div className="space-y-6">
            {error && <p className={errorCls}>{error}</p>}

            <div className={cardCls}>
                <h2 className="font-bold text-gray-800 mb-4">Nouvel abonnement</h2>
                <form
                    className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                    onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                            await transportService.subscriptions.create({ studentId, routeId, stopId });
                            setStudentId('');
                            setStopId('');
                        });
                    }}
                >
                    <div>
                        <label className={labelCls}>Élève</label>
                        <select className={inputCls} value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                            <option value="">—</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} {s.surname}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Ligne</label>
                        <select
                            className={inputCls}
                            value={routeId}
                            onChange={(e) => {
                                setRouteId(e.target.value);
                                setStopId('');
                            }}
                            required
                        >
                            <option value="">—</option>
                            {routes.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Arrêt</label>
                        <select className={inputCls} value={stopId} onChange={(e) => setStopId(e.target.value)} required>
                            <option value="">—</option>
                            {(selectedRoute?.stops ?? []).map((stop) => (
                                <option key={stop.id} value={stop.id}>
                                    {stop.order}. {stop.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" className={primaryBtnCls}>
                        Abonner
                    </button>
                </form>
            </div>

            <div className={cardCls}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-800">Abonnements</h2>
                    <select
                        className={`${inputCls} w-40`}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as TransportSubscriptionStatus | '')}
                    >
                        <option value="">Tous</option>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                {subs.length === 0 && <p className="text-sm text-gray-400">Aucun abonnement.</p>}
                <div className="space-y-3">
                    {subs.map((sub) => (
                        <div key={sub.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-gray-800">
                                        {sub.student?.name} {sub.student?.surname}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {sub.route?.name} · {sub.stop?.name} · {sub.monthlyPrice} MAD/mois ·{' '}
                                        {STATUS_LABELS[sub.status]}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {sub.status === 'ACTIVE' && (
                                        <>
                                            <button className={smallBtnCls} onClick={() => setPayingId(payingId === sub.id ? null : sub.id)}>
                                                Encaisser
                                            </button>
                                            <button className={smallBtnCls} onClick={() => run(() => transportService.subscriptions.pause(sub.id))}>
                                                Pause
                                            </button>
                                        </>
                                    )}
                                    {sub.status === 'PAUSED' && (
                                        <button className={smallBtnCls} onClick={() => run(() => transportService.subscriptions.resume(sub.id))}>
                                            Reprendre
                                        </button>
                                    )}
                                    {sub.status !== 'ENDED' && (
                                        <button
                                            className={`${smallBtnCls} text-red-600`}
                                            onClick={() => {
                                                if (window.confirm('Terminer cet abonnement ?')) {
                                                    run(() => transportService.subscriptions.end(sub.id));
                                                }
                                            }}
                                        >
                                            Terminer
                                        </button>
                                    )}
                                </div>
                            </div>

                            {payingId === sub.id && (
                                <form
                                    className="grid grid-cols-3 gap-2 items-end mt-3"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        run(async () => {
                                            await transportService.subscriptions.pay(sub.id, { forMonth: payMonth, method: payMethod });
                                            setPayingId(null);
                                        });
                                    }}
                                >
                                    <div>
                                        <label className={labelCls}>Mois</label>
                                        <input type="month" className={inputCls} value={payMonth} onChange={(e) => setPayMonth(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Mode</label>
                                        <select className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                                            <option>Espèces</option>
                                            <option>Virement</option>
                                            <option>Chèque</option>
                                        </select>
                                    </div>
                                    <button type="submit" className={primaryBtnCls}>
                                        Valider {sub.monthlyPrice} MAD
                                    </button>
                                </form>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 6: Dues tab**

`components/transport/DuesTab.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import type { TransportSubscription } from '@/types';
import { cardCls, errorCls, inputCls, labelCls } from './styles';

const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function DuesTab() {
    const [month, setMonth] = useState(currentMonth());
    const [dues, setDues] = useState<TransportSubscription[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        setError('');
        transportService
            .dues(month)
            .then(setDues)
            .catch((e) => setError(transportErrorMessage(e)));
    }, [month]);

    const total = dues.reduce((sum, sub) => sum + sub.monthlyPrice, 0);

    return (
        <div className={cardCls}>
            <div className="flex items-end justify-between mb-4">
                <div>
                    <h2 className="font-bold text-gray-800">Impayés du mois</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {dues.length} élève{dues.length > 1 ? 's' : ''} · {total} MAD à encaisser
                    </p>
                </div>
                <div>
                    <label className={labelCls}>Mois</label>
                    <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
            </div>
            {error && <p className={`${errorCls} mb-3`}>{error}</p>}
            {dues.length === 0 && !error && <p className="text-sm text-gray-400">Tout est réglé pour ce mois. 🎉</p>}
            <div className="space-y-2">
                {dues.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                        <span>
                            <span className="font-semibold">
                                {sub.student?.name} {sub.student?.surname}
                            </span>{' '}
                            <span className="text-gray-500">
                                · {sub.route?.name} · {sub.stop?.name}
                            </span>
                        </span>
                        <span className="font-semibold text-red-600">{sub.monthlyPrice} MAD</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 7: The page**

`app/admin/transport/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Bus } from 'lucide-react';
import FleetTab from '@/components/transport/FleetTab';
import RoutesTab from '@/components/transport/RoutesTab';
import SubscriptionsTab from '@/components/transport/SubscriptionsTab';
import DuesTab from '@/components/transport/DuesTab';
import PricingModePanel from '@/components/transport/PricingModePanel';

const TABS = [
    { id: 'routes', label: 'Lignes & arrêts' },
    { id: 'fleet', label: 'Véhicules & chauffeurs' },
    { id: 'subscriptions', label: 'Abonnements' },
    { id: 'dues', label: 'Impayés' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function TransportPage() {
    const [tab, setTab] = useState<TabId>('routes');

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Transport scolaire</h1>
                    <p className="text-gray-600 mt-1">Lignes, véhicules, abonnements et paiements mensuels</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100">
                    <Bus className="text-blue-600" size={24} />
                </div>
            </div>

            <div className="flex gap-2 border-b border-gray-200">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
                            tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'routes' && (
                <div className="space-y-6">
                    <PricingModePanel />
                    <RoutesTab />
                </div>
            )}
            {tab === 'fleet' && <FleetTab />}
            {tab === 'subscriptions' && <SubscriptionsTab />}
            {tab === 'dues' && <DuesTab />}
        </div>
    );
}
```

- [ ] **Step 8: Sidebar entry**

In `components/Sidebar.tsx`: add `Bus` to the existing `lucide-react` import list. In `adminMenuItems`, insert this item immediately before the `documents` item (`id: 'documents'`):

```tsx
    {
      id: 'transport',
      label: 'Transport',
      icon: Bus,
      path: '/admin/transport',
      activeColor: 'bg-[#334155]/50 border-[#38BDF8]',
      iconColor: 'text-[#38BDF8]'
    },
```
(`ownerMenuItems` spreads `adminMenuItems`, so OWNER gets it too. Secretary menu is intentionally untouched.)

- [ ] **Step 9: Typecheck + build**

Run (frontend dir): `npx tsc --noEmit && npx next lint --dir components/transport --dir app/admin/transport`
Expected: no type errors; lint clean (fix any `react-hooks` warnings other than the one disabled inline).

- [ ] **Step 10: Commit**

```bash
git add apps/education-apps/frontend
git commit -m "feat(education): admin transport page (routes, fleet, subscriptions, dues, pricing mode)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: Student page card and parent portal card

**Files (frontend):**
- Create: `components/transport/StudentTransportCard.tsx`
- Modify: `app/admin/students/[id]/page.tsx`, `app/p/[token]/page.tsx`

- [ ] **Step 1: Student card**

`components/transport/StudentTransportCard.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import type { TransportSubscription } from '@/types';

export default function StudentTransportCard({ studentId }: { studentId: string }) {
    const [sub, setSub] = useState<TransportSubscription | null | undefined>(undefined);
    const [error, setError] = useState('');

    useEffect(() => {
        transportService.subscriptions
            .forStudent(studentId)
            .then(setSub)
            .catch((e) => setError(transportErrorMessage(e)));
    }, [studentId]);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Transport</h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {sub === undefined && !error && <p className="text-sm text-slate-500">Chargement…</p>}
            {sub === null && (
                <p className="text-sm text-slate-500">
                    Pas d&apos;abonnement au transport.{' '}
                    <Link href="/admin/transport" className="text-blue-600 hover:underline">
                        Abonner l&apos;élève
                    </Link>
                </p>
            )}
            {sub && (
                <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                    <p>
                        <span className="text-slate-500">Ligne : </span>
                        {sub.route?.name} {sub.status === 'PAUSED' && '(en pause)'}
                    </p>
                    <p>
                        <span className="text-slate-500">Arrêt : </span>
                        {sub.stop?.name} — matin {sub.stop?.morningTime}, soir {sub.stop?.afternoonTime}
                    </p>
                    <p>
                        <span className="text-slate-500">Tarif : </span>
                        {sub.monthlyPrice} MAD / mois
                    </p>
                    <p className={sub.paidCurrentMonth ? 'font-medium text-emerald-600' : 'font-medium text-red-600'}>
                        {sub.paidCurrentMonth ? `Mois ${sub.currentMonth} payé` : `Mois ${sub.currentMonth} non payé`}
                    </p>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Mount it on the admin student page**

In `app/admin/students/[id]/page.tsx` add `import StudentTransportCard from '@/components/transport/StudentTransportCard';` next to the other imports, and insert `<StudentTransportCard studentId={id} />` as the last child of the root `<div className="space-y-6 animate-in fade-in duration-500">` (just before its closing `</div>` — the second-to-last `</div>` line of the file's JSX, i.e. after the block that closes at current line 212).

- [ ] **Step 3: Parent portal card**

In `app/p/[token]/page.tsx`, inside each student card, after the `Solde dû` paragraph (`<p className="mt-1 text-sm ...">Solde dû : {due} MAD</p>`), add:

```tsx
                                {(student.transportSubscriptions || []).map((sub) => (
                                    <div
                                        key={sub.id}
                                        className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-700/50"
                                    >
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            Transport — {sub.route?.name}
                                            {sub.status === 'PAUSED' && ' (en pause)'}
                                        </p>
                                        <p className="text-slate-500 dark:text-slate-400">
                                            {sub.stop?.name} · matin {sub.stop?.morningTime} · soir {sub.stop?.afternoonTime}
                                        </p>
                                        <p className="text-slate-500 dark:text-slate-400">
                                            Chauffeur : {sub.route?.driver?.name}{' '}
                                            {sub.route?.driver?.phone && (
                                                <a className="text-blue-600 hover:underline" href={`tel:${sub.route.driver.phone}`}>
                                                    {sub.route.driver.phone}
                                                </a>
                                            )}
                                        </p>
                                        <p
                                            className={
                                                (sub.payments || []).length > 0
                                                    ? 'font-medium text-emerald-600 dark:text-emerald-400'
                                                    : 'font-medium text-red-600 dark:text-red-400'
                                            }
                                        >
                                            {(sub.payments || []).length > 0
                                                ? 'Mois en cours : payé'
                                                : `Mois en cours : ${sub.monthlyPrice} MAD à régler`}
                                        </p>
                                    </div>
                                ))}
```

Also update the disclaimer text in that page: change `N&apos;inclut pas les frais mensuels récurrents` to `N&apos;inclut pas les frais mensuels récurrents ni le transport (détaillé ci-dessous par enfant)`.

- [ ] **Step 4: Typecheck**

Run (frontend dir): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/frontend
git commit -m "feat(education): transport card on student page and parent portal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: End-to-end QA (manual, per spec "Final QA")

No code. Use the `run` skill or start both apps: backend `npm run dev` (port 3010), frontend `npm run dev` (port 3011). Login `admin@injahi.com` / `admin123`.

- [ ] **Step 1: Happy path** — On `/admin/transport`: (a) set pricing mode `Prix par ligne`; (b) add a vehicle with 2 seats and a driver; (c) create a route with price 300 and two stops (07:15/17:30, 07:30/17:45); (d) subscribe a student → subscription shows 300 MAD; (e) Encaisser for the current month → success; (f) Impayés no longer lists the student; (g) `/admin/finance/transactions` shows an INCOME "Transport" of 300.
- [ ] **Step 2: Rules** — verify each is refused with a readable message: second subscription for the same student; third ACTIVE subscription on the 2-seat route (capacity); paying the same month twice; deleting the route/vehicle/driver/stop while a subscription is ACTIVE; a stop from another route.
- [ ] **Step 3: Price snapshot** — change mode to `Prix unique` = 200; existing subscription still 300, a new one is 200. Switch to `Prix par arrêt` with stops lacking a price → subscribing fails with "Transport price is not configured for pricing mode STOP".
- [ ] **Step 4: Tuition balances unaffected** — on `/admin/students/<id>` the student's tuition balance is unchanged after the transport payment, and the Transport card shows "Mois … payé". Open the student's portal (`/s/<token>`): payments list has no transport payment.
- [ ] **Step 5: Parent portal** — link the student to a parent, open `/p/<parent token>`: transport block shows route, stop times, driver name/phone, and "payé" for the current month; balance unchanged.
- [ ] **Step 6: Tenant isolation** — with two OWNER accounts / branches: owner B calling `GET /api/transport/routes` with `X-Branch-Id` of owner A's branch → `403`; owner B cannot create a subscription referencing owner A's route/stop/student ids (`404`/`400`). Legacy `ADMIN` with `branchId: null` → `403`.
- [ ] **Step 7: Full suites** — `npx jest` (backend) all green; `npx tsc --noEmit -p .` silent; frontend `npx tsc --noEmit` silent. Report actual results; if anything fails, fix before declaring done.

---

## Self-Review

**Spec coverage**
- Data model (Vehicle, Driver, TransportRoute, TransportStop, TransportSubscription, Payment fields, Settings fields) → Task 1.
- Pricing modes + price snapshot → Tasks 2, 3, 7 (+ UI Task 12 `PricingModePanel`).
- API table (vehicles, drivers, routes/stops, subscriptions, payments, dues) → Tasks 5–9.
- Business rules: one open subscription/student, stop∈route, capacity, in-use protection, one payment per month, atomic Payment+Transaction, ended handling, dues definition → Tasks 5–8 (each with tests).
- `branchId` from `req.branchId`, cross-reference validation → every service takes `branchId` from the controller's `req.branchId!` and looks up every foreign id with `{ id, branchId }`.
- Admin UI: 4 tabs, student card, pricing selector (relocated, documented), parent portal card → Tasks 12–13.
- Effect on existing payment views (new, discovered while planning) → Task 10.
- Testing/QA incl. two-owner isolation → per-task tests + Task 14.

**Placeholder scan:** none — every code step has full code. 

**Type consistency:** `respond`/`OPEN_STATUSES`/`countOpenSubscriptions(branchId, filter)`/`countOpenSubscriptionsForRoutesOf(branchId, field, id)` signatures match between Task 4 and their callers in Tasks 5–7; `currentMonth`, `isValidMonth`, `startOfNextMonth` (Task 2) are used unchanged in Tasks 7, 8, 10; `resolveMonthlyPrice(mode, route, stop, uniform)` argument order matches its use in Task 7; frontend `transportService` method names (Task 11) match their uses in Tasks 12–13; the route paths in `transport.routes.ts` match the URLs in `transportService`.

**Known risks to watch during execution**
- Task 1 Step 5 (`null` filter semantics on MongoDB) gates Task 10.
- Task 10's `where: { status: { in: [...] } }` on a nested `include` relies on Prisma accepting string literals for the enum — if `tsc` complains, cast with `as const`.
- Frontend has no test runner; UI correctness rests on `tsc` + Task 14.
