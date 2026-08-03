import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseStatusDto } from './dto/update-purchase-status.dto';
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

  async updateStatus(
    tenantId: string,
    id: string,
    createdById: string,
    dto: UpdatePurchaseStatusDto,
  ) {
    const purchase = await this.findOwned(tenantId, id);

    if (purchase.status !== 'PENDING') {
      throw new BadRequestException(
        `Purchase is already ${purchase.status} and cannot be changed`,
      );
    }

    if (dto.status === 'CANCELLED') {
      return this.prisma.purchase.update({
        where: { id: purchase.id },
        data: { status: 'CANCELLED' },
        include: { items: true },
      });
    }

    const operations: any[] = [
      this.prisma.purchase.update({
        where: { id: purchase.id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
        include: { items: true },
      }),
      this.prisma.expense.create({
        data: {
          tenantId,
          hotelId: purchase.hotelId,
          categoryId: purchase.categoryId,
          amount: purchase.totalCost,
          currency: purchase.currency,
          description: `Purchase from ${purchase.vendorName}`,
          date: new Date(),
          createdById,
        },
      }),
    ];

    for (const item of purchase.items) {
      operations.push(
        this.prisma.stockItem.update({
          where: { id: item.stockItemId },
          data: { quantity: { increment: item.quantity } },
        }),
        this.prisma.stockMovement.create({
          data: {
            itemId: item.stockItemId,
            type: 'RESTOCK',
            quantityChange: item.quantity,
            reason: `Received purchase from ${purchase.vendorName}`,
            createdById,
          },
        }),
      );
    }

    try {
      const [updatedPurchase] = await this.prisma.$transaction(operations);
      return updatedPurchase;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          'A stock item referenced by this purchase no longer exists',
        );
      }
      throw error;
    }
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
