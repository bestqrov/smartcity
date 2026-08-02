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
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.expensesService.create(user.tenantId, user.userId, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findAll(@Query() query: SearchExpenseDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.expensesService.findAll(user.tenantId, query);
  }

  @Get('summary')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async summary(@Query('month') month: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month must be in YYYY-MM format');
    }
    return this.expensesService.summary(user.tenantId, month);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.expensesService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.expensesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.expensesService.remove(user.tenantId, id);
  }
}
