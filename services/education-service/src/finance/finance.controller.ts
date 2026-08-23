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
