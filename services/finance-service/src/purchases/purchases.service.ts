import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { SearchPurchaseDto } from './dto/search-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createdById: string, dto: CreatePurchaseDto) {
    await this.assertHotelOwnership(tenantId, dto.hotelId);
    await this.assertCategoryOwnership(tenantId, dto.categoryId);
    for (const item of dto.items) {
      await this.assertStockItemInHotel(tenantId, dto.hotelId, item.stockItemId);
    }

    const totalCost = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );
    const currency = await this.getTenantCurrency(tenantId);

    return this.prisma.purchase.create({
      data: {
        tenantId,
        hotelId: dto.hotelId,
        vendorName: dto.vendorName,
        categoryId: dto.categoryId,
        totalCost,
        currency,
        createdById,
        items: {
          create: dto.items.map((item) => ({
            stockItemId: item.stockItemId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      },
      include: { items: true },
    });
  }

  async findAll(tenantId: string, query: SearchPurchaseDto) {
    const { hotelId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (hotelId) where.hotelId = hotelId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    return this.findOwned(tenantId, id);
  }

  async findOwned(tenantId: string, id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    if (purchase.tenantId !== tenantId) {
      throw new ForbiddenException('You do not have access to this purchase');
    }
    return purchase;
  }

  private async assertHotelOwnership(tenantId: string, hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.tenantId !== tenantId) {
      throw new NotFoundException('Hotel not found');
    }
  }

  private async assertCategoryOwnership(tenantId: string, categoryId: string) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.tenantId !== tenantId) {
      throw new NotFoundException('Category not found');
    }
  }

  private async assertStockItemInHotel(
    tenantId: string,
    hotelId: string,
    stockItemId: string,
  ) {
    const item = await this.prisma.stockItem.findUnique({
      where: { id: stockItemId },
    });
    if (!item || item.tenantId !== tenantId || item.hotelId !== hotelId) {
      throw new NotFoundException(
        `Stock item ${stockItemId} not found for this hotel`,
      );
    }
  }

  private async getTenantCurrency(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { currency: true },
    });
    return tenant?.currency || 'MAD';
  }
}
