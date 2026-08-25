import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateFormationDto } from './dto/create-formation.dto';
import { UpdateFormationDto } from './dto/update-formation.dto';

interface FindAllParams {
  page: number;
  limit: number;
}

@Injectable()
export class FormationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateFormationDto) {
    return this.prisma.formation.create({
      data: { ...dto, tenantId },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [formations, total] = await Promise.all([
      this.prisma.formation.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.formation.count({ where: { tenantId } }),
    ]);

    return {
      data: formations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(tenantId: string, id: string, dto: UpdateFormationDto) {
    const formation = await this.prisma.formation.findFirst({ where: { id, tenantId } });
    if (!formation) {
      throw new NotFoundException('Formation not found');
    }

    return this.prisma.formation.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    const formation = await this.prisma.formation.findFirst({ where: { id, tenantId } });
    if (!formation) {
      throw new NotFoundException('Formation not found');
    }

    await this.prisma.formation.delete({ where: { id } });

    return { message: 'Formation deleted successfully' };
  }

  async getAnalytics(tenantId: string) {
    const totalFormations = await this.prisma.formation.count({ where: { tenantId } });

    const totalInscriptions = await this.prisma.inscription.count({
      where: { tenantId, type: 'FORMATION' },
    });

    const revenueAgg = await this.prisma.inscription.aggregate({
      where: { tenantId, type: 'FORMATION' },
      _sum: { amount: true },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyRevenueAgg = await this.prisma.inscription.aggregate({
      where: {
        tenantId,
        type: 'FORMATION',
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    const recentInscriptions = await this.prisma.inscription.findMany({
      where: { tenantId, type: 'FORMATION' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { student: true },
    });

    return {
      totalFormations,
      totalInscriptions,
      totalRevenue: revenueAgg._sum.amount ?? 0,
      monthlyRevenue: monthlyRevenueAgg._sum.amount ?? 0,
      recentInscriptions,
    };
  }
}
