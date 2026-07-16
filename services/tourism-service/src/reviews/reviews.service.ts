import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { SearchReviewDto } from './dto/search-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReviewDto) {
    const existingReview = await this.prisma.review.findFirst({
      where: { guestId: dto.guestId, hotelId: dto.hotelId },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this hotel');
    }

    const review = await this.prisma.review.create({
      data: dto,
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    await this.updateHotelRating(dto.hotelId);

    return review;
  }

  async findAll(query: SearchReviewDto) {
    const { hotelId, guestId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};
    if (hotelId) where.hotelId = hotelId;
    if (guestId) where.guestId = guestId;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          guest: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          hotel: {
            select: { id: true, name: true, city: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        hotel: {
          select: { id: true, name: true, city: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async update(id: string, dto: UpdateReviewDto) {
    const review = await this.findById(id);

    const updated = await this.prisma.review.update({
      where: { id },
      data: dto,
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    await this.updateHotelRating(review.hotelId);

    return updated;
  }

  async remove(id: string) {
    const review = await this.findById(id);

    await this.prisma.review.delete({ where: { id } });

    await this.updateHotelRating(review.hotelId);

    return { message: 'Review deleted successfully' };
  }

  private async updateHotelRating(hotelId: string) {
    const aggregate = await this.prisma.review.aggregate({
      where: { hotelId },
      _avg: { rating: true },
      _count: { id: true },
    });

    const rating = aggregate._avg.rating ?? 0;
    const reviewCount = aggregate._count.id;

    await this.prisma.hotel.update({
      where: { id: hotelId },
      data: {
        rating: Math.round(rating * 100) / 100,
        reviewCount,
      },
    });
  }
}
