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
