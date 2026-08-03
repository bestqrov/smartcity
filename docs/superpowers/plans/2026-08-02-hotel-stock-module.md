# Hotel Stock/Inventory Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-hotel stock/inventory tracking (`StockItem` + audit-trailed `StockMovement`) to `finance-service`, with automatic deduction when a `tourism-service` minibar/room-service order (`ServiceOrder`) references a tracked item.

**Architecture:** A new `stock-items` NestJS module inside the existing `finance-service` (port 3008), following the exact tenant/hotel-scoping and controller/service/DTO pattern already used by the `expenses` module. `ServiceOrder` (owned by `tourism-service`) gets an optional `itemId` field; `tourism-service`'s `orders.service.ts` reads/writes `StockItem`/`StockMovement` directly via the same shared Prisma client both services already use — no HTTP call between services, matching the precedent set by `finance-service`'s own cross-domain reads of `Hotel`/`Tenant`.

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB, using `$transaction` for atomic stock+movement writes — safe here because the project's MongoDB Atlas cluster is a proper replica set, a requirement Prisma transactions depend on and which this project already relies on elsewhere), class-validator DTOs.

**Testing approach:** Same as the Expenses module — this repo has zero automated tests anywhere; verification is `npx nest build` plus manual curl against a running stack (Task 6). Don't introduce a test framework.

---

## Reference material (read before starting)

- `docs/superpowers/specs/2026-08-02-hotel-stock-module-design.md` — the full spec this plan implements.
- `services/finance-service/src/expenses/**` — the module this one mirrors almost exactly (DTOs, service structure, controller guard-clause pattern, `assertHotelOwnership`-style ownership checks). Where this plan says "follow the same pattern as expenses", that directory is the reference.
- `services/tourism-service/src/orders/**` — the existing minibar/room-service order flow this plan extends (Task 4 only).
- `packages/database/prisma/schema.prisma` — current state already has `ExpenseCategory`, `Expense`, `ACCOUNTANT` role, and their relations (from the Expenses module). This plan adds `StockItem`, `StockMovement`, and a new field on the existing `ServiceOrder` model.

---

### Task 1: Prisma schema — `StockItem`, `StockMovement`, `ServiceOrder.itemId`

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add the two new models**

Add these two models anywhere in the file (end of file is fine, consistent with how `Expense`/`ExpenseCategory` were added):

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

  tenant    Tenant          @relation(fields: [tenantId], references: [id])
  hotel     Hotel           @relation(fields: [hotelId], references: [id])
  movements StockMovement[]

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

- [ ] **Step 2: Add `itemId` to the existing `ServiceOrder` model**

Find the `ServiceOrder` model (currently around line 259):

```prisma
model ServiceOrder {
  id          String      @id @default(auto()) @map("_id") @db.ObjectId
  bookingId   String      @db.ObjectId
  type        String
  description String?
  quantity    Int
  price       Float
  status      OrderStatus @default(PENDING)
  rating      Int?
  ratedAt     DateTime?
  createdAt   DateTime    @default(now())

  booking Booking @relation(fields: [bookingId], references: [id])

  @@map("service_orders")
}
```

Add one new optional scalar field `itemId` (no relation — `ServiceOrder` doesn't need to `include` the stock item, `tourism-service`'s code will just compare/use the raw id, same reasoning as `Expense.createdById` having no relation):

```prisma
model ServiceOrder {
  id          String      @id @default(auto()) @map("_id") @db.ObjectId
  bookingId   String      @db.ObjectId
  itemId      String?     @db.ObjectId
  type        String
  description String?
  quantity    Int
  price       Float
  status      OrderStatus @default(PENDING)
  rating      Int?
  ratedAt     DateTime?
  createdAt   DateTime    @default(now())

  booking Booking @relation(fields: [bookingId], references: [id])

  @@map("service_orders")
}
```

- [ ] **Step 3: Add back-reference arrays on `Tenant` and `Hotel`**

In the `Tenant` model, find the relations block (currently ends with `expenses Expense[]`):

```prisma
  users             User[]
  hotels            Hotel[]
  subscription      Subscription?
  activities        Activity[]
  restaurants       Restaurant[]
  expenseCategories ExpenseCategory[]
  expenses          Expense[]
```

Add `stockItems StockItem[]` after `expenses`:

```prisma
  users             User[]
  hotels            Hotel[]
  subscription      Subscription?
  activities        Activity[]
  restaurants       Restaurant[]
  expenseCategories ExpenseCategory[]
  expenses          Expense[]
  stockItems        StockItem[]
```

In the `Hotel` model, find the relations block (currently ends with `expenses Expense[]`):

```prisma
  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  rooms       Room[]
  bookings    Booking[]
  reviews     Review[]
  activities  Activity[]
  restaurants Restaurant[]
  expenses    Expense[]
```

Add `stockItems StockItem[]`:

```prisma
  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  rooms       Room[]
  bookings    Booking[]
  reviews     Review[]
  activities  Activity[]
  restaurants Restaurant[]
  expenses    Expense[]
  stockItems  StockItem[]
```

(Read the actual current file first to confirm exact current spacing/alignment before editing — the plan's excerpts are accurate as of the last commit on this branch, but re-verify.)

- [ ] **Step 4: Generate and push**

```bash
pnpm db:generate
```

Expected: `✔ Generated Prisma Client`, no validation errors (if there's a relation-pairing error, it means Step 3 was missed for one of `Tenant`/`Hotel`/`StockItem` — fix before continuing).

```bash
pnpm db:push
```

Expected: `The database is now in sync with your Prisma schema` (or "already in sync" for the `ServiceOrder.itemId` part, since it's a new optional field with no default — MongoDB doesn't need a migration for that, existing documents just won't have the field until set).

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add StockItem/StockMovement models and ServiceOrder.itemId"
```

---

### Task 2: `stock-items` module — CRUD (no movements yet)

**Files:**
- Create: `services/finance-service/src/stock-items/dto/create-stock-item.dto.ts`
- Create: `services/finance-service/src/stock-items/dto/update-stock-item.dto.ts`
- Create: `services/finance-service/src/stock-items/dto/search-stock-item.dto.ts`
- Create: `services/finance-service/src/stock-items/stock-items.service.ts`
- Create: `services/finance-service/src/stock-items/stock-items.controller.ts`
- Create: `services/finance-service/src/stock-items/stock-items.module.ts`
- Modify: `services/finance-service/src/app.module.ts`

- [ ] **Step 1: `dto/create-stock-item.dto.ts`**

```ts
import {
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStockItemDto {
  @IsMongoId()
  hotelId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  minQuantity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;
}
```

`quantity` is the item's starting count, set directly at creation (not via a `StockMovement` — the audit trail is for changes to an *existing* item, not its initial stocking).

- [ ] **Step 2: `dto/update-stock-item.dto.ts`**

Not a `PartialType(CreateStockItemDto)` — `hotelId` and `quantity` must NOT be editable via this DTO (hotel assignment doesn't change after creation; quantity only changes via recorded movements, per the spec's endpoint table). A standalone class, not derived from `CreateStockItemDto`:

```ts
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateStockItemDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  minQuantity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;
}
```

- [ ] **Step 3: `dto/search-stock-item.dto.ts`**

```ts
import { IsInt, IsMongoId, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchStockItemDto {
  @IsMongoId()
  @IsOptional()
  hotelId?: string;

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

- [ ] **Step 4: `stock-items.service.ts`**

```ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { SearchStockItemDto } from './dto/search-stock-item.dto';

@Injectable()
export class StockItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateStockItemDto) {
    await this.assertHotelOwnership(tenantId, dto.hotelId);

    const item = await this.prisma.stockItem.create({
      data: {
        tenantId,
        hotelId: dto.hotelId,
        name: dto.name,
        unit: dto.unit,
        quantity: dto.quantity ?? 0,
        minQuantity: dto.minQuantity ?? 0,
        costPrice: dto.costPrice,
      },
    });
    return this.withIsLow(item);
  }

  async findAll(tenantId: string, query: SearchStockItemDto) {
    const { hotelId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (hotelId) where.hotelId = hotelId;

    const [data, total] = await Promise.all([
      this.prisma.stockItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.stockItem.count({ where }),
    ]);

    return {
      data: data.map((item) => this.withIsLow(item)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.findOwned(tenantId, id);
    return this.withIsLow(item);
  }

  async update(tenantId: string, id: string, dto: UpdateStockItemDto) {
    const item = await this.findOwned(tenantId, id);

    const updated = await this.prisma.stockItem.update({
      where: { id: item.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.minQuantity !== undefined && { minQuantity: dto.minQuantity }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
      },
    });
    return this.withIsLow(updated);
  }

  async remove(tenantId: string, id: string) {
    const item = await this.findOwned(tenantId, id);

    const hasMovements = await this.prisma.stockMovement.findFirst({
      where: { itemId: item.id },
    });
    if (hasMovements) {
      throw new ConflictException(
        'This item has recorded movements and cannot be deleted',
      );
    }

    return this.prisma.stockItem.delete({ where: { id: item.id } });
  }

  async findOwned(tenantId: string, id: string) {
    const item = await this.prisma.stockItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Stock item not found');
    }
    if (item.tenantId !== tenantId) {
      throw new ForbiddenException('You do not have access to this stock item');
    }
    return item;
  }

  private withIsLow(item: { quantity: number; minQuantity: number }) {
    return { ...item, isLow: item.quantity < item.minQuantity };
  }

  private async assertHotelOwnership(tenantId: string, hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.tenantId !== tenantId) {
      throw new NotFoundException('Hotel not found');
    }
  }
}
```

Note: `findOwned` is deliberately **not** `private` here (unlike the equivalent method in `expenses.service.ts`) — Task 3 adds a sibling `StockMovementsService` that needs to verify item ownership before recording a movement, and it does so by calling `stockItemsService.findOwned(...)` rather than duplicating the ownership-check logic. This is the one intentional deviation from the Expenses module's exact pattern; everything else mirrors it.

- [ ] **Step 5: `stock-items.controller.ts`**

```ts
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { StockItemsService } from './stock-items.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { SearchStockItemDto } from './dto/search-stock-item.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('stock-items')
export class StockItemsController {
  constructor(private readonly stockItemsService: StockItemsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() dto: CreateStockItemDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.create(user.tenantId, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findAll(@Query() query: SearchStockItemDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStockItemDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.remove(user.tenantId, id);
  }
}
```

(Task 3 will add two more routes to this same controller — `POST/GET :id/movements`. Don't add them yet in this task.)

- [ ] **Step 6: `stock-items.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { StockItemsController } from './stock-items.controller';
import { StockItemsService } from './stock-items.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [StockItemsController],
  providers: [StockItemsService, PrismaService],
  exports: [StockItemsService],
})
export class StockItemsModule {}
```

- [ ] **Step 7: Register the module in `app.module.ts`**

Read the current file first (it currently imports `AuthModule`, `ExpenseCategoriesModule`, `ExpensesModule`, `HealthModule`). Add the import and include it in the `@Module({ imports: [...] })` array:

```ts
import { StockItemsModule } from './stock-items/stock-items.module';
```

and add `StockItemsModule` to the imports array (position doesn't matter, e.g. after `ExpensesModule`).

- [ ] **Step 8: Build and verify**

```bash
cd services/finance-service && npx nest build && cd ../..
```

Expected: builds cleanly. Unlike the Expenses module's Task 2/3 split, this task's `app.module.ts` doesn't reference anything not yet created, so this build is expected to succeed now, not later.

- [ ] **Step 9: Commit**

```bash
git add services/finance-service/src/stock-items services/finance-service/src/app.module.ts
git commit -m "feat(finance-service): add stock items CRUD"
```

---

### Task 3: Stock movements (restock/waste/adjustment) with audit trail

**Files:**
- Create: `services/finance-service/src/stock-items/dto/create-stock-movement.dto.ts`
- Create: `services/finance-service/src/stock-items/dto/search-stock-movement.dto.ts`
- Create: `services/finance-service/src/stock-items/stock-movements.service.ts`
- Modify: `services/finance-service/src/stock-items/stock-items.controller.ts`
- Modify: `services/finance-service/src/stock-items/stock-items.module.ts`

- [ ] **Step 1: `dto/create-stock-movement.dto.ts`**

```ts
import { IsIn, IsInt, IsOptional, IsString, NotEquals } from 'class-validator';

export const MANUAL_MOVEMENT_TYPES = ['RESTOCK', 'WASTE', 'ADJUSTMENT'] as const;

export class CreateStockMovementDto {
  @IsIn(MANUAL_MOVEMENT_TYPES)
  type: 'RESTOCK' | 'WASTE' | 'ADJUSTMENT';

  @IsInt()
  @NotEquals(0)
  quantityChange: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
```

`ORDER_DEDUCTION` is deliberately excluded from `MANUAL_MOVEMENT_TYPES` — that type is only ever written by `tourism-service`'s order-creation flow (Task 4), never through this manual endpoint, so staff can't fabricate a fake "order deduction" movement through the stock API.

- [ ] **Step 2: `dto/search-stock-movement.dto.ts`**

```ts
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchStockMovementDto {
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

- [ ] **Step 3: `stock-movements.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StockItemsService } from './stock-items.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { SearchStockMovementDto } from './dto/search-stock-movement.dto';

@Injectable()
export class StockMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockItemsService: StockItemsService,
  ) {}

  async create(
    tenantId: string,
    itemId: string,
    createdById: string,
    dto: CreateStockMovementDto,
  ) {
    const item = await this.stockItemsService.findOwned(tenantId, itemId);

    const [movement] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          itemId: item.id,
          type: dto.type,
          quantityChange: dto.quantityChange,
          reason: dto.reason,
          createdById,
        },
      }),
      this.prisma.stockItem.update({
        where: { id: item.id },
        data: { quantity: { increment: dto.quantityChange } },
      }),
    ]);

    return movement;
  }

  async findAll(tenantId: string, itemId: string, query: SearchStockMovementDto) {
    await this.stockItemsService.findOwned(tenantId, itemId);

    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { itemId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where: { itemId } }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
```

`create`'s `$transaction` array runs both writes atomically — either both the movement record and the quantity change land, or neither does. `quantityChange` can be negative (e.g. `WASTE` with `quantityChange: -3`), and Prisma's `increment` correctly subtracts in that case (`increment: -3` is equivalent to decrementing by 3).

- [ ] **Step 4: Add movement routes to `stock-items.controller.ts`**

Read the current file (from Task 2) first. Add the import and inject the new service, then add two routes. The full updated file:

```ts
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { StockItemsService } from './stock-items.service';
import { StockMovementsService } from './stock-movements.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { SearchStockItemDto } from './dto/search-stock-item.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { SearchStockMovementDto } from './dto/search-stock-movement.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('stock-items')
export class StockItemsController {
  constructor(
    private readonly stockItemsService: StockItemsService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() dto: CreateStockItemDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.create(user.tenantId, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findAll(@Query() query: SearchStockItemDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStockItemDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.remove(user.tenantId, id);
  }

  @Post(':id/movements')
  @Roles('ADMIN', 'MANAGER')
  async createMovement(
    @Param('id') id: string,
    @Body() dto: CreateStockMovementDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockMovementsService.create(user.tenantId, id, user.userId, dto);
  }

  @Get(':id/movements')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findMovements(
    @Param('id') id: string,
    @Query() query: SearchStockMovementDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockMovementsService.findAll(user.tenantId, id, query);
  }
}
```

- [ ] **Step 5: Register `StockMovementsService` in `stock-items.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { StockItemsController } from './stock-items.controller';
import { StockItemsService } from './stock-items.service';
import { StockMovementsService } from './stock-movements.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [StockItemsController],
  providers: [StockItemsService, StockMovementsService, PrismaService],
  exports: [StockItemsService, StockMovementsService],
})
export class StockItemsModule {}
```

- [ ] **Step 6: Build and verify**

```bash
cd services/finance-service && npx nest build && cd ../..
```

Expected: builds cleanly, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add services/finance-service/src/stock-items
git commit -m "feat(finance-service): add stock movements (restock/waste/adjustment) with audit trail"
```

---

### Task 4: `ServiceOrder` auto-deducts stock when `itemId` is set

**Files:**
- Modify: `services/tourism-service/src/orders/dto/create-order.dto.ts`
- Modify: `services/tourism-service/src/orders/orders.service.ts`
- Modify: `services/tourism-service/src/orders/orders.controller.ts`

- [ ] **Step 1: Add `itemId` to `CreateOrderDto`**

Read the current file first (`services/tourism-service/src/orders/dto/create-order.dto.ts`) — the plan's excerpt below shows the field to add; the rest of the file (imports, `OrderStatus` enum, other fields) stays as-is. Note this file uses `@IsString()` for `bookingId` rather than `@IsMongoId()` — match that existing local convention (not `finance-service`'s `@IsMongoId()` style) for consistency within this specific file:

```ts
  @IsString()
  @IsOptional()
  itemId?: string;
```

Add it as a new field in the `CreateOrderDto` class, e.g. right after `bookingId`.

- [ ] **Step 2: Modify `orders.service.ts`'s `create` method**

Read the current file first. The current `create` method:

```ts
  async create(dto: CreateOrderDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Cannot add order to a cancelled booking');
    }

    return this.prisma.serviceOrder.create({
      data: { ...dto, rating: null },
      include: {
        booking: {
          select: { id: true, status: true },
        },
      },
    });
  }
```

Change it to accept a `createdById` parameter and, when `dto.itemId` is set, validate the item belongs to the same hotel as the booking and atomically deduct stock:

```ts
  async create(dto: CreateOrderDto, createdById: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Cannot add order to a cancelled booking');
    }

    const operations: any[] = [
      this.prisma.serviceOrder.create({
        data: { ...dto, rating: null },
        include: {
          booking: {
            select: { id: true, status: true },
          },
        },
      }),
    ];

    if (dto.itemId) {
      const item = await this.prisma.stockItem.findUnique({
        where: { id: dto.itemId },
      });
      if (!item || item.hotelId !== booking.hotelId) {
        throw new NotFoundException('Stock item not found for this hotel');
      }

      operations.push(
        this.prisma.stockItem.update({
          where: { id: dto.itemId },
          data: { quantity: { decrement: dto.quantity } },
        }),
        this.prisma.stockMovement.create({
          data: {
            itemId: dto.itemId,
            type: 'ORDER_DEDUCTION',
            quantityChange: -dto.quantity,
            createdById,
          },
        }),
      );
    }

    const [order] = await this.prisma.$transaction(operations);
    return order;
  }
```

The `item.hotelId !== booking.hotelId` check is a tenant/hotel-ownership guard — without it, a guest could pass any `itemId` (even one belonging to a completely different hotel/tenant) and silently decrement someone else's stock. This mirrors the ownership-check discipline used everywhere else in this codebase (`assertHotelOwnership`, `assertTenantOwnership`), just inlined here since it's a single check in an existing method rather than a new reusable helper.

- [ ] **Step 3: Update the controller call site**

Read the current file first (`services/tourism-service/src/orders/orders.controller.ts`). Find the `create` method:

```ts
  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: CurrentUserDto) {
    const isStaff = STAFF_ROLES.includes(user.role) || user.role === 'SUPER_ADMIN';

    if (!isStaff) {
      const booking = await this.bookingsService.findById(dto.bookingId);
      if (booking.guestId !== user.userId) {
        throw new ForbiddenException('You cannot order for this booking');
      }
    }

    return this.ordersService.create(dto);
  }
```

Change only the final line:

```ts
    return this.ordersService.create(dto, user.userId);
```

- [ ] **Step 4: Build and verify**

```bash
cd services/tourism-service && npx nest build && cd ../..
```

Expected: builds cleanly. If it fails because `this.prisma.stockItem` or `this.prisma.stockMovement` aren't recognized, the Prisma client wasn't regenerated after Task 1 in this shell/environment — re-run `pnpm db:generate` from the repo root and rebuild.

- [ ] **Step 5: Commit**

```bash
git add services/tourism-service/src/orders
git commit -m "feat(tourism-service): auto-deduct stock when a minibar/room-service order references a stock item"
```

---

### Task 5: Gateway routing

**Files:**
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`

- [ ] **Step 1: Add the route map entry**

Read the current file first — it already has a `financeServiceUrl` const (added for the Expenses module) and a `routeMap` entry for `'/api/expenses'`/`'/api/expense-categories'`. Add one more line to the `routeMap` object, right after those:

```ts
      '/api/stock-items': financeServiceUrl,
```

No new env vars, `.env.example` entries, or `package.json` build-filter changes are needed — `finance-service` is already fully wired for those (done in the Expenses module's Task 6). The nested movement routes (`/api/stock-items/:id/movements`) are automatically covered by this same `'/api/stock-items'` prefix match, no separate entry needed.

- [ ] **Step 2: Rebuild and verify**

```bash
cd services/gateway && npx nest build && cd ../..
```

Expected: builds cleanly.

- [ ] **Step 3: Commit**

```bash
git add services/gateway/src/proxy/proxy.middleware.ts
git commit -m "feat(gateway): route /api/stock-items to finance-service"
```

---

### Task 6: End-to-end manual verification

No code changes — proves the feature works end-to-end, same style as the Expenses module's final verification task.

**Prerequisites:** `user-service`, `tourism-service`, `finance-service`, and `gateway` all running locally, plus Redis (the Expenses module's verification found that `user-service` login fails with a raw 500 if Redis isn't running — start it first: `redis-server --daemonize yes --port 6379` if not already running).

- [ ] **Step 1: Log in and get a token for a tenant-linked staff account**

`admin@smartcity.ma` is `SUPER_ADMIN` with no `tenantId` (confirmed during the Expenses module's verification) — use `manager@smartcity.ma` / `Manager123!` instead, same as that verification did:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@smartcity.ma","password":"Manager123!"}' | tee /tmp/login.json
TOKEN=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/login.json")).accessToken')
```

Expected: JSON with `accessToken`.

- [ ] **Step 2: Find a hotel belonging to this tenant**

```bash
curl -s http://localhost:3000/api/hotels -H "Authorization: Bearer $TOKEN" | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)), null, 2)' | head -30
```

Pick one hotel `id` from the response — call it `$HOTEL_ID` for the following steps.

- [ ] **Step 3: Create a stock item**

```bash
curl -s -X POST http://localhost:3000/api/stock-items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"hotelId\":\"$HOTEL_ID\",\"name\":\"Coca-Cola\",\"unit\":\"bottle\",\"quantity\":10,\"minQuantity\":5}" | tee /tmp/item.json
ITEM_ID=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/item.json")).id')
```

Expected: `201`, `quantity: 10`, `minQuantity: 5`, `isLow: false` (10 is not less than 5).

- [ ] **Step 4: Record a manual RESTOCK movement**

```bash
curl -s -X POST "http://localhost:3000/api/stock-items/$ITEM_ID/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"RESTOCK","quantityChange":20,"reason":"Weekly delivery"}'
```

Expected: `201`, the movement row with `quantityChange: 20`. Then confirm the item's quantity updated:

```bash
curl -s "http://localhost:3000/api/stock-items/$ITEM_ID" -H "Authorization: Bearer $TOKEN"
```

Expected: `quantity: 30` (10 + 20).

- [ ] **Step 5: Get a booking for this hotel and create a minibar order that references the stock item**

```bash
curl -s "http://localhost:3000/api/bookings?hotelId=$HOTEL_ID" -H "Authorization: Bearer $TOKEN"
```

If no booking exists for this hotel, create one first via `POST /api/bookings` (check `PROJECT_SUMMARY.md` section 8 for the request shape, or `apps/tourism-app` guest booking flow) — use your judgment, don't spend excessive effort, this is dev/seed data. Once you have a `$BOOKING_ID`:

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"bookingId\":\"$BOOKING_ID\",\"itemId\":\"$ITEM_ID\",\"type\":\"minibar\",\"quantity\":3,\"price\":15}"
```

Expected: `201`, order created.

- [ ] **Step 6: Confirm stock was auto-deducted**

```bash
curl -s "http://localhost:3000/api/stock-items/$ITEM_ID" -H "Authorization: Bearer $TOKEN"
```

Expected: `quantity: 27` (30 - 3).

```bash
curl -s "http://localhost:3000/api/stock-items/$ITEM_ID/movements" -H "Authorization: Bearer $TOKEN"
```

Expected: two movements now — the `RESTOCK` (+20) and an `ORDER_DEDUCTION` (-3).

- [ ] **Step 6b: Regression check — order WITHOUT `itemId` has zero effect on stock**

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"bookingId\":\"$BOOKING_ID\",\"type\":\"towel-request\",\"quantity\":1,\"price\":0}"
curl -s "http://localhost:3000/api/stock-items/$ITEM_ID" -H "Authorization: Bearer $TOKEN"
```

Expected: order created successfully, and the stock item's `quantity` is still `27` (unchanged) — confirms existing order flows that don't reference a stock item are unaffected by this feature.

- [ ] **Step 6c: Confirm deleting a stock item with movements is blocked**

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X DELETE "http://localhost:3000/api/stock-items/$ITEM_ID" -H "Authorization: Bearer $TOKEN"
```

Expected: `409 Conflict` / `"This item has recorded movements and cannot be deleted"` — `$ITEM_ID` has movements from Steps 4 and 6.

- [ ] **Step 7: Confirm role rejection**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"guest@smartcity.ma","password":"Guest123!"}' | tee /tmp/guest-login.json
GUEST_TOKEN=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/guest-login.json")).accessToken')
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3000/api/stock-items -H "Authorization: Bearer $GUEST_TOKEN"
```

Expected: `403`.

- [ ] **Step 8: Confirm cross-tenant/cross-hotel `hotelId` rejection on stock item creation**

Find a hotel belonging to a different tenant (same approach as the Expenses module's Task 7 verification — check `GET /api/hotels` for one whose `tenantId` differs from the manager's own tenant):

```bash
curl -s -X POST http://localhost:3000/api/stock-items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hotelId":"<other-tenant-hotel-id>","name":"Test","unit":"piece"}'
```

Expected: `404 Not Found` / `"Hotel not found"`. If no second-tenant hotel is available in seed data, skip this step and note why (same allowance as the Expenses module's verification).

- [ ] **Step 9: Record the result**

If Steps 3-7 (including 6b/6c) pass (Step 8 may be a legitimate skip), the module is verified. No commit needed for this task.

---

## Explicitly out of scope for this plan (per the spec)

- Push/email low-stock notifications — only the `isLow` boolean in API responses.
- Linking `StockMovement` to `Purchase` records — belongs to the Purchases sub-project (next in the roadmap), not this one.
- Any frontend admin UI page.
- Blocking `ServiceOrder` creation on insufficient stock — explicitly rejected in the spec; `quantity` is allowed to go negative.
