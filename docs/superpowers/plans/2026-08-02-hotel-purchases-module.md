# Hotel Purchases Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-line `Purchase`/`PurchaseItem` tracking to `finance-service`, where marking a purchase `RECEIVED` atomically restocks every line item and posts one consolidated `Expense` — the integration point between the already-built Stock and Expenses sub-projects.

**Architecture:** A new `purchases` module inside the existing `finance-service` (port 3008), following the exact tenant/hotel-scoping pattern used by `expenses` and `stock-items`. The "receive" action builds a single raw Prisma `$transaction` array combining `stockItem.update` + `stockMovement.create` (per line item) + one `expense.create` + the `purchase.update` itself — the same "build the whole operations array, run one transaction" pattern already used in `tourism-service`'s order-creation stock deduction (Stock module, Task 4).

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB, `$transaction`), class-validator DTOs including nested-array validation (`@ValidateNested`, `class-transformer`'s `@Type`).

**Testing approach:** Same as every prior sub-project in this codebase — zero automated tests exist; verification is `npx nest build` plus manual curl against a running stack (final task). Don't introduce a test framework.

---

## Reference material (read before starting)

- `docs/superpowers/specs/2026-08-02-hotel-purchases-module-design.md` — the spec this plan implements.
- `services/finance-service/src/expenses/**` and `services/finance-service/src/stock-items/**` — the two existing modules this one integrates with and mirrors structurally.
- `services/tourism-service/src/orders/orders.service.ts`'s `create` method — the reference pattern for "build a raw operations array, run one `$transaction`, catch `P2025` for a clean 404 if a referenced record vanishes mid-transaction" (a lesson learned and fixed during the Stock module's Task 4 review — apply it proactively here instead of waiting for a review round-trip).

---

### Task 1: Prisma schema — `Purchase`, `PurchaseItem`, `PurchaseStatus`

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add the enum and two models**

Add anywhere in the file (end of file is fine, consistent with prior sub-projects):

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

  @@map("purchases")
}

model PurchaseItem {
  id          String @id @default(auto()) @map("_id") @db.ObjectId
  purchaseId  String @db.ObjectId
  stockItemId String @db.ObjectId
  quantity    Int
  unitCost    Float

  purchase  Purchase  @relation(fields: [purchaseId], references: [id])
  stockItem StockItem @relation(fields: [stockItemId], references: [id])

  @@map("purchase_items")
}
```

- [ ] **Step 2: Add back-reference arrays**

Read each model's current relations block first (they were last modified by the Stock module — `Tenant`/`Hotel` currently end with `stockItems StockItem[]`, `ExpenseCategory` currently has no back-references beyond its own fields, `StockItem` currently ends with `movements StockMovement[]`).

Add `purchases Purchase[]` to `Tenant`'s relations block, after `stockItems`.

Add `purchases Purchase[]` to `Hotel`'s relations block, after `stockItems`.

Find the `ExpenseCategory` model (created during the Expenses sub-project). It currently reads:

```prisma
model ExpenseCategory {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String   @db.ObjectId
  name      String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())

  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  expenses Expense[]

  @@unique([tenantId, name])
  @@map("expense_categories")
}
```

Add `purchases Purchase[]` after `expenses Expense[]`:

```prisma
  tenant    Tenant     @relation(fields: [tenantId], references: [id])
  expenses  Expense[]
  purchases Purchase[]
```

(Note the realignment of the `tenant`/`expenses` column spacing to accommodate the longer `purchases` line — match whatever `prisma format`/existing column-alignment convention produces; if unsure, run `npx prisma format` on the schema file after editing, which is safe and matches this project's existing formatting style throughout the file.)

Add `purchaseItems PurchaseItem[]` to `StockItem`'s relations block, after `movements`.

- [ ] **Step 3: Generate and push**

```bash
pnpm db:generate
```

Expected: `✔ Generated Prisma Client`, no validation errors (a relation-pairing error means a back-reference array was missed in Step 2).

```bash
pnpm db:push
```

Expected: sync success message, talking to the same MongoDB Atlas cluster every other service uses.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add Purchase/PurchaseItem models"
```

---

### Task 2: `purchases` module — create, list, detail (no receive/cancel yet)

**Files:**
- Create: `services/finance-service/src/purchases/dto/create-purchase-item.dto.ts`
- Create: `services/finance-service/src/purchases/dto/create-purchase.dto.ts`
- Create: `services/finance-service/src/purchases/dto/search-purchase.dto.ts`
- Create: `services/finance-service/src/purchases/purchases.service.ts`
- Create: `services/finance-service/src/purchases/purchases.controller.ts`
- Create: `services/finance-service/src/purchases/purchases.module.ts`
- Modify: `services/finance-service/src/app.module.ts`

- [ ] **Step 1: `dto/create-purchase-item.dto.ts`**

```ts
import { IsInt, IsMongoId, IsNumber, Min } from 'class-validator';

export class CreatePurchaseItemDto {
  @IsMongoId()
  stockItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitCost: number;
}
```

- [ ] **Step 2: `dto/create-purchase.dto.ts`**

```ts
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePurchaseItemDto } from './create-purchase-item.dto';

export class CreatePurchaseDto {
  @IsMongoId()
  hotelId: string;

  @IsString()
  @IsNotEmpty()
  vendorName: string;

  @IsMongoId()
  categoryId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];
}
```

`@ValidateNested({ each: true })` + `@Type(() => CreatePurchaseItemDto)` is required for `class-validator`/`class-transformer` to recursively validate each array element against `CreatePurchaseItemDto`'s own decorators — without `@Type`, the plain JSON objects in `items` never get transformed into class instances, so their `@IsMongoId()`/`@IsInt()`/etc. decorators would silently never run.

- [ ] **Step 3: `dto/search-purchase.dto.ts`**

```ts
import { IsIn, IsInt, IsMongoId, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPurchaseDto {
  @IsMongoId()
  @IsOptional()
  hotelId?: string;

  @IsIn(['PENDING', 'RECEIVED', 'CANCELLED'])
  @IsOptional()
  status?: 'PENDING' | 'RECEIVED' | 'CANCELLED';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
```

- [ ] **Step 4: `purchases.service.ts`**

```ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { SearchPurchaseDto } from './dto/search-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createdById: string, dto: CreatePurchaseDto) {
    await this.assertHotelOwnership(tenantId, dto.hotelId);
    await this.assertCategoryOwnership(tenantId, dto.categoryId);
    for (const item of dto.items) {
      await this.assertStockItemInHotel(tenantId, dto.hotelId, item.stockItemId);
    }

    const totalCost = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );
    const currency = await this.getTenantCurrency(tenantId);

    return this.prisma.purchase.create({
      data: {
        tenantId,
        hotelId: dto.hotelId,
        vendorName: dto.vendorName,
        categoryId: dto.categoryId,
        totalCost,
        currency,
        createdById,
        items: {
          create: dto.items.map((item) => ({
            stockItemId: item.stockItemId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      },
      include: { items: true },
    });
  }

  async findAll(tenantId: string, query: SearchPurchaseDto) {
    const { hotelId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (hotelId) where.hotelId = hotelId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    return this.findOwned(tenantId, id);
  }

  async findOwned(tenantId: string, id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    if (purchase.tenantId !== tenantId) {
      throw new ForbiddenException('You do not have access to this purchase');
    }
    return purchase;
  }

  private async assertHotelOwnership(tenantId: string, hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.tenantId !== tenantId) {
      throw new NotFoundException('Hotel not found');
    }
  }

  private async assertCategoryOwnership(tenantId: string, categoryId: string) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.tenantId !== tenantId) {
      throw new NotFoundException('Category not found');
    }
  }

  private async assertStockItemInHotel(
    tenantId: string,
    hotelId: string,
    stockItemId: string,
  ) {
    const item = await this.prisma.stockItem.findUnique({
      where: { id: stockItemId },
    });
    if (!item || item.tenantId !== tenantId || item.hotelId !== hotelId) {
      throw new NotFoundException(
        `Stock item ${stockItemId} not found for this hotel`,
      );
    }
  }

  private async getTenantCurrency(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { currency: true },
    });
    return tenant?.currency || 'MAD';
  }
}
```

`findOwned` is public (not `private`) — same reasoning as `stock-items.service.ts`'s `findOwned`: Task 3 (not this task) will extend this same service with an `updateStatus` method that needs to look up the purchase with the same ownership check; no separate service is being introduced here, so this is really just "public because it's called by another method added later in the same class" rather than a cross-service concern, but keeping it public from the start avoids a diff in Task 3.

- [ ] **Step 5: `purchases.controller.ts`**

```ts
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { SearchPurchaseDto } from './dto/search-purchase.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.create(user.tenantId, user.userId, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findAll(@Query() query: SearchPurchaseDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.findOne(user.tenantId, id);
  }
}
```

(Task 3, not this task, adds a `PATCH :id/status` route to this same controller — don't add it now.)

- [ ] **Step 6: `purchases.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, PrismaService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
```

- [ ] **Step 7: Register in `app.module.ts`**

Read the current file first — it currently imports `AuthModule`, `ExpenseCategoriesModule`, `ExpensesModule`, `StockItemsModule`, `HealthModule`. Add the import and include `PurchasesModule` in the array (position doesn't matter, e.g. after `StockItemsModule`):

```ts
import { PurchasesModule } from './purchases/purchases.module';
```

- [ ] **Step 8: Build and verify**

```bash
cd services/finance-service && npx nest build && cd ../..
```

Expected: builds cleanly — no forward references to not-yet-created code in this task.

- [ ] **Step 9: Commit**

```bash
git add services/finance-service/src/purchases services/finance-service/src/app.module.ts
git commit -m "feat(finance-service): add purchases create/list/detail"
```

---

### Task 3: Receiving a purchase — atomic restock + expense

**Files:**
- Create: `services/finance-service/src/purchases/dto/update-purchase-status.dto.ts`
- Modify: `services/finance-service/src/purchases/purchases.service.ts`
- Modify: `services/finance-service/src/purchases/purchases.controller.ts`

- [ ] **Step 1: `dto/update-purchase-status.dto.ts`**

```ts
import { IsIn } from 'class-validator';

export class UpdatePurchaseStatusDto {
  @IsIn(['RECEIVED', 'CANCELLED'])
  status: 'RECEIVED' | 'CANCELLED';
}
```

- [ ] **Step 2: Add `updateStatus` to `purchases.service.ts`**

Read the current file first (from Task 2). Add the import `Prisma` from `@prisma/client` and `BadRequestException` to the existing `@nestjs/common` import line, and `UpdatePurchaseStatusDto`. The top of the file becomes:

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseStatusDto } from './dto/update-purchase-status.dto';
import { SearchPurchaseDto } from './dto/search-purchase.dto';
```

Then add this new method to the `PurchasesService` class — place it after `findOwned` (or anywhere in the class, e.g. right after `findOne`):

```ts
  async updateStatus(
    tenantId: string,
    id: string,
    createdById: string,
    dto: UpdatePurchaseStatusDto,
  ) {
    const purchase = await this.findOwned(tenantId, id);

    if (purchase.status !== 'PENDING') {
      throw new BadRequestException(
        `Purchase is already ${purchase.status} and cannot be changed`,
      );
    }

    if (dto.status === 'CANCELLED') {
      return this.prisma.purchase.update({
        where: { id: purchase.id },
        data: { status: 'CANCELLED' },
        include: { items: true },
      });
    }

    const operations: any[] = [
      this.prisma.purchase.update({
        where: { id: purchase.id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
        include: { items: true },
      }),
      this.prisma.expense.create({
        data: {
          tenantId,
          hotelId: purchase.hotelId,
          categoryId: purchase.categoryId,
          amount: purchase.totalCost,
          currency: purchase.currency,
          description: `Purchase from ${purchase.vendorName}`,
          date: new Date(),
          createdById,
        },
      }),
    ];

    for (const item of purchase.items) {
      operations.push(
        this.prisma.stockItem.update({
          where: { id: item.stockItemId },
          data: { quantity: { increment: item.quantity } },
        }),
        this.prisma.stockMovement.create({
          data: {
            itemId: item.stockItemId,
            type: 'RESTOCK',
            quantityChange: item.quantity,
            reason: `Received purchase from ${purchase.vendorName}`,
            createdById,
          },
        }),
      );
    }

    try {
      const [updatedPurchase] = await this.prisma.$transaction(operations);
      return updatedPurchase;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          'A stock item referenced by this purchase no longer exists',
        );
      }
      throw error;
    }
  }
```

The `P2025` catch handles the same class of race condition fixed in the Stock module (Task 4's `d85c57a`): if a `StockItem` referenced by this purchase's line items is deleted between the purchase's creation and it being marked received, the `stockItem.update` inside the transaction fails with `P2025`, which would otherwise surface as an opaque 500 — this maps it to a clean 404 instead. The whole transaction (including the `Expense` and the `Purchase` status flip) correctly rolls back in that case, so no partial state is left behind.

- [ ] **Step 3: Add the route to `purchases.controller.ts`**

Read the current file first (from Task 2). Add the import for `UpdatePurchaseStatusDto`, add `Patch` to the `@nestjs/common` import list, and add one new route. The full updated file:

```ts
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseStatusDto } from './dto/update-purchase-status.dto';
import { SearchPurchaseDto } from './dto/search-purchase.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.create(user.tenantId, user.userId, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findAll(@Query() query: SearchPurchaseDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.findOne(user.tenantId, id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseStatusDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.updateStatus(user.tenantId, id, user.userId, dto);
  }
}
```

- [ ] **Step 4: Build and verify**

```bash
cd services/finance-service && npx nest build && cd ../..
```

Expected: builds cleanly.

- [ ] **Step 5: Commit**

```bash
git add services/finance-service/src/purchases
git commit -m "feat(finance-service): receiving a purchase atomically restocks items and posts an expense"
```

---

### Task 4: Gateway routing

**Files:**
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`

- [ ] **Step 1: Add the route map entry**

Read the current file first — it already has a `financeServiceUrl` const and route-map entries for `/api/expenses`, `/api/expense-categories`, `/api/stock-items`. Add one more line right after those:

```ts
      '/api/purchases': financeServiceUrl,
```

No new env vars, `.env.example` entries, or `package.json` build-filter changes needed — `finance-service` is already fully wired for those.

- [ ] **Step 2: Rebuild and verify**

```bash
cd services/gateway && npx nest build && cd ../..
```

Expected: builds cleanly.

- [ ] **Step 3: Commit**

```bash
git add services/gateway/src/proxy/proxy.middleware.ts
git commit -m "feat(gateway): route /api/purchases to finance-service"
```

---

### Task 5: End-to-end manual verification

No code changes unless a genuine bug is found — proves the feature works end-to-end, same style as the prior two sub-projects' final verification tasks.

**Prerequisites:** `user-service`, `tourism-service`, `finance-service`, `gateway` running locally, Redis running (`redis-cli ping` to check, `redis-server --daemonize yes --port 6379` if not).

- [ ] **Step 1: Log in as `manager@smartcity.ma` / `Manager123!`**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@smartcity.ma","password":"Manager123!"}' | tee /tmp/login.json
TOKEN=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/login.json")).accessToken')
```

- [ ] **Step 2: Find a hotel and an expense category for this tenant**

```bash
curl -s http://localhost:3000/api/hotels -H "Authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].id'
```

Call the result `$HOTEL_ID`.

```bash
curl -s http://localhost:3000/api/expense-categories -H "Authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].id'
```

Call the result `$CATEGORY_ID` (this also confirms the Expenses module's lazy category seeding still works, unaffected by this feature).

- [ ] **Step 3: Create two stock items to purchase**

```bash
curl -s -X POST http://localhost:3000/api/stock-items \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"hotelId\":\"$HOTEL_ID\",\"name\":\"Towels\",\"unit\":\"piece\",\"quantity\":0}" | tee /tmp/item1.json
ITEM1_ID=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/item1.json")).id')

curl -s -X POST http://localhost:3000/api/stock-items \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"hotelId\":\"$HOTEL_ID\",\"name\":\"Soap\",\"unit\":\"bar\",\"quantity\":0}" | tee /tmp/item2.json
ITEM2_ID=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/item2.json")).id')
```

Expected: both `201`, `quantity: 0`.

- [ ] **Step 4: Create a multi-line purchase**

```bash
curl -s -X POST http://localhost:3000/api/purchases \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"hotelId\":\"$HOTEL_ID\",\"vendorName\":\"Linen Supply Co\",\"categoryId\":\"$CATEGORY_ID\",\"items\":[{\"stockItemId\":\"$ITEM1_ID\",\"quantity\":50,\"unitCost\":8},{\"stockItemId\":\"$ITEM2_ID\",\"quantity\":100,\"unitCost\":2}]}" | tee /tmp/purchase.json
PURCHASE_ID=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/purchase.json")).id')
```

Expected: `201`, `status: "PENDING"`, `totalCost: 600` (50×8 + 100×2 = 400+200), `currency` populated, 2 items in the response's `items` array. `totalCost` isn't a field on `CreatePurchaseDto` at all, so it's always server-computed — there's nothing a client could send to override it; the global `ValidationPipe`'s `forbidNonWhitelisted: true` (set in `main.ts`, same as every other DTO in this service) would reject the whole request with a 400 if a client tried to include an unrecognized `totalCost` field in the body, rather than silently accepting and ignoring it. No separate test needed for this — it's structurally impossible to override.

- [ ] **Step 5: Confirm stock is untouched while PENDING**

```bash
curl -s "http://localhost:3000/api/stock-items/$ITEM1_ID" -H "Authorization: Bearer $TOKEN"
```

Expected: `quantity: 0` still (unchanged — purchase hasn't been received yet).

- [ ] **Step 6: Receive the purchase**

```bash
curl -s -X PATCH "http://localhost:3000/api/purchases/$PURCHASE_ID/status" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"RECEIVED"}'
```

Expected: `200`, `status: "RECEIVED"`, `receivedAt` populated.

- [ ] **Step 7: Confirm both stock items were restocked**

```bash
curl -s "http://localhost:3000/api/stock-items/$ITEM1_ID" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/stock-items/$ITEM2_ID" -H "Authorization: Bearer $TOKEN"
```

Expected: `quantity: 50` and `quantity: 100` respectively.

```bash
curl -s "http://localhost:3000/api/stock-items/$ITEM1_ID/movements" -H "Authorization: Bearer $TOKEN"
```

Expected: one `RESTOCK` movement, `quantityChange: 50`.

- [ ] **Step 8: Confirm exactly one expense was posted**

```bash
curl -s "http://localhost:3000/api/expenses/summary?month=$(date -u +%Y-%m)" -H "Authorization: Bearer $TOKEN"
```

Expected: `total` includes `600` attributed to `$CATEGORY_ID` (may include other amounts if run after prior sub-projects' verification left data behind — just confirm the category total increased by exactly 600 from whatever it was before Step 6).

- [ ] **Step 9: Confirm a received purchase can't be received or cancelled again**

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:3000/api/purchases/$PURCHASE_ID/status" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"CANCELLED"}'
```

Expected: `400`.

- [ ] **Step 10: Confirm role rejection**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"guest@smartcity.ma","password":"Guest123!"}' | tee /tmp/guest-login.json
GUEST_TOKEN=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/guest-login.json")).accessToken')
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3000/api/purchases -H "Authorization: Bearer $GUEST_TOKEN"
```

Expected: `403`.

- [ ] **Step 11: Confirm cross-hotel `stockItemId` rejection**

Create a purchase where `items` references a `stockItemId` from a different hotel than `hotelId` (if a second hotel exists for this tenant; otherwise use a stock item id from a genuinely different tenant if one is available from prior sub-projects' verification, or skip with a one-line reason if neither is available):

```bash
curl -s -X POST http://localhost:3000/api/purchases \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"hotelId\":\"$HOTEL_ID\",\"vendorName\":\"Test\",\"categoryId\":\"$CATEGORY_ID\",\"items\":[{\"stockItemId\":\"<item-from-another-hotel>\",\"quantity\":1,\"unitCost\":1}]}"
```

Expected: `404 Not Found`.

- [ ] **Step 12: Record the result and stop services**

If Steps 4-10 pass (Step 11 may be a legitimate skip), the module is verified. Kill background service processes you started (`pkill -f "dist/main.js"`, being careful only to kill what you started). No commit needed unless a real bug was found and fixed.

---

## Explicitly out of scope for this plan (per the spec)

- Vendor directory/tracking beyond a free-text `vendorName`.
- Partial receipts (receiving only some line items of a purchase).
- Approval workflow before a purchase can be marked received.
- Receipt/invoice photo attachments.
- Price comparison tooling.
- Any frontend admin UI page.
