import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

interface FindAllParams {
  page: number;
  limit: number;
}

const INCLUDE_RELATIONS = { teacher: true, branch: true } as const;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertBranchInTenant(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new BadRequestException('branchId does not belong to this tenant');
    }
  }

  private async assertTeacherInTenant(tenantId: string, teacherId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
    });

    if (!teacher) {
      throw new BadRequestException('teacherId does not belong to this tenant');
    }
  }

  async create(tenantId: string, dto: CreateGroupDto) {
    await this.assertBranchInTenant(tenantId, dto.branchId);
    if (dto.teacherId) {
      await this.assertTeacherInTenant(tenantId, dto.teacherId);
    }

    return this.prisma.group.create({
      data: { ...dto, tenantId },
      include: INCLUDE_RELATIONS,
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = { tenantId, isActive: true };

    const [groups, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: INCLUDE_RELATIONS,
      }),
      this.prisma.group.count({ where }),
    ]);

    return {
      data: groups,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, tenantId },
      include: INCLUDE_RELATIONS,
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async update(tenantId: string, id: string, dto: UpdateGroupDto) {
    await this.findById(tenantId, id);

    if (dto.branchId) {
      await this.assertBranchInTenant(tenantId, dto.branchId);
    }
    if (dto.teacherId) {
      await this.assertTeacherInTenant(tenantId, dto.teacherId);
    }

    return this.prisma.group.update({
      where: { id },
      data: dto,
      include: INCLUDE_RELATIONS,
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    await this.prisma.group.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Group deactivated successfully' };
  }
}
