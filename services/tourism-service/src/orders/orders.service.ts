import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SearchOrderDto } from './dto/search-order.dto';
import { OrderStatus } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto, createdById: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Cannot add order to a cancelled booking');
    }

    const operations: any[] = [
      this.prisma.serviceOrder.create({
        data: { ...dto, rating: null },
        include: {
          booking: {
            select: { id: true, status: true },
          },
        },
      }),
    ];

    if (dto.itemId) {
      const item = await this.prisma.stockItem.findUnique({
        where: { id: dto.itemId },
      });
      if (!item || item.hotelId !== booking.hotelId) {
        throw new NotFoundException('Stock item not found for this hotel');
      }

      operations.push(
        this.prisma.stockItem.update({
          where: { id: dto.itemId },
          data: { quantity: { decrement: dto.quantity } },
        }),
        this.prisma.stockMovement.create({
          data: {
            itemId: dto.itemId,
            type: 'ORDER_DEDUCTION',
            quantityChange: -dto.quantity,
            createdById,
          },
        }),
      );
    }

    try {
      const [order] = await this.prisma.$transaction(operations);
      return order;
    } catch (error) {
      if (
        dto.itemId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Stock item not found for this hotel');
      }
      throw error;
    }
  }

  async findAll(query: SearchOrderDto & { tenantId?: string }) {
    const { bookingId, status, tenantId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;
    if (tenantId) where.booking = { hotel: { tenantId } };

    const [orders, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: { id: true, status: true },
          },
        },
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return {
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            hotel: { select: { tenantId: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async update(id: string, dto: UpdateOrderDto) {
    await this.findById(id);

    return this.prisma.serviceOrder.update({
      where: { id },
      data: dto,
      include: {
        booking: {
          select: { id: true, status: true },
        },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    await this.findById(id);

    const validStatuses = ['PENDING', 'PREPARING', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: status as OrderStatus },
    });
  }

  async remove(id: string) {
    await this.findById(id);

    await this.prisma.serviceOrder.delete({ where: { id } });

    return { message: 'Order deleted successfully' };
  }

  async rate(id: string, rating: number) {
    const order = await this.findById(id);

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('You can only rate a delivered order');
    }
    if (order.rating !== null && order.rating !== undefined) {
      throw new BadRequestException('This order has already been rated');
    }
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: { rating, ratedAt: new Date() },
    });
  }
}
