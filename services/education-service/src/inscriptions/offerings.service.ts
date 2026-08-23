import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

interface FindAllParams {
  page: number;
  limit: number;
  type?: string;
}

const INCLUDE_RELATIONS = {
  teacher: true,
} as const;

@Injectable()
export class OfferingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTeacherInTenant(tenantId: string, teacherId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
    });

    if (!teacher) {
      throw new BadRequestException('teacherId does not belong to this tenant');
    }
  }

  async create(tenantId: string, dto: CreateOfferingDto) {
    if (dto.teacherId) {
      await this.assertTeacherInTenant(tenantId, dto.teacherId);
    }

    return this.prisma.offering.create({
      data: { ...dto, tenantId },
      include: INCLUDE_RELATIONS,
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, type } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (type) where.type = type;

    const [offerings, total] = await Promise.all([
      this.prisma.offering.findMany({
        where,
        skip,
        take: limit,
        include: INCLUDE_RELATIONS,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.offering.count({ where }),
    ]);

    return {
      data: offerings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(tenantId: string, id: string, dto: UpdateOfferingDto) {
    const offering = await this.prisma.offering.findFirst({ where: { id, tenantId } });
    if (!offering) {
      throw new NotFoundException('Offering not found');
    }

    if (dto.teacherId) {
      await this.assertTeacherInTenant(tenantId, dto.teacherId);
    }

    return this.prisma.offering.update({
      where: { id },
      data: dto,
      include: INCLUDE_RELATIONS,
    });
  }
}
