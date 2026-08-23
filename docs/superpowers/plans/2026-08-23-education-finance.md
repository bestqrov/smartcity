# Education: Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth full-stack Education slice — student payments that atomically create a linked general-ledger transaction, plus manual income/expense entries and a Finance dashboard — following the tenant-scoped-CRUD pattern every prior Education slice in this repo established.

**Architecture:** Two new Prisma models (`Transaction`, `Payment` — `Payment.transactionId` is a required FK, unlike app-injahi's unlinked pair). `education-service` gets one `finance/` module containing `TransactionsService`+`PaymentsService`+one `FinanceController` (`PaymentsService.create` wraps both writes in a single `prisma.$transaction` so a payment and its ledger entry are created atomically or not at all). `education-app` gets a new `lib/finance.ts` hook file, one new "Finance" page (stat cards + payments table + transactions table, each with an add-modal), and a new sidebar nav entry.

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB), class-validator — Next.js 15, React 19, `@smartcity/ui`, `@tanstack/react-query`, `lucide-react`.

---

## Deviations from app-injahi (and why)

Documented in full in `docs/superpowers/specs/2026-08-23-education-finance-design.md` — summary:

- **`Payment.transactionId` is a required foreign key.** app-injahi's `Payment` and `Transaction`
  have no relation between them at all — a payment's linked transaction is created alongside it
  in two separate, unguarded writes, so nothing prevents them from drifting apart or orphaning.
  This plan makes the link explicit and atomic via `prisma.$transaction`.
- **No `Pricing` catalog** — it presumes real Program/Subject/Level entities that every prior
  Education slice here has deferred.
- **No teacher payroll/salary payments** — a distinct HR feature, already deferred when Teachers
  was built.
- **No automated tests** — same as every prior slice; verification is `tsc --noEmit`, `nest
  build`, and manual `curl`/Playwright checks.

---

## File Structure

```
packages/database/prisma/schema.prisma        # modify: + TransactionType enum, Transaction/Payment models, back-refs
packages/shared-types/src/education.types.ts  # modify: + TransactionType, ITransaction, IPayment

packages/i18n/locales/{en,fr,ar}.json         # modify: + finance education.* keys

services/education-service/
  src/app.module.ts                              # modify: + FinanceModule
  src/finance/dto/create-transaction.dto.ts       # create
  src/finance/dto/create-payment.dto.ts           # create
  src/finance/transactions.service.ts             # create
  src/finance/payments.service.ts                 # create
  src/finance/finance.controller.ts               # create
  src/finance/finance.module.ts                   # create

services/gateway/src/proxy/proxy.middleware.ts # modify: + /api/finance route

apps/education-app/
  src/components/StatCard.tsx                    # modify: + green color option
  src/lib/finance.ts                              # create
  src/app/[locale]/(admin)/layout.tsx             # modify: + Finance nav item
  src/app/[locale]/(admin)/finance/page.tsx       # create
```

---

## Task 1: Prisma schema — Transaction, Payment

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add the `TransactionType` enum**

Find `enum AttendanceStatus` (added by the previous Attendance plan) and, directly above it,
insert:

```prisma
enum TransactionType {
  INCOME
  EXPENSE
}

```

- [ ] **Step 2: Add back-refs to `Tenant` and `Student`**

In the `Tenant` model, find the `attendances Attendance[]` line and add two siblings immediately
after it:

```prisma
  attendances  Attendance[]
  transactions Transaction[]
  payments     Payment[]
```

In the `Student` model, find `attendances Attendance[]` and add a sibling:

```prisma
  attendances Attendance[]
  payments    Payment[]
```

(Read the current exact surrounding lines before editing — these are additive edits only, nothing
existing should be removed.)

- [ ] **Step 3: Append the `Transaction` and `Payment` models**

At the very end of `packages/database/prisma/schema.prisma`, append:

```prisma

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

  tenant  Tenant    @relation(fields: [tenantId], references: [id])
  payment Payment?

  @@map("transactions")
}

model Payment {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId      String   @db.ObjectId
  studentId     String   @db.ObjectId
  transactionId String   @unique @db.ObjectId
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

`Payment.transactionId` is `@unique` — a one-to-one relationship, since each payment creates
exactly one transaction and no transaction should ever be claimed by two different payments.

- [ ] **Step 4: Regenerate the Prisma client**

Run: `cd /Users/mac/Documents/smartcity && pnpm --filter @smartcity/database run db:generate`
Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 5: Push the new models to the database**

Run: `cd /Users/mac/Documents/smartcity && pnpm --filter @smartcity/database run db:push`
Expected: output confirming `transactions` and `payments` collections are in sync, including the
unique index on `payments.transactionId`. If the worktree is missing a `.env`/
`packages/database/.env` (gitignored, not checked out into fresh worktrees), copy them from the
main repo's root `.env` first — expected, not an error, and must not be committed.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add Transaction and Payment models"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared-types/src/education.types.ts`

- [ ] **Step 1: Append to `packages/shared-types/src/education.types.ts`**

```ts
export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

export interface ITransaction {
  id: string;
  tenantId: string;
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment {
  id: string;
  tenantId: string;
  studentId: string;
  transactionId: string;
  amount: number;
  method: string;
  notes?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Verify the package still compiles**

Run: `cd /Users/mac/Documents/smartcity/packages/shared-types && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/shared-types/src/education.types.ts
git commit -m "feat(shared-types): add TransactionType/ITransaction/IPayment types"
```

---

## Task 3: i18n — finance keys

**Files:**
- Modify: `packages/i18n/locales/en.json`
- Modify: `packages/i18n/locales/fr.json`
- Modify: `packages/i18n/locales/ar.json`

- [ ] **Step 1: Read the current last key in each file's `education` block**

Run: `python3 -c "import json; [print(l, list(json.load(open('/Users/mac/Documents/smartcity/packages/i18n/locales/'+l+'.json'))['education'].keys())[-1]) for l in ['en','fr','ar']]"`

This tells you the exact last key to insert after (it should be `selectGroupAndDatePrompt` from
the Attendance slice, but confirm rather than assume — insert after whatever key is actually
last).

- [ ] **Step 2: Add these keys to the end of `packages/i18n/locales/en.json`'s `education` block**
  (comma after the previous last key's value, these keys before the block's closing `}`):

```json
    "finance": "Finance",
    "totalIncome": "Total income",
    "totalExpenses": "Total expenses",
    "balance": "Balance",
    "payments": "Payments",
    "addPayment": "Add payment",
    "paymentAmount": "Amount",
    "paymentMethod": "Payment method",
    "paymentNotes": "Notes (optional)",
    "paymentStudent": "Student",
    "noPaymentsYet": "No payments recorded yet.",
    "transactions": "Transactions",
    "addTransaction": "Add transaction",
    "transactionType": "Type",
    "transactionAmount": "Amount",
    "transactionCategory": "Category",
    "transactionDescription": "Description (optional)",
    "noTransactionsYet": "No transactions recorded yet.",
    "typeIncome": "Income",
    "typeExpense": "Expense"
```

- [ ] **Step 3: Add the equivalent French block to `packages/i18n/locales/fr.json`**, same
  position:

```json
    "finance": "Finances",
    "totalIncome": "Total des revenus",
    "totalExpenses": "Total des dépenses",
    "balance": "Solde",
    "payments": "Paiements",
    "addPayment": "Ajouter un paiement",
    "paymentAmount": "Montant",
    "paymentMethod": "Mode de paiement",
    "paymentNotes": "Notes (optionnel)",
    "paymentStudent": "Étudiant",
    "noPaymentsYet": "Aucun paiement enregistré pour l'instant.",
    "transactions": "Transactions",
    "addTransaction": "Ajouter une transaction",
    "transactionType": "Type",
    "transactionAmount": "Montant",
    "transactionCategory": "Catégorie",
    "transactionDescription": "Description (optionnel)",
    "noTransactionsYet": "Aucune transaction enregistrée pour l'instant.",
    "typeIncome": "Revenu",
    "typeExpense": "Dépense"
```

- [ ] **Step 4: Add the equivalent Arabic block to `packages/i18n/locales/ar.json`**, same
  position:

```json
    "finance": "المالية",
    "totalIncome": "إجمالي الإيرادات",
    "totalExpenses": "إجمالي المصاريف",
    "balance": "الرصيد",
    "payments": "الأداءات",
    "addPayment": "إضافة أداء",
    "paymentAmount": "المبلغ",
    "paymentMethod": "طريقة الأداء",
    "paymentNotes": "ملاحظات (اختياري)",
    "paymentStudent": "الطالب",
    "noPaymentsYet": "لا يوجد أداء مسجل بعد.",
    "transactions": "المعاملات",
    "addTransaction": "إضافة معاملة",
    "transactionType": "النوع",
    "transactionAmount": "المبلغ",
    "transactionCategory": "الفئة",
    "transactionDescription": "الوصف (اختياري)",
    "noTransactionsYet": "لا توجد معاملات مسجلة بعد.",
    "typeIncome": "إيراد",
    "typeExpense": "مصروف"
```

- [ ] **Step 5: Validate all three files are still valid JSON**

Run: `node -e "['en','fr','ar'].forEach(l => { require('/Users/mac/Documents/smartcity/packages/i18n/locales/'+l+'.json'); console.log(l, 'OK'); })"`
Expected: `en OK`, `fr OK`, `ar OK`.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add packages/i18n/locales/en.json packages/i18n/locales/fr.json packages/i18n/locales/ar.json
git commit -m "feat(i18n): add finance education namespace keys (en/fr/ar)"
```

---

## Task 4: Finance module (backend)

**Files:**
- Create: `services/education-service/src/finance/dto/create-transaction.dto.ts`
- Create: `services/education-service/src/finance/dto/create-payment.dto.ts`
- Create: `services/education-service/src/finance/transactions.service.ts`
- Create: `services/education-service/src/finance/payments.service.ts`
- Create: `services/education-service/src/finance/finance.controller.ts`
- Create: `services/education-service/src/finance/finance.module.ts`
- Modify: `services/education-service/src/app.module.ts`

- [ ] **Step 1: Write `services/education-service/src/finance/dto/create-transaction.dto.ts`**

```ts
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(2)
  category: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
```

- [ ] **Step 2: Write `services/education-service/src/finance/dto/create-payment.dto.ts`**

```ts
import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  studentId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(2)
  method: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
```

- [ ] **Step 3: Write `services/education-service/src/finance/transactions.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

interface FindAllParams {
  page: number;
  limit: number;
  type?: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        tenantId,
        type: dto.type,
        amount: dto.amount,
        category: dto.category,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : new Date(),
      },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, type } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(tenantId: string) {
    const [incomeAgg, expenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = incomeAgg._sum.amount ?? 0;
    const totalExpense = expenseAgg._sum.amount ?? 0;

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }
}
```

- [ ] **Step 4: Write `services/education-service/src/finance/payments.service.ts`**

`create` wraps both the linked `Transaction` and the `Payment` in a single
`prisma.$transaction(async (tx) => ...)` interactive transaction, so the two rows are written
atomically — this is the one deliberate improvement over app-injahi's unlinked, non-atomic
version described in the spec.

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

interface FindAllParams {
  page: number;
  limit: number;
  studentId?: string;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreatePaymentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });

    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }

    const date = dto.date ? new Date(dto.date) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          type: 'INCOME',
          amount: dto.amount,
          category: 'Tuition Payment',
          description: `Payment from ${student.firstName} ${student.lastName} (${dto.method})`,
          date,
        },
      });

      return tx.payment.create({
        data: {
          tenantId,
          studentId: dto.studentId,
          transactionId: transaction.id,
          amount: dto.amount,
          method: dto.method,
          notes: dto.notes,
          date,
        },
        include: { student: true },
      });
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, studentId } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (studentId) where.studentId = studentId;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: { student: true },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByStudent(tenantId: string, studentId: string) {
    return this.prisma.payment.findMany({
      where: { tenantId, studentId },
      orderBy: { date: 'desc' },
    });
  }
}
```

- [ ] **Step 5: Write `services/education-service/src/finance/finance.controller.ts`**

Query filters (`studentId`, `type`) are read directly via individual `@Query('name')` params, not
a wrapper DTO — matching the established convention in `StudentsController` (its `branchId`/
`status` list filters are plain `@Query()` params too, not a query DTO class); a DTO class for
query filtering is only used elsewhere in this codebase (`FindStudentGuardiansQueryDto`,
`FindGroupStudentsQueryDto`) when a resource's *only* filters are alternative lookup keys with no
pagination alongside them, which isn't the case here.

```ts
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PaymentsService } from './payments.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('finance')
export class FinanceController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('payments')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async createPayment(@CurrentUser() user: CurrentUserDto, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(requireTenantId(user), dto);
  }

  @Get('payments')
  async findPayments(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('studentId') studentId?: string,
  ) {
    return this.paymentsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
      studentId,
    });
  }

  @Post('transactions')
  @Roles('ADMIN', 'MANAGER')
  async createTransaction(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(requireTenantId(user), dto);
  }

  @Get('transactions')
  async findTransactions(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.transactionsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
      type,
    });
  }

  @Get('stats')
  async getStats(@CurrentUser() user: CurrentUserDto) {
    return this.transactionsService.getStats(requireTenantId(user));
  }
}
```

- [ ] **Step 6: Write `services/education-service/src/finance/finance.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { TransactionsService } from './transactions.service';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FinanceController],
  providers: [TransactionsService, PaymentsService, PrismaService],
  exports: [TransactionsService, PaymentsService],
})
export class FinanceModule {}
```

- [ ] **Step 7: Register `FinanceModule` in `app.module.ts`**

Read the current `services/education-service/src/app.module.ts` first (the Attendance plan added
an `AttendanceModule` import — add this plan's import after it):

```ts
import { FinanceModule } from './finance/finance.module';
```

Add `FinanceModule` to the `imports: [` array. Do not remove or reorder anything already there.

- [ ] **Step 8: Verify the whole service builds**

Run: `cd /Users/mac/Documents/smartcity/services/education-service && pnpm exec nest build`
Expected: build succeeds, `dist/main.js` produced, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/education-service/src/finance services/education-service/src/app.module.ts
git commit -m "feat(education-service): add Finance module (payments with atomic ledger entries, transactions)"
```

---

## Task 5: Gateway routing

**Files:**
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`

- [ ] **Step 1: Add the new route**

Read the current `routeMap` first, then add, alongside the existing education-service routes:

```ts
      '/api/finance': educationServiceUrl,
```

- [ ] **Step 2: Verify the gateway still compiles**

Run: `cd /Users/mac/Documents/smartcity/services/gateway && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add services/gateway/src/proxy/proxy.middleware.ts
git commit -m "feat(gateway): route /api/finance to education-service"
```

---

## Task 6: Frontend API hooks

**Files:**
- Create: `apps/education-app/src/lib/finance.ts`

- [ ] **Step 1: Write `apps/education-app/src/lib/finance.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IPayment, IStudent, ITransaction, TransactionType } from '@smartcity/types';
import { apiClient } from './api';

export interface PaymentWithStudent extends IPayment {
  student: IStudent;
}

interface PaymentListResponse {
  data: PaymentWithStudent[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface TransactionListResponse {
  data: ITransaction[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreatePaymentInput {
  studentId: string;
  amount: number;
  method: string;
  notes?: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
}

export interface FinanceStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export function usePayments(page = 1, limit = 20, studentId?: string) {
  return useQuery({
    queryKey: ['finance', 'payments', page, limit, studentId],
    queryFn: () =>
      apiClient<PaymentListResponse>(
        `/finance/payments?page=${page}&limit=${limit}${studentId ? `&studentId=${studentId}` : ''}`,
      ),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePaymentInput) =>
      apiClient<PaymentWithStudent>('/finance/payments', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'stats'] });
    },
  });
}

export function useTransactions(page = 1, limit = 20, type?: TransactionType) {
  return useQuery({
    queryKey: ['finance', 'transactions', page, limit, type],
    queryFn: () =>
      apiClient<TransactionListResponse>(
        `/finance/transactions?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`,
      ),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      apiClient<ITransaction>('/finance/transactions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'stats'] });
    },
  });
}

export function useFinanceStats() {
  return useQuery({
    queryKey: ['finance', 'stats'],
    queryFn: () => apiClient<FinanceStats>('/finance/stats'),
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add apps/education-app/src/lib/finance.ts
git commit -m "feat(education-app): add Finance API hooks"
```

---

## Task 7: StatCard green color + sidebar navigation

**Files:**
- Modify: `apps/education-app/src/components/StatCard.tsx`
- Modify: `apps/education-app/src/app/[locale]/(admin)/layout.tsx`

- [ ] **Step 1: Add a `green` color option to `StatCard`**

In `apps/education-app/src/components/StatCard.tsx`, find:

```ts
const colorClasses = {
  sky: 'bg-sky-50 text-sky-600',
  primary: 'bg-primary-50 text-primary-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
} as const;
```

Replace with:

```ts
const colorClasses = {
  sky: 'bg-sky-50 text-sky-600',
  primary: 'bg-primary-50 text-primary-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
  green: 'bg-green-50 text-green-600',
} as const;
```

- [ ] **Step 2: Add the `Wallet` icon import to the sidebar**

In `apps/education-app/src/app/[locale]/(admin)/layout.tsx`, find the `lucide-react` import block
(currently ends with `Presentation, Layers, Calendar`). Add `Wallet` to that same import list — do
not remove any existing icon import.

- [ ] **Step 3: Add a Finance entry to `navItems`**

Find the `navItems` array's last entry (`attendance`) and add a new entry immediately after it,
before the array's closing `];`:

```ts
    {
      href: `/${locale}/finance`,
      label: t('education.finance'),
      icon: Wallet,
      accent: 'text-green-400',
      activeBg: 'bg-green-500/10',
      activeBorder: 'border-green-400',
    },
```

Do not modify or reorder any existing entries.

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add apps/education-app/src/components/StatCard.tsx "apps/education-app/src/app/[locale]/(admin)/layout.tsx"
git commit -m "feat(education-app): add green StatCard color and Finance sidebar navigation"
```

---

## Task 8: Finance page

**Files:**
- Create: `apps/education-app/src/app/[locale]/(admin)/finance/page.tsx`

- [ ] **Step 1: Write `apps/education-app/src/app/[locale]/(admin)/finance/page.tsx`**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { Button, Input, Badge, Modal, Skeleton } from '@smartcity/ui';
import { TransactionType } from '@smartcity/types';
import { useStudents } from '@/lib/students';
import {
  usePayments,
  useCreatePayment,
  useTransactions,
  useCreateTransaction,
  useFinanceStats,
} from '@/lib/finance';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';

const TRANSACTION_TYPE_VARIANT: Record<string, 'success' | 'error'> = {
  INCOME: 'success',
  EXPENSE: 'error',
};

const TRANSACTION_TYPE_LABEL_KEY: Record<string, string> = {
  INCOME: 'education.typeIncome',
  EXPENSE: 'education.typeExpense',
};

export default function FinancePage() {
  const { t } = useTranslation();
  const { data: stats } = useFinanceStats();
  const { data: paymentsData, isLoading: isLoadingPayments } = usePayments();
  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions();
  const { data: studentsData } = useStudents(1, 100);

  const createPayment = useCreatePayment();
  const createTransaction = useCreateTransaction();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStudentId, setPaymentStudentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionCategory, setTransactionCategory] = useState('');
  const [transactionDescription, setTransactionDescription] = useState('');
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const resetPaymentForm = () => {
    setPaymentStudentId('');
    setPaymentAmount('');
    setPaymentMethod('');
    setPaymentNotes('');
    setPaymentError(null);
  };

  const handleCreatePayment = async (event: FormEvent) => {
    event.preventDefault();
    setPaymentError(null);

    try {
      await createPayment.mutateAsync({
        studentId: paymentStudentId,
        amount: Number(paymentAmount),
        method: paymentMethod,
        notes: paymentNotes || undefined,
      });
      resetPaymentForm();
      setIsPaymentModalOpen(false);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const resetTransactionForm = () => {
    setTransactionType(TransactionType.EXPENSE);
    setTransactionAmount('');
    setTransactionCategory('');
    setTransactionDescription('');
    setTransactionError(null);
  };

  const handleCreateTransaction = async (event: FormEvent) => {
    event.preventDefault();
    setTransactionError(null);

    try {
      await createTransaction.mutateAsync({
        type: transactionType,
        amount: Number(transactionAmount),
        category: transactionCategory,
        description: transactionDescription || undefined,
      });
      resetTransactionForm();
      setIsTransactionModalOpen(false);
    } catch (err) {
      setTransactionError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const payments = paymentsData?.data ?? [];
  const transactions = transactionsData?.data ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.finance')}</h1>
      </div>

      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={TrendingUp}
            color="green"
            label={t('education.totalIncome')}
            value={stats.totalIncome}
          />
          <StatCard
            icon={TrendingDown}
            color="rose"
            label={t('education.totalExpenses')}
            value={stats.totalExpense}
          />
          <StatCard
            icon={Scale}
            color="primary"
            label={t('education.balance')}
            value={stats.balance}
          />
        </div>
      )}

      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('education.payments')}</h2>
          <Button onClick={() => setIsPaymentModalOpen(true)}>{t('education.addPayment')}</Button>
        </div>

        {isLoadingPayments && <Skeleton height="4rem" />}

        {!isLoadingPayments && payments.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noPaymentsYet')}</p>
        )}

        {!isLoadingPayments && payments.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.paymentStudent')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.paymentAmount')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.paymentMethod')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.selectDate')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-3 text-gray-900">
                      {payment.student.firstName} {payment.student.lastName}
                    </td>
                    <td className="p-3 text-gray-600">{payment.amount}</td>
                    <td className="p-3 text-gray-600">{payment.method}</td>
                    <td className="p-3 text-gray-600">
                      {new Date(payment.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('education.transactions')}</h2>
          <Button onClick={() => setIsTransactionModalOpen(true)}>
            {t('education.addTransaction')}
          </Button>
        </div>

        {isLoadingTransactions && <Skeleton height="4rem" />}

        {!isLoadingTransactions && transactions.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noTransactionsYet')}</p>
        )}

        {!isLoadingTransactions && transactions.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.transactionType')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.transactionCategory')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.transactionAmount')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.selectDate')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-3">
                      <Badge variant={TRANSACTION_TYPE_VARIANT[transaction.type] ?? 'default'}>
                        {t(TRANSACTION_TYPE_LABEL_KEY[transaction.type] ?? transaction.type)}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-600">{transaction.category}</td>
                    <td className="p-3 text-gray-600">{transaction.amount}</td>
                    <td className="p-3 text-gray-600">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={t('education.addPayment')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreatePayment} loading={createPayment.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreatePayment} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.paymentStudent')}
            </label>
            <select
              value={paymentStudentId}
              onChange={(e) => setPaymentStudentId(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {(studentsData?.data ?? []).map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName} ({student.registrationNumber})
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t('education.paymentAmount')}
            type="number"
            min="0.01"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
          />
          <Input
            label={t('education.paymentMethod')}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            required
          />
          <Input
            label={t('education.paymentNotes')}
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
          />
          {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
        </form>
      </Modal>

      <Modal
        open={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        title={t('education.addTransaction')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTransactionModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateTransaction} loading={createTransaction.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTransaction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.transactionType')}
            </label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as TransactionType)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={TransactionType.EXPENSE}>{t('education.typeExpense')}</option>
              <option value={TransactionType.INCOME}>{t('education.typeIncome')}</option>
            </select>
          </div>
          <Input
            label={t('education.transactionAmount')}
            type="number"
            min="0.01"
            step="0.01"
            value={transactionAmount}
            onChange={(e) => setTransactionAmount(e.target.value)}
            required
          />
          <Input
            label={t('education.transactionCategory')}
            value={transactionCategory}
            onChange={(e) => setTransactionCategory(e.target.value)}
            required
          />
          <Input
            label={t('education.transactionDescription')}
            value={transactionDescription}
            onChange={(e) => setTransactionDescription(e.target.value)}
          />
          {transactionError && <p className="text-sm text-red-600">{transactionError}</p>}
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verify the whole app builds**

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd /Users/mac/Documents/smartcity/apps/education-app && pnpm exec next build`
Expected: build succeeds, route table includes `/[locale]/finance`.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/smartcity
git add "apps/education-app/src/app/[locale]/(admin)/finance"
git commit -m "feat(education-app): add Finance page with payments and transactions"
```

---

## Task 9: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend and frontend**

Run: `cd /Users/mac/Documents/smartcity && pnpm dev:education` (plus `user-service`, `gateway`,
and a local `redis-server` running, as set up in prior Education testing sessions).

- [ ] **Step 2: Log in and create a payment via curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test-education.local","password":"TestEdu123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

STUDENT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/students \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT_ID\",\"amount\":500,\"method\":\"Cash\",\"notes\":\"September tuition\"}" \
  http://localhost:3004/finance/payments
```

Expected: JSON response with the created payment, including a nested `student` object and a
`transactionId` field.

- [ ] **Step 3: Verify the linked transaction was created atomically**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3004/finance/transactions?limit=5"
```

Expected: the most recent transaction has `type: "INCOME"`, `category: "Tuition Payment"`,
`amount: 500`, and its `description` mentions the student's name and "Cash".

- [ ] **Step 4: Verify stats**

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/finance/stats
```

Expected: `totalIncome` includes the 500 just added, `balance` reflects `totalIncome -
totalExpense`.

- [ ] **Step 5: Add a manual expense transaction**

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"EXPENSE","amount":150,"category":"Utilities","description":"Electricity bill"}' \
  http://localhost:3004/finance/transactions
```

Expected: JSON response with the created expense transaction — confirm re-checking `/finance/stats`
now shows `totalExpense` including 150 and `balance` reduced accordingly.

- [ ] **Step 6: Verify the UI end-to-end in the browser**

Open `http://localhost:3103/fr/login`, log in, confirm "Finance" appears in the sidebar with a
green accent. Open it, confirm the three stat cards show the totals matching Step 4/5's curl
results, and both the Payments and Transactions tables show the rows just created. Click "Ajouter
un paiement", fill the form for a different amount, save, and confirm the new payment appears in
the table and the stat cards update. Click "Ajouter une transaction", add another expense, save,
confirm it appears with a red "Dépense" badge.

- [ ] **Step 7: Report results**

No commit for this task — it's verification only. If any step fails, fix the underlying code in
the relevant earlier task and re-commit there, then re-run this task's steps.
