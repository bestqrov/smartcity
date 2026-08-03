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
