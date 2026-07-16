import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { SearchHotelDto } from './dto/search-hotel.dto';

interface FindAllParams {
  page: number;
  limit: number;
  city?: string;
  type?: string;
  minRating?: number;
  maxPrice?: string;
}

@Injectable()
export class HotelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHotelDto) {
    return this.prisma.hotel.create({
      data: {
        ...dto,
        amenities: dto.amenities || [],
        images: [],
      },
    });
  }

  async findAll(params: FindAllParams) {
    const { page, limit, city, type, minRating, maxPrice } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { isActive: true };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (type) where.type = type;
    if (minRating) where.rating = { gte: minRating };
    if (maxPrice) where.priceRange = maxPrice;

    const [hotels, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              rooms: true,
              reviews: true,
              activities: true,
              restaurants: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.hotel.count({ where }),
    ]);

    return {
      data: hotels,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id },
      include: {
        rooms: {
          where: { isAvailable: true },
          orderBy: { price: 'asc' },
        },
        restaurants: {
          where: { isActive: true },
        },
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            guest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            rooms: true,
            reviews: true,
            activities: true,
            restaurants: true,
          },
        },
      },
    });

    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    return hotel;
  }

  async update(id: string, dto: UpdateHotelDto) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id } });
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    return this.prisma.hotel.update({
      where: { id },
      data: dto,
    });
  }

  async softDelete(id: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id } });
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    await this.prisma.hotel.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Hotel deactivated successfully' };
  }

  async search(query: SearchHotelDto) {
    const { q, city, type, minRating, maxPrice, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { isActive: true };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (type) where.type = type;
    if (minRating) where.rating = { gte: minRating };
    if (maxPrice) where.priceRange = maxPrice;

    const [hotels, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              rooms: true,
              reviews: true,
            },
          },
        },
        orderBy: { rating: 'desc' },
      }),
      this.prisma.hotel.count({ where }),
    ]);

    return {
      data: hotels,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findNearby(lat: number, lng: number, radiusKm: number) {
    // Fetch all active hotels and filter by distance in-memory
    // (MongoDB with Prisma doesn't support native geo queries directly)
    const allHotels = await this.prisma.hotel.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { rooms: true, reviews: true },
        },
      },
    });

    type HotelWithCount = (typeof allHotels)[number];
    type HotelWithDistance = HotelWithCount & { distance: number };

    const nearbyHotels = allHotels
      .map((hotel: HotelWithCount): HotelWithDistance => {
        const distance = this.calculateDistance(lat, lng, hotel.lat, hotel.lng);
        return { ...hotel, distance: Math.round(distance * 100) / 100 };
      })
      .filter((hotel: HotelWithDistance) => hotel.distance <= radiusKm)
      .sort((a: HotelWithDistance, b: HotelWithDistance) => a.distance - b.distance);

    return {
      data: nearbyHotels,
      meta: {
        total: nearbyHotels.length,
        center: { lat, lng },
        radiusKm,
      },
    };
  }

  /**
   * Haversine formula to calculate distance between two coordinates in km
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
