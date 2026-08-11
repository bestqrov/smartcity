import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

interface FindAllParams {
  page: number;
  limit: number;
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = { tenantId, isActive: true };

    const [branches, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return {
      data: branches,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto) {
    await this.findById(tenantId, id);

    return this.prisma.branch.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Branch deactivated successfully' };
  }
}
