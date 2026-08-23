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
