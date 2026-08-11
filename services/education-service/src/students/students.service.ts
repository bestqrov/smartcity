import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

interface FindAllParams {
  page: number;
  limit: number;
  branchId?: string;
  status?: string;
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertBranchInTenant(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new BadRequestException('branchId does not belong to this tenant');
    }
  }

  async create(tenantId: string, dto: CreateStudentDto) {
    await this.assertBranchInTenant(tenantId, dto.branchId);

    const existing = await this.prisma.student.findFirst({
      where: { tenantId, registrationNumber: dto.registrationNumber },
    });

    if (existing) {
      throw new ConflictException(
        `Registration number "${dto.registrationNumber}" is already in use`,
      );
    }

    return this.prisma.student.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        registrationNumber: dto.registrationNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, branchId, status } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: students,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async update(tenantId: string, id: string, dto: UpdateStudentDto) {
    await this.findById(tenantId, id);

    if (dto.branchId) {
      await this.assertBranchInTenant(tenantId, dto.branchId);
    }

    return this.prisma.student.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async withdraw(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    return this.prisma.student.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });
  }
}
