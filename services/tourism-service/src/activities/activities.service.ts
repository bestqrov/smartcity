import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { SearchActivityDto } from './dto/search-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateActivityDto, tenantId: string) {
    return this.prisma.activity.create({
      data: {
        ...dto,
        tenantId,
        images: dto.images || [],
      },
    });
  }

  async findAllPublic(page = 1, limit = 20, city?: string) {
    const skip = (page - 1) * limit;
    const where: Record<string, any> = { isAvailable: true };
    if (city) {
      where.OR = [{ city }, { hotel: { city } }];
    }

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
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
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(hotelId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: { hotelId, isAvailable: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: {
            select: { id: true, name: true, city: true },
          },
        },
      }),
      this.prisma.activity.count({ where: { hotelId, isAvailable: true } }),
    ]);

    return {
      data: activities,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const activity = await this.prisma.activity.findUnique({
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

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    return activity;
  }

  async update(id: string, dto: UpdateActivityDto) {
    await this.findById(id);

    return this.prisma.activity.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findById(id);

    await this.prisma.activity.update({
      where: { id },
      data: { isAvailable: false },
    });

    return { message: 'Activity deactivated successfully' };
  }

  async search(query: SearchActivityDto) {
    const {
      hotelId,
      tenantId,
      city,
      type,
      q,
      minPrice,
      maxPrice,
      includeInactive,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = includeInactive ? {} : { isAvailable: true };
    if (hotelId) where.hotelId = hotelId;
    if (tenantId) where.tenantId = tenantId;
    if (city) where.OR = [{ city }, { hotel: { city } }];
    if (type) where.type = type;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }
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

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
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
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
