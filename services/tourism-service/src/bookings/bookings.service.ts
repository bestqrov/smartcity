import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { SearchBookingDto } from './dto/search-booking.dto';
import { BookingStatus } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBookingDto) {
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);

    if (checkIn >= checkOut) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    if (!room.isAvailable) {
      throw new BadRequestException('Room is not available for booking');
    }
    if (room.capacity < dto.guestCount) {
      throw new BadRequestException(
        `Room capacity exceeded (max ${room.capacity})`,
      );
    }

    const overlapping = await this.prisma.booking.findFirst({
      where: {
        roomId: dto.roomId,
        status: { notIn: ['CANCELLED'] },
        AND: [
          { checkIn: { lt: checkOut } },
          { checkOut: { gt: checkIn } },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'Room is already booked for the selected dates',
      );
    }

    return this.prisma.booking.create({
      data: {
        ...dto,
        checkIn,
        checkOut,
        status: 'PENDING',
      },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        hotel: {
          select: { id: true, name: true, city: true },
        },
        room: {
          select: { id: true, name: true, type: true, price: true },
        },
      },
    });
  }

  async findAll(query: SearchBookingDto) {
    const {
      guestId,
      hotelId,
      roomId,
      status,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};
    if (guestId) where.guestId = guestId;
    if (hotelId) where.hotelId = hotelId;
    if (roomId) where.roomId = roomId;
    if (status) where.status = status;

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          guest: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          hotel: {
            select: { id: true, name: true, city: true },
          },
          room: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        hotel: {
          select: { id: true, name: true, city: true, address: true },
        },
        room: {
          select: { id: true, name: true, type: true, price: true },
        },
        serviceOrders: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async update(id: string, dto: UpdateBookingDto) {
    const booking = await this.findById(id);

    const checkIn = dto.checkIn ? new Date(dto.checkIn) : booking.checkIn;
    const checkOut = dto.checkOut ? new Date(dto.checkOut) : booking.checkOut;

    if (checkIn >= checkOut) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    if (dto.roomId && dto.roomId !== booking.roomId) {
      const overlapping = await this.prisma.booking.findFirst({
        where: {
          roomId: dto.roomId,
          id: { not: id },
          status: { notIn: ['CANCELLED'] },
          AND: [
            { checkIn: { lt: checkOut } },
            { checkOut: { gt: checkIn } },
          ],
        },
      });
      if (overlapping) {
        throw new BadRequestException(
          'New room is already booked for the selected dates',
        );
      }
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        ...dto,
        checkIn,
        checkOut,
      },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        hotel: {
          select: { id: true, name: true, city: true },
        },
        room: {
          select: { id: true, name: true, type: true },
        },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    const booking = await this.findById(id);

    const validStatuses = [
      'PENDING',
      'CONFIRMED',
      'CHECKED_IN',
      'CHECKED_OUT',
      'CANCELLED',
    ];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: status as BookingStatus },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        hotel: {
          select: { id: true, name: true, city: true },
        },
        room: {
          select: { id: true, name: true, type: true },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);

    await this.prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return { message: 'Booking cancelled successfully' };
  }
}
