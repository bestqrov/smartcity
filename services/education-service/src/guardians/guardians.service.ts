import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';

interface FindAllParams {
  page: number;
  limit: number;
}

@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateGuardianDto) {
    return this.prisma.guardian.create({
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

    const [guardians, total] = await Promise.all([
      this.prisma.guardian.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.guardian.count({ where }),
    ]);

    return {
      data: guardians,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id, tenantId },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian not found');
    }

    return guardian;
  }

  async update(tenantId: string, id: string, dto: UpdateGuardianDto) {
    await this.findById(tenantId, id);

    return this.prisma.guardian.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    await this.prisma.guardian.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Guardian deactivated successfully' };
  }

  /**
   * Students linked to this guardian, tenant-scoped through the same
   * findById ownership check used everywhere else in this service.
   */
  async findStudents(tenantId: string, guardianId: string) {
    await this.findById(tenantId, guardianId);

    const links = await this.prisma.studentGuardian.findMany({
      where: { tenantId, guardianId },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      relationship: {
        id: link.id,
        relationshipType: link.relationshipType,
        isPrimary: link.isPrimary,
        isEmergencyContact: link.isEmergencyContact,
        canPickUp: link.canPickUp,
        canCommunicate: link.canCommunicate,
        financiallyResponsible: link.financiallyResponsible,
      },
      student: link.student,
    }));
  }
}
