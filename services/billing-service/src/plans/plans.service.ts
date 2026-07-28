import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException('A plan with this slug already exists');
    }

    return this.prisma.plan.create({ data: dto });
  }

  async findAll(includeInactive = false) {
    return this.prisma.plan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOne(id);
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.plan.update({ where: { id }, data: { isActive: false } });
  }
}
