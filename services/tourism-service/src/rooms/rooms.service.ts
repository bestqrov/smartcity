import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { SearchRoomDto } from './dto/search-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoomDto) {
    return this.prisma.room.create({
      data: {
        ...dto,
        amenities: dto.amenities || [],
        images: dto.images || [],
      },
    });
  }

  async findAll(hotelId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where: { hotelId, isAvailable: true },
        skip,
        take: limit,
        orderBy: { price: 'asc' },
        include: {
          hotel: {
            select: { id: true, name: true, city: true },
          },
        },
      }),
      this.prisma.room.count({ where: { hotelId, isAvailable: true } }),
    ]);

    return {
      data: rooms,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        hotel: {
          select: { id: true, name: true, city: true, address: true },
        },
        bookings: {
          where: {
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
            checkOut: { gte: new Date() },
          },
          select: { id: true, checkIn: true, checkOut: true, status: true },
          orderBy: { checkIn: 'asc' },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async update(id: string, dto: UpdateRoomDto) {
    await this.findById(id);

    return this.prisma.room.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findById(id);

    await this.prisma.room.delete({ where: { id } });

    return { message: 'Room deleted successfully' };
  }

  async search(query: SearchRoomDto) {
    const {
      hotelId,
      type,
      minPrice,
      maxPrice,
      capacity,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { isAvailable: true };
    if (hotelId) where.hotelId = hotelId;
    if (type) where.type = type;
    if (capacity) where.capacity = { gte: capacity };
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip,
        take: limit,
        orderBy: { price: 'asc' },
        include: {
          hotel: {
            select: { id: true, name: true, city: true },
          },
        },
      }),
      this.prisma.room.count({ where }),
    ]);

    return {
      data: rooms,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
