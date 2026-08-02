# Hotel Expenses Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `finance-service` microservice that lets hotel `ADMIN`/`MANAGER`/`ACCOUNTANT` users record and summarize operating expenses, scoped per tenant (and optionally per hotel), with editable categories.

**Architecture:** A new NestJS microservice `services/finance-service` (port 3008), structured identically to the existing `billing-service` (JWT auth guard + roles guard copied verbatim, own `PrismaService` pointed at the shared `@smartcity/database` Prisma client). Two Nest modules inside it: `expense-categories` and `expenses`. The API Gateway proxies `/api/expenses/*` and `/api/expense-categories/*` to it. A new `ACCOUNTANT` role is added to the shared `UserRole` enum.

**Tech Stack:** NestJS 10, Prisma 6 (MongoDB), class-validator DTOs, JWT (passport-jwt) — all matching what `billing-service` already uses.

**Testing approach:** This repo has zero automated tests anywhere (`find services -name "*.spec.ts"` returns nothing) — verification is done by curl against a running service, as documented in recent commit messages (e.g. the bookings tenant-scoping fix). This plan follows that existing convention: each task ends with a manual curl-based verification step, not a new jest suite. Introducing a first-of-its-kind test framework for one module would be inconsistent with how every other module in this codebase is verified.

---

## Reference material (read before starting)

The whole service is a near-copy of `services/billing-service`. Keep that file tree open for comparison:
- `services/billing-service/src/main.ts`, `app.module.ts`
- `services/billing-service/src/auth/**` (copy verbatim, only the class names/comments matter, no billing-specific logic lives there)
- `services/billing-service/src/common/prisma.service.ts` (copy verbatim)
- `services/billing-service/src/health/**` (copy, change the string `'billing-service'` to `'finance-service'`)
- `services/tourism-service/src/bookings/bookings.controller.ts:107-116` — the `assertTenantOwnership` pattern this plan reuses for `hotelId` checks.

---

### Task 1: Add `ACCOUNTANT` role and Prisma models

**Files:**
- Modify: `packages/shared-types/src/user.types.ts`
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add `ACCOUNTANT` to the shared `UserRole` enum**

Open `packages/shared-types/src/user.types.ts`. It currently starts with:

```ts
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
```

Find the rest of the enum values (there will be `ADMIN`, `MANAGER`, `STAFF`, `GUEST` following). Add `ACCOUNTANT` after `STAFF`:

```ts
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  STAFF = "STAFF",
  ACCOUNTANT = "ACCOUNTANT",
  GUEST = "GUEST",
}
```

(Keep whatever ordering/formatting is already there — just insert the `ACCOUNTANT` line in the equivalent spot, tenant-scoped roles grouped together before `GUEST`.)

- [ ] **Step 2: Add `ACCOUNTANT` to the Prisma `UserRole` enum**

In `packages/database/prisma/schema.prisma`, find:

```prisma
enum UserRole {
  SUPER_ADMIN
  ADMIN
  MANAGER
  STAFF
  GUEST
}
```

Change to:

```prisma
enum UserRole {
  SUPER_ADMIN
  ADMIN
  MANAGER
  STAFF
  ACCOUNTANT
  GUEST
}
```

- [ ] **Step 3: Add `ExpenseCategory` and `Expense` models**

In the same file, add these two models right after the `Session` model (end of file is fine too — Prisma doesn't care about model order). Match the existing style (double-spaced alignment isn't required, just valid Prisma):

```prisma
model ExpenseCategory {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String   @db.ObjectId
  name      String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())

  @@map("expense_categories")
}

model Expense {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String   @db.ObjectId
  hotelId     String?  @db.ObjectId
  categoryId  String   @db.ObjectId
  amount      Float
  currency    String
  description String?
  receiptUrl  String?
  date        DateTime
  createdById String   @db.ObjectId
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("expenses")
}
```

(No `@relation` fields — every other cross-entity reference in this schema that crosses a service boundary, e.g. `Booking.hotelId`, is a plain `@db.ObjectId` without a Prisma relation when the referencing service doesn't need to `include` the related model. `finance-service` will never join against `Hotel`/`Tenant` directly, it only compares string IDs, matching how `tourism-service` already treats `Booking.guestId` → `User` for services that don't own the `User` model... actually `Booking.guestId` *does* have a relation since both live in the tourism-service schema. The point here is simpler: relations aren't required for foreign IDs, and skipping them avoids adding back-reference arrays to `Tenant`/`Hotel`/`User` that nothing will ever query. Keep it as plain `@db.ObjectId` fields.)

- [ ] **Step 4: Generate the Prisma client and push the schema**

Run from the repo root:

```bash
pnpm db:generate
```

Expected: completes with `✔ Generated Prisma Client` and no errors.

```bash
pnpm db:push
```

Expected: completes with `The database is now in sync with your Prisma schema` (or similar). This talks to the MongoDB Atlas cluster configured in `packages/database/.env` — same one already used by every other service, no new setup needed.

- [ ] **Step 5: Verify the new types exist**

```bash
grep -n "ACCOUNTANT" node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/index.d.ts | head -5
```

Expected: at least one match showing `ACCOUNTANT` inside the generated `UserRole` enum. (Exact path may vary slightly by pnpm version — if the glob doesn't match, run `find . -path "*/.prisma/client/index.d.ts" -not -path "*/node_modules/*/node_modules/*"` to locate it, or just trust step 4's success output.)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/user.types.ts packages/database/prisma/schema.prisma
git commit -m "feat(database): add ACCOUNTANT role and Expense/ExpenseCategory models"
```

---

### Task 2: Scaffold `finance-service` (boilerplate copied from `billing-service`)

**Files:**
- Create: `services/finance-service/package.json`
- Create: `services/finance-service/nest-cli.json`
- Create: `services/finance-service/tsconfig.json`
- Create: `services/finance-service/src/main.ts`
- Create: `services/finance-service/src/app.module.ts`
- Create: `services/finance-service/src/auth/auth.module.ts`
- Create: `services/finance-service/src/auth/jwt.strategy.ts`
- Create: `services/finance-service/src/auth/jwt-auth.guard.ts`
- Create: `services/finance-service/src/auth/roles.guard.ts`
- Create: `services/finance-service/src/auth/decorators/current-user.decorator.ts`
- Create: `services/finance-service/src/auth/decorators/public.decorator.ts`
- Create: `services/finance-service/src/auth/decorators/roles.decorator.ts`
- Create: `services/finance-service/src/common/prisma.service.ts`
- Create: `services/finance-service/src/health/health.controller.ts`
- Create: `services/finance-service/src/health/health.module.ts`

- [ ] **Step 1: `package.json`**

```json
{
  "name": "finance-service",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/mapped-types": "^2.1.1",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^10.3.0",
    "@prisma/client": "^6.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "@types/passport-jwt": "^4.0.1",
    "prisma": "^6.0.0",
    "ts-loader": "^9.6.2",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: `nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "extends": "../../packages/config/tsconfig/nestjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 4: `src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  const port = process.env.PORT_FINANCE_SERVICE || 3008;
  await app.listen(port);
  console.log(`[FinanceService] Running on http://localhost:${port}`);
}

bootstrap();
```

- [ ] **Step 5: `src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    HealthModule,
  ],
})
export class AppModule {}
```

(`ExpenseCategoriesModule` and `ExpensesModule` don't exist yet — they're built in Tasks 3 and 4. This file won't compile until then; that's expected and fine, we're not running the build yet.)

- [ ] **Step 6: Auth module files — copy verbatim from `billing-service`**

Create `services/finance-service/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, PassportModule, JwtStrategy, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

Create `services/finance-service/src/auth/jwt.strategy.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId?: string;
}

export interface CurrentUserDto {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserDto> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      tenantId: payload.tenantId,
    };
  }
}
```

Create `services/finance-service/src/auth/jwt-auth.guard.ts`:

```ts
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
```

Create `services/finance-service/src/auth/roles.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorators/roles.decorator';
import { CurrentUserDto } from './jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: CurrentUserDto }>();

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!requiredRoles.includes(user.role) && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
```

Create `services/finance-service/src/auth/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserDto } from '../jwt.strategy';

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserDto | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUserDto }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
```

Create `services/finance-service/src/auth/decorators/public.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Create `services/finance-service/src/auth/decorators/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 7: `src/common/prisma.service.ts`**

```ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }
}
```

- [ ] **Step 8: `src/health/health.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return {
      status: 'ok',
      service: 'finance-service',
      timestamp: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 9: `src/health/health.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 10: Create `services/finance-service/.env`**

Copy the pattern from `services/billing-service/.env` (same `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS` values — they must be identical across services or tokens won't validate). Add one line:

```bash
cp services/billing-service/.env services/finance-service/.env
```

Then edit `services/finance-service/.env` and change/add:

```
PORT_FINANCE_SERVICE=3008
```

(remove or leave the old `PORT_BILLING_SERVICE` line — it's harmless if left, but delete it for clarity since this is finance-service's own env file.)

- [ ] **Step 11: Install dependencies**

```bash
pnpm install
```

Expected: pnpm resolves the new `finance-service` workspace package (picked up automatically via the `services/*` glob in `pnpm-workspace.yaml`) with no errors.

- [ ] **Step 12: Commit**

This won't build yet (Task 3/4 modules are missing) — that's fine, commit the scaffold as-is; the next tasks complete it.

```bash
git add services/finance-service
git commit -m "feat(finance-service): scaffold service (auth, health, prisma boilerplate)"
```

---

### Task 3: Expense Categories module

**Files:**
- Create: `services/finance-service/src/expense-categories/dto/create-expense-category.dto.ts`
- Create: `services/finance-service/src/expense-categories/dto/update-expense-category.dto.ts`
- Create: `services/finance-service/src/expense-categories/expense-categories.service.ts`
- Create: `services/finance-service/src/expense-categories/expense-categories.controller.ts`
- Create: `services/finance-service/src/expense-categories/expense-categories.module.ts`

Default categories are seeded lazily: the first time a tenant calls `GET /expense-categories` and has zero categories, the service creates the default set and returns it. This avoids adding a cross-service call from `user-service`'s tenant-creation flow (no service in this codebase currently calls another service for side effects — introducing that coupling for one seed step isn't worth it).

- [ ] **Step 1: `dto/create-expense-category.dto.ts`**

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateExpenseCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
```

- [ ] **Step 2: `dto/update-expense-category.dto.ts`**

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateExpenseCategoryDto } from './create-expense-category.dto';

export class UpdateExpenseCategoryDto extends PartialType(CreateExpenseCategoryDto) {}
```

- [ ] **Step 3: `expense-categories.service.ts`**

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

const DEFAULT_CATEGORY_NAMES = [
  'Utilities',
  'Maintenance',
  'Cleaning',
  'Marketing',
  'Salaries',
  'Supplies',
  'Other',
];

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const existing = await this.prisma.expenseCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    if (existing.length > 0) {
      return existing;
    }

    await this.prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORY_NAMES.map((name) => ({
        tenantId,
        name,
        isDefault: true,
      })),
    });

    return this.prisma.expenseCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A category with this name already exists');
    }

    return this.prisma.expenseCategory.create({
      data: { tenantId, name: dto.name },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseCategoryDto) {
    const category = await this.findOwned(tenantId, id);

    return this.prisma.expenseCategory.update({
      where: { id: category.id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    const category = await this.findOwned(tenantId, id);

    const inUse = await this.prisma.expense.findFirst({
      where: { categoryId: category.id },
    });
    if (inUse) {
      throw new ConflictException(
        'This category is used by existing expenses and cannot be deleted',
      );
    }

    return this.prisma.expenseCategory.delete({ where: { id: category.id } });
  }

  private async findOwned(tenantId: string, id: string) {
    const category = await this.prisma.expenseCategory.findUnique({ where: { id } });
    if (!category || category.tenantId !== tenantId) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }
}
```

- [ ] **Step 4: `expense-categories.controller.ts`**

```ts
import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly categoriesService: ExpenseCategoriesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findAll(@CurrentUser() user: CurrentUserDto) {
    return this.categoriesService.findAll(user.tenantId);
  }

  @Post()
  @Roles('ADMIN')
  async create(
    @Body() dto: CreateExpenseCategoryDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.categoriesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.categoriesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    return this.categoriesService.remove(user.tenantId, id);
  }
}
```

- [ ] **Step 5: `expense-categories.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseCategoriesService } from './expense-categories.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [ExpenseCategoriesController],
  providers: [ExpenseCategoriesService, PrismaService],
  exports: [ExpenseCategoriesService],
})
export class ExpenseCategoriesModule {}
```

- [ ] **Step 6: Commit**

```bash
git add services/finance-service/src/expense-categories
git commit -m "feat(finance-service): add expense categories CRUD with lazy default seeding"
```

(Build verification happens at the end of Task 4, once both modules exist and `app.module.ts` compiles.)

---

### Task 4: Expenses module (CRUD + summary)

**Files:**
- Create: `services/finance-service/src/expenses/dto/create-expense.dto.ts`
- Create: `services/finance-service/src/expenses/dto/update-expense.dto.ts`
- Create: `services/finance-service/src/expenses/dto/search-expense.dto.ts`
- Create: `services/finance-service/src/expenses/expenses.service.ts`
- Create: `services/finance-service/src/expenses/expenses.controller.ts`
- Create: `services/finance-service/src/expenses/expenses.module.ts`

- [ ] **Step 1: `dto/create-expense.dto.ts`**

```ts
import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsMongoId()
  categoryId: string;

  @IsMongoId()
  @IsOptional()
  hotelId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;
}
```

- [ ] **Step 2: `dto/update-expense.dto.ts`**

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateExpenseDto } from './create-expense.dto';

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
```

- [ ] **Step 3: `dto/search-expense.dto.ts`**

```ts
import { IsInt, IsISO8601, IsMongoId, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchExpenseDto {
  @IsMongoId()
  @IsOptional()
  categoryId?: string;

  @IsMongoId()
  @IsOptional()
  hotelId?: string;

  @IsISO8601()
  @IsOptional()
  from?: string;

  @IsISO8601()
  @IsOptional()
  to?: string;

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

- [ ] **Step 4: `expenses.service.ts`**

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SearchExpenseDto } from './dto/search-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    createdById: string,
    defaultCurrency: string,
    dto: CreateExpenseDto,
  ) {
    await this.assertCategoryOwnership(tenantId, dto.categoryId);
    if (dto.hotelId) {
      await this.assertHotelOwnership(tenantId, dto.hotelId);
    }

    return this.prisma.expense.create({
      data: {
        tenantId,
        hotelId: dto.hotelId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        currency: dto.currency || defaultCurrency,
        description: dto.description,
        receiptUrl: dto.receiptUrl,
        date: new Date(dto.date),
        createdById,
      },
    });
  }

  async findAll(tenantId: string, query: SearchExpenseDto) {
    const { categoryId, hotelId, from, to, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (categoryId) where.categoryId = categoryId;
    if (hotelId) where.hotelId = hotelId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    return this.findOwned(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseDto) {
    const expense = await this.findOwned(tenantId, id);

    if (dto.categoryId) {
      await this.assertCategoryOwnership(tenantId, dto.categoryId);
    }
    if (dto.hotelId) {
      await this.assertHotelOwnership(tenantId, dto.hotelId);
    }

    return this.prisma.expense.update({
      where: { id: expense.id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.hotelId !== undefined && { hotelId: dto.hotelId }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
        ...(dto.date && { date: new Date(dto.date) }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const expense = await this.findOwned(tenantId, id);
    return this.prisma.expense.delete({ where: { id: expense.id } });
  }

  async summary(tenantId: string, month: string) {
    const [year, monthIndex] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 1));

    const expenses = await this.prisma.expense.findMany({
      where: { tenantId, date: { gte: start, lt: end } },
      select: { amount: true, categoryId: true },
    });

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const expense of expenses) {
      total += expense.amount;
      byCategory[expense.categoryId] = (byCategory[expense.categoryId] || 0) + expense.amount;
    }

    return { month, total, byCategory };
  }

  private async findOwned(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    if (expense.tenantId !== tenantId) {
      throw new ForbiddenException('You do not have access to this expense');
    }
    return expense;
  }

  private async assertCategoryOwnership(tenantId: string, categoryId: string) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.tenantId !== tenantId) {
      throw new NotFoundException('Category not found');
    }
  }

  private async assertHotelOwnership(tenantId: string, hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.tenantId !== tenantId) {
      throw new NotFoundException('Hotel not found');
    }
  }
}
```

`assertHotelOwnership` queries the `Hotel` model directly — it lives in the same shared MongoDB database/Prisma schema as `Tenant`, just normally "owned" by `tourism-service`. Reading it from `finance-service` for a same-database ownership check is consistent with how `getTenantCurrency` (Task 5) reads `Tenant` directly instead of calling `user-service` over HTTP.

`summary`'s `byCategory` keys are category IDs, not names — that matches the spec's "totals grouped by category and month" requirement; the frontend (a later task, not part of this module) resolves names via `GET /expense-categories`.

- [ ] **Step 5: `expenses.controller.ts`**

```ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SearchExpenseDto } from './dto/search-expense.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async create(@Body() dto: CreateExpenseDto, @CurrentUser() user: CurrentUserDto) {
    return this.expensesService.create(user.tenantId, user.userId, 'MAD', dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findAll(@Query() query: SearchExpenseDto, @CurrentUser() user: CurrentUserDto) {
    return this.expensesService.findAll(user.tenantId, query);
  }

  @Get('summary')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async summary(@Query('month') month: string, @CurrentUser() user: CurrentUserDto) {
    return this.expensesService.summary(user.tenantId, month);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    return this.expensesService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.expensesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    return this.expensesService.remove(user.tenantId, id);
  }
}
```

Note on Step 5's `create`: the hardcoded `'MAD'` fallback currency is a placeholder — `finance-service` doesn't currently look up the tenant's actual `currency` field (that would require either a `Tenant` Prisma relation or a call to `user-service`). This is called out explicitly in Task 5 as a known follow-up, not silently left broken.

- [ ] **Step 6: `expenses.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, PrismaService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
```

- [ ] **Step 7: Build the service**

```bash
cd services/finance-service && npx nest build && cd ../..
```

Expected: `webpack compiled successfully` or no error output, `services/finance-service/dist/main.js` exists.

- [ ] **Step 8: Commit**

```bash
git add services/finance-service/src/expenses
git commit -m "feat(finance-service): add expenses CRUD + monthly summary endpoint"
```

---

### Task 5: Look up tenant currency instead of hardcoding `'MAD'`

**Files:**
- Modify: `services/finance-service/src/expenses/expenses.controller.ts`
- Modify: `services/finance-service/src/expenses/expenses.service.ts`

The `Tenant.currency` field lives in `user-service`'s domain of the shared database. Since `finance-service` reads the *same* MongoDB database via the same shared Prisma client, it can query `Tenant` directly without an HTTP call to `user-service` — this mirrors how `tourism-service` already reads `User`/`Tenant` fields it doesn't "own" (e.g. `Booking.include: { guest: ... } }`).

- [ ] **Step 1: Add a tenant currency lookup to `expenses.service.ts`**

In `services/finance-service/src/expenses/expenses.service.ts`, add this method to the `ExpensesService` class (anywhere inside the class body, e.g. right after `create`):

```ts
  async getTenantCurrency(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { currency: true },
    });
    return tenant?.currency || 'MAD';
  }
```

- [ ] **Step 2: Use it in `create`**

Change the `create` method signature and body from:

```ts
  async create(
    tenantId: string,
    createdById: string,
    defaultCurrency: string,
    dto: CreateExpenseDto,
  ) {
    await this.assertCategoryOwnership(tenantId, dto.categoryId);
    if (dto.hotelId) {
      await this.assertHotelOwnership(tenantId, dto.hotelId);
    }

    return this.prisma.expense.create({
      data: {
        tenantId,
        hotelId: dto.hotelId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        currency: dto.currency || defaultCurrency,
```

to:

```ts
  async create(tenantId: string, createdById: string, dto: CreateExpenseDto) {
    await this.assertCategoryOwnership(tenantId, dto.categoryId);
    if (dto.hotelId) {
      await this.assertHotelOwnership(tenantId, dto.hotelId);
    }
    const currency = dto.currency || (await this.getTenantCurrency(tenantId));

    return this.prisma.expense.create({
      data: {
        tenantId,
        hotelId: dto.hotelId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        currency,
```

(the rest of the `data` object and the closing of the method are unchanged.)

- [ ] **Step 3: Update the controller call site**

In `services/finance-service/src/expenses/expenses.controller.ts`, change:

```ts
  async create(@Body() dto: CreateExpenseDto, @CurrentUser() user: CurrentUserDto) {
    return this.expensesService.create(user.tenantId, user.userId, 'MAD', dto);
  }
```

to:

```ts
  async create(@Body() dto: CreateExpenseDto, @CurrentUser() user: CurrentUserDto) {
    return this.expensesService.create(user.tenantId, user.userId, dto);
  }
```

- [ ] **Step 4: Rebuild and verify no compile errors**

```bash
cd services/finance-service && npx nest build && cd ../..
```

Expected: builds cleanly, no TypeScript errors about the changed method signature.

- [ ] **Step 5: Commit**

```bash
git add services/finance-service/src/expenses
git commit -m "fix(finance-service): use tenant's configured currency instead of hardcoded MAD"
```

---

### Task 6: Wire the API Gateway

**Files:**
- Modify: `services/gateway/src/proxy/proxy.middleware.ts`
- Modify: `services/gateway/.env` (local only, not committed if gitignored — check first)
- Modify: `.env.example`

- [ ] **Step 1: Add the route map entries**

In `services/gateway/src/proxy/proxy.middleware.ts`, the constructor currently reads:

```ts
    const billingServiceUrl =
      this.configService.get<string>('BILLING_SERVICE_URL') ||
      'http://localhost:3006';
```

Add right after it:

```ts
    const financeServiceUrl =
      this.configService.get<string>('FINANCE_SERVICE_URL') ||
      'http://localhost:3008';
```

Then in the `routeMap` object, add two lines after the `'/api/subscriptions': billingServiceUrl,` line:

```ts
      '/api/plans': billingServiceUrl,
      '/api/subscriptions': billingServiceUrl,
      '/api/expenses': financeServiceUrl,
      '/api/expense-categories': financeServiceUrl,
    };
```

- [ ] **Step 2: Check whether `services/gateway/.env` is tracked by git**

```bash
git check-ignore services/gateway/.env && echo "IGNORED" || echo "TRACKED"
```

If it prints `TRACKED`, add `FINANCE_SERVICE_URL="http://localhost:3008"` to that file manually (same style as the existing `BILLING_SERVICE_URL` line in it) — do this by hand, don't script-edit a file that may contain real secrets. If it prints `IGNORED`, skip this step; local `.env` files are per-developer and don't need a plan step.

- [ ] **Step 3: Update `.env.example`**

In `.env.example` at the repo root, find the block with:

```
PORT_BILLING_SERVICE=3006
PORT_NOTIFICATION_SERVICE=3007
```

Add a line after it:

```
PORT_FINANCE_SERVICE=3008
```

Find the block with:

```
USER_SERVICE_URL="http://user-service:3001"
TOURISM_SERVICE_URL="http://tourism-service:3002"
```

Add a line after it (matching whatever the existing pattern is for `BILLING_SERVICE_URL` if present, otherwise add both consistently):

```
FINANCE_SERVICE_URL="http://finance-service:3008"
```

- [ ] **Step 4: Register `finance-service` in the scoped production build**

In the root `package.json`, find:

```json
    "build": "turbo run build --filter=gateway --filter=user-service --filter=tourism-service --filter=billing-service --filter=tourism-app --filter=landing-page --concurrency=2",
```

Change to:

```json
    "build": "turbo run build --filter=gateway --filter=user-service --filter=tourism-service --filter=billing-service --filter=finance-service --filter=tourism-app --filter=landing-page --concurrency=2",
```

(This matters — commit `2efdbb3` explicitly scoped production builds to active services to save memory; a service left out of this list won't be built in production even though it works locally.)

- [ ] **Step 5: Commit**

```bash
git add services/gateway/src/proxy/proxy.middleware.ts .env.example package.json
git commit -m "feat(gateway): route /api/expenses and /api/expense-categories to finance-service"
```

---

### Task 7: End-to-end manual verification

No code changes — this task runs the whole stack locally and confirms the module works, following the same curl-based verification style used in the bookings tenant-scoping fix commit.

**Prerequisites:** `user-service`, `tourism-service`, `finance-service`, and `gateway` all running locally (see `PROJECT_SUMMARY.md` section 7.3 for the standard startup sequence — add `finance-service` to it the same way `tourism-service` is started: `cd services/finance-service && npx nest build --webpack && node dist/main.js`, or `npx nest start --watch` for dev).

- [ ] **Step 1: Log in as the seeded admin and capture the token**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartcity.ma","password":"Admin123!"}' | tee /tmp/login.json
```

Expected: JSON with `accessToken`. Extract it:

```bash
TOKEN=$(cat /tmp/login.json | node -pe 'JSON.parse(require("fs").readFileSync("/tmp/login.json")).accessToken')
```

- [ ] **Step 2: Fetch categories — confirm lazy default seeding**

```bash
curl -s http://localhost:3000/api/expense-categories -H "Authorization: Bearer $TOKEN" | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)), null, 2)'
```

Expected: an array of 7 categories (Utilities, Maintenance, Cleaning, Marketing, Salaries, Supplies, Other), each with an `id`.

- [ ] **Step 3: Create an expense**

```bash
CATEGORY_ID=$(curl -s http://localhost:3000/api/expense-categories -H "Authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].id')

curl -s -X POST http://localhost:3000/api/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"categoryId\":\"$CATEGORY_ID\",\"amount\":450,\"date\":\"2026-08-01\",\"description\":\"Electricity bill\"}"
```

Expected: 201 with the created expense JSON, `currency` populated (e.g. `"MAD"`), `amount: 450`.

- [ ] **Step 4: Confirm it shows up in the summary**

```bash
curl -s "http://localhost:3000/api/expenses/summary?month=2026-08" -H "Authorization: Bearer $TOKEN"
```

Expected: `{"month":"2026-08","total":450,"byCategory":{"<categoryId>":450}}`.

- [ ] **Step 5: Confirm tenant isolation**

Log in as a user belonging to a *different* tenant (or, if none exists in seed data, register one via `/api/auth/register` with a distinct `tenantId`/organization first — check `PROJECT_SUMMARY.md` section 6 for available seeded accounts). Repeat step 2 with that user's token.

Expected: a fresh set of 7 default categories, NOT the admin's categories — proving `tenantId` scoping works and confirming no data leaked across tenants.

- [ ] **Step 6: Confirm role rejection**

Log in as the seeded `guest@smartcity.ma` / `Guest123!` account (role `GUEST`) and repeat step 2.

Expected: `403 Forbidden` with a message like `Access denied. Required roles: ADMIN, MANAGER, ACCOUNTANT`.

- [ ] **Step 7: Confirm cross-tenant `hotelId` rejection**

Using the admin token from Step 1, find a hotel that belongs to a *different* tenant than `admin@smartcity.ma` (e.g. via `GET http://localhost:3000/api/hotels` and picking one whose `tenantId` differs — or use the second tenant's hotel from Step 5 if one exists). Then:

```bash
curl -s -X POST http://localhost:3000/api/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"categoryId\":\"$CATEGORY_ID\",\"hotelId\":\"<other-tenant-hotel-id>\",\"amount\":100,\"date\":\"2026-08-01\"}"
```

Expected: `404 Not Found` with `Hotel not found` — proving `assertHotelOwnership` blocks cross-tenant `hotelId` values instead of silently accepting them.

- [ ] **Step 8: Record the result**

If all checks (Steps 2–7) pass, the module is verified. No commit needed for this task (it's manual verification, not a code change) — mention the result in the PR/handoff summary instead.

---

## Explicitly out of scope for this plan (per the spec)

- Approval workflow, recurring expenses, `Purchase` linkage, and full accounting reports are deferred to later sub-projects (Stock, Purchases, Salary, Accounting) per the spec's roadmap — do not add them here.
- No frontend admin UI page (`/admin/expenses` in `tourism-app`) is included in this plan — the spec only covers the backend API. If a UI is wanted next, it needs its own plan following the pattern of `AdminBookings.tsx`/`AdminHotels.tsx`.
- Docker Compose wiring: `billing-service` itself isn't in `docker-compose.yml` either (checked — no entry exists), so `finance-service` isn't added there either, consistent with the current state of the repo.
