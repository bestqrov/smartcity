import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStudentGuardianDto } from './dto/create-student-guardian.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';

interface FindAllParams {
  studentId?: string;
  guardianId?: string;
}

@Injectable()
export class StudentGuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertStudentInTenant(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });

    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }
  }

  private async assertGuardianInTenant(tenantId: string, guardianId: string) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: guardianId, tenantId },
    });

    if (!guardian) {
      throw new BadRequestException('guardianId does not belong to this tenant');
    }
  }

  async create(tenantId: string, dto: CreateStudentGuardianDto) {
    await this.assertStudentInTenant(tenantId, dto.studentId);
    await this.assertGuardianInTenant(tenantId, dto.guardianId);

    const existing = await this.prisma.studentGuardian.findFirst({
      where: { tenantId, studentId: dto.studentId, guardianId: dto.guardianId },
    });

    if (existing) {
      throw new ConflictException(
        'This guardian is already linked to this student',
      );
    }

    return this.prisma.studentGuardian.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        guardianId: dto.guardianId,
        relationshipType: dto.relationshipType,
        isPrimary: dto.isPrimary ?? false,
        isEmergencyContact: dto.isEmergencyContact ?? false,
        canPickUp: dto.canPickUp ?? false,
        canCommunicate: dto.canCommunicate ?? true,
        financiallyResponsible: dto.financiallyResponsible ?? false,
      },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { studentId, guardianId } = params;

    const where: Record<string, unknown> = { tenantId };
    if (studentId) where.studentId = studentId;
    if (guardianId) where.guardianId = guardianId;

    return this.prisma.studentGuardian.findMany({
      where,
      include: { guardian: true, student: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const link = await this.prisma.studentGuardian.findFirst({
      where: { id, tenantId },
    });

    if (!link) {
      throw new NotFoundException('Relationship not found');
    }

    return link;
  }

  async update(tenantId: string, id: string, dto: UpdateStudentGuardianDto) {
    await this.findById(tenantId, id);

    return this.prisma.studentGuardian.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    await this.prisma.studentGuardian.delete({ where: { id } });

    return { message: 'Guardian detached successfully' };
  }
}
