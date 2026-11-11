# Education Sales Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sales agents with referral codes that are mandatory at school signup, recorded school payments with frozen per-agent commissions, payouts, a SUPER_ADMIN management UI, and an `/agent` space where each agent sees their own clients and accounting.

**Architecture:** A new backend module `src/modules/sales-agents` (validation, agent service, school-payment service, controllers, routes) on top of three new Prisma models (`SalesAgent`, `SchoolPayment`, `AgentPayout`) and a new `SALES_AGENT` role. Signup calls `resolveReferralCode` before creating the school. The frontend adds a code field to `/signup`, forwards `?ref=` from the landing, adds SUPER_ADMIN pages under `/admin/sales-agents`, a payments modal on `/admin/schools`, and a standalone `/agent` space.

**Tech Stack:** Express + Prisma 5 (MongoDB) + Jest 30 / ts-jest (backend, `apps/education-apps`), Next.js 14 app router + Tailwind + lucide-react (frontend, `apps/education-apps/frontend`).

**Spec:** `docs/superpowers/specs/2026-11-11-education-sales-agents-design.md`

**Conventions to follow (read once):**
- Services throw `Error` with a plain message; controllers wrap them with `respond()` from `src/modules/transport/http.ts` (message ending in "not found" → 404, other errors → 400, Prisma errors → 500).
- Ids are checked with `assertId(label, value)` from `src/modules/transport/ids.ts`.
- Tests mock `../../config/database` with `jest.mock` and plain `jest.fn()`s (see `src/modules/packs/packs.service.test.ts`). This is Jest 30: `restoreAllMocks` does NOT reset `jest.fn()` implementations, `resetAllMocks` does.
- All commands below run from `apps/education-apps` unless stated. Branch: `feature/education-sales-agents`.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

Backend (`apps/education-apps`):
- Modify `prisma/schema.prisma`: role, enum, 3 models, relations on `User` and `School`.
- Create `src/modules/sales-agents/salesAgents.validation.ts`: code normalisation, money rounding, commission formula, input sanitisers.
- Create `src/modules/sales-agents/salesAgents.service.ts`: referral-code resolution, agent CRUD, totals, reports, payouts.
- Create `src/modules/sales-agents/schoolPayments.service.ts`: assign an agent to a school, record/list/delete school payments.
- Create `src/modules/sales-agents/salesAgents.controller.ts`: HTTP handlers for all of the above.
- Create `src/modules/sales-agents/salesAgents.routes.ts` (`/api/sales-agents`), `src/modules/sales-agents/agent.routes.ts` (`/api/agent`).
- Create `src/modules/sales-agents/salesAgents.seed.ts` + `prisma/seed-sales-agents.ts`: house agent `ARWA`.
- Modify `src/modules/schools/schools.service.ts`, `schools.controller.ts`, `schools.routes.ts`, `src/app.ts`, `package.json`.
- Tests next to each service: `*.test.ts`.

Frontend (`apps/education-apps/frontend`):
- Modify `types/index.ts` (role), `app/login/page.tsx`, `components/auth/RequireRole.tsx`, `components/landing/LandingPage.tsx`, `components/landing/PricingSection.tsx`, `app/signup/page.tsx`, `lib/services/schools.ts`, `components/Sidebar.tsx`, `app/admin/schools/page.tsx`.
- Create `lib/services/salesAgents.ts`: API client + types + `formatMAD`.
- Create `app/admin/sales-agents/page.tsx`, `app/admin/sales-agents/[id]/page.tsx`, `components/admin/SchoolPaymentsModal.tsx`, `components/agent/AgentReportView.tsx`, `app/agent/layout.tsx`, `app/agent/page.tsx`.

---

### Task 1: Prisma schema

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`

- [ ] **Step 1: Add the role and the enum**

In `enum UserRole`, add `SALES_AGENT` after `SUPER_ADMIN`:

```prisma
enum UserRole {
  ADMIN
  SECRETARY
  OWNER
  SUPER_ADMIN
  SALES_AGENT
}
```

Right after `enum SchoolStatus { ... }`, add:

```prisma
enum SubscriptionPeriod {
  MONTHLY
  YEARLY
}
```

- [ ] **Step 2: Add relations to `User` and `School`**

In `model User`, after the `branch` relation line, add:

```prisma
  salesAgent SalesAgent?
```

In `model School`, after the `pack Pack? @relation(...)` line, add:

```prisma
  salesAgentId String?          @db.ObjectId
  salesAgent   SalesAgent?      @relation(fields: [salesAgentId], references: [id])
  payments     SchoolPayment[]
```

and add `@@index([salesAgentId])` next to the existing `@@index([packId])`.

- [ ] **Step 3: Add the three models at the end of the file**

```prisma
// A commercial who brings schools in. The house agent (isHouse) is the company's own code used in its ads:
// it has no login (userId null). Only the house agent may have a null userId (MongoDB unique index).
model SalesAgent {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  name           String
  phone          String?
  code           String   @unique
  commissionRate Float
  isHouse        Boolean  @default(false)
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  userId String? @unique @db.ObjectId
  user   User?   @relation(fields: [userId], references: [id])

  schools  School[]
  payments SchoolPayment[]
  payouts  AgentPayout[]

  @@map("sales_agents")
}

// A subscription payment made by a school, recorded by the SUPER_ADMIN. The agent and rate are frozen here.
model SchoolPayment {
  id               String             @id @default(auto()) @map("_id") @db.ObjectId
  schoolId         String             @db.ObjectId
  school           School             @relation(fields: [schoolId], references: [id])
  amount           Float
  period           SubscriptionPeriod
  paidAt           DateTime
  note             String?
  salesAgentId     String?            @db.ObjectId
  salesAgent       SalesAgent?        @relation(fields: [salesAgentId], references: [id])
  commissionRate   Float
  commissionAmount Float
  createdAt        DateTime           @default(now())

  @@index([schoolId, paidAt])
  @@index([salesAgentId, paidAt])
  @@map("school_payments")
}

// Money paid out to an agent against their commissions.
model AgentPayout {
  id           String     @id @default(auto()) @map("_id") @db.ObjectId
  salesAgentId String     @db.ObjectId
  salesAgent   SalesAgent @relation(fields: [salesAgentId], references: [id])
  amount       Float
  paidAt       DateTime
  note         String?
  createdAt    DateTime   @default(now())

  @@index([salesAgentId, paidAt])
  @@map("agent_payouts")
}
```

- [ ] **Step 4: Validate, generate, push**

Run:
```bash
npx prisma validate && npx prisma generate && npx prisma db push
```
Expected: "The schema at prisma/schema.prisma is valid", "Generated Prisma Client", and "Your database is now in sync with your Prisma schema" (db push creates the unique indexes on `sales_agents.code` and `sales_agents.userId`).

- [ ] **Step 5: Run the whole suite**

Run: `npx jest`
Expected: all suites pass. (Before this task `attendance.service.test.ts` failed only because the generated client was stale; `prisma generate` fixes it. If it still fails, stop and report it: it is not part of this feature.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(education): schema for sales agents, school payments and agent payouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Validation helpers

**Files:**
- Create: `apps/education-apps/src/modules/sales-agents/salesAgents.validation.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.validation.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import {
    normalizeCode,
    sanitizeCode,
    computeCommission,
    roundMoney,
    sanitizeNewAgent,
    sanitizeAgentUpdate,
    sanitizePayment,
    sanitizePayout,
} from './salesAgents.validation';

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

describe('sanitizeNewAgent', () => {
    const valid = {
        name: ' Youssef ',
        email: ' Youssef@Example.com ',
        password: 'secret123',
        phone: '0600000000',
        code: 'youssef22',
        commissionRate: '15',
    };

    it('returns clean data', () => {
        expect(sanitizeNewAgent(valid)).toEqual({
            name: 'Youssef',
            email: 'youssef@example.com',
            password: 'secret123',
            phone: '0600000000',
            code: 'YOUSSEF22',
            commissionRate: 15,
        });
    });
    it('rejects a short password', () => {
        expect(() => sanitizeNewAgent({ ...valid, password: 'short' })).toThrow('Password must be at least 8 characters');
    });
    it('rejects a missing name or a bad email', () => {
        expect(() => sanitizeNewAgent({ ...valid, name: '  ' })).toThrow('Name is required');
        expect(() => sanitizeNewAgent({ ...valid, email: 'nope' })).toThrow('Email is invalid');
    });
    it('rejects a rate outside 0-100', () => {
        expect(() => sanitizeNewAgent({ ...valid, commissionRate: 101 })).toThrow('Commission rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, commissionRate: -1 })).toThrow('Commission rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, commissionRate: 'abc' })).toThrow('Commission rate must be between 0 and 100');
    });
});

describe('sanitizeAgentUpdate', () => {
    it('keeps only the provided editable fields', () => {
        expect(sanitizeAgentUpdate({ commissionRate: 20 })).toEqual({ commissionRate: 20 });
        expect(sanitizeAgentUpdate({ name: 'Ali', phone: '', active: false })).toEqual({
            name: 'Ali',
            phone: null,
            active: false,
        });
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
    it('rejects a zero/negative amount, a bad period or a bad date', () => {
        expect(() => sanitizePayment({ amount: 0, period: 'MONTHLY', paidAt: '2026-11-01' })).toThrow('Amount must be greater than 0');
        expect(() => sanitizePayment({ amount: 10, period: 'WEEKLY', paidAt: '2026-11-01' })).toThrow('Period must be MONTHLY or YEARLY');
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/salesAgents.validation.test.ts`
Expected: FAIL, "Cannot find module './salesAgents.validation'".

- [ ] **Step 3: Implement**

```ts
// Codes are compared uppercased and trimmed everywhere (signup, check endpoint, creation).
export const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;
export const PERIODS = ['MONTHLY', 'YEARLY'] as const;
export type PeriodValue = (typeof PERIODS)[number];

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

const parseRate = (value: unknown): number => {
    const rate = toNumber(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Commission rate must be between 0 and 100');
    return rate;
};

const parseAmount = (value: unknown): number => {
    const amount = toNumber(value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than 0');
    return roundMoney(amount);
};

const parseDate = (label: string, value: unknown): Date => {
    const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`);
    return date;
};

export const sanitizeCode = (raw: unknown): string => {
    const code = normalizeCode(raw);
    if (!CODE_PATTERN.test(code)) throw new Error('Code must be 3-20 letters, digits or dashes');
    return code;
};

export interface NewAgentData {
    name: string;
    email: string;
    password: string;
    phone?: string;
    code: string;
    commissionRate: number;
}

export const sanitizeNewAgent = (input: Record<string, unknown>): NewAgentData => {
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
        commissionRate: parseRate(input.commissionRate),
    };
};

export interface AgentUpdateData {
    name?: string;
    phone?: string | null;
    commissionRate?: number;
    active?: boolean;
}

export const sanitizeAgentUpdate = (input: Record<string, unknown>): AgentUpdateData => {
    if (input.code !== undefined) throw new Error('The code cannot be changed');
    if (input.isHouse !== undefined) throw new Error('The company flag cannot be changed');
    const data: AgentUpdateData = {};
    if (input.name !== undefined) data.name = requireText('Name', input.name);
    if (input.phone !== undefined) data.phone = optionalText(input.phone) ?? null;
    if (input.commissionRate !== undefined) data.commissionRate = parseRate(input.commissionRate);
    if (input.active !== undefined) {
        if (typeof input.active !== 'boolean') throw new Error('Active must be true or false');
        data.active = input.active;
    }
    return data;
};

export interface PaymentData {
    amount: number;
    period: PeriodValue;
    paidAt: Date;
    note?: string;
}

export const sanitizePayment = (input: Record<string, unknown>): PaymentData => {
    const amount = parseAmount(input.amount);
    if (!PERIODS.includes(input.period as PeriodValue)) throw new Error('Period must be MONTHLY or YEARLY');
    return {
        amount,
        period: input.period as PeriodValue,
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

Note: `toEqual` treats a missing key and `undefined` the same, so `note: undefined` matches tests that omit `note`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/modules/sales-agents/salesAgents.validation.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents/salesAgents.validation.ts src/modules/sales-agents/salesAgents.validation.test.ts
git commit -m "feat(education): validation and commission helpers for sales agents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Referral code resolution + mandatory code at signup

**Files:**
- Create: `apps/education-apps/src/modules/sales-agents/salesAgents.service.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.service.test.ts`
- Modify: `apps/education-apps/src/modules/schools/schools.service.ts` (interface `SignupSchoolData`, function `signupSchool`)
- Modify: `apps/education-apps/src/modules/schools/schools.controller.ts` (`signup`)
- Test: `apps/education-apps/src/modules/schools/schools.service.test.ts`

- [ ] **Step 1: Write the failing tests for code resolution**

Create `src/modules/sales-agents/salesAgents.service.test.ts`. This mock block is shared by Tasks 3, 4 and 5 — later tasks append `describe` blocks and extend this mock as stated there:

```ts
import prisma from '../../config/database';
import { resolveReferralCode, isReferralCodeValid } from './salesAgents.service';

jest.mock('../../config/database', () => {
    const tx = { user: { create: jest.fn() }, salesAgent: { create: jest.fn() } };
    return {
        __esModule: true,
        default: {
            salesAgent: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
            user: { findUnique: jest.fn() },
            agentPayout: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/salesAgents.service.test.ts`
Expected: FAIL, "Cannot find module './salesAgents.service'".

- [ ] **Step 3: Implement the start of the service**

Create `src/modules/sales-agents/salesAgents.service.ts`:

```ts
import prisma from '../../config/database';
import { CODE_PATTERN, normalizeCode } from './salesAgents.validation';

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
    } catch {
        return false;
    }
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/modules/sales-agents/salesAgents.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing signup tests**

In `src/modules/schools/schools.service.test.ts`:

1. Extend the database mock: add `salesAgent: { findFirst: jest.fn() },` inside `default: { ... }`.
2. Add `referralCode: 'YOUSSEF22',` to `baseInput`.
3. Right after the `pack` helper, add a file-level `beforeEach`. It must survive the `resetAllMocks` used by a later describe, and it clears call counts because the signup describe only uses `restoreAllMocks` (which, in Jest 30, leaves `jest.fn()` call history alone):

```ts
const agent = { id: 'agent1', code: 'YOUSSEF22', active: true, commissionRate: 15 };

beforeEach(() => {
    jest.clearAllMocks();
    (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(agent);
});
```

4. Inside `describe('signupSchool', ...)` add:

```ts
    it('rejects a signup without a referral code', async () => {
        arrangeSignup();
        await expect(signupSchool({ ...baseInput, referralCode: '' })).rejects.toThrow('Referral code is required');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown or inactive referral code', async () => {
        arrangeSignup();
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(signupSchool({ ...baseInput, referralCode: 'NOPE' })).rejects.toThrow('Invalid referral code');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('attributes the school to the agent behind the code (case and spaces ignored)', async () => {
        const { txClient } = arrangeSignup();

        await signupSchool({ ...baseInput, referralCode: '  youssef22 ' });

        expect(prisma.salesAgent.findFirst).toHaveBeenCalledWith({ where: { code: 'YOUSSEF22', active: true } });
        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ salesAgentId: 'agent1' }) })
        );
    });
```

- [ ] **Step 6: Run to verify the new tests fail**

Run: `npx jest src/modules/schools/schools.service.test.ts`
Expected: FAIL. The three new tests fail (no code check, no `salesAgentId`); TypeScript may also complain that `referralCode` is not in `SignupSchoolData`.

- [ ] **Step 7: Implement in the signup service**

In `src/modules/schools/schools.service.ts`:

Add the import:
```ts
import { resolveReferralCode } from '../sales-agents/salesAgents.service';
```

Add to `SignupSchoolData`:
```ts
    referralCode?: unknown; // required; typed loosely because it comes straight from a public request body
```

In `signupSchool`, right after the `isInstitutionType` check, add:
```ts
    const agent = await resolveReferralCode(data.referralCode);
```

and in `tx.school.create({ data: { ... } })` add `salesAgentId: agent.id,` after `packId`.

- [ ] **Step 8: Pass the code through the controller**

In `src/modules/schools/schools.controller.ts`, `signup`: add `referralCode,` to the destructuring of `req.body` and to the object passed to `signupSchool`.

- [ ] **Step 9: Run to verify everything passes**

Run: `npx jest src/modules/schools src/modules/sales-agents`
Expected: PASS (old signup tests still pass thanks to the `beforeEach` agent mock and `baseInput.referralCode`).

- [ ] **Step 10: Commit**

```bash
git add src/modules/sales-agents src/modules/schools
git commit -m "feat(education): require a valid sales agent code at school signup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Agent CRUD and list with totals

**Files:**
- Modify: `apps/education-apps/src/modules/sales-agents/salesAgents.service.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Change the import at the top of `salesAgents.service.test.ts` to:
```ts
import { resolveReferralCode, isReferralCodeValid, listAgents, createAgent, updateAgent } from './salesAgents.service';
import * as bcryptUtil from '../../utils/bcrypt';
```

Append:

```ts
describe('listAgents', () => {
    it('returns agents (house first) with totals and without the user id', async () => {
        (prisma.salesAgent.findMany as jest.Mock).mockResolvedValue([
            {
                id: 'a1',
                name: 'Youssef',
                code: 'YOUSSEF22',
                commissionRate: 15,
                isHouse: false,
                active: true,
                userId: 'u1',
                user: { email: 'y@example.com' },
                schools: [{ status: 'ACTIVE' }, { status: 'PENDING' }],
                payments: [{ commissionAmount: 52.5 }, { commissionAmount: 30.25 }],
                payouts: [{ amount: 50 }],
            },
        ]);

        const [agent] = await listAgents();

        expect(prisma.salesAgent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: [{ isHouse: 'desc' }, { createdAt: 'asc' }] })
        );
        expect(agent).toEqual({
            id: 'a1',
            name: 'Youssef',
            code: 'YOUSSEF22',
            commissionRate: 15,
            isHouse: false,
            active: true,
            email: 'y@example.com',
            totals: { schools: 2, activeSchools: 1, totalCommissions: 82.75, totalPayouts: 50, balance: 32.75 },
        });
    });
});

describe('createAgent', () => {
    const input = { name: 'Youssef', email: 'Y@example.com', password: 'secret123', code: 'youssef22', commissionRate: 15 };

    beforeEach(() => {
        jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed');
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        tx.user.create.mockResolvedValue({ id: 'u1' });
        tx.salesAgent.create.mockResolvedValue({ id: 'a1', code: 'YOUSSEF22' });
    });
    afterEach(() => jest.restoreAllMocks());

    it('creates the SALES_AGENT user and the agent in one transaction', async () => {
        await expect(createAgent(input)).resolves.toEqual({ id: 'a1', code: 'YOUSSEF22' });

        expect(tx.user.create).toHaveBeenCalledWith({
            data: { email: 'y@example.com', password: 'hashed', name: 'Youssef', role: 'SALES_AGENT', gsm: undefined },
        });
        expect(tx.salesAgent.create).toHaveBeenCalledWith({
            data: { name: 'Youssef', phone: undefined, code: 'YOUSSEF22', commissionRate: 15, userId: 'u1' },
        });
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
    it('updates editable fields', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'a1', commissionRate: 20 });

        await updateAgent('a1', { commissionRate: 20 });

        expect(prisma.salesAgent.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { commissionRate: 20 } });
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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/salesAgents.service.test.ts`
Expected: FAIL, `listAgents`/`createAgent`/`updateAgent` are not exported.

- [ ] **Step 3: Implement**

Replace the imports at the top of `salesAgents.service.ts` with:

```ts
import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';
import { assertId } from '../transport/ids';
import { CODE_PATTERN, normalizeCode, roundMoney, sanitizeAgentUpdate, sanitizeNewAgent } from './salesAgents.validation';
```

Append:

```ts
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

    return agents.map(({ user, schools, payments, payouts, userId: _userId, ...agent }) => ({
        ...agent,
        email: user?.email ?? null,
        totals: buildTotals(schools, payments, payouts),
    }));
};

export const createAgent = async (input: Record<string, unknown>) => {
    const data = sanitizeNewAgent(input);

    if (await prisma.salesAgent.findUnique({ where: { code: data.code } })) throw new Error('This code is already used');
    if (await prisma.user.findUnique({ where: { email: data.email } })) throw new Error('Email already exists');

    const password = await hashPassword(data.password);

    try {
        return await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: { email: data.email, password, name: data.name, role: 'SALES_AGENT', gsm: data.phone },
            });
            return tx.salesAgent.create({
                data: {
                    name: data.name,
                    phone: data.phone,
                    code: data.code,
                    commissionRate: data.commissionRate,
                    userId: user.id,
                },
            });
        });
    } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') throw new Error('Email or code already exists');
        throw error;
    }
};

export const updateAgent = async (id: string, input: Record<string, unknown>) => {
    assertId('Sales agent id', id);
    const data = sanitizeAgentUpdate(input);

    const existing = await prisma.salesAgent.findUnique({ where: { id } });
    if (!existing) throw new Error('Sales agent not found');
    if (existing.isHouse && data.active === false) throw new Error('The company code cannot be deactivated');

    return prisma.salesAgent.update({ where: { id }, data });
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/modules/sales-agents/salesAgents.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents
git commit -m "feat(education): create, list and edit sales agents with their totals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Agent report (admin detail + agent space) and payouts

**Files:**
- Modify: `apps/education-apps/src/modules/sales-agents/salesAgents.service.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `getAgentReport, getAgentReportForUser, recordPayout, deletePayout` to the import from `./salesAgents.service`. Append:

```ts
describe('agent report', () => {
    const stored = {
        id: 'a1',
        name: 'Youssef',
        phone: '0600',
        code: 'YOUSSEF22',
        commissionRate: 15,
        isHouse: false,
        active: true,
        userId: 'u1',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        user: { email: 'y@example.com' },
        schools: [
            {
                id: 's1',
                name: 'Ecole A',
                city: 'Casa',
                institutionType: 'PRIVATE_SCHOOL',
                status: 'ACTIVE',
                createdAt: new Date('2026-02-01'),
                ownerName: 'Owner',
                ownerPhone: '0611',
                pack: { name: 'Pro' },
                payments: [{ amount: 350 }, { amount: 350 }],
            },
        ],
        payments: [
            {
                id: 'p1',
                paidAt: new Date('2026-03-01'),
                amount: 350,
                period: 'MONTHLY',
                commissionRate: 15,
                commissionAmount: 52.5,
                school: { name: 'Ecole A' },
            },
        ],
        payouts: [{ id: 'o1', paidAt: new Date('2026-03-05'), amount: 50, note: null }],
    };

    it('builds the report for an agent id', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(stored);

        const report = await getAgentReport('a1');

        expect((prisma.salesAgent.findUnique as jest.Mock).mock.calls[0][0].where).toEqual({ id: 'a1' });
        expect(report.agent).toEqual({
            id: 'a1',
            name: 'Youssef',
            phone: '0600',
            code: 'YOUSSEF22',
            commissionRate: 15,
            isHouse: false,
            active: true,
            email: 'y@example.com',
            referralPath: '/signup?ref=YOUSSEF22',
        });
        expect(report.totals).toEqual({
            schools: 1,
            activeSchools: 1,
            totalCommissions: 52.5,
            totalPayouts: 50,
            balance: 2.5,
        });
        expect(report.schools).toEqual([
            {
                id: 's1',
                name: 'Ecole A',
                city: 'Casa',
                institutionType: 'PRIVATE_SCHOOL',
                status: 'ACTIVE',
                createdAt: new Date('2026-02-01'),
                ownerName: 'Owner',
                ownerPhone: '0611',
                packName: 'Pro',
                totalPaid: 700,
            },
        ]);
        expect(report.commissions).toEqual([
            {
                id: 'p1',
                paidAt: new Date('2026-03-01'),
                amount: 350,
                period: 'MONTHLY',
                commissionRate: 15,
                commissionAmount: 52.5,
                schoolName: 'Ecole A',
            },
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
        expect(args.include.payments).toBeDefined();
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
Expected: FAIL, functions not exported.

- [ ] **Step 3: Implement**

In `salesAgents.service.ts`, add `sanitizePayout` to the validation import, add at the top:

```ts
import type { Prisma } from '@prisma/client';
```

and append:

```ts
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
                    payments: { select: { amount: true } },
                },
            },
            // Payments credited to this agent (frozen on the payment), not payments of its current schools.
            payments: {
                orderBy: { paidAt: 'desc' },
                select: {
                    id: true,
                    paidAt: true,
                    amount: true,
                    period: true,
                    commissionRate: true,
                    commissionAmount: true,
                    school: { select: { name: true } },
                },
            },
            payouts: { orderBy: { paidAt: 'desc' }, select: { id: true, paidAt: true, amount: true, note: true } },
        },
    });
    if (!agent) throw new Error('Sales agent not found');

    return {
        agent: {
            id: agent.id,
            name: agent.name,
            phone: agent.phone,
            code: agent.code,
            commissionRate: agent.commissionRate,
            isHouse: agent.isHouse,
            active: agent.active,
            email: agent.user?.email ?? null,
            referralPath: `/signup?ref=${agent.code}`,
        },
        totals: buildTotals(agent.schools, agent.payments, agent.payouts),
        schools: agent.schools.map(({ pack, payments, ...school }) => ({
            ...school,
            packName: pack?.name ?? null,
            totalPaid: sum(payments.map((payment) => payment.amount)),
        })),
        commissions: agent.payments.map(({ school, ...payment }) => ({ ...payment, schoolName: school.name })),
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
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents
git commit -m "feat(education): sales agent report and payouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: School payments and agent assignment

**Files:**
- Create: `apps/education-apps/src/modules/sales-agents/schoolPayments.service.ts`
- Test: `apps/education-apps/src/modules/sales-agents/schoolPayments.service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import prisma from '../../config/database';
import {
    assignSchoolAgent,
    listSchoolPayments,
    recordSchoolPayment,
    deleteSchoolPayment,
} from './schoolPayments.service';

jest.mock('../../config/database', () => {
    const tx = { school: { findUnique: jest.fn() }, schoolPayment: { create: jest.fn() } };
    return {
        __esModule: true,
        default: {
            school: { findUnique: jest.fn(), update: jest.fn() },
            salesAgent: { findUnique: jest.fn() },
            schoolPayment: { findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

afterEach(() => jest.clearAllMocks());

describe('assignSchoolAgent', () => {
    it('sets the agent of a school', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1' });

        await assignSchoolAgent('s1', 'a1');

        expect(prisma.school.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { salesAgentId: 'a1' },
            select: { id: true, salesAgentId: true },
        });
    });

    it('clears the agent with null', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
        await assignSchoolAgent('s1', null);
        expect(prisma.salesAgent.findUnique).not.toHaveBeenCalled();
        expect(prisma.school.update).toHaveBeenCalledWith(expect.objectContaining({ data: { salesAgentId: null } }));
    });

    it('404s an unknown school or agent', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValueOnce(null);
        await expect(assignSchoolAgent('zz', 'a1')).rejects.toThrow('School not found');

        (prisma.school.findUnique as jest.Mock).mockResolvedValueOnce({ id: 's1' });
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValueOnce(null);
        await expect(assignSchoolAgent('s1', 'zz')).rejects.toThrow('Sales agent not found');
        expect(prisma.school.update).not.toHaveBeenCalled();
    });
});

describe('recordSchoolPayment', () => {
    const input = { amount: 350, period: 'MONTHLY', paidAt: '2026-11-01' };

    it("freezes the school's current agent and rate on the payment", async () => {
        tx.school.findUnique.mockResolvedValue({ id: 's1', salesAgent: { id: 'a1', commissionRate: 15 } });
        tx.schoolPayment.create.mockResolvedValue({ id: 'p1' });

        await recordSchoolPayment('s1', input);

        expect(tx.school.findUnique).toHaveBeenCalledWith({ where: { id: 's1' }, include: { salesAgent: true } });
        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: {
                amount: 350,
                period: 'MONTHLY',
                paidAt: new Date('2026-11-01'),
                note: undefined,
                schoolId: 's1',
                salesAgentId: 'a1',
                commissionRate: 15,
                commissionAmount: 52.5,
            },
        });
    });

    it('records a zero commission when the school has no agent', async () => {
        tx.school.findUnique.mockResolvedValue({ id: 's1', salesAgent: null });

        await recordSchoolPayment('s1', input);

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ salesAgentId: null, commissionRate: 0, commissionAmount: 0 }),
        });
    });

    it('404s an unknown school and validates input before touching the database', async () => {
        tx.school.findUnique.mockResolvedValue(null);
        await expect(recordSchoolPayment('zz', input)).rejects.toThrow('School not found');

        await expect(recordSchoolPayment('s1', { ...input, amount: 0 })).rejects.toThrow('Amount must be greater than 0');
        expect(tx.schoolPayment.create).not.toHaveBeenCalled();
    });
});

describe('listSchoolPayments', () => {
    it("lists the school's payments, newest first, with the credited agent", async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.schoolPayment.findMany as jest.Mock).mockResolvedValue([]);

        await listSchoolPayments('s1');

        expect(prisma.schoolPayment.findMany).toHaveBeenCalledWith({
            where: { schoolId: 's1' },
            orderBy: { paidAt: 'desc' },
            include: { salesAgent: { select: { id: true, name: true, code: true } } },
        });
    });

    it('404s an unknown school', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(listSchoolPayments('zz')).rejects.toThrow('School not found');
    });
});

describe('deleteSchoolPayment', () => {
    it('deletes only a payment of that school', async () => {
        (prisma.schoolPayment.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'p1' }).mockResolvedValueOnce(null);

        await expect(deleteSchoolPayment('s1', 'p1')).resolves.toEqual({ id: 'p1' });
        expect(prisma.schoolPayment.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', schoolId: 's1' } });
        expect(prisma.schoolPayment.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });

        await expect(deleteSchoolPayment('s2', 'p1')).rejects.toThrow('Payment not found');
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/schoolPayments.service.test.ts`
Expected: FAIL, "Cannot find module './schoolPayments.service'".

- [ ] **Step 3: Implement**

```ts
import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { computeCommission, sanitizePayment } from './salesAgents.validation';

// Changing a school's agent only affects payments recorded afterwards: past payments keep their frozen agent.
export const assignSchoolAgent = async (schoolId: string, salesAgentId: unknown) => {
    assertId('School id', schoolId);
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    let agentId: string | null = null;
    if (salesAgentId !== null && salesAgentId !== undefined && salesAgentId !== '') {
        assertId('Sales agent id', salesAgentId);
        const agent = await prisma.salesAgent.findUnique({ where: { id: salesAgentId } });
        if (!agent) throw new Error('Sales agent not found');
        agentId = agent.id;
    }

    return prisma.school.update({
        where: { id: schoolId },
        data: { salesAgentId: agentId },
        select: { id: true, salesAgentId: true },
    });
};

export const listSchoolPayments = async (schoolId: string) => {
    assertId('School id', schoolId);
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    return prisma.schoolPayment.findMany({
        where: { schoolId },
        orderBy: { paidAt: 'desc' },
        include: { salesAgent: { select: { id: true, name: true, code: true } } },
    });
};

// An inactive agent still earns: deactivation only stops new signups with the code.
export const recordSchoolPayment = async (schoolId: string, input: Record<string, unknown>) => {
    assertId('School id', schoolId);
    const data = sanitizePayment(input);

    return prisma.$transaction(async (tx) => {
        const school = await tx.school.findUnique({ where: { id: schoolId }, include: { salesAgent: true } });
        if (!school) throw new Error('School not found');

        const rate = school.salesAgent?.commissionRate ?? 0;
        return tx.schoolPayment.create({
            data: {
                ...data,
                schoolId,
                salesAgentId: school.salesAgent?.id ?? null,
                commissionRate: rate,
                commissionAmount: computeCommission(data.amount, rate),
            },
        });
    });
};

export const deleteSchoolPayment = async (schoolId: string, paymentId: string) => {
    assertId('School id', schoolId);
    assertId('Payment id', paymentId);
    const payment = await prisma.schoolPayment.findFirst({ where: { id: paymentId, schoolId } });
    if (!payment) throw new Error('Payment not found');
    await prisma.schoolPayment.delete({ where: { id: paymentId } });
    return { id: paymentId };
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/modules/sales-agents`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents
git commit -m "feat(education): record school subscription payments with frozen commissions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Controllers, routes and the schools list

**Files:**
- Create: `apps/education-apps/src/modules/sales-agents/salesAgents.controller.ts`
- Create: `apps/education-apps/src/modules/sales-agents/salesAgents.routes.ts`
- Create: `apps/education-apps/src/modules/sales-agents/agent.routes.ts`
- Modify: `apps/education-apps/src/modules/schools/schools.routes.ts`
- Modify: `apps/education-apps/src/modules/schools/schools.service.ts` (`listSchools`)
- Modify: `apps/education-apps/src/app.ts`
- Test: `apps/education-apps/src/modules/schools/schools.service.test.ts`, `apps/education-apps/src/middlewares/tenantScope.middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

In `schools.service.test.ts`, inside the existing `listSchools` test, add to the `select: expect.objectContaining({ ... })` object:

```ts
                    salesAgentId: true,
                    salesAgent: { select: { id: true, name: true, code: true } },
```

In `src/middlewares/tenantScope.middleware.test.ts`, after the `rejects SUPER_ADMIN on branch-scoped routes` test, add:

```ts
    it('rejects SALES_AGENT on branch-scoped routes', async () => {
        const req = {
            user: { id: 'u1', email: 'a@b.com', role: 'SALES_AGENT', schoolId: null, branchId: null },
            header: jest.fn(),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run them**

Run: `npx jest src/modules/schools src/middlewares/tenantScope.middleware.test.ts`
Expected: the `listSchools` test FAILS (fields missing). The SALES_AGENT test already PASSES (the middleware rejects every unknown role); it stays as a regression guard.

- [ ] **Step 3: Update `listSchools`**

In `src/modules/schools/schools.service.ts`, inside `listSchools`'s `select`, after `pack: { ... }`, add:

```ts
            salesAgentId: true,
            salesAgent: { select: { id: true, name: true, code: true } },
```

- [ ] **Step 4: Create the controller**

`src/modules/sales-agents/salesAgents.controller.ts`:

```ts
import { Request, Response } from 'express';
import { respond } from '../transport/http';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
    isReferralCodeValid,
    listAgents,
    createAgent,
    updateAgent,
    getAgentReport,
    getAgentReportForUser,
    recordPayout,
    deletePayout,
} from './salesAgents.service';
import {
    assignSchoolAgent,
    listSchoolPayments,
    recordSchoolPayment,
    deleteSchoolPayment,
} from './schoolPayments.service';

export const check = (req: Request, res: Response) =>
    respond(res, async () => ({ valid: await isReferralCodeValid(req.params.code) }), {
        message: 'Code checked',
        failure: 'Failed to check code',
    });

export const list = (_req: Request, res: Response) =>
    respond(res, () => listAgents(), { message: 'Sales agents retrieved', failure: 'Failed to retrieve sales agents' });

export const create = (req: Request, res: Response) =>
    respond(res, () => createAgent(req.body ?? {}), {
        message: 'Sales agent created',
        status: 201,
        failure: 'Failed to create sales agent',
    });

export const detail = (req: Request, res: Response) =>
    respond(res, () => getAgentReport(req.params.id), {
        message: 'Sales agent retrieved',
        failure: 'Failed to retrieve sales agent',
    });

export const update = (req: Request, res: Response) =>
    respond(res, () => updateAgent(req.params.id, req.body ?? {}), {
        message: 'Sales agent updated',
        failure: 'Failed to update sales agent',
    });

export const addPayout = (req: Request, res: Response) =>
    respond(res, () => recordPayout(req.params.id, req.body ?? {}), {
        message: 'Payout recorded',
        status: 201,
        failure: 'Failed to record payout',
    });

export const removePayout = (req: Request, res: Response) =>
    respond(res, () => deletePayout(req.params.id, req.params.payoutId), {
        message: 'Payout deleted',
        failure: 'Failed to delete payout',
    });

export const me = (req: AuthRequest, res: Response) =>
    respond(res, () => getAgentReportForUser(req.user!.id), {
        message: 'Agent dashboard retrieved',
        failure: 'Failed to retrieve agent dashboard',
    });

export const assignAgent = (req: Request, res: Response) =>
    respond(res, () => assignSchoolAgent(req.params.id, req.body?.salesAgentId), {
        message: 'School sales agent updated',
        failure: 'Failed to update school sales agent',
    });

export const listPayments = (req: Request, res: Response) =>
    respond(res, () => listSchoolPayments(req.params.id), {
        message: 'School payments retrieved',
        failure: 'Failed to retrieve school payments',
    });

export const addPayment = (req: Request, res: Response) =>
    respond(res, () => recordSchoolPayment(req.params.id, req.body ?? {}), {
        message: 'School payment recorded',
        status: 201,
        failure: 'Failed to record school payment',
    });

export const removePayment = (req: Request, res: Response) =>
    respond(res, () => deleteSchoolPayment(req.params.id, req.params.paymentId), {
        message: 'School payment deleted',
        failure: 'Failed to delete school payment',
    });
```

- [ ] **Step 5: Create the routes**

`src/modules/sales-agents/salesAgents.routes.ts`:

```ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { check, list, create, detail, update, addPayout, removePayout } from './salesAgents.controller';

const router = Router();

// Public, no auth — the signup form checks a code on blur. Limited so codes can't be brute-forced quickly.
const checkLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/check/:code', checkLimiter, check);

router.use(authMiddleware);
router.use(roleMiddleware('SUPER_ADMIN'));

router.get('/', list);
router.post('/', create);
router.get('/:id', detail);
router.patch('/:id', update);
router.post('/:id/payouts', addPayout);
router.delete('/:id/payouts/:payoutId', removePayout);

export default router;
```

`src/modules/sales-agents/agent.routes.ts`:

```ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { me } from './salesAgents.controller';

const router = Router();

// The agent's own space: only their clients, commissions and payouts.
router.get('/me', authMiddleware, roleMiddleware('SALES_AGENT'), me);

export default router;
```

In `src/modules/schools/schools.routes.ts`, add the import:

```ts
import { assignAgent, listPayments, addPayment, removePayment } from '../sales-agents/salesAgents.controller';
```

and after the `/:id/pack` route:

```ts
router.patch('/:id/sales-agent', authMiddleware, roleMiddleware('SUPER_ADMIN'), assignAgent);
router.get('/:id/payments', authMiddleware, roleMiddleware('SUPER_ADMIN'), listPayments);
router.post('/:id/payments', authMiddleware, roleMiddleware('SUPER_ADMIN'), addPayment);
router.delete('/:id/payments/:paymentId', authMiddleware, roleMiddleware('SUPER_ADMIN'), removePayment);
```

In `src/app.ts`, after `import packsRoutes ...`:

```ts
import salesAgentsRoutes from './modules/sales-agents/salesAgents.routes';
import agentRoutes from './modules/sales-agents/agent.routes';
```

and after `apiRouter.use('/packs', packsRoutes);`:

```ts
apiRouter.use('/sales-agents', salesAgentsRoutes);
apiRouter.use('/agent', agentRoutes);
```

- [ ] **Step 6: Run tests and type-check**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites PASS, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(education): sales agent, school payment and agent space endpoints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: House agent seed

**Files:**
- Create: `apps/education-apps/src/modules/sales-agents/salesAgents.seed.ts`
- Test: `apps/education-apps/src/modules/sales-agents/salesAgents.seed.test.ts`
- Create: `apps/education-apps/prisma/seed-sales-agents.ts`
- Modify: `apps/education-apps/package.json`

- [ ] **Step 1: Write the failing test**

```ts
import { seedHouseAgent, HOUSE_AGENT } from './salesAgents.seed';

const makeClient = (existing: unknown) =>
    ({
        salesAgent: {
            findFirst: jest.fn().mockResolvedValue(existing),
            create: jest.fn().mockResolvedValue({ id: 'h1', ...HOUSE_AGENT }),
        },
    }) as any;

describe('seedHouseAgent', () => {
    it('creates the ARWA house agent when none exists', async () => {
        const client = makeClient(null);

        await seedHouseAgent(client);

        expect(client.salesAgent.findFirst).toHaveBeenCalledWith({ where: { isHouse: true } });
        expect(client.salesAgent.create).toHaveBeenCalledWith({
            data: { name: 'Société (ARWA)', code: 'ARWA', commissionRate: 0, isHouse: true, active: true },
        });
    });

    it('does nothing when a house agent already exists', async () => {
        const client = makeClient({ id: 'h0', isHouse: true });

        await expect(seedHouseAgent(client)).resolves.toEqual({ id: 'h0', isHouse: true });
        expect(client.salesAgent.create).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/modules/sales-agents/salesAgents.seed.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/modules/sales-agents/salesAgents.seed.ts`:

```ts
import type { PrismaClient } from '@prisma/client';

// The company's own code, used in its ads. It earns nothing and has no login.
export const HOUSE_AGENT = { name: 'Société (ARWA)', code: 'ARWA', commissionRate: 0, isHouse: true, active: true };

// Idempotent: never touches an existing house agent (a SUPER_ADMIN may have renamed it).
export const seedHouseAgent = async (client: PrismaClient) => {
    const existing = await client.salesAgent.findFirst({ where: { isHouse: true } });
    if (existing) return existing;
    return client.salesAgent.create({ data: HOUSE_AGENT });
};
```

`prisma/seed-sales-agents.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { seedHouseAgent } from '../src/modules/sales-agents/salesAgents.seed';

const prisma = new PrismaClient();

seedHouseAgent(prisma)
    .then((agent) => console.log('House agent:', { code: agent.code, isHouse: agent.isHouse }))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
```

In `package.json` `scripts`, after `"prisma:seed-packs"`, add:

```json
    "prisma:seed-sales-agents": "ts-node prisma/seed-sales-agents.ts",
```

- [ ] **Step 4: Run test, then the seed against the local DB**

Run: `npx jest src/modules/sales-agents/salesAgents.seed.test.ts && npm run prisma:seed-sales-agents`
Expected: PASS, then `House agent: { code: 'ARWA', isHouse: true }`. Running the seed a second time prints the same line and creates nothing.

- [ ] **Step 5: Commit**

```bash
git add src/modules/sales-agents prisma/seed-sales-agents.ts package.json
git commit -m "feat(education): seed the company house code ARWA

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Frontend foundations (role, API client, redirects)

**Files:**
- Modify: `apps/education-apps/frontend/types/index.ts:2`
- Create: `apps/education-apps/frontend/lib/services/salesAgents.ts`
- Modify: `apps/education-apps/frontend/lib/services/schools.ts`
- Modify: `apps/education-apps/frontend/app/login/page.tsx:32-35`
- Modify: `apps/education-apps/frontend/components/auth/RequireRole.tsx`
- Modify: `apps/education-apps/frontend/components/landing/LandingPage.tsx`

There is no frontend test runner; verification is `npx tsc --noEmit` plus manual checks in Task 15.

- [ ] **Step 1: Add the role**

`frontend/types/index.ts` line 2:

```ts
export type UserRole = 'ADMIN' | 'SECRETARY' | 'OWNER' | 'SUPER_ADMIN' | 'SALES_AGENT';
```

- [ ] **Step 2: Create the API client**

`frontend/lib/services/salesAgents.ts`:

```ts
import api from '../api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '../institutionTypes';
import type { SchoolStatus } from './schools';

export type SubscriptionPeriod = 'MONTHLY' | 'YEARLY';

export interface AgentTotals {
    schools: number;
    activeSchools: number;
    totalCommissions: number;
    totalPayouts: number;
    balance: number;
}

export interface SalesAgentListItem {
    id: string;
    name: string;
    phone: string | null;
    code: string;
    commissionRate: number;
    isHouse: boolean;
    active: boolean;
    email: string | null;
    totals: AgentTotals;
}

export interface AgentReport {
    agent: {
        id: string;
        name: string;
        phone: string | null;
        code: string;
        commissionRate: number;
        isHouse: boolean;
        active: boolean;
        email: string | null;
        referralPath: string;
    };
    totals: AgentTotals;
    schools: {
        id: string;
        name: string;
        city: string | null;
        institutionType: InstitutionType | null;
        status: SchoolStatus;
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
        commissionRate: number;
        commissionAmount: number;
        schoolName: string;
    }[];
    payouts: { id: string; paidAt: string; amount: number; note: string | null }[];
}

export interface NewAgentInput {
    name: string;
    email: string;
    password: string;
    phone?: string;
    code: string;
    commissionRate: number;
}

export interface AgentUpdateInput {
    name?: string;
    phone?: string;
    commissionRate?: number;
    active?: boolean;
}

export interface SchoolPaymentItem {
    id: string;
    amount: number;
    period: SubscriptionPeriod;
    paidAt: string;
    note: string | null;
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

- [ ] **Step 3: Extend the schools client**

In `frontend/lib/services/schools.ts`, add `referralCode: string;` to `SignupSchoolData`, and to `SchoolListItem` add:

```ts
    salesAgentId?: string | null;
    salesAgent?: { id: string; name: string; code: string } | null;
```

- [ ] **Step 4: Send agents to `/agent`**

`frontend/app/login/page.tsx`, before the final `else router.push('/');`, add:

```tsx
        else if (user?.role === 'SALES_AGENT') router.push('/agent');
```

`frontend/components/auth/RequireRole.tsx`, in the redirect chain after the `OWNER` branch, add:

```tsx
                } else if (user.role === 'SALES_AGENT') {
                    router.push('/agent');
```

`frontend/components/landing/LandingPage.tsx`, in the "Already signed in" effect, add after the SECRETARY line:

```tsx
        else if (user.role === 'SALES_AGENT') router.replace('/agent');
```

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. (Errors in `app/signup/page.tsx` about the missing `referralCode` are expected and fixed in Task 10. If those are the only errors, continue.)

- [ ] **Step 6: Commit**

```bash
git add frontend/types/index.ts frontend/lib/services frontend/app/login/page.tsx frontend/components/auth/RequireRole.tsx frontend/components/landing/LandingPage.tsx
git commit -m "feat(education): frontend API client and routing for sales agents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Referral code at signup + landing forwarding

**Files:**
- Modify: `apps/education-apps/frontend/app/signup/page.tsx`
- Modify: `apps/education-apps/frontend/components/landing/LandingPage.tsx`
- Modify: `apps/education-apps/frontend/components/landing/PricingSection.tsx`

- [ ] **Step 1: Signup state and submission**

In `app/signup/page.tsx` add imports:

```tsx
import { checkReferralCode } from '../../lib/services/salesAgents';
import { whatsappUrl } from '../../lib/landing/whatsapp';
```

After the `packs` state, add:

```tsx
    const [referralCode, setReferralCode] = useState<string>((searchParams.get('ref') ?? '').trim().toUpperCase());
    const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

    const verifyCode = async (code: string) => {
        if (!code) {
            setCodeStatus('idle');
            return;
        }
        setCodeStatus('checking');
        try {
            setCodeStatus((await checkReferralCode(code)) ? 'valid' : 'invalid');
        } catch {
            setCodeStatus('idle'); // network/rate-limit problem: let the server decide at submit
        }
    };

    // A code arriving from a ?ref= link is checked right away.
    useEffect(() => {
        if (referralCode) verifyCode(referralCode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
```

In `handleSubmit`, after the institution type check, add:

```tsx
        if (!referralCode) { setError('Le code commercial est obligatoire.'); return; }
        if (codeStatus === 'invalid') { setError('Code commercial invalide.'); return; }
```

and pass it to the API: replace `...form,` with `...form, referralCode,`. In the `catch`, after computing `msg`, add:

```tsx
            if (msg === 'Invalid referral code' || msg === 'Referral code is required') setCodeStatus('invalid');
```

- [ ] **Step 2: The field**

Insert this block right before the `<Input type="text" ... placeholder="Votre nom" />` element:

```tsx
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-600" htmlFor="referralCode">
                                Code commercial
                            </label>
                            <input
                                id="referralCode"
                                type="text"
                                value={referralCode}
                                onChange={(e) => {
                                    setReferralCode(e.target.value.toUpperCase());
                                    setCodeStatus('idle');
                                }}
                                onBlur={() => verifyCode(referralCode.trim())}
                                required
                                autoComplete="off"
                                placeholder="Ex. YOUSSEF22"
                                className={`w-full px-6 py-4 bg-slate-50 border-2 rounded-[2rem] focus:bg-white focus:outline-none font-bold text-lg shadow-sm tracking-wider ${
                                    codeStatus === 'invalid'
                                        ? 'border-red-300 focus:border-red-500'
                                        : codeStatus === 'valid'
                                        ? 'border-emerald-300 focus:border-emerald-500'
                                        : 'border-slate-100 focus:border-indigo-500'
                                }`}
                            />
                            {codeStatus === 'checking' && <p className="text-xs text-slate-400">Vérification…</p>}
                            {codeStatus === 'valid' && <p className="text-xs font-semibold text-emerald-600">Code valide ✓</p>}
                            {codeStatus === 'invalid' && (
                                <p className="text-xs font-semibold text-red-600">Ce code n&apos;existe pas ou n&apos;est plus actif.</p>
                            )}
                            <a
                                href={whatsappUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-xs font-bold text-emerald-700 hover:underline"
                            >
                                Pas de code ? Contactez-nous sur WhatsApp
                            </a>
                        </div>
```

- [ ] **Step 3: Forward `?ref=` from the landing**

In `components/landing/LandingPage.tsx`, after the `type` state add:

```tsx
    const [refCode, setRefCode] = useState('');

    // A commercial's link may point to the landing (/?ref=CODE): keep the code for the signup links.
    useEffect(() => {
        const ref = new URLSearchParams(window.location.search).get('ref');
        if (ref) setRefCode(ref.trim().toUpperCase());
    }, []);
```

and pass it to the pricing section: find `<PricingSection` in the JSX and add the prop `refCode={refCode}`.

In `components/landing/PricingSection.tsx`:
- add `refCode?: string;` to `interface Props`;
- change the signature to `export default function PricingSection({ m, type, onTypeChange, refCode }: Props)`;
- add, right inside the function body:

```tsx
    const refParam = refCode ? `&ref=${encodeURIComponent(refCode)}` : '';
```

- change the two links to `` href={`/signup?type=${type}${refParam}`} `` and `` href={`/signup?type=${type}&pack=${pack.code}${refParam}`} ``.

- [ ] **Step 4: Type-check and lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: no TypeScript errors; lint shows no new errors in the touched files.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/signup/page.tsx frontend/components/landing
git commit -m "feat(education): mandatory sales agent code on the signup form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: SUPER_ADMIN agents list page + sidebar

**Files:**
- Create: `apps/education-apps/frontend/app/admin/sales-agents/page.tsx`
- Modify: `apps/education-apps/frontend/components/Sidebar.tsx`

- [ ] **Step 1: Sidebar entry**

In `components/Sidebar.tsx`, add `Briefcase,` to the `lucide-react` import list, and in `superAdminMenuItems`, after the `packs` item, add:

```tsx
    {
      id: 'sales-agents',
      label: 'Commerciaux',
      icon: Briefcase,
      path: '/admin/sales-agents',
      activeColor: 'bg-[#334155]/50 border-[#34D399]',
      iconColor: 'text-[#34D399]'
    },
```

- [ ] **Step 2: The page**

`app/admin/sales-agents/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, Plus } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import { apiErrorMessage } from '@/lib/services/packs';
import { createSalesAgent, formatMAD, getSalesAgents, type SalesAgentListItem } from '@/lib/services/salesAgents';

const emptyForm = { name: '', email: '', password: '', phone: '', code: '', commissionRate: '10' };

export default function SalesAgentsPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [agents, setAgents] = useState<SalesAgentListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setAgents(await getSalesAgents());
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
                commissionRate: Number(form.commissionRate),
            });
            setShowForm(false);
            setForm(emptyForm);
            await load();
        } catch (err) {
            setFormError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (!user || user.role !== 'SUPER_ADMIN') return null;

    const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Commerciaux</h1>
                    <p className="text-gray-600 mt-1">Codes, écoles apportées et commissions</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                >
                    <Plus size={18} /> Nouveau commercial
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>}

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
                                <th className="px-6 py-4">Solde</th>
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
                                    <td className="px-6 py-4">{agent.commissionRate} %</td>
                                    <td className="px-6 py-4">
                                        {agent.totals.activeSchools} / {agent.totals.schools}
                                        <div className="text-xs text-gray-500">actives / total</div>
                                    </td>
                                    <td className="px-6 py-4">{formatMAD(agent.totals.totalCommissions)}</td>
                                    <td className="px-6 py-4">{formatMAD(agent.totals.totalPayouts)}</td>
                                    <td className="px-6 py-4 font-bold">{formatMAD(agent.totals.balance)}</td>
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

            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nouveau commercial">
                <form onSubmit={submit} className="space-y-3">
                    {formError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{formError}</div>}
                    <input className={inputClass} placeholder="Nom complet" value={form.name} onChange={set('name')} required />
                    <input className={inputClass} type="email" placeholder="Email (identifiant)" value={form.email} onChange={set('email')} required />
                    <input className={inputClass} type="password" placeholder="Mot de passe (8 caractères min.)" minLength={8} value={form.password} onChange={set('password')} required />
                    <input className={inputClass} placeholder="Téléphone" value={form.phone} onChange={set('phone')} />
                    <input className={`${inputClass} font-mono`} placeholder="Code (ex. YOUSSEF22)" pattern="[A-Z0-9\-]{3,20}" value={form.code} onChange={set('code')} required />
                    <label className="block text-sm text-gray-600">
                        Taux de commission (%)
                        <input className={inputClass} type="number" min={0} max={100} step="0.5" value={form.commissionRate} onChange={set('commissionRate')} required />
                    </label>
                    <button disabled={saving} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50">
                        {saving ? 'Création…' : 'Créer'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/admin/sales-agents/page.tsx frontend/components/Sidebar.tsx
git commit -m "feat(education): super admin list of sales agents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Shared report view + SUPER_ADMIN agent detail page

**Files:**
- Create: `apps/education-apps/frontend/components/agent/AgentReportView.tsx` (used by the admin detail page and by `/agent`)
- Create: `apps/education-apps/frontend/app/admin/sales-agents/[id]/page.tsx`

- [ ] **Step 1: The shared report view**

`components/agent/AgentReportView.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import { INSTITUTION_TYPE_LABELS, DEFAULT_INSTITUTION_TYPE } from '@/lib/institutionTypes';
import { formatDate, formatMAD, referralUrl, type AgentReport } from '@/lib/services/salesAgents';

type Tab = 'schools' | 'commissions' | 'payouts';

interface Props {
    report: AgentReport;
    onDeletePayout?: (payoutId: string) => void; // admin only
}

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Active', PENDING: 'En attente', SUSPENDED: 'Suspendue' };

export default function AgentReportView({ report, onDeletePayout }: Props) {
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
                    Code : <b className="font-mono">{report.agent.code}</b> · Taux : {report.agent.commissionRate} %
                </span>
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
                                    <td className="px-4 py-3">{STATUS_LABELS[school.status] ?? school.status}</td>
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
                                <th className="px-4 py-3">Paiement</th>
                                <th className="px-4 py-3">Taux</th>
                                <th className="px-4 py-3">Commission</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.commissions.map((c) => (
                                <tr key={c.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3">{formatDate(c.paidAt)}</td>
                                    <td className="px-4 py-3 font-semibold">{c.schoolName}</td>
                                    <td className="px-4 py-3">
                                        {formatMAD(c.amount)} <span className="text-xs text-gray-500">({c.period === 'YEARLY' ? 'annuel' : 'mensuel'})</span>
                                    </td>
                                    <td className="px-4 py-3">{c.commissionRate} %</td>
                                    <td className="px-4 py-3 font-bold">{formatMAD(c.commissionAmount)}</td>
                                </tr>
                            ))}
                            {report.commissions.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-6 text-gray-500">Aucune commission pour le moment.</td></tr>
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
                                    <td className="px-4 py-3">{formatDate(p.paidAt)}</td>
                                    <td className="px-4 py-3 font-bold">{formatMAD(p.amount)}</td>
                                    <td className="px-4 py-3">{p.note || '—'}</td>
                                    {onDeletePayout && (
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => onDeletePayout(p.id)} className="text-red-600 hover:text-red-800" aria-label="Supprimer">
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
        </div>
    );
}
```

- [ ] **Step 2: The admin detail page**

`app/admin/sales-agents/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import AgentReportView from '@/components/agent/AgentReportView';
import { apiErrorMessage } from '@/lib/services/packs';
import {
    deleteAgentPayout,
    getSalesAgentReport,
    recordAgentPayout,
    updateSalesAgent,
    type AgentReport,
} from '@/lib/services/salesAgents';

const today = () => new Date().toISOString().slice(0, 10);

export default function SalesAgentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [report, setReport] = useState<AgentReport | null>(null);
    const [error, setError] = useState('');
    const [edit, setEdit] = useState({ name: '', phone: '', commissionRate: '', active: true });
    const [payout, setPayout] = useState({ amount: '', paidAt: today(), note: '' });
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setError('');
        try {
            const data = await getSalesAgentReport(id);
            setReport(data);
            setEdit({
                name: data.agent.name,
                phone: data.agent.phone ?? '',
                commissionRate: String(data.agent.commissionRate),
                active: data.agent.active,
            });
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
            updateSalesAgent(id, {
                name: edit.name,
                phone: edit.phone,
                commissionRate: Number(edit.commissionRate),
                active: edit.active,
            })
        );
    };

    const addPayout = (e: React.FormEvent) => {
        e.preventDefault();
        run(async () => {
            await recordAgentPayout(id, { amount: Number(payout.amount), paidAt: payout.paidAt, note: payout.note || undefined });
            setPayout({ amount: '', paidAt: today(), note: '' });
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

            {!report ? (
                <p className="text-gray-500">Chargement…</p>
            ) : (
                <>
                    <h1 className="text-3xl font-bold text-gray-800">
                        {report.agent.name}
                        {report.agent.isHouse && <span className="ml-3 align-middle px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">Société</span>}
                    </h1>

                    <div className="grid md:grid-cols-2 gap-4">
                        <form onSubmit={saveAgent} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                            <h2 className="font-bold text-gray-800">Fiche</h2>
                            <input className={`${inputClass} w-full`} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
                            <input className={`${inputClass} w-full`} placeholder="Téléphone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                            <label className="block text-sm text-gray-600">
                                Taux de commission (%) — s&apos;applique aux prochains paiements
                                <input className={`${inputClass} w-full`} type="number" min={0} max={100} step="0.5" value={edit.commissionRate} onChange={(e) => setEdit({ ...edit, commissionRate: e.target.value })} required />
                            </label>
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
                                <input className={`${inputClass} w-full`} type="number" min={0.01} step="0.01" placeholder="Montant (MAD)" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} required />
                                <input className={`${inputClass} w-full`} type="date" value={payout.paidAt} onChange={(e) => setPayout({ ...payout, paidAt: e.target.value })} required />
                                <input className={`${inputClass} w-full`} placeholder="Note (ex. virement CIH)" value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} />
                                <button disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50">Enregistrer le versement</button>
                            </form>
                        )}
                    </div>

                    <AgentReportView report={report} onDeletePayout={removePayout} />
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/agent frontend/app/admin/sales-agents
git commit -m "feat(education): sales agent detail page with payouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Schools page — agent column and payments modal

**Files:**
- Create: `apps/education-apps/frontend/components/admin/SchoolPaymentsModal.tsx`
- Modify: `apps/education-apps/frontend/app/admin/schools/page.tsx`

- [ ] **Step 1: The payments modal**

`components/admin/SchoolPaymentsModal.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { apiErrorMessage } from '@/lib/services/packs';
import {
    deleteSchoolPayment,
    formatDate,
    formatMAD,
    getSchoolPayments,
    recordSchoolPayment,
    type SchoolPaymentItem,
    type SubscriptionPeriod,
} from '@/lib/services/salesAgents';

interface Props {
    school: { id: string; name: string } | null;
    onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function SchoolPaymentsModal({ school, onClose }: Props) {
    const [payments, setPayments] = useState<SchoolPaymentItem[]>([]);
    const [form, setForm] = useState({ amount: '', period: 'MONTHLY' as SubscriptionPeriod, paidAt: today(), note: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const load = async (schoolId: string) => {
        setError('');
        try {
            setPayments(await getSchoolPayments(schoolId));
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    useEffect(() => {
        if (school) load(school.id);
        else setPayments([]);
    }, [school]);

    if (!school) return null;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await recordSchoolPayment(school.id, {
                amount: Number(form.amount),
                period: form.period,
                paidAt: form.paidAt,
                note: form.note || undefined,
            });
            setForm({ amount: '', period: form.period, paidAt: today(), note: '' });
            await load(school.id);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (paymentId: string) => {
        if (!window.confirm('Supprimer ce paiement ? Sa commission sera annulée.')) return;
        setBusy(true);
        try {
            await deleteSchoolPayment(school.id, paymentId);
            await load(school.id);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const inputClass = 'px-3 py-2 border border-gray-200 rounded-lg';

    return (
        <Modal isOpen onClose={onClose} title={`Paiements — ${school.name}`} size="lg">
            <div className="space-y-4">
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

                <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input className={inputClass} type="number" min={0.01} step="0.01" placeholder="Montant (MAD)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    <select className={inputClass} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value as SubscriptionPeriod })}>
                        <option value="MONTHLY">Mensuel</option>
                        <option value="YEARLY">Annuel</option>
                    </select>
                    <input className={inputClass} type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} required />
                    <input className={inputClass} placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                    <button disabled={busy} className="sm:col-span-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50">
                        Enregistrer le paiement
                    </button>
                </form>

                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                        <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Montant</th>
                            <th className="px-3 py-2">Commercial</th>
                            <th className="px-3 py-2">Commission</th>
                            <th className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {payments.map((p) => (
                            <tr key={p.id} className="border-t border-gray-100">
                                <td className="px-3 py-2">{formatDate(p.paidAt)}</td>
                                <td className="px-3 py-2">
                                    {formatMAD(p.amount)} <span className="text-xs text-gray-500">({p.period === 'YEARLY' ? 'annuel' : 'mensuel'})</span>
                                </td>
                                <td className="px-3 py-2">{p.salesAgent ? `${p.salesAgent.name} (${p.salesAgent.code})` : '—'}</td>
                                <td className="px-3 py-2">{formatMAD(p.commissionAmount)} <span className="text-xs text-gray-500">({p.commissionRate} %)</span></td>
                                <td className="px-3 py-2 text-right">
                                    <button onClick={() => remove(p.id)} disabled={busy} className="text-red-600 hover:text-red-800" aria-label="Supprimer">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {payments.length === 0 && (
                            <tr><td colSpan={5} className="px-3 py-4 text-gray-500">Aucun paiement enregistré.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
}
```

- [ ] **Step 2: Wire it into the schools page**

In `app/admin/schools/page.tsx`:

Imports:
```tsx
import { Building2, CheckCircle, Wallet } from 'lucide-react';
import SchoolPaymentsModal from '@/components/admin/SchoolPaymentsModal';
import { assignSchoolAgent, getSalesAgents, type SalesAgentListItem } from '@/lib/services/salesAgents';
```
(replace the existing `lucide-react` import line with the one above).

State, after `assigningId`:
```tsx
    const [agents, setAgents] = useState<SalesAgentListItem[]>([]);
    const [paymentsSchool, setPaymentsSchool] = useState<{ id: string; name: string } | null>(null);
```

In `fetchSchools`, replace the `Promise.all` line and the setters with:
```tsx
            const [data, allPacks, allAgents] = await Promise.all([getAllSchools(), getAllPacks(), getSalesAgents()]);
            setSchools(data);
            setPacks(allPacks);
            setAgents(allAgents);
```

After `handleAssignPack`, add:
```tsx
    const handleAssignAgent = async (schoolId: string, agentId: string) => {
        setAssigningId(schoolId);
        setError('');
        try {
            await assignSchoolAgent(schoolId, agentId || null);
            await fetchSchools();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setAssigningId(null);
        }
    };
```

In the table header, after `<th className="px-6 py-4">Pack</th>` add `<th className="px-6 py-4">Commercial</th>`.

In each row, after the Pack `<td>…</td>`, add:
```tsx
                                    <td className="px-6 py-4">
                                        <select
                                            value={school.salesAgentId ?? ''}
                                            disabled={assigningId === school.id}
                                            onChange={(e) => handleAssignAgent(school.id, e.target.value)}
                                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50"
                                        >
                                            <option value="">Aucun commercial</option>
                                            {agents.map((agent) => (
                                                <option key={agent.id} value={agent.id}>
                                                    {agent.name} ({agent.code}){agent.active ? '' : ' — inactif'}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
```

In the Action `<td>`, wrap the existing content in `<div className="flex items-center gap-2">…</div>` and add after the Activate button:
```tsx
                                            <button
                                                onClick={() => setPaymentsSchool({ id: school.id, name: school.name })}
                                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm"
                                            >
                                                <Wallet size={16} /> Paiements
                                            </button>
```

Right before the final closing `</div>` of the page, add:
```tsx
            <SchoolPaymentsModal school={paymentsSchool} onClose={() => setPaymentsSchool(null)} />
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/admin/SchoolPaymentsModal.tsx frontend/app/admin/schools/page.tsx
git commit -m "feat(education): assign a sales agent and record payments from the schools page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Agent space `/agent`

**Files:**
- Create: `apps/education-apps/frontend/app/agent/layout.tsx`
- Create: `apps/education-apps/frontend/app/agent/page.tsx`

- [ ] **Step 1: Layout**

`app/agent/layout.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Briefcase, LogOut } from 'lucide-react';
import { RequireRole } from '@/components/auth/RequireRole';
import useAuthStore from '@/store/useAuthStore';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);

    const logout = () => {
        useAuthStore.getState().logout();
        router.push('/login');
    };

    return (
        <RequireRole allowedRoles={['SALES_AGENT']}>
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white border-b border-gray-200">
                    <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-bold text-gray-800">
                            <Briefcase size={20} className="text-emerald-600" /> Espace commercial
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="hidden sm:inline text-gray-600">{user?.name}</span>
                            <button onClick={logout} className="flex items-center gap-1 text-gray-600 hover:text-red-600">
                                <LogOut size={16} /> Déconnexion
                            </button>
                        </div>
                    </div>
                </header>
                <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
            </div>
        </RequireRole>
    );
}
```

- [ ] **Step 2: Page**

`app/agent/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import AgentReportView from '@/components/agent/AgentReportView';
import { apiErrorMessage } from '@/lib/services/packs';
import { getMyAgentReport, type AgentReport } from '@/lib/services/salesAgents';

export default function AgentHomePage() {
    const [report, setReport] = useState<AgentReport | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        getMyAgentReport()
            .then(setReport)
            .catch((err) => setError(apiErrorMessage(err)));
    }, []);

    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>;
    if (!report) return <p className="text-gray-500">Chargement…</p>;

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-800">Bonjour {report.agent.name}</h1>
            <AgentReportView report={report} />
        </div>
    );
}
```

- [ ] **Step 3: Type-check, lint, build**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`
Expected: no TypeScript errors, no new lint errors, build succeeds and lists `/agent`, `/admin/sales-agents`, `/admin/sales-agents/[id]`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/agent
git commit -m "feat(education): agent space with clients, commissions and payouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: End-to-end QA

No code; run backend (`npm run dev`, port 3010) and frontend (`cd frontend && npm run dev`, port 3011). Super admin login: `admin@injahi.com` / `admin123` (check its role is `SUPER_ADMIN`; if not, use the SUPER_ADMIN account from `create-seed-users.ts`).

- [ ] **Step 1: API role checks with curl**

```bash
API=http://localhost:3010/api
SA=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@injahi.com","password":"admin123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')
curl -s $API/sales-agents/check/ARWA                         # {"success":true,"data":{"valid":true},...}
curl -s $API/sales-agents/check/NOPE                         # valid:false
curl -s -X POST $API/sales-agents -H "Authorization: Bearer $SA" -H 'Content-Type: application/json' \
  -d '{"name":"QA Agent","email":"qa.agent@example.com","password":"secret123","code":"QA-01","commissionRate":15}'   # 201
AG=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"qa.agent@example.com","password":"secret123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')
curl -s -o /dev/null -w '%{http_code}\n' $API/sales-agents -H "Authorization: Bearer $AG"     # 403
curl -s -o /dev/null -w '%{http_code}\n' $API/students -H "Authorization: Bearer $AG"         # 403
curl -s -o /dev/null -w '%{http_code}\n' $API/agent/me -H "Authorization: Bearer $AG"         # 200
curl -s -X POST $API/schools/signup -H 'Content-Type: application/json' \
  -d '{"ownerName":"QA","ownerEmail":"qa.school1@example.com","password":"secret123","institutionType":"PRIVATE_SCHOOL"}'   # 400 Referral code is required
```
Expected: the status codes in the comments. Note the signup limiter allows 5 signups per hour per IP.

- [ ] **Step 2: Browser flow**

1. Open `http://localhost:3011/?ref=qa-01`, click a pack: the signup URL carries `ref=QA-01` and the field shows "Code valide ✓".
2. Clear the code, type `NOPE`, leave the field: red error and the WhatsApp link. Submit: blocked.
3. Sign up with `QA-01`. Log in as super admin: on `/admin/schools` the new school shows "QA Agent (QA-01)".
4. Click "Paiements", record 350 MAD monthly: commission 52,50 MAD (15 %).
5. On `/admin/sales-agents/<id>` change the rate to 20 %, record another 350 MAD payment for the school: the old line still shows 15 % / 52,50, the new one 20 % / 70,00.
6. Record a payout of 100 MAD: balance = 122,50 − 100 = 22,50 MAD.
7. Move the school to `ARWA` and record a payment: it is credited to ARWA at 0 %; QA Agent's commissions are unchanged.
8. Log in as `qa.agent@example.com` on a phone-sized window: redirected to `/agent`, link copy works, the cards show the same totals, no admin menu, and `/admin` redirects back to `/agent`.

- [ ] **Step 3: Report**

Write down any deviation, fix it with a test first if it is a backend bug, and commit fixes as `fix(education): ...`.
