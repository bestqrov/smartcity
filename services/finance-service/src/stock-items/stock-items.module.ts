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
