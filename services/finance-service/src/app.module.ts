import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { StockItemsModule } from './stock-items/stock-items.module';
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
    StockItemsModule,
    HealthModule,
  ],
})
export class AppModule {}
