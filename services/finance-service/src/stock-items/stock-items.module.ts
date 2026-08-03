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
