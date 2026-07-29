import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { SearchRestaurantDto } from './dto/search-restaurant.dto';

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRestaurantDto, tenantId: string) {
    return this.prisma.restaurant.create({
      data: {
        ...dto,
        tenantId,
        cuisine: dto.cuisine || [],
        images: dto.images || [],
      },
    });
  }

  async findAllPublic(page = 1, limit = 20, city?: string) {
    const skip = (page - 1) * limit;
    const where: Record<string, any> = { isActive: true };
    if (city) {
      where.OR = [{ city }, { hotel: { city } }];
    }

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: {
            select: { id: true, name: true, city: true },
          },
          tenant: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    return {
      data: restaurants,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(hotelId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where: { hotelId, isActive: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: {
            select: { id: true, name: true, city: true },
          },
        },
      }),
      this.prisma.restaurant.count({ where: { hotelId, isActive: true } }),
    ]);

    return {
      data: restaurants,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        hotel: {
          select: { id: true, name: true, city: true, address: true },
        },
        tenant: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return restaurant;
  }

  async update(id: string, dto: UpdateRestaurantDto) {
    await this.findById(id);

    return this.prisma.restaurant.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findById(id);

    await this.prisma.restaurant.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Restaurant deactivated successfully' };
  }

  async search(query: SearchRestaurantDto) {
    const { hotelId, city, q, cuisine, priceRange, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { isActive: true };
    if (hotelId) where.hotelId = hotelId;
    if (city) where.OR = [{ city }, { hotel: { city } }];
    if (cuisine) where.cuisine = { has: cuisine };
    if (priceRange) where.priceRange = priceRange;
    if (q) {
      where.AND = [
        {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: {
            select: { id: true, name: true, city: true },
          },
          tenant: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    return {
      data: restaurants,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
