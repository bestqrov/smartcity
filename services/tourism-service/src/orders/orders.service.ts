import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SearchOrderDto } from './dto/search-order.dto';
import { OrderStatus } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Cannot add order to a cancelled booking');
    }

    return this.prisma.serviceOrder.create({
      data: dto,
      include: {
        booking: {
          select: { id: true, status: true },
        },
      },
    });
  }

  async findAll(query: SearchOrderDto) {
    const { bookingId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;

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
          select: { id: true, status: true },
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
}
