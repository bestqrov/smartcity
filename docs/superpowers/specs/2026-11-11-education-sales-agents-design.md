# Education Sales Agents (Commerciaux) + Referral Codes + Commissions

## Context

ArwaEduc (`apps/education-apps`) is sold to schools as a paid SaaS. Schools sign up themselves through the public `POST /api/schools/signup` (landing `/` → `/signup`), land in `PENDING` with a 15-day trial, and the SUPER_ADMIN activates them from `/admin/schools`. Roles today: `ADMIN`, `SECRETARY`, `OWNER`, `SUPER_ADMIN`.

The company is sending sales agents ("commerciaux") into the field. Some sell face to face, some run their own ads, and in both cases the client usually signs up on the website directly. Today nothing records who brought a school in, and nothing records what a school pays for its subscription, so there is nothing to compute a commission from.

This spec adds: (1) sales agents with a unique referral code, (2) a **mandatory** referral code at signup, (3) recording of school subscription payments by the SUPER_ADMIN, (4) per-agent commissions computed from those payments, with payouts, and (5) an agent space where each agent logs in and sees their clients and their own accounting.

## Goals

- SUPER_ADMIN creates sales agents (name, email, password, phone, code, commission rate) and can deactivate them.
- One special **company code** (house agent, e.g. `ARWA`, rate 0%, no login) is used in the company's own ads, so every school is attributed to someone.
- Signup requires a valid, active referral code. A link `…/signup?ref=CODE` (or `/?ref=CODE` on the landing) pre-fills it. A visitor without a code sees a WhatsApp button to contact the company and get one.
- SUPER_ADMIN records each subscription payment a school makes. The commission is computed at that moment from the agent's current rate and frozen on the payment.
- Commissions are **recurring**: every payment of an attributed school earns its agent a commission.
- SUPER_ADMIN records payouts to agents. Balance = total commissions − total payouts.
- An agent logs in at `/agent` and sees: their referral link, their clients (status, pack, payments), their commissions, their payouts and their balance. Nothing else.

## Non-Goals

- Online payment, invoices, automatic billing or auto-suspension of schools that don't pay.
- Enforcing pack limits / subscriptions.
- Multi-level referrals, agent teams or managers, per-pack or per-period commission rules, commission caps or time limits.
- Agents creating schools themselves, editing anything, or seeing anything inside a school (students, parents, finance).
- Editing a recorded payment or payout (delete and re-record instead).
- Notifications (email/WhatsApp) to agents.

## Data Model (Prisma)

```prisma
enum UserRole {
  ADMIN
  SECRETARY
  OWNER
  SUPER_ADMIN
  SALES_AGENT        // new
}

enum SubscriptionPeriod {
  MONTHLY
  YEARLY
}

model SalesAgent {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  name           String
  phone          String?
  code           String   @unique   // uppercase, [A-Z0-9-], 3–20 chars
  commissionRate Float              // percent, 0–100
  isHouse        Boolean  @default(false) // the company code; at most one; no login
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  userId String? @unique @db.ObjectId   // null only for the house agent
  user   User?   @relation(fields: [userId], references: [id])

  schools  School[]
  payments SchoolPayment[]
  payouts  AgentPayout[]

  @@map("sales_agents")
}

model SchoolPayment {
  id               String             @id @default(auto()) @map("_id") @db.ObjectId
  schoolId         String             @db.ObjectId
  school           School             @relation(fields: [schoolId], references: [id])
  amount           Float              // MAD, > 0
  period           SubscriptionPeriod
  paidAt           DateTime
  note             String?
  // Frozen at recording time; later changes to the school's agent or the agent's rate do not touch it.
  salesAgentId     String?            @db.ObjectId
  salesAgent       SalesAgent?        @relation(fields: [salesAgentId], references: [id])
  commissionRate   Float              // 0 when no agent
  commissionAmount Float              // round(amount * rate / 100, 2)
  createdAt        DateTime           @default(now())

  @@index([schoolId, paidAt])
  @@index([salesAgentId, paidAt])
  @@map("school_payments")
}

model AgentPayout {
  id           String     @id @default(auto()) @map("_id") @db.ObjectId
  salesAgentId String     @db.ObjectId
  salesAgent   SalesAgent @relation(fields: [salesAgentId], references: [id])
  amount       Float      // MAD, > 0
  paidAt       DateTime
  note         String?    // e.g. "virement CIH"
  createdAt    DateTime   @default(now())

  @@index([salesAgentId, paidAt])
  @@map("agent_payouts")
}
```

Additions to existing models:
- `School.salesAgentId String? @db.ObjectId` + relation + `@@index([salesAgentId])`, and `School.payments SchoolPayment[]`. Existing schools stay `null` ("no agent") until the SUPER_ADMIN assigns one.
- `User.salesAgent SalesAgent?` back-relation. A `SALES_AGENT` user has `schoolId = null`, `branchId = null`.

A seed/migration script creates the house agent (`code: "ARWA"`, `isHouse: true`, `commissionRate: 0`) if none exists.

## Backend (`src/modules/sales-agents`)

Code normalisation everywhere: `trim().toUpperCase()`; must match `^[A-Z0-9-]{3,20}$`.

### Signup change (`schools.service.signupSchool`)

- New required field `referralCode` (string). Missing/blank → `400 "Referral code is required"`.
- Look up `SalesAgent` by normalised code with `active: true`; not found → `400 "Invalid referral code"`. Non-string input is rejected before reaching Prisma (same rule as `packCode`).
- The school is created with `salesAgentId`. Everything else in signup is unchanged.

Public endpoint `GET /api/sales-agents/check/:code` (rate-limited like signup) → `{ valid: boolean }`, so the form can validate on blur. It never returns the agent's name or any other data.

### SUPER_ADMIN endpoints (`roleMiddleware('SUPER_ADMIN')`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/sales-agents` | List agents with totals: schools count, active schools count, total commissions, total payouts, balance |
| POST | `/api/sales-agents` | Create agent + its `SALES_AGENT` user in one transaction (name, email, password, phone, code, commissionRate). Duplicate email/code → 400 |
| PATCH | `/api/sales-agents/:id` | Update name, phone, commissionRate, active. The code and the house flag cannot be changed. The house agent cannot be deactivated |
| GET | `/api/sales-agents/:id` | Agent detail: schools, payments, payouts, totals |
| POST | `/api/sales-agents/:id/payouts` | Record a payout (amount > 0, paidAt, note) |
| DELETE | `/api/sales-agents/:id/payouts/:payoutId` | Delete a mistaken payout |
| PATCH | `/api/schools/:id/sales-agent` | Assign/change a school's agent (`salesAgentId` or `null`). Affects future payments only |
| GET | `/api/schools/:id/payments` | List a school's payments |
| POST | `/api/schools/:id/payments` | Record a payment (amount > 0, period, paidAt, note). Snapshots the school's current agent and that agent's current rate. An inactive agent still earns (deactivation only stops new signups with the code) |
| DELETE | `/api/schools/:id/payments/:paymentId` | Delete a mistaken payment (its commission disappears with it) |

The balance may go negative if a payment is deleted after a payout; it is shown as-is (no blocking).

### Agent endpoints (`roleMiddleware('SALES_AGENT')`)

`GET /api/agent/me` → for the agent linked to `req.user.id`:
- `agent`: name, code, commissionRate, referral link path (`/signup?ref=CODE`)
- `totals`: schools, active schools, total commissions, total payouts, balance
- `schools`: name, city, institution type, status, pack name, signup date, owner name, owner phone, total paid
- `commissions`: per payment: school name, paidAt, amount, period, rate, commission
- `payouts`: paidAt, amount, note

Strictly scoped by `salesAgentId` (payments filtered on `SchoolPayment.salesAgentId`, not on the school's current agent). No other agent endpoint exists. The existing `tenantScopeMiddleware` already rejects roles other than ADMIN/SECRETARY/OWNER, so a `SALES_AGENT` token cannot reach any branch-scoped resource; `/api/schools/me` stays limited to OWNER/ADMIN/SECRETARY.

Login: unchanged, except that a `SALES_AGENT` login returns the role and the frontend sends it to `/agent`.

## Frontend

### Signup (`/signup`) and landing (`/`)
- New required field "Code commercial / رمز المندوب", uppercased as typed, validated on blur via `/check/:code`.
- `?ref=CODE` on `/signup` pre-fills it; on `/` the `ref` is kept and forwarded on every CTA link to `/signup`.
- Invalid code or server `Invalid referral code`: inline error + "Pas de code ? Contactez-nous" WhatsApp button (existing `whatsappUrl()` helper).

### SUPER_ADMIN
- `/admin/sales-agents`: table (name, code, rate, schools, active schools, commissions, paid out, balance, status) + "New agent" form + edit rate/status. The house agent is pinned at the top and labelled "Société".
- `/admin/sales-agents/[id]`: totals cards, copyable referral link, schools list, commissions list, payouts list, "Record payout" form, delete buttons with confirmation.
- `/admin/schools`: new "Commercial" column with a select to change the agent, and a "Paiements" action opening a panel to list/record/delete that school's payments.
- Sidebar entry "Commerciaux" for SUPER_ADMIN.

### Agent space (`/agent`)
- Own minimal layout (no branch selector, no school menus), logout button.
- Header: referral link with "Copier" button.
- Cards: clients, active clients, total commissions, paid out, **balance due**.
- Tabs: Clients / Commissions / Paiements reçus.
- French UI, matching the existing admin pages' style. Mobile-friendly (agents use phones in the field).

## Error Handling

- All validation errors are 400 with a clear message; ownership/role errors 403; unknown ids 404 (invalid ObjectIds go through the existing `assertId` helper).
- Agent creation (agent + user) and payment recording (read agent + rate, write payment) each run in a single transaction.

## Testing

Jest service tests, following `schools.service.test.ts`:
- Signup: missing code, unknown code, inactive code, lowercase/space-padded code accepted, non-string code rejected, school gets `salesAgentId`.
- Payment recording: commission = amount × rate / 100 rounded to 2 decimals; rate and agent are frozen (changing the rate or the school's agent afterwards doesn't change old payments); no agent → commission 0.
- Totals/balance: commissions − payouts, including after a payment deletion.
- Agent scoping: `/agent/me` returns only that agent's schools and payments; a payment recorded before a school was moved to another agent stays with the first agent.
- Agent CRUD: duplicate code/email, invalid code format, house agent cannot be deactivated nor have its code changed.
- Routes: `SALES_AGENT` gets 403 on SUPER_ADMIN routes and on a branch-scoped route; OWNER gets 403 on `/agent/me`.

Manual QA at localhost:3011: create an agent, sign up with `?ref=`, activate the school, record a payment, check commissions on both admin and agent screens, record a payout, check the balance.
