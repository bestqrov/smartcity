# Education Sales Agents v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace each agent's single `commissionRate` with three base rates (monthly / semi-annual / yearly) plus optional per-pack exceptions, add the `SEMIANNUAL` period, freeze the resolved rate and the school's pack on every payment, and show computed client statuses and FIFO payout statuses (with icons and a legend) on the admin pages and in `/agent`.

**Architecture:** Prisma gets a `SEMIANNUAL` enum value, an embedded composite type `AgentPackRate` on `SalesAgent` (replacing `commissionRate`) and `packId`/`packName` snapshot fields on `SchoolPayment`. A raw, idempotent MongoDB pipeline update (`migrateAgentRates`) converts v1 agents before the new client reads them. Pure helpers (`resolveCommissionRate` in the validation module, `clientStatus` / `allocatePayouts` / `countStatuses` in a new statuses module) are used by `schoolPayments.service.ts` and `salesAgents.service.ts`. The frontend gets shared labels + status badge/legend components, a pack exceptions editor reused by the create modal and the detail page, and an updated `AgentReportView`.

**Tech Stack:** Express + Prisma 5 (MongoDB) + Jest 30 / ts-jest (backend, `apps/education-apps`), Next.js 14 app router + Tailwind + lucide-react (frontend, `apps/education-apps/frontend`).

**Spec:** `docs/superpowers/specs/2026-11-11-education-sales-agents-rates-status-design.md` (extends `docs/superpowers/specs/2026-11-11-education-sales-agents-design.md`, already built).

**Conventions to follow (read once):**
- Services throw `Error` with a plain message; controllers wrap them with `respond()` from `src/modules/transport/http.ts` (message ending in "not found" → 404, other errors → 400, Prisma errors → 500). Controllers and routes do **not** change in this plan.
- Tests mock `../../config/database` with `jest.mock` and plain `jest.fn()`s, with `afterEach(() => jest.clearAllMocks())`. This is Jest 30: `clearAllMocks` resets calls but **keeps** `mockResolvedValue` implementations; `restoreAllMocks` only restores `jest.spyOn` spies. Every test sets the mock values it relies on.
- ts-jest type-checks each file it loads, so a suite fails if an imported service does not compile against the generated Prisma client. Between Task 2 and Task 6, `salesAgents.service.test.ts` and `schoolPayments.service.test.ts` are **expected** to fail to compile (they are fixed in Tasks 4 and 6). Do not "fix" them early.
- All backend commands run from `apps/education-apps`; frontend commands from `apps/education-apps/frontend`. Branch: `feature/education-sales-agents` (do not switch, do not push).
- Frontend has no test runner: verify with `npx tsc --noEmit 2>&1 | grep 'error TS' | grep -v '^.next/types/app/secretary/'` (the 4 errors under `.next/types/app/secretary/...` are pre-existing and ignored). `npm run lint` is not configured. **Never run `npm run build`** (a dev server is using `.next`).
- A backend dev server (`npm run dev`, ts-node-dev, port 3010) and a frontend dev server (port 3011) may be running. ts-node-dev restarts when a file under `src/` changes; `touch src/server.ts` forces a restart.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Baseline before this plan: `npx jest` → 39 suites / 339 tests pass; backend `npx tsc --noEmit` is clean.

## File Structure

Backend (`apps/education-apps`):
- Create `src/modules/sales-agents/salesAgents.migration.ts` (+ `.test.ts`): `AGENT_RATES_MIGRATION` command and `migrateAgentRates(client)`.
- Create `prisma/migrate-agent-rates.ts`: CLI for the migration. Modify `package.json`: script `prisma:migrate-agent-rates`.
- Modify `prisma/schema.prisma`: `SEMIANNUAL`, `type AgentPackRate`, `SalesAgent` rates, `SchoolPayment.packId/packName`.
- Modify `src/modules/sales-agents/salesAgents.seed.ts` (+ test), `prisma/seed-sales-agents.ts`, `prisma/seed.ts`: house agent rates, migration before the house seed.
- Modify `src/modules/sales-agents/salesAgents.validation.ts` (+ test): three rates, pack exceptions, `SEMIANNUAL`, legacy `commissionRate` rejected, `resolveCommissionRate`.
- Modify `src/modules/sales-agents/schoolPayments.service.ts` (+ test): resolved rate and pack snapshot.
- Create `src/modules/sales-agents/salesAgents.statuses.ts` (+ `.test.ts`): client status, FIFO payout allocation, status counts.
- Modify `src/modules/sales-agents/salesAgents.service.ts` (+ test): rates/exceptions in create/update/list/report, pack names, statuses, FIFO.
- Modify `COOLIFY_EDUCATION_DEPLOY.md` (repo root): migration step.

Frontend (`apps/education-apps/frontend`):
- Modify `lib/services/salesAgents.ts`: types for rates, exceptions, statuses.
- Create `lib/salesAgentLabels.ts`: period labels, status metadata, `formatRates`, `packLabel`.
- Create `components/agent/StatusBadge.tsx`: `ClientStatusBadge`, `PayoutStatusBadge`, `StatusLegend`.
- Create `components/admin/PackRatesEditor.tsx` and `components/admin/AgentRatesFields.tsx`.
- Modify `components/admin/SchoolPaymentsModal.tsx`, `app/admin/sales-agents/page.tsx`, `app/admin/sales-agents/[id]/page.tsx`, `components/agent/AgentReportView.tsx`, `app/agent/page.tsx`.

---

### Task 1: Agent rates migration helper and CLI

**Files:**
- Create: `apps/education-apps/src/modules/sales-agents/salesAgents.migration.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.migration.test.ts`
- Create: `apps/education-apps/prisma/migrate-agent-rates.ts`
- Modify: `apps/education-apps/package.json`

- [ ] **Step 1: Write the failing test**

Create `src/modules/sales-agents/salesAgents.migration.test.ts`:

```ts
import { migrateAgentRates } from './salesAgents.migration';

const makeClient = (result: unknown) => ({ $runCommandRaw: jest.fn().mockResolvedValue(result) }) as any;

describe('migrateAgentRates', () => {
    it('sends one idempotent pipeline update on agents that have no per-period rates yet', async () => {
        const client = makeClient({ n: 3, nModified: 3, ok: 1 });

        await expect(migrateAgentRates(client)).resolves.toBe(3);

        const oldRate = { $ifNull: ['$commissionRate', 0] };
        expect(client.$runCommandRaw).toHaveBeenCalledTimes(1);
        expect(client.$runCommandRaw).toHaveBeenCalledWith({
            update: 'sales_agents',
            updates: [
                {
                    q: { monthlyRate: { $exists: false } },
                    u: [
                        { $set: { monthlyRate: oldRate, semiannualRate: oldRate, yearlyRate: oldRate, packRates: [] } },
                        { $unset: 'commissionRate' },
                    ],
                    multi: true,
                },
            ],
        });
    });

    it('reports 0 when every agent is already migrated', async () => {
        await expect(migrateAgentRates(makeClient({ n: 0, nModified: 0, ok: 1 }))).resolves.toBe(0);
    });

    it('fails loudly on write errors', async () => {
        const client = makeClient({ n: 1, nModified: 0, ok: 1, writeErrors: [{ index: 0, errmsg: 'boom' }] });
        await expect(migrateAgentRates(client)).rejects.toThrow('Agent rates migration failed');
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/salesAgents.migration.test.ts`
Expected: FAIL, "Cannot find module './salesAgents.migration'".

- [ ] **Step 3: Implement**

Create `src/modules/sales-agents/salesAgents.migration.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client';

const oldRate = { $ifNull: ['$commissionRate', 0] };

// v1 agents had one commissionRate; v2 has a rate per period plus pack exceptions. Prisma cannot read the
// old documents once the new rates are required, so this runs as a raw MongoDB pipeline update, before any
// read. Idempotent: only documents without monthlyRate are touched.
export const AGENT_RATES_MIGRATION: Prisma.InputJsonObject = {
    update: 'sales_agents',
    updates: [
        {
            q: { monthlyRate: { $exists: false } },
            u: [
                { $set: { monthlyRate: oldRate, semiannualRate: oldRate, yearlyRate: oldRate, packRates: [] } },
                { $unset: 'commissionRate' },
            ],
            multi: true,
        },
    ],
};

// Returns the number of agents converted.
export const migrateAgentRates = async (client: Pick<PrismaClient, '$runCommandRaw'>): Promise<number> => {
    const result = (await client.$runCommandRaw(AGENT_RATES_MIGRATION)) as unknown as {
        nModified?: number;
        writeErrors?: unknown[];
    };
    if (result.writeErrors?.length) {
        throw new Error(`Agent rates migration failed: ${JSON.stringify(result.writeErrors)}`);
    }
    return Number(result.nModified ?? 0);
};
```

Create `prisma/migrate-agent-rates.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { migrateAgentRates } from '../src/modules/sales-agents/salesAgents.migration';

const prisma = new PrismaClient();

migrateAgentRates(prisma)
    .then((count) => console.log(`Sales agents migrated to per-period rates: ${count}`))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
```

In `package.json` `"scripts"`, add after the `"prisma:seed-sales-agents"` line:

```json
    "prisma:migrate-agent-rates": "ts-node prisma/migrate-agent-rates.ts",
```

so the block reads:

```json
    "prisma:seed-sales-agents": "ts-node prisma/seed-sales-agents.ts",
    "prisma:migrate-agent-rates": "ts-node prisma/migrate-agent-rates.ts",
    "test": "jest"
```

Do **not** run the script yet (Task 2 runs it right after the schema change).

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/modules/sales-agents/salesAgents.migration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents/salesAgents.migration.ts src/modules/sales-agents/salesAgents.migration.test.ts prisma/migrate-agent-rates.ts package.json
git commit -m "feat(education): idempotent migration from one agent rate to per-period rates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema, house seed and local DB migration

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`
- Modify: `apps/education-apps/src/modules/sales-agents/salesAgents.seed.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.seed.test.ts`
- Modify: `apps/education-apps/prisma/seed-sales-agents.ts`, `apps/education-apps/prisma/seed.ts`
- Modify: `COOLIFY_EDUCATION_DEPLOY.md` (repo root)

- [ ] **Step 1: Update the seed test (failing)**

In `src/modules/sales-agents/salesAgents.seed.test.ts`, replace the expectation

```ts
        expect(client.salesAgent.create).toHaveBeenCalledWith({
            data: { name: 'Société (ARWA)', code: 'ARWA', commissionRate: 0, isHouse: true, active: true },
        });
```

with

```ts
        expect(client.salesAgent.create).toHaveBeenCalledWith({
            data: {
                name: 'Société (ARWA)',
                code: 'ARWA',
                monthlyRate: 0,
                semiannualRate: 0,
                yearlyRate: 0,
                packRates: [],
                isHouse: true,
                active: true,
            },
        });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/salesAgents.seed.test.ts`
Expected: FAIL in "creates the ARWA house agent when none exists" (received data still has `commissionRate: 0`).

- [ ] **Step 3: Change the schema**

In `prisma/schema.prisma`, replace

```prisma
enum SubscriptionPeriod {
  MONTHLY
  YEARLY
}
```

with

```prisma
enum SubscriptionPeriod {
  MONTHLY
  SEMIANNUAL
  YEARLY
}
```

Replace the whole `model SalesAgent { ... }` block with:

```prisma
model SalesAgent {
  id             String          @id @default(auto()) @map("_id") @db.ObjectId
  name           String
  phone          String?
  code           String          @unique
  // Percent 0-100 per payment period; packRates override them for one (pack, period).
  monthlyRate    Float
  semiannualRate Float
  yearlyRate     Float
  packRates      AgentPackRate[]
  isHouse        Boolean         @default(false)
  active         Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  userId String? @unique @db.ObjectId
  user   User?   @relation(fields: [userId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  schools  School[]
  payments SchoolPayment[]
  payouts  AgentPayout[]

  @@map("sales_agents")
}

// A sales agent's rate for one (pack, period), embedded in SalesAgent. (packId, period) is unique per agent.
type AgentPackRate {
  packId String             @db.ObjectId
  period SubscriptionPeriod
  rate   Float
}
```

In `model SchoolPayment`, replace

```prisma
  commissionRate   Float
  commissionAmount Float
  createdAt        DateTime           @default(now())
```

with

```prisma
  commissionRate   Float
  commissionAmount Float
  // The school's pack when the payment was recorded (snapshot, no relation). Null on v1 payments.
  packId           String?            @db.ObjectId
  packName         String?
  createdAt        DateTime           @default(now())
```

- [ ] **Step 4: Update the house seed and the seed scripts**

Replace `src/modules/sales-agents/salesAgents.seed.ts` with:

```ts
import type { PrismaClient } from '@prisma/client';

// The company's own code, used in its ads. It earns nothing and has no login.
export const HOUSE_AGENT = {
    name: 'Société (ARWA)',
    code: 'ARWA',
    monthlyRate: 0,
    semiannualRate: 0,
    yearlyRate: 0,
    packRates: [],
    isHouse: true,
    active: true,
};

// Idempotent: never touches an existing house agent (a SUPER_ADMIN may have renamed it).
// Run migrateAgentRates first: findFirst cannot read v1 agents.
export const seedHouseAgent = async (client: PrismaClient) => {
    const existing = await client.salesAgent.findFirst({ where: { isHouse: true } });
    if (existing) return existing;
    return client.salesAgent.create({ data: HOUSE_AGENT });
};
```

Replace `prisma/seed-sales-agents.ts` with:

```ts
import { PrismaClient } from '@prisma/client';
import { migrateAgentRates } from '../src/modules/sales-agents/salesAgents.migration';
import { seedHouseAgent } from '../src/modules/sales-agents/salesAgents.seed';

const prisma = new PrismaClient();

const main = async () => {
    // v1 agents must be converted before Prisma reads any agent.
    const migrated = await migrateAgentRates(prisma);
    console.log(`Sales agents migrated to per-period rates: ${migrated}`);
    const agent = await seedHouseAgent(prisma);
    console.log('House agent:', { code: agent.code, isHouse: agent.isHouse });
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
```

In `prisma/seed.ts`, replace the import line

```ts
import { seedHouseAgent } from '../src/modules/sales-agents/salesAgents.seed';
```

with

```ts
import { seedHouseAgent } from '../src/modules/sales-agents/salesAgents.seed';
import { migrateAgentRates } from '../src/modules/sales-agents/salesAgents.migration';
```

and replace

```ts
    console.log('\nEnsuring house referral code...');
    await seedHouseAgent(prisma);
```

with

```ts
    console.log('\nEnsuring house referral code...');
    await migrateAgentRates(prisma); // v1 agents must be converted before Prisma reads any agent
    await seedHouseAgent(prisma);
```

- [ ] **Step 5: Validate, generate, push, then migrate immediately**

Run:
```bash
npx prisma validate && npx prisma generate && npx prisma db push
```
Expected: "The schema at prisma/schema.prisma is valid", "Generated Prisma Client", and "Your database indexes are now in sync with your Prisma schema" (MongoDB: `db push` only syncs indexes; it does **not** touch existing documents — that is the migration's job).

Right away (before anything reads agents with the new client), run:
```bash
npm run prisma:migrate-agent-rates
```
Expected: `Sales agents migrated to per-period rates: 3` on the local DB (ARWA, QA-01, ABDESSAMADAITMLL). Run it a second time:
```bash
npm run prisma:migrate-agent-rates
```
Expected: `Sales agents migrated to per-period rates: 0` (idempotent).

- [ ] **Step 6: Restart the backend and check the migrated agents through the API**

The running backend still holds the old client in memory, which can no longer read agents. Force a restart (skip if no dev server is running; then start one with `npm run dev`):
```bash
touch src/server.ts
```
Wait until the dev server logs that it is listening again, then:
```bash
API=http://localhost:3010/api
SA=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"<SUPER_ADMIN_EMAIL>","password":"<SUPER_ADMIN_PASSWORD>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')
curl -s $API/sales-agents -H "Authorization: Bearer $SA" | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.map(a => [a.code, a.monthlyRate, a.semiannualRate, a.yearlyRate, JSON.stringify(a.packRates), "commissionRate" in a].join(" | ")).join("\n")'
```
Expected (the v1 service code still spreads the raw document, so the new fields show up):
```
ARWA | 0 | 0 | 0 | [] | false
QA-01 | 20 | 20 | 20 | [] | false
ABDESSAMADAITMLL | 25 | 25 | 25 | [] | false
```

- [ ] **Step 7: Run the sales-agents suites**

Run: `npx jest src/modules/sales-agents`
Expected: `salesAgents.seed.test.ts`, `salesAgents.migration.test.ts` and `salesAgents.validation.test.ts` PASS. `salesAgents.service.test.ts` and `schoolPayments.service.test.ts` FAIL to compile with TS errors about `commissionRate` (e.g. TS2339 "Property 'commissionRate' does not exist", TS2353/TS2322 on `salesAgent.create` data). This is expected: Tasks 4 and 6 fix them.

- [ ] **Step 8: Document the deploy step**

In `COOLIFY_EDUCATION_DEPLOY.md` (repo root), replace the line

```markdown
   - Une seule fois : `npm run prisma:seed-sales-agents` (crée le code société `ARWA`, idempotent ; nécessite les devDependencies pour `ts-node`). **Sans ce code, toute inscription d'école échoue** : le code commercial est obligatoire.
```

with

```markdown
   - Une seule fois : `npm run prisma:seed-sales-agents` (convertit les commerciaux v1 puis crée le code société `ARWA`, idempotent ; nécessite les devDependencies pour `ts-node`). **Sans ce code, toute inscription d'école échoue** : le code commercial est obligatoire.
   - Taux par période (v2) : juste après `npx prisma db push`, **avant** de redémarrer le backend, lancer `npm run prisma:migrate-agent-rates` (idempotent). Il remplace l'ancien `commissionRate` de chaque commercial par trois taux (mensuel, semestriel, annuel) égaux à l'ancien taux. Sans cela, les commerciaux créés en v1 ne peuvent plus être lus.
```

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts prisma/seed-sales-agents.ts src/modules/sales-agents/salesAgents.seed.ts src/modules/sales-agents/salesAgents.seed.test.ts
git add ../../COOLIFY_EDUCATION_DEPLOY.md
git commit -m "feat(education): schema for per-period agent rates, pack exceptions and payment pack snapshot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Validation — three rates, pack exceptions, SEMIANNUAL, rate resolution

**Files:**
- Modify: `apps/education-apps/src/modules/sales-agents/salesAgents.validation.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.validation.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace `src/modules/sales-agents/salesAgents.validation.test.ts` with:

```ts
import {
    normalizeCode,
    sanitizeCode,
    computeCommission,
    roundMoney,
    sanitizeNewAgent,
    sanitizeAgentUpdate,
    sanitizePackRates,
    sanitizePayment,
    sanitizePayout,
    resolveCommissionRate,
    LEGACY_RATE_ERROR,
} from './salesAgents.validation';

const PACK_A = '6ab050b281878c35b0f00752';
const PACK_B = '6ab050b181878c35b0f00750';

describe('normalizeCode', () => {
    it('trims and uppercases strings', () => {
        expect(normalizeCode('  youssef22 ')).toBe('YOUSSEF22');
    });
    it('returns an empty string for non-strings', () => {
        expect(normalizeCode(42)).toBe('');
        expect(normalizeCode({ $ne: null })).toBe('');
        expect(normalizeCode(undefined)).toBe('');
    });
});

describe('sanitizeCode', () => {
    it('accepts 3-20 letters, digits or dashes', () => {
        expect(sanitizeCode('arwa')).toBe('ARWA');
        expect(sanitizeCode('ali-2026')).toBe('ALI-2026');
    });
    it('rejects too short, too long or invalid characters', () => {
        expect(() => sanitizeCode('ab')).toThrow('Code must be 3-20 letters, digits or dashes');
        expect(() => sanitizeCode('A'.repeat(21))).toThrow('Code must be 3-20 letters, digits or dashes');
        expect(() => sanitizeCode('ALI 22')).toThrow('Code must be 3-20 letters, digits or dashes');
    });
});

describe('money', () => {
    it('rounds to 2 decimals', () => {
        expect(roundMoney(52.499999)).toBe(52.5);
        expect(roundMoney(3.14159)).toBe(3.14);
    });
    it('computes commission = amount * rate / 100, rounded', () => {
        expect(computeCommission(350, 15)).toBe(52.5);
        expect(computeCommission(199, 12.5)).toBe(24.88);
        expect(computeCommission(500, 0)).toBe(0);
    });
});

describe('sanitizePackRates', () => {
    it('returns clean exceptions, lowercasing pack ids and parsing rates', () => {
        expect(
            sanitizePackRates([
                { packId: PACK_A.toUpperCase(), period: 'YEARLY', rate: '20' },
                { packId: PACK_A, period: 'MONTHLY', rate: 12.5 },
                { packId: PACK_B, period: 'SEMIANNUAL', rate: 0 },
            ])
        ).toEqual([
            { packId: PACK_A, period: 'YEARLY', rate: 20 },
            { packId: PACK_A, period: 'MONTHLY', rate: 12.5 },
            { packId: PACK_B, period: 'SEMIANNUAL', rate: 0 },
        ]);
    });
    it('accepts an empty list', () => {
        expect(sanitizePackRates([])).toEqual([]);
    });
    it('rejects a non-list', () => {
        expect(() => sanitizePackRates({ packId: PACK_A })).toThrow('Pack rates must be a list');
        expect(() => sanitizePackRates(null)).toThrow('Pack rates must be a list');
    });
    it('rejects a missing or malformed pack id', () => {
        expect(() => sanitizePackRates([{ period: 'YEARLY', rate: 10 }])).toThrow('Invalid pack id');
        expect(() => sanitizePackRates([{ packId: 'abc', period: 'YEARLY', rate: 10 }])).toThrow('Invalid pack id');
        expect(() => sanitizePackRates([null])).toThrow('Invalid pack id');
    });
    it('rejects a bad period', () => {
        expect(() => sanitizePackRates([{ packId: PACK_A, period: 'WEEKLY', rate: 10 }])).toThrow(
            'Period must be MONTHLY, SEMIANNUAL or YEARLY'
        );
    });
    it('rejects a rate outside 0-100', () => {
        expect(() => sanitizePackRates([{ packId: PACK_A, period: 'YEARLY', rate: 101 }])).toThrow('Pack rate must be between 0 and 100');
        expect(() => sanitizePackRates([{ packId: PACK_A, period: 'YEARLY' }])).toThrow('Pack rate must be between 0 and 100');
    });
    it('rejects the same pack twice for one period, whatever the case of the id', () => {
        expect(() =>
            sanitizePackRates([
                { packId: PACK_A, period: 'YEARLY', rate: 20 },
                { packId: PACK_A.toUpperCase(), period: 'YEARLY', rate: 22 },
            ])
        ).toThrow('A pack can only have one rate per period');
    });
});

describe('sanitizeNewAgent', () => {
    const valid = {
        name: ' Youssef ',
        email: ' Youssef@Example.com ',
        password: 'secret123',
        phone: '0600000000',
        code: 'youssef22',
        monthlyRate: '10',
        semiannualRate: 15,
        yearlyRate: 25,
    };

    it('returns clean data with no pack exceptions by default', () => {
        expect(sanitizeNewAgent(valid)).toEqual({
            name: 'Youssef',
            email: 'youssef@example.com',
            password: 'secret123',
            phone: '0600000000',
            code: 'YOUSSEF22',
            monthlyRate: 10,
            semiannualRate: 15,
            yearlyRate: 25,
            packRates: [],
        });
        expect(sanitizeNewAgent({ ...valid, packRates: null }).packRates).toEqual([]);
    });
    it('keeps sanitized pack exceptions', () => {
        expect(sanitizeNewAgent({ ...valid, packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] }).packRates).toEqual([
            { packId: PACK_A, period: 'YEARLY', rate: 20 },
        ]);
    });
    it('rejects a short password', () => {
        expect(() => sanitizeNewAgent({ ...valid, password: 'short' })).toThrow('Password must be at least 8 characters');
    });
    it('rejects a missing name or a bad email', () => {
        expect(() => sanitizeNewAgent({ ...valid, name: '  ' })).toThrow('Name is required');
        expect(() => sanitizeNewAgent({ ...valid, email: 'nope' })).toThrow('Email is invalid');
    });
    it('requires the three rates, each between 0 and 100', () => {
        const { semiannualRate: _s, ...withoutSemiannual } = valid;
        expect(() => sanitizeNewAgent(withoutSemiannual)).toThrow('Semi-annual rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, monthlyRate: 101 })).toThrow('Monthly rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, semiannualRate: -1 })).toThrow('Semi-annual rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, yearlyRate: 'abc' })).toThrow('Yearly rate must be between 0 and 100');
    });
    it('rejects the v1 single rate', () => {
        expect(() => sanitizeNewAgent({ ...valid, commissionRate: 15 })).toThrow(LEGACY_RATE_ERROR);
    });
});

describe('sanitizeAgentUpdate', () => {
    it('keeps only the provided editable fields', () => {
        expect(sanitizeAgentUpdate({ monthlyRate: 20 })).toEqual({ monthlyRate: 20 });
        expect(sanitizeAgentUpdate({ semiannualRate: '12.5', yearlyRate: 30 })).toEqual({ semiannualRate: 12.5, yearlyRate: 30 });
        expect(sanitizeAgentUpdate({ name: 'Ali', phone: '', active: false })).toEqual({
            name: 'Ali',
            phone: null,
            active: false,
        });
    });
    it('replaces the whole pack exception list when sent', () => {
        expect(sanitizeAgentUpdate({ packRates: [{ packId: PACK_B, period: 'MONTHLY', rate: 8 }] })).toEqual({
            packRates: [{ packId: PACK_B, period: 'MONTHLY', rate: 8 }],
        });
        expect(sanitizeAgentUpdate({ packRates: [] })).toEqual({ packRates: [] });
    });
    it('validates rates and exceptions', () => {
        expect(() => sanitizeAgentUpdate({ yearlyRate: 150 })).toThrow('Yearly rate must be between 0 and 100');
        expect(() => sanitizeAgentUpdate({ packRates: 'none' })).toThrow('Pack rates must be a list');
    });
    it('rejects the v1 single rate', () => {
        expect(() => sanitizeAgentUpdate({ commissionRate: 20 })).toThrow(LEGACY_RATE_ERROR);
    });
    it('refuses to change the code or the house flag', () => {
        expect(() => sanitizeAgentUpdate({ code: 'NEW' })).toThrow('The code cannot be changed');
        expect(() => sanitizeAgentUpdate({ isHouse: true })).toThrow('The company flag cannot be changed');
    });
    it('rejects a non-boolean active', () => {
        expect(() => sanitizeAgentUpdate({ active: 'yes' })).toThrow('Active must be true or false');
    });
});

describe('sanitizePayment', () => {
    it('returns clean data', () => {
        expect(sanitizePayment({ amount: '350', period: 'MONTHLY', paidAt: '2026-11-01', note: ' cash ' })).toEqual({
            amount: 350,
            period: 'MONTHLY',
            paidAt: new Date('2026-11-01'),
            note: 'cash',
        });
    });
    it('accepts the semi-annual period', () => {
        expect(sanitizePayment({ amount: 1500, period: 'SEMIANNUAL', paidAt: '2026-11-01' }).period).toBe('SEMIANNUAL');
    });
    it('rejects a zero/negative amount, a bad period or a bad date', () => {
        expect(() => sanitizePayment({ amount: 0, period: 'MONTHLY', paidAt: '2026-11-01' })).toThrow('Amount must be greater than 0');
        expect(() => sanitizePayment({ amount: 10, period: 'WEEKLY', paidAt: '2026-11-01' })).toThrow(
            'Period must be MONTHLY, SEMIANNUAL or YEARLY'
        );
        expect(() => sanitizePayment({ amount: 10, period: 'YEARLY', paidAt: 'nope' })).toThrow('Payment date must be a valid date');
    });
});

describe('sanitizePayout', () => {
    it('returns clean data', () => {
        expect(sanitizePayout({ amount: 3000, paidAt: '2026-11-10', note: 'virement' })).toEqual({
            amount: 3000,
            paidAt: new Date('2026-11-10'),
            note: 'virement',
        });
    });
    it('rejects a bad amount or date', () => {
        expect(() => sanitizePayout({ amount: -5, paidAt: '2026-11-10' })).toThrow('Amount must be greater than 0');
        expect(() => sanitizePayout({ amount: 5 })).toThrow('Payout date must be a valid date');
    });
});

describe('date strictness', () => {
    it.each(['1', '2026-02-31', '2026-13-01', '11/01/2026', '0000-01-01', '1999-12-31', '2101-01-01', '2026-11-10T08:30:00.000Z'])('rejects %s', (bad) => {
        expect(() => sanitizePayment({ amount: 10, period: 'MONTHLY', paidAt: bad })).toThrow('Payment date must be a valid date');
        expect(() => sanitizePayout({ amount: 10, paidAt: bad })).toThrow('Payout date must be a valid date');
    });
    it('accepts a plain date and a Date instance', () => {
        expect(sanitizePayout({ amount: 10, paidAt: '2026-11-10' }).paidAt).toEqual(new Date('2026-11-10'));
        const d = new Date('2026-11-10');
        expect(sanitizePayout({ amount: 10, paidAt: d }).paidAt).toEqual(d);
    });
});

describe('resolveCommissionRate', () => {
    const agent = {
        monthlyRate: 10,
        semiannualRate: 15,
        yearlyRate: 25,
        packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }],
    };

    it('uses the exception for the school pack and the period', () => {
        expect(resolveCommissionRate(agent, PACK_A, 'YEARLY')).toBe(20);
    });
    it('falls back to the base rate of the period', () => {
        expect(resolveCommissionRate(agent, PACK_A, 'MONTHLY')).toBe(10);
        expect(resolveCommissionRate(agent, PACK_A, 'SEMIANNUAL')).toBe(15);
        expect(resolveCommissionRate(agent, PACK_B, 'YEARLY')).toBe(25);
    });
    it('uses the base rate for a school without a pack', () => {
        expect(resolveCommissionRate(agent, null, 'YEARLY')).toBe(25);
        expect(resolveCommissionRate(agent, undefined, 'MONTHLY')).toBe(10);
    });
    it('is 0 without an agent', () => {
        expect(resolveCommissionRate(null, PACK_A, 'YEARLY')).toBe(0);
        expect(resolveCommissionRate(undefined, null, 'MONTHLY')).toBe(0);
    });
    it('an exception at 0 % wins over a non-zero base rate', () => {
        expect(resolveCommissionRate({ ...agent, packRates: [{ packId: PACK_B, period: 'MONTHLY', rate: 0 }] }, PACK_B, 'MONTHLY')).toBe(0);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/salesAgents.validation.test.ts`
Expected: FAIL to compile: `sanitizePackRates`, `resolveCommissionRate` and `LEGACY_RATE_ERROR` are not exported by `./salesAgents.validation` (TS2305).

- [ ] **Step 3: Implement**

Replace `src/modules/sales-agents/salesAgents.validation.ts` with:

```ts
// Codes are compared uppercased and trimmed everywhere (signup, check endpoint, creation).
export const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;
export const PERIODS = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'] as const;
export type PeriodValue = (typeof PERIODS)[number];

const PERIOD_ERROR = 'Period must be MONTHLY, SEMIANNUAL or YEARLY';
const OBJECT_ID = /^[a-f0-9]{24}$/;
export const LEGACY_RATE_ERROR = 'commissionRate is no longer accepted: send monthlyRate, semiannualRate and yearlyRate';

export const normalizeCode = (raw: unknown): string => (typeof raw === 'string' ? raw.trim().toUpperCase() : '');

export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const computeCommission = (amount: number, rate: number): number => roundMoney((amount * rate) / 100);

const requireText = (label: string, value: unknown): string => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
    return value.trim();
};

const optionalText = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

const toNumber = (value: unknown): number =>
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;

const parseRate = (label: string, value: unknown): number => {
    const rate = toNumber(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error(`${label} must be between 0 and 100`);
    return rate;
};

const parseAmount = (value: unknown): number => {
    const amount = toNumber(value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than 0');
    return roundMoney(amount);
};

const parseDate = (label: string, value: unknown): Date => {
    const invalid = new Error(`${label} must be a valid date`);
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) throw invalid;
        return value;
    }
    // Only a plain YYYY-MM-DD (2000-2100): `new Date('1')`, time parts and rolled-over days like 02-31 are rejected.
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid;
    const date = new Date(value);
    const year = Number(value.slice(0, 4));
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || year < 2000 || year > 2100) throw invalid;
    return date;
};

const isPeriod = (value: unknown): value is PeriodValue => PERIODS.includes(value as PeriodValue);

export const sanitizeCode = (raw: unknown): string => {
    const code = normalizeCode(raw);
    if (!CODE_PATTERN.test(code)) throw new Error('Code must be 3-20 letters, digits or dashes');
    return code;
};

export interface PackRateData {
    packId: string;
    period: PeriodValue;
    rate: number;
}

// Pack exceptions: (pack, period) -> rate, overriding the base rate of that period for that pack.
// Pack existence is checked by the service (it needs the database).
export const sanitizePackRates = (value: unknown): PackRateData[] => {
    if (!Array.isArray(value)) throw new Error('Pack rates must be a list');
    const seen = new Set<string>();
    return value.map((item) => {
        const entry = (item !== null && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const packId = typeof entry.packId === 'string' ? entry.packId.trim().toLowerCase() : '';
        if (!OBJECT_ID.test(packId)) throw new Error('Invalid pack id');
        if (!isPeriod(entry.period)) throw new Error(PERIOD_ERROR);
        const key = `${packId}:${entry.period}`;
        if (seen.has(key)) throw new Error('A pack can only have one rate per period');
        seen.add(key);
        return { packId, period: entry.period, rate: parseRate('Pack rate', entry.rate) };
    });
};

export interface AgentRates {
    monthlyRate: number;
    semiannualRate: number;
    yearlyRate: number;
}

export interface NewAgentData extends AgentRates {
    name: string;
    email: string;
    password: string;
    phone?: string;
    code: string;
    packRates: PackRateData[];
}

export const sanitizeNewAgent = (input: Record<string, unknown>): NewAgentData => {
    if (input.commissionRate !== undefined) throw new Error(LEGACY_RATE_ERROR);
    const password = typeof input.password === 'string' ? input.password : '';
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    const name = requireText('Name', input.name);
    const email = requireText('Email', input.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email is invalid');
    return {
        name,
        email,
        password,
        phone: optionalText(input.phone),
        code: sanitizeCode(input.code),
        monthlyRate: parseRate('Monthly rate', input.monthlyRate),
        semiannualRate: parseRate('Semi-annual rate', input.semiannualRate),
        yearlyRate: parseRate('Yearly rate', input.yearlyRate),
        packRates: input.packRates === undefined || input.packRates === null ? [] : sanitizePackRates(input.packRates),
    };
};

export interface AgentUpdateData {
    name?: string;
    phone?: string | null;
    monthlyRate?: number;
    semiannualRate?: number;
    yearlyRate?: number;
    packRates?: PackRateData[];
    active?: boolean;
}

export const sanitizeAgentUpdate = (input: Record<string, unknown>): AgentUpdateData => {
    if (input.code !== undefined) throw new Error('The code cannot be changed');
    if (input.isHouse !== undefined) throw new Error('The company flag cannot be changed');
    if (input.commissionRate !== undefined) throw new Error(LEGACY_RATE_ERROR);
    const data: AgentUpdateData = {};
    if (input.name !== undefined) data.name = requireText('Name', input.name);
    if (input.phone !== undefined) data.phone = optionalText(input.phone) ?? null;
    if (input.monthlyRate !== undefined) data.monthlyRate = parseRate('Monthly rate', input.monthlyRate);
    if (input.semiannualRate !== undefined) data.semiannualRate = parseRate('Semi-annual rate', input.semiannualRate);
    if (input.yearlyRate !== undefined) data.yearlyRate = parseRate('Yearly rate', input.yearlyRate);
    // Replaces the whole list when present.
    if (input.packRates !== undefined) data.packRates = sanitizePackRates(input.packRates);
    if (input.active !== undefined) {
        if (typeof input.active !== 'boolean') throw new Error('Active must be true or false');
        data.active = input.active;
    }
    return data;
};

export interface RateSource extends AgentRates {
    packRates: { packId: string; period: string; rate: number }[];
}

export const baseRate = (rates: AgentRates, period: PeriodValue): number =>
    period === 'MONTHLY' ? rates.monthlyRate : period === 'SEMIANNUAL' ? rates.semiannualRate : rates.yearlyRate;

// The rate frozen on a payment: the agent's exception for (school pack, period) if any, else the base rate
// of the period. No agent earns 0; a school without a pack uses the base rate.
export const resolveCommissionRate = (
    agent: RateSource | null | undefined,
    packId: string | null | undefined,
    period: PeriodValue
): number => {
    if (!agent) return 0;
    const exception = packId ? agent.packRates.find((rate) => rate.packId === packId && rate.period === period) : undefined;
    return exception ? exception.rate : baseRate(agent, period);
};

export interface PaymentData {
    amount: number;
    period: PeriodValue;
    paidAt: Date;
    note?: string;
}

export const sanitizePayment = (input: Record<string, unknown>): PaymentData => {
    const amount = parseAmount(input.amount);
    if (!isPeriod(input.period)) throw new Error(PERIOD_ERROR);
    return {
        amount,
        period: input.period,
        paidAt: parseDate('Payment date', input.paidAt),
        note: optionalText(input.note),
    };
};

export interface PayoutData {
    amount: number;
    paidAt: Date;
    note?: string;
}

export const sanitizePayout = (input: Record<string, unknown>): PayoutData => ({
    amount: parseAmount(input.amount),
    paidAt: parseDate('Payout date', input.paidAt),
    note: optionalText(input.note),
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/modules/sales-agents/salesAgents.validation.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents/salesAgents.validation.ts src/modules/sales-agents/salesAgents.validation.test.ts
git commit -m "feat(education): validate per-period agent rates and pack exceptions, resolve payment rates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Payment snapshot — resolved rate and pack

**Files:**
- Modify: `apps/education-apps/src/modules/sales-agents/schoolPayments.service.ts`
- Test: `apps/education-apps/src/modules/sales-agents/schoolPayments.service.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/modules/sales-agents/schoolPayments.service.test.ts`, add after the line `const tx = (prisma as any).__tx;`:

```ts
const PACK_A = '6ab050b281878c35b0f00752';

const agent = {
    id: 'a1',
    active: true,
    monthlyRate: 10,
    semiannualRate: 15,
    yearlyRate: 25,
    packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }],
};

const crecheSchool = { id: 's1', packId: PACK_A, pack: { id: PACK_A, name: 'Crèche' }, salesAgent: agent };
```

and replace the whole `describe('recordSchoolPayment', () => { ... });` block with:

```ts
describe('recordSchoolPayment', () => {
    beforeEach(() => tx.schoolPayment.create.mockResolvedValue({ id: 'p1' }));

    it("freezes the agent, the resolved exception rate and the school's pack on the payment", async () => {
        tx.school.findUnique.mockResolvedValue(crecheSchool);

        await recordSchoolPayment('s1', { amount: 1500, period: 'YEARLY', paidAt: '2026-11-01' });

        expect(tx.school.findUnique).toHaveBeenCalledWith({
            where: { id: 's1' },
            include: { salesAgent: true, pack: { select: { id: true, name: true } } },
        });
        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: {
                amount: 1500,
                period: 'YEARLY',
                paidAt: new Date('2026-11-01'),
                note: undefined,
                schoolId: 's1',
                salesAgentId: 'a1',
                packId: PACK_A,
                packName: 'Crèche',
                commissionRate: 20,
                commissionAmount: 300,
            },
        });
    });

    it('uses the base rate of the period when the pack has no exception for it', async () => {
        tx.school.findUnique.mockResolvedValue(crecheSchool);

        await recordSchoolPayment('s1', { amount: 150, period: 'MONTHLY', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ period: 'MONTHLY', commissionRate: 10, commissionAmount: 15, packName: 'Crèche' }),
        });
    });

    it('accepts a semi-annual payment', async () => {
        tx.school.findUnique.mockResolvedValue(crecheSchool);

        await recordSchoolPayment('s1', { amount: 1500, period: 'SEMIANNUAL', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ period: 'SEMIANNUAL', commissionRate: 15, commissionAmount: 225 }),
        });
    });

    it('uses the base rate and stores no pack for a school without a pack', async () => {
        tx.school.findUnique.mockResolvedValue({ id: 's1', packId: null, pack: null, salesAgent: agent });

        await recordSchoolPayment('s1', { amount: 1000, period: 'YEARLY', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ packId: null, packName: null, commissionRate: 25, commissionAmount: 250 }),
        });
    });

    it('an inactive agent still earns', async () => {
        tx.school.findUnique.mockResolvedValue({ ...crecheSchool, salesAgent: { ...agent, active: false } });

        await recordSchoolPayment('s1', { amount: 150, period: 'MONTHLY', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ salesAgentId: 'a1', commissionAmount: 15 }),
        });
    });

    it('records a zero commission when the school has no agent, but still snapshots the pack', async () => {
        tx.school.findUnique.mockResolvedValue({ ...crecheSchool, salesAgent: null });

        await recordSchoolPayment('s1', { amount: 350, period: 'MONTHLY', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ salesAgentId: null, commissionRate: 0, commissionAmount: 0, packId: PACK_A, packName: 'Crèche' }),
        });
    });

    it('404s an unknown school and validates input before touching the database', async () => {
        tx.school.findUnique.mockResolvedValue(null);
        await expect(recordSchoolPayment('zz', { amount: 350, period: 'MONTHLY', paidAt: '2026-11-01' })).rejects.toThrow('School not found');

        jest.clearAllMocks();
        await expect(recordSchoolPayment('s1', { amount: 0, period: 'MONTHLY', paidAt: '2026-11-01' })).rejects.toThrow(
            'Amount must be greater than 0'
        );
        await expect(recordSchoolPayment('s1', { amount: 10, period: 'WEEKLY', paidAt: '2026-11-01' })).rejects.toThrow(
            'Period must be MONTHLY, SEMIANNUAL or YEARLY'
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(tx.schoolPayment.create).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/schoolPayments.service.test.ts`
Expected: FAIL to compile: TS2339 "Property 'commissionRate' does not exist" in `schoolPayments.service.ts` (`school.salesAgent?.commissionRate`).

- [ ] **Step 3: Implement**

In `src/modules/sales-agents/schoolPayments.service.ts`, replace the import line

```ts
import { computeCommission, sanitizePayment } from './salesAgents.validation';
```

with

```ts
import { computeCommission, resolveCommissionRate, sanitizePayment } from './salesAgents.validation';
```

and replace the whole `recordSchoolPayment` function (with its comment) with:

```ts
// The school's current agent, the rate resolved for (pack, period) and the pack itself are frozen on the
// payment: later changes to the agent's rates, the school's agent or its pack never touch it.
// An inactive agent still earns: deactivation only stops new signups with the code.
export const recordSchoolPayment = async (schoolId: string, input: Record<string, unknown>) => {
    assertId('School id', schoolId);
    const data = sanitizePayment(input);

    return prisma.$transaction(async (tx) => {
        const school = await tx.school.findUnique({
            where: { id: schoolId },
            include: { salesAgent: true, pack: { select: { id: true, name: true } } },
        });
        if (!school) throw new Error('School not found');

        const packId = school.pack?.id ?? null;
        const rate = resolveCommissionRate(school.salesAgent, packId, data.period);
        return tx.schoolPayment.create({
            data: {
                ...data,
                schoolId,
                salesAgentId: school.salesAgent?.id ?? null,
                packId,
                packName: school.pack?.name ?? null,
                commissionRate: rate,
                commissionAmount: computeCommission(data.amount, rate),
            },
        });
    });
};
```

(`listSchoolPayments` needs no change: it returns every payment field, so `packId`/`packName` are included; v1 payments return `null` for both.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/modules/sales-agents/schoolPayments.service.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents/schoolPayments.service.ts src/modules/sales-agents/schoolPayments.service.test.ts
git commit -m "feat(education): freeze the resolved agent rate and the school pack on payments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client status and FIFO payout allocation helpers

**Files:**
- Create: `apps/education-apps/src/modules/sales-agents/salesAgents.statuses.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.statuses.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/sales-agents/salesAgents.statuses.test.ts`:

```ts
import { allocatePayouts, clientStatus, countStatuses, type Allocation } from './salesAgents.statuses';

describe('clientStatus', () => {
    it.each<[string, number, string]>([
        ['PENDING', 0, 'PENDING'],
        ['PENDING', 2, 'PENDING'],
        ['ACTIVE', 0, 'ACTIVE_UNPAID'],
        ['ACTIVE', 1, 'CONFIRMED'],
        ['SUSPENDED', 0, 'CANCELLED'],
        ['SUSPENDED', 3, 'CANCELLED'],
    ])('a %s school with %i credited payment(s) is %s', (status, payments, expected) => {
        expect(clientStatus(status, payments)).toBe(expected);
    });
});

describe('countStatuses', () => {
    it('counts every status, including absent ones', () => {
        expect(countStatuses(['CONFIRMED', 'CONFIRMED', 'CANCELLED'])).toEqual({
            PENDING: 0,
            ACTIVE_UNPAID: 0,
            CONFIRMED: 2,
            CANCELLED: 1,
        });
    });
});

const commission = (id: string, day: string, commissionAmount: number, recordedOn = day) => ({
    id,
    paidAt: new Date(day),
    createdAt: new Date(recordedOn),
    commissionAmount,
});

const summary = (allocation: Map<string, Allocation>) =>
    Object.fromEntries([...allocation].map(([id, entry]) => [id, [entry.payoutStatus, entry.paidAmount]]));

describe('allocatePayouts', () => {
    it('leaves everything due without payouts', () => {
        const result = allocatePayouts([commission('a', '2026-01-01', 100), commission('b', '2026-02-01', 50)], 0);
        expect(summary(result)).toEqual({ a: ['DUE', 0], b: ['DUE', 0] });
    });

    it('marks everything paid when payouts cover the commissions exactly', () => {
        const result = allocatePayouts([commission('a', '2026-01-01', 100), commission('b', '2026-02-01', 50)], 150);
        expect(summary(result)).toEqual({ a: ['PAID', 100], b: ['PAID', 50] });
    });

    it('spends payouts on the oldest commission first and leaves the next one partial', () => {
        // Listed newest first, as the report returns them.
        const result = allocatePayouts([commission('b', '2026-02-01', 50), commission('a', '2026-01-01', 100)], 120);
        expect(summary(result)).toEqual({ a: ['PAID', 100], b: ['PARTIAL', 20] });
    });

    it('marks everything paid when payouts exceed the commissions', () => {
        const result = allocatePayouts([commission('a', '2026-01-01', 100), commission('b', '2026-02-01', 50)], 500);
        expect(summary(result)).toEqual({ a: ['PAID', 100], b: ['PAID', 50] });
    });

    it('breaks a tie on the payment date with the recording time', () => {
        const result = allocatePayouts(
            [commission('late', '2026-01-01', 100, '2026-01-03'), commission('early', '2026-01-01', 100, '2026-01-02')],
            100
        );
        expect(summary(result)).toEqual({ early: ['PAID', 100], late: ['DUE', 0] });
    });

    it('marks zero commissions NONE without spending anything on them', () => {
        const result = allocatePayouts([commission('zero', '2026-01-01', 0), commission('a', '2026-02-01', 40)], 10);
        expect(summary(result)).toEqual({ zero: ['NONE', 0], a: ['PARTIAL', 10] });
    });

    it('rounds amounts to cents', () => {
        const result = allocatePayouts([commission('a', '2026-01-01', 33.33), commission('b', '2026-01-02', 33.33)], 50);
        expect(summary(result)).toEqual({ a: ['PAID', 33.33], b: ['PARTIAL', 16.67] });
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/salesAgents.statuses.test.ts`
Expected: FAIL, "Cannot find module './salesAgents.statuses'".

- [ ] **Step 3: Implement**

Create `src/modules/sales-agents/salesAgents.statuses.ts`:

```ts
import { roundMoney } from './salesAgents.validation';

export type ClientStatus = 'PENDING' | 'ACTIVE_UNPAID' | 'CONFIRMED' | 'CANCELLED';
export type PayoutStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'NONE';

// A school seen from its agent: only payments credited to that agent count. A suspended school keeps the
// commissions it already generated (still owed); only its client status becomes CANCELLED.
export const clientStatus = (schoolStatus: string, creditedPayments: number): ClientStatus => {
    if (schoolStatus === 'SUSPENDED') return 'CANCELLED';
    if (schoolStatus === 'PENDING') return 'PENDING';
    return creditedPayments > 0 ? 'CONFIRMED' : 'ACTIVE_UNPAID';
};

export const countStatuses = (statuses: ClientStatus[]): Record<ClientStatus, number> => {
    const counts: Record<ClientStatus, number> = { PENDING: 0, ACTIVE_UNPAID: 0, CONFIRMED: 0, CANCELLED: 0 };
    for (const status of statuses) counts[status] += 1;
    return counts;
};

export interface Allocation {
    payoutStatus: PayoutStatus;
    paidAmount: number;
}

interface Allocatable {
    id: string;
    paidAt: Date;
    createdAt: Date;
    commissionAmount: number;
}

// Payouts are not linked to commissions: their total is spent on the oldest commissions first (payment date,
// then recording time). Any excess (negative balance) is not carried anywhere.
export const allocatePayouts = (commissions: Allocatable[], totalPayouts: number): Map<string, Allocation> => {
    const ordered = [...commissions].sort(
        (a, b) => a.paidAt.getTime() - b.paidAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
    );
    let remaining = roundMoney(Math.max(totalPayouts, 0));
    const allocation = new Map<string, Allocation>();
    for (const commission of ordered) {
        if (commission.commissionAmount <= 0) {
            allocation.set(commission.id, { payoutStatus: 'NONE', paidAmount: 0 });
            continue;
        }
        const paid = roundMoney(Math.min(remaining, commission.commissionAmount));
        remaining = roundMoney(remaining - paid);
        const payoutStatus: PayoutStatus = paid >= commission.commissionAmount ? 'PAID' : paid > 0 ? 'PARTIAL' : 'DUE';
        allocation.set(commission.id, { payoutStatus, paidAmount: paid });
    }
    return allocation;
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/modules/sales-agents/salesAgents.statuses.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents/salesAgents.statuses.ts src/modules/sales-agents/salesAgents.statuses.test.ts
git commit -m "feat(education): client statuses and oldest-first payout allocation for agents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Agent service — rates, pack exceptions, statuses and FIFO in reports

**Files:**
- Modify: `apps/education-apps/src/modules/sales-agents/salesAgents.service.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace `src/modules/sales-agents/salesAgents.service.test.ts` with:

```ts
import prisma from '../../config/database';
import {
    buildTotals,
    resolveReferralCode,
    isReferralCodeValid,
    listAgents,
    createAgent,
    updateAgent,
    getAgentReport,
    getAgentReportForUser,
    recordPayout,
    deletePayout,
} from './salesAgents.service';
import * as bcryptUtil from '../../utils/bcrypt';

jest.mock('../../config/database', () => {
    const tx = { user: { create: jest.fn(), update: jest.fn() }, salesAgent: { create: jest.fn(), update: jest.fn() } };
    return {
        __esModule: true,
        default: {
            salesAgent: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
            user: { findUnique: jest.fn() },
            pack: { findMany: jest.fn(), count: jest.fn() },
            agentPayout: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

const PACK_A = '6ab050b281878c35b0f00752';
const PACK_B = '6ab050b181878c35b0f00750';
const LEGACY = 'commissionRate is no longer accepted: send monthlyRate, semiannualRate and yearlyRate';

afterEach(() => jest.clearAllMocks());

describe('resolveReferralCode', () => {
    it('requires a code', async () => {
        await expect(resolveReferralCode(undefined)).rejects.toThrow('Referral code is required');
        await expect(resolveReferralCode('   ')).rejects.toThrow('Referral code is required');
        expect(prisma.salesAgent.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a non-string without querying', async () => {
        await expect(resolveReferralCode({ $ne: null })).rejects.toThrow('Invalid referral code');
        expect(prisma.salesAgent.findFirst).not.toHaveBeenCalled();
    });

    it('looks up an active agent by the normalised code', async () => {
        const agent = { id: 'a1', code: 'YOUSSEF22', active: true };
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(agent);

        await expect(resolveReferralCode(' youssef22 ')).resolves.toBe(agent);
        expect(prisma.salesAgent.findFirst).toHaveBeenCalledWith({ where: { code: 'YOUSSEF22', active: true } });
    });

    it('rejects an unknown or inactive code', async () => {
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(resolveReferralCode('NOPE')).rejects.toThrow('Invalid referral code');
    });
});

describe('isReferralCodeValid', () => {
    it('returns true for an active code and false otherwise', async () => {
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'a1' }).mockResolvedValueOnce(null);
        await expect(isReferralCodeValid('ARWA')).resolves.toBe(true);
        await expect(isReferralCodeValid('NOPE')).resolves.toBe(false);
        await expect(isReferralCodeValid('')).resolves.toBe(false);
    });

    it('surfaces infrastructure errors instead of calling the code invalid', async () => {
        (prisma.salesAgent.findFirst as jest.Mock).mockRejectedValueOnce(
            Object.assign(new Error('db down'), { name: 'PrismaClientKnownRequestError' })
        );
        await expect(isReferralCodeValid('ARWA')).rejects.toThrow('db down');
    });
});

describe('listAgents', () => {
    const stored = (packRates: unknown[]) => ({
        id: 'a1',
        name: 'Youssef',
        code: 'YOUSSEF22',
        monthlyRate: 10,
        semiannualRate: 15,
        yearlyRate: 25,
        packRates,
        isHouse: false,
        active: true,
        userId: 'u1',
        user: { email: 'y@example.com' },
        schools: [{ status: 'ACTIVE' }, { status: 'PENDING' }],
        payments: [{ commissionAmount: 52.5 }, { commissionAmount: 30.25 }],
        payouts: [{ amount: 50 }],
    });

    it('returns agents (house first) with their rates, named pack exceptions and totals, without the user id', async () => {
        (prisma.salesAgent.findMany as jest.Mock).mockResolvedValue([stored([{ packId: PACK_A, period: 'YEARLY', rate: 20 }])]);
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([{ id: PACK_A, name: 'Crèche', code: 'creche' }]);

        const [agent] = await listAgents();

        expect(prisma.salesAgent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: [{ isHouse: 'desc' }, { createdAt: 'asc' }] })
        );
        expect(prisma.pack.findMany).toHaveBeenCalledWith({
            where: { id: { in: [PACK_A] } },
            select: { id: true, name: true, code: true },
        });
        expect(agent).toEqual({
            id: 'a1',
            name: 'Youssef',
            code: 'YOUSSEF22',
            monthlyRate: 10,
            semiannualRate: 15,
            yearlyRate: 25,
            packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20, packName: 'Crèche', packCode: 'creche' }],
            isHouse: false,
            active: true,
            email: 'y@example.com',
            totals: { schools: 2, activeSchools: 1, totalCommissions: 82.75, totalPayouts: 50, balance: 32.75 },
        });
    });

    it('does not query packs when no agent has exceptions', async () => {
        (prisma.salesAgent.findMany as jest.Mock).mockResolvedValue([stored([])]);

        const [agent] = await listAgents();

        expect(prisma.pack.findMany).not.toHaveBeenCalled();
        expect(agent.packRates).toEqual([]);
    });
});

describe('buildTotals', () => {
    it('gives a negative balance when payouts exceed commissions', () => {
        expect(buildTotals([{ status: 'ACTIVE' }], [{ commissionAmount: 52.5 }], [{ amount: 100 }])).toEqual({
            schools: 1,
            activeSchools: 1,
            totalCommissions: 52.5,
            totalPayouts: 100,
            balance: -47.5,
        });
    });
});

describe('createAgent', () => {
    const input = {
        name: 'Youssef',
        email: 'Y@example.com',
        password: 'secret123',
        code: 'youssef22',
        monthlyRate: 10,
        semiannualRate: 15,
        yearlyRate: 25,
    };

    beforeEach(() => {
        jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed');
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        tx.user.create.mockResolvedValue({ id: 'u1' });
        tx.salesAgent.create.mockResolvedValue({ id: 'a1', code: 'YOUSSEF22' });
    });
    afterEach(() => jest.restoreAllMocks());

    it('creates the SALES_AGENT user and the agent with its three rates in one transaction', async () => {
        tx.salesAgent.create.mockResolvedValue({ id: 'a1', code: 'YOUSSEF22', userId: 'u1' });
        await expect(createAgent(input)).resolves.toEqual({ id: 'a1', code: 'YOUSSEF22' });

        expect(tx.user.create).toHaveBeenCalledWith({
            data: { email: 'y@example.com', password: 'hashed', name: 'Youssef', role: 'SALES_AGENT', gsm: undefined },
        });
        expect(tx.salesAgent.create).toHaveBeenCalledWith({
            data: {
                name: 'Youssef',
                phone: undefined,
                code: 'YOUSSEF22',
                monthlyRate: 10,
                semiannualRate: 15,
                yearlyRate: 25,
                packRates: [],
                userId: 'u1',
            },
        });
        expect(prisma.pack.count).not.toHaveBeenCalled();
    });

    it('stores pack exceptions after checking that the packs exist', async () => {
        (prisma.pack.count as jest.Mock).mockResolvedValue(1);

        await createAgent({ ...input, packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] });

        expect(prisma.pack.count).toHaveBeenCalledWith({ where: { id: { in: [PACK_A] } } });
        expect(tx.salesAgent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] }),
        });
    });

    it('rejects an unknown pack before creating anything', async () => {
        (prisma.pack.count as jest.Mock).mockResolvedValue(0);
        await expect(createAgent({ ...input, packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] })).rejects.toThrow(
            'Pack not found'
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects the v1 single rate', async () => {
        await expect(createAgent({ ...input, commissionRate: 15 })).rejects.toThrow(LEGACY);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a code already in use', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'other' });
        await expect(createAgent(input)).rejects.toThrow('This code is already used');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an email already in use', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u0' });
        await expect(createAgent(input)).rejects.toThrow('Email already exists');
    });

    it('turns a unique-index race into a friendly message', async () => {
        (prisma.$transaction as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
        await expect(createAgent(input)).rejects.toThrow('Email or code already exists');
    });
});

describe('updateAgent', () => {
    it('updates the base rates', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'a1', monthlyRate: 12, yearlyRate: 30, userId: 'u1' });

        await expect(updateAgent('a1', { monthlyRate: 12, yearlyRate: '30' })).resolves.toEqual({
            id: 'a1',
            monthlyRate: 12,
            yearlyRate: 30,
        });

        expect(prisma.salesAgent.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { monthlyRate: 12, yearlyRate: 30 } });
    });

    it('replaces the whole pack exception list', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'a1', userId: 'u1' });
        (prisma.pack.count as jest.Mock).mockResolvedValue(2);

        await updateAgent('a1', {
            packRates: [
                { packId: PACK_A, period: 'YEARLY', rate: 20 },
                { packId: PACK_B, period: 'SEMIANNUAL', rate: '18' },
            ],
        });

        expect(prisma.pack.count).toHaveBeenCalledWith({ where: { id: { in: [PACK_A, PACK_B] } } });
        expect(prisma.salesAgent.update).toHaveBeenCalledWith({
            where: { id: 'a1' },
            data: {
                packRates: {
                    set: [
                        { packId: PACK_A, period: 'YEARLY', rate: 20 },
                        { packId: PACK_B, period: 'SEMIANNUAL', rate: 18 },
                    ],
                },
            },
        });
    });

    it('clears the exceptions with an empty list', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'a1', userId: 'u1' });

        await updateAgent('a1', { packRates: [] });

        expect(prisma.pack.count).not.toHaveBeenCalled();
        expect(prisma.salesAgent.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { packRates: { set: [] } } });
    });

    it('404s an unknown pack in the exceptions', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        (prisma.pack.count as jest.Mock).mockResolvedValue(0);

        await expect(updateAgent('a1', { packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] })).rejects.toThrow(
            'Pack not found'
        );
        expect(prisma.salesAgent.update).not.toHaveBeenCalled();
    });

    it('rejects the v1 single rate before reading the agent', async () => {
        await expect(updateAgent('a1', { commissionRate: 20 })).rejects.toThrow(LEGACY);
        expect(prisma.salesAgent.findUnique).not.toHaveBeenCalled();
    });

    it('refuses to deactivate the house agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', isHouse: true });
        await expect(updateAgent('h1', { active: false })).rejects.toThrow('The company code cannot be deactivated');
        expect(prisma.salesAgent.update).not.toHaveBeenCalled();
    });

    it('404s an unknown agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(updateAgent('zz', { name: 'x' })).rejects.toThrow('Sales agent not found');
    });

    it('refuses a non-zero rate or any pack exception on the house agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', isHouse: true, userId: null });

        await expect(updateAgent('h1', { semiannualRate: 5 })).rejects.toThrow('The company code earns no commission');
        await expect(updateAgent('h1', { packRates: [{ packId: PACK_A, period: 'MONTHLY', rate: 0 }] })).rejects.toThrow(
            'The company code earns no commission'
        );
        expect(prisma.salesAgent.update).not.toHaveBeenCalled();
    });

    it('accepts zero rates and no exceptions on the house agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', isHouse: true, userId: null });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'h1', userId: null });

        await updateAgent('h1', { monthlyRate: 0, semiannualRate: 0, yearlyRate: 0, packRates: [] });

        expect(prisma.salesAgent.update).toHaveBeenCalledWith({
            where: { id: 'h1' },
            data: { monthlyRate: 0, semiannualRate: 0, yearlyRate: 0, packRates: { set: [] } },
        });
    });

    it('keeps the login account name and phone in sync with the agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        tx.salesAgent.update.mockResolvedValue({ id: 'a1', name: 'Ali', phone: null, userId: 'u1' });

        await expect(updateAgent('a1', { name: 'Ali', phone: '' })).resolves.toEqual({ id: 'a1', name: 'Ali', phone: null });

        expect(tx.salesAgent.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { name: 'Ali', phone: null } });
        expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { name: 'Ali', gsm: null } });
        expect(prisma.salesAgent.update).not.toHaveBeenCalled();
    });
});

describe('agent report', () => {
    const school = (id: string, name: string, status: string) => ({
        id,
        name,
        city: 'Casa',
        institutionType: 'PRIVATE_SCHOOL',
        status,
        createdAt: new Date('2026-01-15'),
        ownerName: 'Owner',
        ownerPhone: '0611',
        pack: { name: 'Pro' },
    });

    const stored = {
        id: 'a1',
        name: 'Youssef',
        phone: '0600',
        code: 'YOUSSEF22',
        monthlyRate: 10,
        semiannualRate: 15,
        yearlyRate: 25,
        packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }],
        isHouse: false,
        active: true,
        userId: 'u1',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        user: { email: 'y@example.com' },
        schools: [
            school('s1', 'Ecole A', 'ACTIVE'), // has credited payments -> CONFIRMED
            school('s2', 'Ecole B', 'PENDING'),
            school('s3', 'Ecole C', 'ACTIVE'), // no payment -> ACTIVE_UNPAID
            school('s4', 'Ecole D', 'SUSPENDED'), // paid before -> CANCELLED, its commission is still owed
        ],
        // As Prisma returns them: newest first.
        payments: [
            { id: 'p1', schoolId: 's1', paidAt: new Date('2026-03-01'), createdAt: new Date('2026-03-01'), amount: 350, period: 'MONTHLY', packName: 'Pro', commissionRate: 10, commissionAmount: 35, school: { name: 'Ecole A' } },
            { id: 'p2', schoolId: 's4', paidAt: new Date('2026-02-01'), createdAt: new Date('2026-02-01'), amount: 1500, period: 'SEMIANNUAL', packName: 'Pro', commissionRate: 15, commissionAmount: 225, school: { name: 'Ecole D' } },
            // Recorded the day after p3 for the same payment date, while the monthly rate was 0 %.
            { id: 'p4', schoolId: 's1', paidAt: new Date('2026-01-01'), createdAt: new Date('2026-01-02'), amount: 100, period: 'MONTHLY', packName: null, commissionRate: 0, commissionAmount: 0, school: { name: 'Ecole A' } },
            // A school that moved to another agent: still credited here, but not in this agent's schools.
            { id: 'p3', schoolId: 's9', paidAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), amount: 1000, period: 'YEARLY', packName: null, commissionRate: 25, commissionAmount: 250, school: { name: 'Ecole Z' } },
        ],
        payouts: [{ id: 'o1', paidAt: new Date('2026-03-05'), amount: 300, note: null }],
    };

    beforeEach(() => {
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([{ id: PACK_A, name: 'Crèche', code: 'creche' }]);
    });

    it('builds the report for an agent id, with rates, statuses and oldest-first payout allocation', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(stored);

        const report = await getAgentReport('a1');

        expect((prisma.salesAgent.findUnique as jest.Mock).mock.calls[0][0].where).toEqual({ id: 'a1' });
        expect(report.agent).toEqual({
            id: 'a1',
            name: 'Youssef',
            phone: '0600',
            code: 'YOUSSEF22',
            monthlyRate: 10,
            semiannualRate: 15,
            yearlyRate: 25,
            packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20, packName: 'Crèche', packCode: 'creche' }],
            isHouse: false,
            active: true,
            email: 'y@example.com',
            referralPath: '/signup?ref=YOUSSEF22',
        });
        expect(report.totals).toEqual({
            schools: 4,
            activeSchools: 2,
            totalCommissions: 510,
            totalPayouts: 300,
            balance: 210,
            statusCounts: { PENDING: 1, ACTIVE_UNPAID: 1, CONFIRMED: 1, CANCELLED: 1 },
        });
        expect(report.schools[0]).toEqual({
            id: 's1',
            name: 'Ecole A',
            city: 'Casa',
            institutionType: 'PRIVATE_SCHOOL',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-15'),
            ownerName: 'Owner',
            ownerPhone: '0611',
            packName: 'Pro',
            clientStatus: 'CONFIRMED',
            totalPaid: 450,
        });
        expect(report.schools.map((s) => [s.id, s.status, s.clientStatus, s.totalPaid])).toEqual([
            ['s1', 'ACTIVE', 'CONFIRMED', 450],
            ['s2', 'PENDING', 'PENDING', 0],
            ['s3', 'ACTIVE', 'ACTIVE_UNPAID', 0],
            ['s4', 'SUSPENDED', 'CANCELLED', 1500],
        ]);
        // 300 paid out: p3 (oldest, 250) is paid, p4 has no commission, p2 gets the last 50, p1 is due.
        expect(report.commissions).toEqual([
            { id: 'p1', paidAt: new Date('2026-03-01'), amount: 350, period: 'MONTHLY', packName: 'Pro', commissionRate: 10, commissionAmount: 35, schoolName: 'Ecole A', payoutStatus: 'DUE', paidAmount: 0 },
            { id: 'p2', paidAt: new Date('2026-02-01'), amount: 1500, period: 'SEMIANNUAL', packName: 'Pro', commissionRate: 15, commissionAmount: 225, schoolName: 'Ecole D', payoutStatus: 'PARTIAL', paidAmount: 50 },
            { id: 'p4', paidAt: new Date('2026-01-01'), amount: 100, period: 'MONTHLY', packName: null, commissionRate: 0, commissionAmount: 0, schoolName: 'Ecole A', payoutStatus: 'NONE', paidAmount: 0 },
            { id: 'p3', paidAt: new Date('2026-01-01'), amount: 1000, period: 'YEARLY', packName: null, commissionRate: 25, commissionAmount: 250, schoolName: 'Ecole Z', payoutStatus: 'PAID', paidAmount: 250 },
        ]);
        expect(report.payouts).toEqual(stored.payouts);
    });

    it('scopes the agent space by the logged-in user id, and commissions by the payment agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(stored);

        await getAgentReportForUser('u1');

        const args = (prisma.salesAgent.findUnique as jest.Mock).mock.calls[0][0];
        expect(args.where).toEqual({ userId: 'u1' });
        // Commissions come from the agent's own `payments` relation (SchoolPayment.salesAgentId),
        // so a payment made before the school moved to another agent stays with this agent.
        expect(args.include.payments.select).toEqual(
            expect.objectContaining({ commissionAmount: true, schoolId: true, createdAt: true, packName: true })
        );
        expect(args.include.payments.orderBy).toEqual([{ paidAt: 'desc' }, { createdAt: 'desc' }]);
        expect(args.include.schools.select.payments).toBeUndefined();
    });

    it('does not query packs for an agent without exceptions', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ ...stored, packRates: [] });

        const report = await getAgentReport('a1');

        expect(prisma.pack.findMany).not.toHaveBeenCalled();
        expect(report.agent.packRates).toEqual([]);
    });

    it('404s when no agent matches', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getAgentReportForUser('u9')).rejects.toThrow('Sales agent not found');
    });
});

describe('payouts', () => {
    it('records a payout for an existing agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1' });
        (prisma.agentPayout.create as jest.Mock).mockResolvedValue({ id: 'o1' });

        await recordPayout('a1', { amount: 3000, paidAt: '2026-11-10', note: 'virement' });

        expect(prisma.agentPayout.create).toHaveBeenCalledWith({
            data: { amount: 3000, paidAt: new Date('2026-11-10'), note: 'virement', salesAgentId: 'a1' },
        });
    });

    it('404s a payout for an unknown agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(recordPayout('zz', { amount: 10, paidAt: '2026-11-10' })).rejects.toThrow('Sales agent not found');
    });

    it('deletes only a payout that belongs to the agent', async () => {
        (prisma.agentPayout.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'o1' }).mockResolvedValueOnce(null);

        await expect(deletePayout('a1', 'o1')).resolves.toEqual({ id: 'o1' });
        expect(prisma.agentPayout.findFirst).toHaveBeenCalledWith({ where: { id: 'o1', salesAgentId: 'a1' } });
        expect(prisma.agentPayout.delete).toHaveBeenCalledWith({ where: { id: 'o1' } });

        await expect(deletePayout('a2', 'o1')).rejects.toThrow('Payout not found');
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/salesAgents.service.test.ts`
Expected: FAIL to compile: TS errors in `salesAgents.service.ts` about `commissionRate` (e.g. "Property 'commissionRate' does not exist on type 'NewAgentData'").

- [ ] **Step 3: Implement**

Replace `src/modules/sales-agents/salesAgents.service.ts` with:

```ts
import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';
import { assertId } from '../transport/ids';
import {
    CODE_PATTERN,
    normalizeCode,
    roundMoney,
    sanitizeAgentUpdate,
    sanitizeNewAgent,
    sanitizePayout,
    type AgentUpdateData,
    type PackRateData,
} from './salesAgents.validation';
import { allocatePayouts, clientStatus, countStatuses, type Allocation } from './salesAgents.statuses';

// The agent behind a referral code typed at signup. Only active agents' codes are accepted.
export const resolveReferralCode = async (raw: unknown) => {
    if (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())) {
        throw new Error('Referral code is required');
    }
    const code = normalizeCode(raw);
    // Non-strings normalise to '' and fail here, so they never reach Prisma.
    if (!CODE_PATTERN.test(code)) throw new Error('Invalid referral code');

    const agent = await prisma.salesAgent.findFirst({ where: { code, active: true } });
    if (!agent) throw new Error('Invalid referral code');
    return agent;
};

// Public check for the signup form: says only whether the code works, never who it belongs to.
export const isReferralCodeValid = async (raw: unknown): Promise<boolean> => {
    try {
        await resolveReferralCode(raw);
        return true;
    } catch (error) {
        if (error instanceof Error && (error.message === 'Referral code is required' || error.message === 'Invalid referral code')) {
            return false;
        }
        throw error;
    }
};

const sum = (values: number[]): number => roundMoney(values.reduce((total, value) => total + value, 0));

export const buildTotals = (
    schools: { status: string }[],
    payments: { commissionAmount: number }[],
    payouts: { amount: number }[]
) => {
    const totalCommissions = sum(payments.map((payment) => payment.commissionAmount));
    const totalPayouts = sum(payouts.map((payout) => payout.amount));
    return {
        schools: schools.length,
        activeSchools: schools.filter((school) => school.status === 'ACTIVE').length,
        totalCommissions,
        totalPayouts,
        balance: roundMoney(totalCommissions - totalPayouts),
    };
};

type StoredPackRate = { packId: string; period: string; rate: number };
type PackLabels = Map<string, { name: string; code: string }>;

// Exceptions store only the pack id; names are looked up so a renamed pack shows its current name.
// The code disambiguates packs that share a name across institution types (e.g. "Pro").
const packLabels = async (lists: StoredPackRate[][]): Promise<PackLabels> => {
    const ids = [...new Set(lists.flat().map((rate) => rate.packId))];
    if (ids.length === 0) return new Map();
    const packs = await prisma.pack.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, code: true } });
    return new Map(packs.map((pack) => [pack.id, { name: pack.name, code: pack.code }]));
};

const withPackNames = <T extends StoredPackRate>(rates: T[], labels: PackLabels) =>
    rates.map((rate) => ({
        ...rate,
        packName: labels.get(rate.packId)?.name ?? null,
        packCode: labels.get(rate.packId)?.code ?? null,
    }));

const assertPacksExist = async (rates: PackRateData[]) => {
    const ids = [...new Set(rates.map((rate) => rate.packId))];
    if (ids.length === 0) return;
    const found = await prisma.pack.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new Error('Pack not found');
};

const earnsCommission = (data: AgentUpdateData): boolean =>
    [data.monthlyRate, data.semiannualRate, data.yearlyRate].some((rate) => rate !== undefined && rate !== 0) ||
    (data.packRates?.length ?? 0) > 0;

export const listAgents = async () => {
    const agents = await prisma.salesAgent.findMany({
        orderBy: [{ isHouse: 'desc' }, { createdAt: 'asc' }],
        include: {
            user: { select: { email: true } },
            schools: { select: { status: true } },
            payments: { select: { commissionAmount: true } },
            payouts: { select: { amount: true } },
        },
    });
    const labels = await packLabels(agents.map((agent) => agent.packRates));

    return agents.map(({ user, schools, payments, payouts, packRates, userId: _userId, ...agent }) => ({
        ...agent,
        packRates: withPackNames(packRates, labels),
        email: user?.email ?? null,
        totals: buildTotals(schools, payments, payouts),
    }));
};

export const createAgent = async (input: Record<string, unknown>) => {
    const data = sanitizeNewAgent(input);

    if (await prisma.salesAgent.findUnique({ where: { code: data.code } })) throw new Error('This code is already used');
    if (await prisma.user.findUnique({ where: { email: data.email } })) throw new Error('Email already exists');
    await assertPacksExist(data.packRates);

    const password = await hashPassword(data.password);

    try {
        const { userId: _userId, ...created } = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: { email: data.email, password, name: data.name, role: 'SALES_AGENT', gsm: data.phone },
            });
            return tx.salesAgent.create({
                data: {
                    name: data.name,
                    phone: data.phone,
                    code: data.code,
                    monthlyRate: data.monthlyRate,
                    semiannualRate: data.semiannualRate,
                    yearlyRate: data.yearlyRate,
                    packRates: data.packRates,
                    userId: user.id,
                },
            });
        });
        return created;
    } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') throw new Error('Email or code already exists');
        throw error;
    }
};

// New rates only apply to payments recorded afterwards: past payments keep their frozen rate.
export const updateAgent = async (id: string, input: Record<string, unknown>) => {
    assertId('Sales agent id', id);
    const data = sanitizeAgentUpdate(input);

    const existing = await prisma.salesAgent.findUnique({ where: { id } });
    if (!existing) throw new Error('Sales agent not found');
    if (existing.isHouse && data.active === false) throw new Error('The company code cannot be deactivated');
    if (existing.isHouse && earnsCommission(data)) throw new Error('The company code earns no commission');
    if (data.packRates) await assertPacksExist(data.packRates);

    // packRates replaces the whole list when sent.
    const { packRates, ...fields } = data;
    const agentData = { ...fields, ...(packRates !== undefined && { packRates: { set: packRates } }) };

    // The login account shows the agent's name (e.g. in the /agent header), so keep it in sync.
    const userData = {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { gsm: data.phone }),
    };
    const userId = existing.userId;

    const { userId: _userId, ...updated } =
        userId && Object.keys(userData).length > 0
            ? await prisma.$transaction(async (tx) => {
                  const agent = await tx.salesAgent.update({ where: { id }, data: agentData });
                  await tx.user.update({ where: { id: userId }, data: userData });
                  return agent;
              })
            : await prisma.salesAgent.update({ where: { id }, data: agentData });
    return updated;
};

const NO_ALLOCATION: Allocation = { payoutStatus: 'NONE', paidAmount: 0 };

const reportFor = async (where: Prisma.SalesAgentWhereUniqueInput) => {
    const agent = await prisma.salesAgent.findUnique({
        where,
        include: {
            user: { select: { email: true } },
            schools: {
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    city: true,
                    institutionType: true,
                    status: true,
                    createdAt: true,
                    ownerName: true,
                    ownerPhone: true,
                    pack: { select: { name: true } },
                },
            },
            // Payments credited to this agent (frozen on the payment), not payments of its current schools.
            payments: {
                orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
                select: {
                    id: true,
                    schoolId: true,
                    paidAt: true,
                    createdAt: true,
                    amount: true,
                    period: true,
                    packName: true,
                    commissionRate: true,
                    commissionAmount: true,
                    school: { select: { name: true } },
                },
            },
            payouts: { orderBy: { paidAt: 'desc' }, select: { id: true, paidAt: true, amount: true, note: true } },
        },
    });
    if (!agent) throw new Error('Sales agent not found');

    const labels = await packLabels([agent.packRates]);
    const totals = buildTotals(agent.schools, agent.payments, agent.payouts);
    const allocation = allocatePayouts(agent.payments, totals.totalPayouts);
    const schools = agent.schools.map(({ pack, ...school }) => {
        // Only payments credited to this agent count.
        const credited = agent.payments.filter((payment) => payment.schoolId === school.id);
        return {
            ...school,
            packName: pack?.name ?? null,
            clientStatus: clientStatus(school.status, credited.length),
            totalPaid: sum(credited.map((payment) => payment.amount)),
        };
    });

    return {
        agent: {
            id: agent.id,
            name: agent.name,
            phone: agent.phone,
            code: agent.code,
            monthlyRate: agent.monthlyRate,
            semiannualRate: agent.semiannualRate,
            yearlyRate: agent.yearlyRate,
            packRates: withPackNames(agent.packRates, labels),
            isHouse: agent.isHouse,
            active: agent.active,
            email: agent.user?.email ?? null,
            referralPath: `/signup?ref=${agent.code}`,
        },
        totals: { ...totals, statusCounts: countStatuses(schools.map((school) => school.clientStatus)) },
        schools,
        commissions: agent.payments.map(({ school, schoolId: _schoolId, createdAt: _createdAt, ...payment }) => ({
            ...payment,
            schoolName: school.name,
            ...(allocation.get(payment.id) ?? NO_ALLOCATION),
        })),
        payouts: agent.payouts,
    };
};

export const getAgentReport = (id: string) => {
    assertId('Sales agent id', id);
    return reportFor({ id });
};

export const getAgentReportForUser = (userId: string) => {
    assertId('User id', userId);
    return reportFor({ userId });
};

export const recordPayout = async (agentId: string, input: Record<string, unknown>) => {
    assertId('Sales agent id', agentId);
    const data = sanitizePayout(input);
    const agent = await prisma.salesAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Sales agent not found');
    return prisma.agentPayout.create({ data: { ...data, salesAgentId: agentId } });
};

export const deletePayout = async (agentId: string, payoutId: string) => {
    assertId('Sales agent id', agentId);
    assertId('Payout id', payoutId);
    const payout = await prisma.agentPayout.findFirst({ where: { id: payoutId, salesAgentId: agentId } });
    if (!payout) throw new Error('Payout not found');
    await prisma.agentPayout.delete({ where: { id: payoutId } });
    return { id: payoutId };
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/modules/sales-agents/salesAgents.service.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Full backend verification**

Run: `npx jest`
Expected: 41 suites pass (39 before + `salesAgents.migration.test.ts` + `salesAgents.statuses.test.ts`), 0 failures.

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 6: Smoke-check the API**

`npm run dev` restarts on its own after the edits (`touch src/server.ts` if not). Then:
```bash
API=http://localhost:3010/api
SA=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"<SUPER_ADMIN_EMAIL>","password":"<SUPER_ADMIN_PASSWORD>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')
curl -s $API/sales-agents/6af446306e41f58dd018b986 -H "Authorization: Bearer $SA" | node -pe 'const r = JSON.parse(require("fs").readFileSync(0)); JSON.stringify({ rates: [r.data.agent.monthlyRate, r.data.agent.semiannualRate, r.data.agent.yearlyRate], counts: r.data.totals.statusCounts, first: r.data.commissions[0] })'
```
Expected: `rates` `[25,25,25]`, `counts` `{"PENDING":0,"ACTIVE_UNPAID":0,"CONFIRMED":4,"CANCELLED":0}`, and the first commission carries `"packName":null,"payoutStatus":"DUE","paidAmount":0` (v1 payment, no payout yet).

- [ ] **Step 7: Commit**

```bash
git add src/modules/sales-agents/salesAgents.service.ts src/modules/sales-agents/salesAgents.service.test.ts
git commit -m "feat(education): per-period rates and pack exceptions on agents, client and payout statuses in reports

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Frontend API client, labels and status badges

**Files:**
- Modify: `apps/education-apps/frontend/lib/services/salesAgents.ts`
- Create: `apps/education-apps/frontend/lib/salesAgentLabels.ts`
- Create: `apps/education-apps/frontend/components/agent/StatusBadge.tsx`

- [ ] **Step 1: Update the API client**

Replace `frontend/lib/services/salesAgents.ts` with:

```ts
import api from '../api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '../institutionTypes';
import type { SchoolStatus } from './schools';

export type SubscriptionPeriod = 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';
export type ClientStatus = 'PENDING' | 'ACTIVE_UNPAID' | 'CONFIRMED' | 'CANCELLED';
export type PayoutStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'NONE';
export type StatusCounts = Record<ClientStatus, number>;

export interface PackRateInput {
    packId: string;
    period: SubscriptionPeriod;
    rate: number;
}

// As returned by the API: the pack's current name and code are looked up (null if the pack is gone).
export interface PackRate extends PackRateInput {
    packName: string | null;
    packCode: string | null;
}

export interface AgentRates {
    monthlyRate: number;
    semiannualRate: number;
    yearlyRate: number;
    packRates: PackRate[];
}

export interface AgentTotals {
    schools: number;
    activeSchools: number;
    totalCommissions: number;
    totalPayouts: number;
    balance: number;
}

export interface SalesAgentListItem extends AgentRates {
    id: string;
    name: string;
    phone: string | null;
    code: string;
    isHouse: boolean;
    active: boolean;
    email: string | null;
    totals: AgentTotals;
}

export interface AgentReport {
    agent: AgentRates & {
        id: string;
        name: string;
        phone: string | null;
        code: string;
        isHouse: boolean;
        active: boolean;
        email: string | null;
        referralPath: string;
    };
    totals: AgentTotals & { statusCounts: StatusCounts };
    schools: {
        id: string;
        name: string;
        city: string | null;
        institutionType: InstitutionType | null;
        status: SchoolStatus;
        clientStatus: ClientStatus;
        createdAt: string;
        ownerName: string;
        ownerPhone: string | null;
        packName: string | null;
        totalPaid: number;
    }[];
    commissions: {
        id: string;
        paidAt: string;
        amount: number;
        period: SubscriptionPeriod;
        packName: string | null;
        commissionRate: number;
        commissionAmount: number;
        schoolName: string;
        payoutStatus: PayoutStatus;
        paidAmount: number;
    }[];
    payouts: { id: string; paidAt: string; amount: number; note: string | null }[];
}

export interface BaseRatesInput {
    monthlyRate: number;
    semiannualRate: number;
    yearlyRate: number;
    packRates: PackRateInput[];
}

export interface NewAgentInput extends BaseRatesInput {
    name: string;
    email: string;
    password: string;
    phone?: string;
    code: string;
}

export interface AgentUpdateInput extends Partial<BaseRatesInput> {
    name?: string;
    phone?: string;
    active?: boolean;
}

export interface SchoolPaymentItem {
    id: string;
    amount: number;
    period: SubscriptionPeriod;
    paidAt: string;
    note: string | null;
    packName: string | null; // null on payments recorded before v2
    commissionRate: number;
    commissionAmount: number;
    salesAgent: { id: string; name: string; code: string } | null;
}

export interface MoneyInput {
    amount: number;
    paidAt: string; // yyyy-mm-dd
    note?: string;
}

export const formatMAD = (value: number): string =>
    `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

export const formatDate = (value: string): string => new Date(value).toLocaleDateString('fr-FR');

// For date-only values (e.g. paidAt stored at UTC midnight).
export const formatDay = (value: string): string => new Date(value).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

// Local calendar date as YYYY-MM-DD.
export const todayLocal = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const referralUrl = (referralPath: string): string =>
    typeof window === 'undefined' ? referralPath : `${window.location.origin}${referralPath}`;

export async function checkReferralCode(code: string): Promise<boolean> {
    const response = await api.get<ApiResponse<{ valid: boolean }>>(`/sales-agents/check/${encodeURIComponent(code)}`);
    return response.data.data.valid;
}

export async function getSalesAgents(): Promise<SalesAgentListItem[]> {
    const response = await api.get<ApiResponse<SalesAgentListItem[]>>('/sales-agents');
    return response.data.data;
}

export async function createSalesAgent(data: NewAgentInput): Promise<void> {
    await api.post('/sales-agents', data);
}

export async function updateSalesAgent(id: string, data: AgentUpdateInput): Promise<void> {
    await api.patch(`/sales-agents/${id}`, data);
}

export async function getSalesAgentReport(id: string): Promise<AgentReport> {
    const response = await api.get<ApiResponse<AgentReport>>(`/sales-agents/${id}`);
    return response.data.data;
}

export async function recordAgentPayout(id: string, data: MoneyInput): Promise<void> {
    await api.post(`/sales-agents/${id}/payouts`, data);
}

export async function deleteAgentPayout(id: string, payoutId: string): Promise<void> {
    await api.delete(`/sales-agents/${id}/payouts/${payoutId}`);
}

export async function getMyAgentReport(): Promise<AgentReport> {
    const response = await api.get<ApiResponse<AgentReport>>('/agent/me');
    return response.data.data;
}

export async function assignSchoolAgent(schoolId: string, salesAgentId: string | null): Promise<void> {
    await api.patch(`/schools/${schoolId}/sales-agent`, { salesAgentId });
}

export async function getSchoolPayments(schoolId: string): Promise<SchoolPaymentItem[]> {
    const response = await api.get<ApiResponse<SchoolPaymentItem[]>>(`/schools/${schoolId}/payments`);
    return response.data.data;
}

export async function recordSchoolPayment(
    schoolId: string,
    data: MoneyInput & { period: SubscriptionPeriod }
): Promise<void> {
    await api.post(`/schools/${schoolId}/payments`, data);
}

export async function deleteSchoolPayment(schoolId: string, paymentId: string): Promise<void> {
    await api.delete(`/schools/${schoolId}/payments/${paymentId}`);
}
```

- [ ] **Step 2: Shared labels**

Create `frontend/lib/salesAgentLabels.ts`:

```ts
import type { AgentRates, ClientStatus, PackRate, PayoutStatus, SubscriptionPeriod } from './services/salesAgents';

export const PERIODS: SubscriptionPeriod[] = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'];

export const PERIOD_LABELS: Record<SubscriptionPeriod, string> = {
    MONTHLY: 'Mensuel',
    SEMIANNUAL: 'Semestriel',
    YEARLY: 'Annuel',
};

export const BASE_RATE_FIELDS: { key: 'monthlyRate' | 'semiannualRate' | 'yearlyRate'; period: SubscriptionPeriod; short: string }[] = [
    { key: 'monthlyRate', period: 'MONTHLY', short: 'M' },
    { key: 'semiannualRate', period: 'SEMIANNUAL', short: 'S' },
    { key: 'yearlyRate', period: 'YEARLY', short: 'A' },
];

// "M 10 % · S 15 % · A 25 %"
export const formatRates = (rates: Pick<AgentRates, 'monthlyRate' | 'semiannualRate' | 'yearlyRate'>): string =>
    BASE_RATE_FIELDS.map((field) => `${field.short} ${rates[field.key]} %`).join(' · ');

// Several packs share a name across institution types ("Pro"), so the code is shown too.
export const packLabel = (rate: Pick<PackRate, 'packName' | 'packCode'>): string =>
    rate.packName ? (rate.packCode ? `${rate.packName} (${rate.packCode})` : rate.packName) : 'Pack supprimé';

export interface StatusMeta {
    icon: string;
    label: string;
    short: string;
    description: string;
    className: string;
}

export const CLIENT_STATUS_ORDER: ClientStatus[] = ['CONFIRMED', 'ACTIVE_UNPAID', 'PENDING', 'CANCELLED'];

export const CLIENT_STATUS_META: Record<ClientStatus, StatusMeta> = {
    PENDING: {
        icon: '🕒',
        label: "En attente d'activation",
        short: "en attente d'activation",
        description: "L'école s'est inscrite, son compte n'est pas encore activé.",
        className: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    ACTIVE_UNPAID: {
        icon: '🔵',
        label: 'Activée, en attente de paiement',
        short: 'en attente de paiement',
        description: "Compte activé, aucun paiement crédité pour l'instant.",
        className: 'bg-blue-50 text-blue-800 border-blue-200',
    },
    CONFIRMED: {
        icon: '✅',
        label: 'Confirmée',
        short: 'confirmées',
        description: 'Compte activé et au moins un paiement crédité.',
        className: 'bg-green-50 text-green-800 border-green-200',
    },
    CANCELLED: {
        icon: '❌',
        label: 'Annulée',
        short: 'annulées',
        description: 'Compte suspendu. Les commissions déjà gagnées restent dues.',
        className: 'bg-red-50 text-red-800 border-red-200',
    },
};

export const PAYOUT_STATUS_ORDER: PayoutStatus[] = ['PAID', 'PARTIAL', 'DUE', 'NONE'];

export const PAYOUT_STATUS_META: Record<PayoutStatus, StatusMeta> = {
    PAID: {
        icon: '💰',
        label: 'Payée',
        short: 'payées',
        description: 'Entièrement couverte par les versements reçus.',
        className: 'bg-green-50 text-green-800 border-green-200',
    },
    PARTIAL: {
        icon: '🟡',
        label: 'Partiellement payée',
        short: 'partielles',
        description: 'Couverte en partie ; le reste sera réglé par les prochains versements.',
        className: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    },
    DUE: {
        icon: '⏳',
        label: 'À payer',
        short: 'à payer',
        description: 'Pas encore couverte par un versement.',
        className: 'bg-orange-50 text-orange-800 border-orange-200',
    },
    NONE: {
        icon: '—',
        label: 'Sans commission',
        short: 'sans commission',
        description: 'Paiement à 0 % : rien à verser.',
        className: 'bg-gray-50 text-gray-600 border-gray-200',
    },
};
```

- [ ] **Step 3: Status badge and legend components**

Create `frontend/components/agent/StatusBadge.tsx`:

```tsx
import {
    CLIENT_STATUS_META,
    CLIENT_STATUS_ORDER,
    PAYOUT_STATUS_META,
    PAYOUT_STATUS_ORDER,
    type StatusMeta,
} from '@/lib/salesAgentLabels';
import type { ClientStatus, PayoutStatus } from '@/lib/services/salesAgents';

export function StatusBadge({ meta }: { meta: StatusMeta }) {
    return (
        <span
            title={meta.description}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${meta.className}`}
        >
            <span aria-hidden="true">{meta.icon}</span>
            {meta.label}
        </span>
    );
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
    return <StatusBadge meta={CLIENT_STATUS_META[status]} />;
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
    return <StatusBadge meta={PAYOUT_STATUS_META[status]} />;
}

// Explains every icon of one status kind; shown under the matching table.
export function StatusLegend({ kind }: { kind: 'client' | 'payout' }) {
    const entries =
        kind === 'client'
            ? CLIENT_STATUS_ORDER.map((status) => CLIENT_STATUS_META[status])
            : PAYOUT_STATUS_ORDER.map((status) => PAYOUT_STATUS_META[status]);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-xs text-gray-600 space-y-2">
            <div className="font-semibold text-gray-700">Légende</div>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {entries.map((meta) => (
                    <li key={meta.label}>
                        <span aria-hidden="true" className="mr-1">
                            {meta.icon}
                        </span>
                        <b>{meta.label}</b> — {meta.description}
                    </li>
                ))}
            </ul>
            {kind === 'payout' && (
                <p>Les versements reçus sont imputés aux commissions les plus anciennes en premier.</p>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Type-check**

Run (from `frontend`): `npx tsc --noEmit 2>&1 | grep 'error TS' | grep -v '^.next/types/app/secretary/'`
Expected: errors **only** in `app/admin/sales-agents/page.tsx`, `app/admin/sales-agents/[id]/page.tsx` and `components/agent/AgentReportView.tsx`, all about `commissionRate` / the missing `monthlyRate`, `semiannualRate`, `yearlyRate`, `packRates` (fixed in Tasks 10–12). No error in the three files of this task.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/services/salesAgents.ts frontend/lib/salesAgentLabels.ts frontend/components/agent/StatusBadge.tsx
git commit -m "feat(education): frontend types, labels and status badges for agent rates and statuses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Run from `apps/education-apps`.)

---

### Task 8: Pack exceptions editor and rate fields

**Files:**
- Create: `apps/education-apps/frontend/components/admin/PackRatesEditor.tsx`
- Create: `apps/education-apps/frontend/components/admin/AgentRatesFields.tsx`

- [ ] **Step 1: Pack exceptions editor**

Create `frontend/components/admin/PackRatesEditor.tsx`:

```tsx
'use client';

import { Plus, Trash2 } from 'lucide-react';
import { INSTITUTION_TYPE_LABELS } from '@/lib/institutionTypes';
import { PERIODS, PERIOD_LABELS } from '@/lib/salesAgentLabels';
import type { AdminPack } from '@/lib/services/packs';
import type { PackRateInput, SubscriptionPeriod } from '@/lib/services/salesAgents';

// Form row: the rate stays a string while typing.
export interface PackRateRow {
    packId: string;
    period: SubscriptionPeriod;
    rate: string;
}

export const toPackRateRows = (rates: PackRateInput[]): PackRateRow[] =>
    rates.map((rate) => ({ packId: rate.packId, period: rate.period, rate: String(rate.rate) }));

export const toPackRates = (rows: PackRateRow[]): PackRateInput[] =>
    rows.map((row) => ({ packId: row.packId, period: row.period, rate: Number(row.rate) }));

interface Props {
    packs: AdminPack[];
    rows: PackRateRow[];
    onChange: (rows: PackRateRow[]) => void;
    disabled?: boolean;
}

// Pack names repeat across institution types ("Pro"), so the option names the types too.
const packOptionLabel = (pack: AdminPack): string =>
    `${pack.name} — ${pack.institutionTypes.map((type) => INSTITUTION_TYPE_LABELS[type]).join(', ')}${pack.active ? '' : ' (inactif)'}`;

export default function PackRatesEditor({ packs, rows, onChange, disabled }: Props) {
    const update = (index: number, patch: Partial<PackRateRow>) =>
        onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
    const add = () => onChange([...rows, { packId: '', period: 'YEARLY', rate: '' }]);
    const isDuplicate = (index: number) =>
        rows.some(
            (other, i) => i !== index && other.packId !== '' && other.packId === rows[index].packId && other.period === rows[index].period
        );

    const inputClass = 'px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50';

    return (
        <div className="space-y-2">
            <div className="text-sm text-gray-600">
                Exceptions par pack{' '}
                <span className="text-xs text-gray-400">(remplacent le taux de base pour ce pack et cette période)</span>
            </div>
            {rows.length === 0 && <p className="text-xs text-gray-400">Aucune exception.</p>}
            {rows.map((row, index) => (
                <div key={index} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            className={`${inputClass} flex-1 min-w-[12rem]`}
                            aria-label="Pack"
                            value={row.packId}
                            onChange={(e) => update(index, { packId: e.target.value })}
                            disabled={disabled}
                            required
                        >
                            <option value="">Choisir un pack…</option>
                            {packs.map((pack) => (
                                <option key={pack.id} value={pack.id}>
                                    {packOptionLabel(pack)}
                                </option>
                            ))}
                        </select>
                        <select
                            className={`${inputClass} w-32`}
                            aria-label="Période"
                            value={row.period}
                            onChange={(e) => update(index, { period: e.target.value as SubscriptionPeriod })}
                            disabled={disabled}
                        >
                            {PERIODS.map((period) => (
                                <option key={period} value={period}>
                                    {PERIOD_LABELS[period]}
                                </option>
                            ))}
                        </select>
                        <input
                            className={`${inputClass} w-24`}
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            aria-label="Taux (%)"
                            placeholder="%"
                            value={row.rate}
                            onChange={(e) => update(index, { rate: e.target.value })}
                            disabled={disabled}
                            required
                        />
                        {!disabled && (
                            <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-2 text-red-600 hover:text-red-800"
                                aria-label="Supprimer l'exception"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                    {isDuplicate(index) && <p className="text-xs text-red-600">Ce pack a déjà un taux pour cette période.</p>}
                </div>
            ))}
            {!disabled && (
                <button type="button" onClick={add} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
                    <Plus size={14} /> Ajouter une exception
                </button>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Rate fields (three base rates + exceptions)**

Create `frontend/components/admin/AgentRatesFields.tsx`:

```tsx
'use client';

import PackRatesEditor, { toPackRateRows, toPackRates, type PackRateRow } from './PackRatesEditor';
import { BASE_RATE_FIELDS, PERIOD_LABELS } from '@/lib/salesAgentLabels';
import type { AdminPack } from '@/lib/services/packs';
import type { AgentRates, BaseRatesInput } from '@/lib/services/salesAgents';

export interface RatesForm {
    monthlyRate: string;
    semiannualRate: string;
    yearlyRate: string;
    packRates: PackRateRow[];
}

export const emptyRatesForm: RatesForm = { monthlyRate: '10', semiannualRate: '10', yearlyRate: '10', packRates: [] };

export const ratesFormFrom = (rates: AgentRates): RatesForm => ({
    monthlyRate: String(rates.monthlyRate),
    semiannualRate: String(rates.semiannualRate),
    yearlyRate: String(rates.yearlyRate),
    packRates: toPackRateRows(rates.packRates),
});

export const ratesPayload = (form: RatesForm): BaseRatesInput => ({
    monthlyRate: Number(form.monthlyRate),
    semiannualRate: Number(form.semiannualRate),
    yearlyRate: Number(form.yearlyRate),
    packRates: toPackRates(form.packRates),
});

interface Props {
    value: RatesForm;
    onChange: (value: RatesForm) => void;
    packs: AdminPack[];
    disabled?: boolean;
}

export default function AgentRatesFields({ value, onChange, packs, disabled }: Props) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                {BASE_RATE_FIELDS.map((field) => (
                    <label key={field.key} className="block text-sm text-gray-600">
                        {PERIOD_LABELS[field.period]} (%)
                        <input
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg disabled:bg-gray-50"
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            value={value[field.key]}
                            onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
                            disabled={disabled}
                            required
                        />
                    </label>
                ))}
            </div>
            <PackRatesEditor
                packs={packs}
                rows={value.packRates}
                onChange={(packRates) => onChange({ ...value, packRates })}
                disabled={disabled}
            />
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

Run (from `frontend`): `npx tsc --noEmit 2>&1 | grep 'error TS' | grep -v '^.next/types/app/secretary/'`
Expected: same errors as after Task 7 (only the three files that still use `commissionRate`); none in `PackRatesEditor.tsx` or `AgentRatesFields.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/admin/PackRatesEditor.tsx frontend/components/admin/AgentRatesFields.tsx
git commit -m "feat(education): pack exceptions editor and per-period rate fields for agents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Payments modal — Semestriel and pack column

**Files:**
- Modify: `apps/education-apps/frontend/components/admin/SchoolPaymentsModal.tsx`

- [ ] **Step 1: Edit the modal**

Add after the `} from '@/lib/services/salesAgents';` import line:

```tsx
import { PERIODS, PERIOD_LABELS } from '@/lib/salesAgentLabels';
```

Replace

```tsx
                        <option value="MONTHLY">Mensuel</option>
                        <option value="YEARLY">Annuel</option>
```

with

```tsx
                        {PERIODS.map((period) => (
                            <option key={period} value={period}>
                                {PERIOD_LABELS[period]}
                            </option>
                        ))}
```

Replace

```tsx
                            <th className="px-3 py-2">Montant</th>
                            <th className="px-3 py-2">Commercial</th>
```

with

```tsx
                            <th className="px-3 py-2">Montant</th>
                            <th className="px-3 py-2">Pack</th>
                            <th className="px-3 py-2">Commercial</th>
```

Replace

```tsx
                                    {formatMAD(p.amount)} <span className="text-xs text-gray-500">({p.period === 'YEARLY' ? 'annuel' : 'mensuel'})</span>
                                </td>
```

with

```tsx
                                    {formatMAD(p.amount)} <span className="text-xs text-gray-500">({PERIOD_LABELS[p.period].toLowerCase()})</span>
                                </td>
                                <td className="px-3 py-2">{p.packName ?? '—'}</td>
```

Replace

```tsx
                            <tr><td colSpan={5} className="px-3 py-4 text-gray-500">{loading ? 'Chargement…' : 'Aucun paiement enregistré.'}</td></tr>
```

with

```tsx
                            <tr><td colSpan={6} className="px-3 py-4 text-gray-500">{loading ? 'Chargement…' : 'Aucun paiement enregistré.'}</td></tr>
```

- [ ] **Step 2: Type-check**

Run (from `frontend`): `npx tsc --noEmit 2>&1 | grep 'error TS' | grep -v '^.next/types/app/secretary/'`
Expected: no error in `SchoolPaymentsModal.tsx` (the three `commissionRate` files remain).

- [ ] **Step 3: Commit**

```bash
git add frontend/components/admin/SchoolPaymentsModal.tsx
git commit -m "feat(education): semi-annual period and pack column in the school payments modal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Agents list — total owed, rates, coloured balance, create with rates

**Files:**
- Modify: `apps/education-apps/frontend/app/admin/sales-agents/page.tsx`

- [ ] **Step 1: Replace the page**

Replace `frontend/app/admin/sales-agents/page.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, Plus, Wallet } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import AgentRatesFields, { emptyRatesForm, ratesPayload, type RatesForm } from '@/components/admin/AgentRatesFields';
import { apiErrorMessage, getAllPacks, type AdminPack } from '@/lib/services/packs';
import { formatRates } from '@/lib/salesAgentLabels';
import { createSalesAgent, formatMAD, getSalesAgents, type SalesAgentListItem } from '@/lib/services/salesAgents';

const emptyForm = { name: '', email: '', password: '', phone: '', code: '' };

// Green when settled, orange while the company owes the agent, red when it paid more than earned.
const balanceClass = (balance: number): string =>
    balance === 0 ? 'text-green-700' : balance > 0 ? 'text-orange-600' : 'text-red-600';

export default function SalesAgentsPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [agents, setAgents] = useState<SalesAgentListItem[]>([]);
    const [packs, setPacks] = useState<AdminPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [rates, setRates] = useState<RatesForm>(emptyRatesForm);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [allAgents, allPacks] = await Promise.all([getSalesAgents(), getAllPacks()]);
            setAgents(allAgents);
            setPacks(allPacks);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') router.push('/admin');
        else if (user) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router]);

    const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [field]: field === 'code' ? e.target.value.toUpperCase() : e.target.value }));

    const openForm = () => {
        setForm(emptyForm);
        setRates(emptyRatesForm);
        setFormError('');
        setShowForm(true);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormError('');
        try {
            await createSalesAgent({
                name: form.name,
                email: form.email,
                password: form.password,
                phone: form.phone || undefined,
                code: form.code,
                ...ratesPayload(rates),
            });
            setShowForm(false);
            await load();
        } catch (err) {
            setFormError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (!user || user.role !== 'SUPER_ADMIN') return null;

    const owed = agents.filter((agent) => agent.totals.balance > 0);
    const totalOwed = owed.reduce((total, agent) => total + agent.totals.balance, 0);
    const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Commerciaux</h1>
                    <p className="text-gray-600 mt-1">Codes, écoles apportées et commissions</p>
                </div>
                <button
                    onClick={openForm}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                >
                    <Plus size={18} /> Nouveau commercial
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>}

            {!loading && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 flex items-center gap-4">
                    <Wallet className="text-orange-600 shrink-0" size={28} />
                    <div>
                        <div className="text-sm text-orange-800">Total dû aux commerciaux</div>
                        <div className="text-2xl font-bold text-orange-700">{formatMAD(totalOwed)}</div>
                        <div className="text-xs text-orange-800">
                            {owed.length === 0
                                ? 'Aucun commercial à payer'
                                : `${owed.length} commercia${owed.length > 1 ? 'ux' : 'l'} avec un solde à payer`}
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-x-auto">
                {loading ? (
                    <p className="p-8 text-gray-500">Chargement…</p>
                ) : agents.length === 0 ? (
                    <div className="p-8 text-gray-500 flex items-center gap-3">
                        <Briefcase size={20} /> Aucun commercial. Lancez le seed du code société (ARWA) puis ajoutez vos commerciaux.
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                            <tr>
                                <th className="px-6 py-4">Commercial</th>
                                <th className="px-6 py-4">Code</th>
                                <th className="px-6 py-4">Taux</th>
                                <th className="px-6 py-4">Écoles</th>
                                <th className="px-6 py-4">Commissions</th>
                                <th className="px-6 py-4">Versé</th>
                                <th className="px-6 py-4">Reste à payer</th>
                                <th className="px-6 py-4">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map((agent) => (
                                <tr key={agent.id} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <Link href={`/admin/sales-agents/${agent.id}`} className="font-semibold text-indigo-700 hover:underline">
                                            {agent.name}
                                        </Link>
                                        {agent.isHouse && (
                                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">Société</span>
                                        )}
                                        <div className="text-xs text-gray-500">{agent.email ?? '—'}</div>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold">{agent.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {formatRates(agent)}
                                        {agent.packRates.length > 0 && (
                                            <div className="text-xs text-indigo-700">
                                                +{agent.packRates.length} exception{agent.packRates.length > 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {agent.totals.activeSchools} / {agent.totals.schools}
                                        <div className="text-xs text-gray-500">actives / total</div>
                                    </td>
                                    <td className="px-6 py-4">{formatMAD(agent.totals.totalCommissions)}</td>
                                    <td className="px-6 py-4">{formatMAD(agent.totals.totalPayouts)}</td>
                                    <td className={`px-6 py-4 font-bold whitespace-nowrap ${balanceClass(agent.totals.balance)}`}>
                                        {formatMAD(agent.totals.balance)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                agent.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {agent.active ? 'Actif' : 'Inactif'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nouveau commercial" size="lg">
                <form onSubmit={submit} className="space-y-3">
                    {formError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{formError}</div>}
                    <input className={inputClass} aria-label="Nom complet" placeholder="Nom complet" value={form.name} onChange={set('name')} required />
                    <input className={inputClass} type="email" aria-label="Email (identifiant)" placeholder="Email (identifiant)" value={form.email} onChange={set('email')} required />
                    <input className={inputClass} type="password" aria-label="Mot de passe" placeholder="Mot de passe (8 caractères min.)" minLength={8} value={form.password} onChange={set('password')} required />
                    <input className={inputClass} aria-label="Téléphone" placeholder="Téléphone" value={form.phone} onChange={set('phone')} />
                    <input className={`${inputClass} font-mono`} aria-label="Code commercial" placeholder="Code (ex. YOUSSEF22)" pattern="[A-Z0-9\-]{3,20}" value={form.code} onChange={set('code')} required />
                    <div className="pt-2 border-t border-gray-100">
                        <div className="text-sm font-semibold text-gray-700 mb-2">Taux de commission</div>
                        <AgentRatesFields value={rates} onChange={setRates} packs={packs} />
                    </div>
                    <button disabled={saving} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50">
                        {saving ? 'Création…' : 'Créer'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run (from `frontend`): `npx tsc --noEmit 2>&1 | grep 'error TS' | grep -v '^.next/types/app/secretary/'`
Expected: no error in `app/admin/sales-agents/page.tsx` (only `[id]/page.tsx` and `AgentReportView.tsx` remain).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/sales-agents/page.tsx
git commit -m "feat(education): total owed, per-period rates and coloured balance on the agents list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Agent detail — edit rates and exceptions

**Files:**
- Modify: `apps/education-apps/frontend/app/admin/sales-agents/[id]/page.tsx`

- [ ] **Step 1: Replace the page**

Replace `frontend/app/admin/sales-agents/[id]/page.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import AgentReportView from '@/components/agent/AgentReportView';
import AgentRatesFields, { emptyRatesForm, ratesFormFrom, ratesPayload, type RatesForm } from '@/components/admin/AgentRatesFields';
import { apiErrorMessage, getAllPacks, type AdminPack } from '@/lib/services/packs';
import {
    deleteAgentPayout,
    todayLocal,
    getSalesAgentReport,
    recordAgentPayout,
    updateSalesAgent,
    type AgentReport,
} from '@/lib/services/salesAgents';

export default function SalesAgentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [report, setReport] = useState<AgentReport | null>(null);
    const [packs, setPacks] = useState<AdminPack[]>([]);
    const [error, setError] = useState('');
    const [edit, setEdit] = useState({ name: '', phone: '', active: true });
    const [rates, setRates] = useState<RatesForm>(emptyRatesForm);
    const [payout, setPayout] = useState({ amount: '', paidAt: todayLocal(), note: '' });
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setError('');
        try {
            const [data, allPacks] = await Promise.all([getSalesAgentReport(id), getAllPacks()]);
            setReport(data);
            setPacks(allPacks);
            setEdit({ name: data.agent.name, phone: data.agent.phone ?? '', active: data.agent.active });
            setRates(ratesFormFrom(data.agent));
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') router.push('/admin');
        else if (user) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router, id]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError('');
        try {
            await action();
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const saveAgent = (e: React.FormEvent) => {
        e.preventDefault();
        run(() =>
            updateSalesAgent(
                id,
                report?.agent.isHouse
                    ? { name: edit.name, phone: edit.phone }
                    : { name: edit.name, phone: edit.phone, active: edit.active, ...ratesPayload(rates) }
            )
        );
    };

    const addPayout = (e: React.FormEvent) => {
        e.preventDefault();
        run(async () => {
            await recordAgentPayout(id, { amount: Number(payout.amount), paidAt: payout.paidAt, note: payout.note || undefined });
            setPayout({ amount: '', paidAt: todayLocal(), note: '' });
        });
    };

    const removePayout = (payoutId: string) => {
        if (!window.confirm('Supprimer ce paiement ?')) return;
        run(() => deleteAgentPayout(id, payoutId));
    };

    if (!user || user.role !== 'SUPER_ADMIN') return null;

    const inputClass = 'px-3 py-2 border border-gray-200 rounded-lg';

    return (
        <div className="space-y-6">
            <Link href="/admin/sales-agents" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft size={16} /> Commerciaux
            </Link>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>}

            {!report && !error ? (
                <p className="text-gray-500">Chargement…</p>
            ) : !report ? null : (
                <>
                    <h1 className="text-3xl font-bold text-gray-800">
                        {report.agent.name}
                        {report.agent.isHouse && <span className="ml-3 align-middle px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">Société</span>}
                    </h1>

                    <div className="grid md:grid-cols-2 gap-4 items-start">
                        <form onSubmit={saveAgent} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                            <h2 className="font-bold text-gray-800">Fiche</h2>
                            <input className={`${inputClass} w-full`} aria-label="Nom" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
                            <input className={`${inputClass} w-full`} aria-label="Téléphone" placeholder="Téléphone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                            <div className="pt-2 border-t border-gray-100 space-y-2">
                                <div className="text-sm font-semibold text-gray-700">
                                    Taux de commission{' '}
                                    <span className="font-normal text-xs text-gray-500">— s&apos;appliquent aux prochains paiements</span>
                                </div>
                                <AgentRatesFields value={rates} onChange={setRates} packs={packs} disabled={report.agent.isHouse} />
                                {report.agent.isHouse && <p className="text-xs text-gray-500">Le code société ne touche pas de commission.</p>}
                            </div>
                            {!report.agent.isHouse && (
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
                                    Actif (un code inactif n&apos;est plus accepté à l&apos;inscription)
                                </label>
                            )}
                            <button disabled={busy} className="px-4 py-2 bg-gray-800 text-white rounded-lg font-semibold disabled:opacity-50">Enregistrer</button>
                        </form>

                        {!report.agent.isHouse && (
                            <form onSubmit={addPayout} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                                <h2 className="font-bold text-gray-800">Enregistrer un versement</h2>
                                <input className={`${inputClass} w-full`} type="number" min={0.01} step="0.01" aria-label="Montant du versement (MAD)" placeholder="Montant (MAD)" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} required />
                                <input className={`${inputClass} w-full`} type="date" aria-label="Date du versement" value={payout.paidAt} onChange={(e) => setPayout({ ...payout, paidAt: e.target.value })} required />
                                <input className={`${inputClass} w-full`} aria-label="Note" placeholder="Note (ex. virement CIH)" value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} />
                                <button disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50">Enregistrer le versement</button>
                            </form>
                        )}
                    </div>

                    <AgentReportView report={report} onDeletePayout={removePayout} busy={busy} />
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run (from `frontend`): `npx tsc --noEmit 2>&1 | grep 'error TS' | grep -v '^.next/types/app/secretary/'`
Expected: only `components/agent/AgentReportView.tsx` still errors (`commissionRate`).

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/admin/sales-agents/[id]/page.tsx"
git commit -m "feat(education): edit per-period rates and pack exceptions on the agent page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Report view — rates block, status chips, badges and legends

**Files:**
- Modify: `apps/education-apps/frontend/components/agent/AgentReportView.tsx`
- Modify: `apps/education-apps/frontend/app/agent/page.tsx`

- [ ] **Step 1: Replace the report view**

Replace `frontend/components/agent/AgentReportView.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import { INSTITUTION_TYPE_LABELS, DEFAULT_INSTITUTION_TYPE } from '@/lib/institutionTypes';
import {
    BASE_RATE_FIELDS,
    CLIENT_STATUS_META,
    CLIENT_STATUS_ORDER,
    PERIOD_LABELS,
    packLabel,
} from '@/lib/salesAgentLabels';
import { formatDate, formatDay, formatMAD, referralUrl, type AgentReport } from '@/lib/services/salesAgents';
import { ClientStatusBadge, PayoutStatusBadge, StatusLegend } from './StatusBadge';

type Tab = 'schools' | 'commissions' | 'payouts';

interface Props {
    report: AgentReport;
    onDeletePayout?: (payoutId: string) => void; // admin only
    busy?: boolean;
    ratesTitle?: string; // "Mes taux" in the agent space
}

export default function AgentReportView({ report, onDeletePayout, busy, ratesTitle = 'Taux' }: Props) {
    const [tab, setTab] = useState<Tab>('schools');
    const [copied, setCopied] = useState(false);
    const link = referralUrl(report.agent.referralPath);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard unavailable: the link stays visible to copy by hand
        }
    };

    const cards = [
        { label: 'Clients', value: String(report.totals.schools) },
        { label: 'Clients actifs', value: String(report.totals.activeSchools) },
        { label: 'Commissions', value: formatMAD(report.totals.totalCommissions) },
        { label: 'Déjà versé', value: formatMAD(report.totals.totalPayouts) },
        { label: 'Solde dû', value: formatMAD(report.totals.balance), strong: true },
    ];

    const tabs: { id: Tab; label: string }[] = [
        { id: 'schools', label: `Clients (${report.schools.length})` },
        { id: 'commissions', label: `Commissions (${report.commissions.length})` },
        { id: 'payouts', label: `Paiements reçus (${report.payouts.length})` },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-500">Lien commercial :</span>
                <code className="flex-1 min-w-0 truncate text-sm font-semibold text-indigo-700">{link}</code>
                <button onClick={copy} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold">
                    {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copié' : 'Copier'}
                </button>
                <span className="w-full text-xs text-gray-500">
                    Code : <b className="font-mono">{report.agent.code}</b>
                </span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <h2 className="font-bold text-gray-800">{ratesTitle}</h2>
                <div className="flex flex-wrap gap-2">
                    {BASE_RATE_FIELDS.map((field) => (
                        <span key={field.key} className="px-3 py-1 rounded-lg bg-gray-100 text-sm text-gray-700">
                            {PERIOD_LABELS[field.period]} : <b>{report.agent[field.key]} %</b>
                        </span>
                    ))}
                </div>
                {report.agent.packRates.length > 0 ? (
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Exceptions par pack</div>
                        <ul className="text-sm text-gray-700 space-y-0.5">
                            {report.agent.packRates.map((rate) => (
                                <li key={`${rate.packId}-${rate.period}`}>
                                    {packLabel(rate)} · {PERIOD_LABELS[rate.period]} : <b>{rate.rate} %</b>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">Pas d&apos;exception par pack.</p>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {cards.map((card) => (
                    <div
                        key={card.label}
                        className={`rounded-2xl border p-4 ${card.strong ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}
                    >
                        <div className="text-xs text-gray-500">{card.label}</div>
                        <div className={`mt-1 font-bold ${card.strong ? 'text-emerald-700 text-xl' : 'text-gray-800 text-lg'}`}>{card.value}</div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Statut des clients">
                {CLIENT_STATUS_ORDER.map((status) => {
                    const meta = CLIENT_STATUS_META[status];
                    return (
                        <span key={status} title={meta.label} className={`px-3 py-1 rounded-full border text-sm font-semibold ${meta.className}`}>
                            <span aria-hidden="true">{meta.icon}</span> {report.totals.statusCounts[status]} {meta.short}
                        </span>
                    );
                })}
            </div>

            <div className="flex gap-2 overflow-x-auto">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
                            tab === t.id ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
                {tab === 'schools' && (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">École</th>
                                <th className="px-4 py-3">Contact</th>
                                <th className="px-4 py-3">Type / Pack</th>
                                <th className="px-4 py-3">Statut</th>
                                <th className="px-4 py-3">Inscrite le</th>
                                <th className="px-4 py-3">Total payé</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.schools.map((school) => (
                                <tr key={school.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3 font-semibold">
                                        {school.name}
                                        <div className="text-xs text-gray-500">{school.city || '—'}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {school.ownerName}
                                        <div className="text-xs text-gray-500">{school.ownerPhone || '—'}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {INSTITUTION_TYPE_LABELS[school.institutionType ?? DEFAULT_INSTITUTION_TYPE]}
                                        <div className="text-xs text-gray-500">{school.packName ?? 'Aucun pack'}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <ClientStatusBadge status={school.clientStatus} />
                                    </td>
                                    <td className="px-4 py-3">{formatDate(school.createdAt)}</td>
                                    <td className="px-4 py-3">{formatMAD(school.totalPaid)}</td>
                                </tr>
                            ))}
                            {report.schools.length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-6 text-gray-500">Aucun client pour le moment.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}

                {tab === 'commissions' && (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">École</th>
                                <th className="px-4 py-3">Pack</th>
                                <th className="px-4 py-3">Paiement</th>
                                <th className="px-4 py-3">Taux</th>
                                <th className="px-4 py-3">Commission</th>
                                <th className="px-4 py-3">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.commissions.map((c) => (
                                <tr key={c.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3">{formatDay(c.paidAt)}</td>
                                    <td className="px-4 py-3 font-semibold">{c.schoolName}</td>
                                    <td className="px-4 py-3">{c.packName ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        {formatMAD(c.amount)} <span className="text-xs text-gray-500">({PERIOD_LABELS[c.period]})</span>
                                    </td>
                                    <td className="px-4 py-3">{c.commissionRate} %</td>
                                    <td className="px-4 py-3 font-bold">{formatMAD(c.commissionAmount)}</td>
                                    <td className="px-4 py-3">
                                        <PayoutStatusBadge status={c.payoutStatus} />
                                        {c.payoutStatus === 'PARTIAL' && (
                                            <div className="mt-1 text-xs text-gray-500">
                                                {formatMAD(c.paidAmount)} versé · reste {formatMAD(c.commissionAmount - c.paidAmount)}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {report.commissions.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-6 text-gray-500">Aucune commission pour le moment.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}

                {tab === 'payouts' && (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Montant</th>
                                <th className="px-4 py-3">Note</th>
                                {onDeletePayout && <th className="px-4 py-3" />}
                            </tr>
                        </thead>
                        <tbody>
                            {report.payouts.map((p) => (
                                <tr key={p.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3">{formatDay(p.paidAt)}</td>
                                    <td className="px-4 py-3 font-bold">{formatMAD(p.amount)}</td>
                                    <td className="px-4 py-3">{p.note || '—'}</td>
                                    {onDeletePayout && (
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => onDeletePayout(p.id)} disabled={busy} className="text-red-600 hover:text-red-800" aria-label="Supprimer">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {report.payouts.length === 0 && (
                                <tr><td colSpan={onDeletePayout ? 4 : 3} className="px-4 py-6 text-gray-500">Aucun paiement pour le moment.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {tab === 'schools' && <StatusLegend kind="client" />}
            {tab === 'commissions' && <StatusLegend kind="payout" />}
        </div>
    );
}
```

- [ ] **Step 2: "Mes taux" in the agent space**

In `frontend/app/agent/page.tsx`, replace

```tsx
            <AgentReportView report={report} />
```

with

```tsx
            <AgentReportView report={report} ratesTitle="Mes taux" />
```

- [ ] **Step 3: Type-check**

Run (from `frontend`): `npx tsc --noEmit 2>&1 | grep 'error TS' | grep -v '^.next/types/app/secretary/'`
Expected: no output (only the 4 pre-existing `.next/types/app/secretary/...` errors remain, filtered out).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/agent/AgentReportView.tsx frontend/app/agent/page.tsx
git commit -m "feat(education): rates, status chips, badges and legends in the agent report

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Manual QA

No code. Backend at `http://localhost:3010` (restarted with the final code: `touch src/server.ts` in `apps/education-apps`), frontend at `http://localhost:3011`. Use **only the API** (no direct DB writes). This QA adds payments, a payout and one school to the local DB on purpose; an optional cleanup is at the end.

- [ ] **Step 1: Session and ids**

```bash
API=http://localhost:3010/api
q() { node -pe "const r=JSON.parse(require('fs').readFileSync(0,'utf8')); $1"; }
SA=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"<SUPER_ADMIN_EMAIL>","password":"<SUPER_ADMIN_PASSWORD>"}' | q 'r.data.token')
AUTH="Authorization: Bearer $SA"
AGENT=6af446306e41f58dd018b986
CRECHE_PACK=6ab050b281878c35b0f00752
school() { curl -s $API/schools -H "$AUTH" | q "(r.data.find(s => s.ownerEmail === \"$1\") || {}).id"; }
CRECHE=$(school abd.creche@example.com); SOUTIEN=$(school abd.soutien@example.com); LANGUES=$(school abd.langues@example.com); PRIVE=$(school abd.prive@example.com)
echo $CRECHE $SOUTIEN $LANGUES $PRIVE
```
Expected: `6af447dd6e41f58dd018b987 6af447de6e41f58dd018b98a 6af447df6e41f58dd018b98d 6af447e06e41f58dd018b990`.

- [ ] **Step 2: The migration kept abdessamad's 25 %**

```bash
curl -s $API/sales-agents/$AGENT -H "$AUTH" | q 'JSON.stringify([r.data.agent.monthlyRate, r.data.agent.semiannualRate, r.data.agent.yearlyRate, r.data.agent.packRates, "commissionRate" in r.data.agent, r.data.totals.totalCommissions])'
```
Expected: `[25,25,25,[],false,2000]` (the four v1 payments of 2000 MAD yearly at 25 % are untouched).

- [ ] **Step 3: Validation and house rules through the API**

```bash
patch() { curl -s -X PATCH $API/sales-agents/$1 -H "$AUTH" -H 'Content-Type: application/json' -d "$2" | q 'r.error || r.message'; }
patch $AGENT '{"commissionRate":20}'
patch $AGENT "{\"packRates\":[{\"packId\":\"$CRECHE_PACK\",\"period\":\"YEARLY\",\"rate\":20},{\"packId\":\"$CRECHE_PACK\",\"period\":\"YEARLY\",\"rate\":22}]}"
patch $AGENT '{"packRates":[{"packId":"000000000000000000000000","period":"YEARLY","rate":20}]}'
patch $AGENT '{"monthlyRate":120}'
HOUSE=$(curl -s $API/sales-agents -H "$AUTH" | q 'r.data.find(a => a.isHouse).id')
patch $HOUSE '{"monthlyRate":5}'
patch $HOUSE "{\"packRates\":[{\"packId\":\"$CRECHE_PACK\",\"period\":\"MONTHLY\",\"rate\":0}]}"
```
Expected, in order:
```
commissionRate is no longer accepted: send monthlyRate, semiannualRate and yearlyRate
A pack can only have one rate per period
Pack not found
Monthly rate must be between 0 and 100
The company code earns no commission
The company code earns no commission
```

- [ ] **Step 4: Set M 10 / S 15 / A 25 with "Crèche annuel 20 %"**

```bash
patch $AGENT "{\"monthlyRate\":10,\"semiannualRate\":15,\"yearlyRate\":25,\"packRates\":[{\"packId\":\"$CRECHE_PACK\",\"period\":\"YEARLY\",\"rate\":20}]}"
curl -s $API/sales-agents/$AGENT -H "$AUTH" | q 'JSON.stringify([r.data.agent.monthlyRate, r.data.agent.semiannualRate, r.data.agent.yearlyRate, r.data.agent.packRates])'
```
Expected: `Sales agent updated`, then `[10,15,25,[{"packId":"6ab050b281878c35b0f00752","period":"YEARLY","rate":20,"packName":"Crèche","packCode":"creche"}]]`.

- [ ] **Step 5: Record payments of each period (in this order)**

```bash
pay() { curl -s -X POST $API/schools/$1/payments -H "$AUTH" -H 'Content-Type: application/json' -d "{\"amount\":$2,\"period\":\"$3\",\"paidAt\":\"2026-11-11\"}" | q 'JSON.stringify([r.data.period, r.data.packName, r.data.commissionRate, r.data.commissionAmount])'; }
pay $CRECHE 1500 YEARLY
pay $CRECHE 150 MONTHLY
pay $SOUTIEN 1500 SEMIANNUAL
pay $LANGUES 350 MONTHLY
pay $PRIVE 3500 YEARLY
```
Expected:
```
["YEARLY","Crèche",20,300]      <- pack exception
["MONTHLY","Crèche",10,15]      <- no monthly exception: base rate
["SEMIANNUAL","Pro",15,225]     <- new period
["MONTHLY","Pro",10,35]
["YEARLY","Pro",25,875]
```

- [ ] **Step 6: Record a partial payout and check FIFO**

```bash
curl -s -X POST $API/sales-agents/$AGENT/payouts -H "$AUTH" -H 'Content-Type: application/json' -d '{"amount":2400,"paidAt":"2026-11-11","note":"QA v2 partiel"}' | q 'r.message'
curl -s $API/sales-agents/$AGENT -H "$AUTH" | q 'JSON.stringify(r.data.totals) + "\n" + r.data.commissions.map(c => [c.schoolName, c.period, c.packName ?? "—", c.commissionRate, c.commissionAmount, c.payoutStatus, c.paidAmount].join(" | ")).join("\n")'
```
Expected: `Payout recorded`, then totals `{"schools":4,"activeSchools":4,"totalCommissions":3450,"totalPayouts":2400,"balance":1050,"statusCounts":{"PENDING":0,"ACTIVE_UNPAID":0,"CONFIRMED":4,"CANCELLED":0}}` and (newest first; the 2400 covers the 4 × 500 of v1, then 300 + 15, then 85 of the 225):
```
Test prive | YEARLY | Pro | 25 | 875 | DUE | 0
Test langues | MONTHLY | Pro | 10 | 35 | DUE | 0
Test soutien | SEMIANNUAL | Pro | 15 | 225 | PARTIAL | 85
Test creche | MONTHLY | Crèche | 10 | 15 | PAID | 15
Test creche | YEARLY | Crèche | 20 | 300 | PAID | 300
Test prive | YEARLY | — | 25 | 500 | PAID | 500
Test langues | YEARLY | — | 25 | 500 | PAID | 500
Test soutien | YEARLY | — | 25 | 500 | PAID | 500
Test creche | YEARLY | — | 25 | 500 | PAID | 500
```

- [ ] **Step 7: The four client statuses**

All four test schools are active and paid, so make one cancelled, one pending, and sign up a fifth school that is activated without paying:
```bash
status() { curl -s -X PATCH $API/schools/$1/status -H "$AUTH" -H 'Content-Type: application/json' -d "{\"status\":\"$2\"}" -o /dev/null -w "%{http_code}\n"; }
status $PRIVE SUSPENDED
status $LANGUES PENDING
curl -s -X POST $API/schools/signup -H 'Content-Type: application/json' \
  -d '{"schoolName":"Test v2 sans paiement","ownerName":"QA v2","ownerEmail":"abd.v2@example.com","password":"secret123","institutionType":"PRIVATE_SCHOOL","referralCode":"ABDESSAMADAITMLL"}' -o /dev/null -w "%{http_code}\n"
NEW=$(school abd.v2@example.com); status $NEW ACTIVE
curl -s $API/sales-agents/$AGENT -H "$AUTH" | q 'JSON.stringify(r.data.totals) + "\n" + r.data.schools.map(s => [s.name, s.status, s.clientStatus, s.totalPaid].join(" | ")).join("\n")'
```
Expected: `200`, `200`, `201` (a second run gives `400` "Email already exists": fine, the school exists), `200`; totals with `"schools":5`, `"totalCommissions":3450`, `"balance":1050` (the suspended school keeps its commissions) and `"statusCounts":{"PENDING":1,"ACTIVE_UNPAID":1,"CONFIRMED":2,"CANCELLED":1}`; schools:
```
Test v2 sans paiement | ACTIVE | ACTIVE_UNPAID | 0
Test prive | SUSPENDED | CANCELLED | 4000
Test langues | PENDING | PENDING | 2350
Test soutien | ACTIVE | CONFIRMED | 3500
Test creche | ACTIVE | CONFIRMED | 3650
```

- [ ] **Step 8: List totals and the agent space API**

```bash
curl -s $API/sales-agents -H "$AUTH" | q 'r.data.map(a => [a.code, a.monthlyRate, a.semiannualRate, a.yearlyRate, a.packRates.length, a.totals.balance].join(" | ")).join("\n")'
AG=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"qa.agent@example.com","password":"secret123"}' | q 'r.data.token')
curl -s $API/agent/me -H "Authorization: Bearer $AG" | q 'JSON.stringify([r.data.agent.monthlyRate, r.data.agent.semiannualRate, r.data.agent.yearlyRate, r.data.totals.statusCounts, r.data.commissions.map(c => [c.commissionAmount, c.payoutStatus, c.paidAmount])])'
curl -s -o /dev/null -w '%{http_code}\n' $API/sales-agents -H "Authorization: Bearer $AG"
```
Expected:
```
ARWA | 0 | 0 | 0 | 0 | 0
QA-01 | 20 | 20 | 20 | 0 | 22.5
ABDESSAMADAITMLL | 10 | 15 | 25 | 1 | 1050
```
then `[20,20,20,{"PENDING":0,"ACTIVE_UNPAID":0,"CONFIRMED":0,"CANCELLED":0},[[70,"PARTIAL",47.5],[52.5,"PAID",52.5]]]` (QA-01's school moved to ARWA in v1 QA; its 100 MAD payout covers the 2026-11-01 commission first), then `403`.

- [ ] **Step 9: Browser checks**

As super admin on `http://localhost:3011`:
1. `/admin/sales-agents`: the orange card shows **"Total dû aux commerciaux" 1 072,50 MAD** and "2 commerciaux avec un solde à payer". The rates column shows "M 10 % · S 15 % · A 25 %" + "+1 exception" for abdessamad, "M 20 % · S 20 % · A 20 %" for QA Agent. "Reste à payer": ARWA green (0), QA Agent and abdessamad orange.
2. "Nouveau commercial": three rate inputs (Mensuel / Semestriel / Annuel), "Ajouter une exception" adds a row (pack select names the institution types, period select includes Semestriel, rate), the trash icon removes a row, choosing the same pack + period twice shows "Ce pack a déjà un taux pour cette période." (close without saving).
3. `/admin/sales-agents/6af446306e41f58dd018b986`: the fiche shows 10 / 15 / 25 and the Crèche annual exception at 20. The "Taux" block lists the base rates and "Crèche (creche) · Annuel : 20 %". Status chips: "✅ 2 confirmées · 🔵 1 en attente de paiement · 🕒 1 en attente d'activation · ❌ 1 annulées". Clients tab: one badge per school (✅ / 🔵 / 🕒 / ❌) and the client legend below. Commissions tab: Pack column ("—" for v1 rows), period labels including "Semestriel", 💰 / 🟡 / ⏳ badges, "85,00 MAD versé · reste 140,00 MAD" under the semi-annual line, and the payout legend with the oldest-first sentence.
4. ARWA's page: rate inputs and exceptions are disabled, note "Le code société ne touche pas de commission.", no add/remove exception buttons.
5. `/admin/schools` → "Paiements" on "Test soutien": period select has Mensuel / Semestriel / Annuel; the list shows a Pack column ("Pro" for the new payment, "—" for the v1 one) and "(semestriel)".
6. `/agent` in a phone-sized window, logged in as `qa.agent@example.com` / `secret123`: "Mes taux" block (20 / 20 / 20, "Pas d'exception par pack."), chips all at 0, commissions with 💰 and 🟡 badges and the legend. If abdessamad's password is known (login `<AGENT_EMAIL>`), repeat with his account: same figures as step 3.

- [ ] **Step 10: Restore the test schools (optional cleanup)**

```bash
status $PRIVE ACTIVE
status $LANGUES ACTIVE
status $NEW SUSPENDED
```
Expected: `200` three times. Keep the QA payments and payout (they document the scenario), or delete them through `DELETE $API/schools/<schoolId>/payments/<paymentId>` and `DELETE $API/sales-agents/$AGENT/payouts/<payoutId>` (ids from the reports above).

- [ ] **Step 11: Report**

Write down any deviation, fix it with a test first if it is a backend bug, and commit fixes as `fix(education): ...` with the Co-Authored-By line.
