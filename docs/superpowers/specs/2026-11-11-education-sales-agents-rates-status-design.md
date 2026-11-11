# Sales Agents v2: Commission Rates per Period/Pack + Client and Commission Statuses

Extends `2026-11-11-education-sales-agents-design.md` (already built on branch `feature/education-sales-agents`, not merged, not deployed). Everything there stays unless replaced below.

## Context

v1 gives each agent a single `commissionRate` applied to every payment. The business wants different rates depending on how the school pays (monthly, semi-annual, annual) and, sometimes, on the pack. A semi-annual period does not exist yet. The agent space also needs to show, with icons and a legend, which clients are pending, confirmed or cancelled and which commissions were paid.

## Decisions (validated with the user)

- Commissions are always **percentages** (never fixed MAD amounts).
- Each agent has **3 base rates**: monthly, semi-annual, yearly.
- Each agent may have **pack exceptions**: (pack, period) → rate, which override the base rate for that pack and period. Optional; usually empty.
- New period **SEMIANNUAL** ("Semestriel" / 6 months).
- The rate used for a payment is resolved when the payment is recorded and **frozen** on it (as in v1), together with the pack name.
- Client status (per school, from the agent's point of view): Pending / Activated-unpaid / Confirmed / Cancelled.
- Commission payout status: payouts are allocated **oldest commission first** (FIFO) → each commission is Paid / Partially paid / Due.
- The SUPER_ADMIN list makes "how much each agent is owed" obvious, plus a grand total owed.

## Data Model

```prisma
enum SubscriptionPeriod {
  MONTHLY
  SEMIANNUAL   // new
  YEARLY
}

type AgentPackRate {          // MongoDB composite type, embedded in SalesAgent
  packId String             @db.ObjectId
  period SubscriptionPeriod
  rate   Float              // percent 0–100
}

model SalesAgent {
  // commissionRate Float  -> REMOVED, replaced by:
  monthlyRate    Float
  semiannualRate Float
  yearlyRate     Float
  packRates      AgentPackRate[]
  // ...all other v1 fields unchanged
}

model SchoolPayment {
  // ...v1 fields unchanged (commissionRate stays: it is the frozen rate actually used)
  packId   String? @db.ObjectId   // school's pack when the payment was recorded (snapshot, no relation)
  packName String?                // snapshot for display
}
```

### Migrating existing agents

Agents created with v1 have `commissionRate` and no new fields; Prisma cannot read them once the new fields are required. An idempotent migration `migrateAgentRates(client)` runs a raw MongoDB pipeline update on `sales_agents` where `monthlyRate` does not exist: set `monthlyRate`, `semiannualRate`, `yearlyRate` to the old `commissionRate` (0 if missing), `packRates` to `[]`, and unset `commissionRate`. Exposed as `npm run prisma:migrate-agent-rates` and called from `prisma/seed.ts` and from `prisma/seed-sales-agents.ts` before the house seed. Existing `SchoolPayment` rows are untouched (no `packId`/`packName`; display "—").

The house agent (ARWA) is seeded with all three rates 0 and no pack rates.

## Rules

- All rates: numbers 0–100.
- Pack exceptions: each `packId` must be an existing pack; `(packId, period)` pairs must be unique within an agent.
- House agent: all three rates must be 0 and `packRates` must be empty (rejected otherwise: "The company code earns no commission").
- Rate resolution for a payment with period P on a school whose current pack is K: the exception for (K, P) if one exists, else the base rate for P. No agent → 0. School without a pack → base rate.
- Updating rates only affects payments recorded afterwards.

## Statuses (computed, not stored)

Client status, per school in an agent report, using only payments credited to that agent:
| Status | Condition | Icon | FR label |
|---|---|---|---|
| `PENDING` | school `PENDING` | 🕒 | En attente d'activation |
| `ACTIVE_UNPAID` | school `ACTIVE`, no credited payment | 🔵 | Activée, en attente de paiement |
| `CONFIRMED` | school `ACTIVE`, ≥ 1 credited payment | ✅ | Confirmée |
| `CANCELLED` | school `SUSPENDED` | ❌ | Annulée |

A suspended school that paid before keeps its past commissions (still owed); only its client status is "Annulée".

Commission payout status: sort the agent's commissions by `paidAt` ascending (then `createdAt`), walk through them spending the agent's total payouts:
| Status | Condition | Icon | FR label |
|---|---|---|---|
| `PAID` | fully covered | 💰 | Payée |
| `PARTIAL` | partly covered | 🟡 | Partiellement payée |
| `DUE` | not covered | ⏳ | À payer |
| `NONE` | commission amount is 0 | — | Sans commission |

Each commission also returns `paidAmount`. Totals gain `statusCounts: { PENDING, ACTIVE_UNPAID, CONFIRMED, CANCELLED }`.

## API changes

- `POST /api/sales-agents`: body takes `monthlyRate`, `semiannualRate`, `yearlyRate` (required) and `packRates` (optional array of `{ packId, period, rate }`) instead of `commissionRate`.
- `PATCH /api/sales-agents/:id`: any of the three rates; `packRates` replaces the whole list when present. `commissionRate` is no longer accepted.
- `POST /api/schools/:id/payments`: `period` accepts `SEMIANNUAL`; the payment stores `packId`/`packName`.
- `GET /api/sales-agents`, `GET /api/sales-agents/:id`, `GET /api/agent/me`: agent objects expose the three rates and `packRates` enriched with `packName`; reports add client `status`, commission `payoutStatus` + `paidAmount` + `packName`, and `totals.statusCounts`.

## Frontend

- Shared helpers: period labels (Mensuel / Semestriel / Annuel), status metadata (icon, label, colour) for both status kinds.
- `/admin/sales-agents`:
  - Summary card at the top: **"Total dû aux commerciaux"** = sum of positive balances, plus number of agents with a balance due.
  - Table: rates column "M 10 % · S 15 % · A 25 %" (+ "+N exceptions" when any); "Reste à payer" column coloured (green when 0, orange when > 0, red when negative).
  - Create modal: three rate inputs + pack exceptions editor (pack select from all packs, period select, rate, remove row, add row).
- `/admin/sales-agents/[id]`: edit the three rates and the pack exceptions with the same editor (house agent: read-only, note "Le code société ne touche pas de commission").
- Payments modal on `/admin/schools`: period select includes "Semestriel"; list shows the pack column.
- `AgentReportView` (admin detail and `/agent`):
  - "Mes taux" / "Taux" block: the three base rates and the pack exceptions (pack name, period, rate).
  - Status count chips above the tabs (✅ n confirmées · 🔵 n · 🕒 n · ❌ n).
  - Clients tab: status badge with icon per school.
  - Commissions tab: pack column, period label, payout status badge, paid amount for partial ones.
  - A legend under the tables explaining every icon.

## Non-Goals

- Fixed-amount commissions, per-school rates, rate history UI.
- Linking a payout to specific commissions manually (allocation is FIFO only).
- Changing v1 payments retroactively.

## Testing

Backend (Jest, mocks as in v1):
- Validation: three rates required on create, 0–100; pack rates shape, period values, duplicate (pack, period) rejected; `commissionRate` rejected on update.
- Rate resolution: exception wins; falls back to base rate per period; school without pack; no agent.
- Payment snapshot: `commissionRate`, `commissionAmount`, `packId`, `packName` frozen; SEMIANNUAL accepted.
- House agent: non-zero rates or pack rates rejected.
- Unknown pack id in pack rates → "Pack not found".
- Client status mapping for the four cases (including suspended-with-payments).
- FIFO allocation: no payouts; exact cover; partial; payouts exceeding commissions; zero-commission rows → NONE.
- Migration: raw command shape (filter on missing `monthlyRate`, pipeline `$set` from `$commissionRate`, `$unset`).

Manual QA: migrate the local DB (abdessamad's 25 % becomes 25/25/25), set his rates to M 10 / S 15 / A 25 with an exception "Crèche annuel 20 %", record payments of each period on the four test schools, record a partial payout, and check icons, legend, statuses and totals on admin and `/agent`.
