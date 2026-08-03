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
