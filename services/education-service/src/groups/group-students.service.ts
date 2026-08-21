import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateGroupStudentDto } from './dto/create-group-student.dto';

interface FindAllParams {
  groupId?: string;
  studentId?: string;
}

@Injectable()
export class GroupStudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertGroupInTenant(tenantId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });

    if (!group) {
      throw new BadRequestException('groupId does not belong to this tenant');
    }
  }

  private async assertStudentInTenant(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });

    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }
  }

  async create(tenantId: string, dto: CreateGroupStudentDto) {
    await this.assertGroupInTenant(tenantId, dto.groupId);
    await this.assertStudentInTenant(tenantId, dto.studentId);

    const existing = await this.prisma.groupStudent.findFirst({
      where: { tenantId, groupId: dto.groupId, studentId: dto.studentId },
    });

    if (existing) {
      throw new ConflictException('This student is already enrolled in this group');
    }

    return this.prisma.groupStudent.create({
      data: { tenantId, groupId: dto.groupId, studentId: dto.studentId },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { groupId, studentId } = params;

    const where: Record<string, unknown> = { tenantId };
    if (groupId) where.groupId = groupId;
    if (studentId) where.studentId = studentId;

    return this.prisma.groupStudent.findMany({
      where,
      include: { student: true, group: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const link = await this.prisma.groupStudent.findFirst({
      where: { id, tenantId },
    });

    if (!link) {
      throw new NotFoundException('Enrollment not found');
    }

    return link;
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    await this.prisma.groupStudent.delete({ where: { id } });

    return { message: 'Student removed from group successfully' };
  }
}
